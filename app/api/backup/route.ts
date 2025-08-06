import { NextRequest, NextResponse } from "next/server";
import {
  getBackupConfig,
  createBackupHistory,
  cleanupOldBackups,
  updateBackupHistory,
  getBackupHistoryByConfig,
} from "@/lib/database";
import { verifyToken } from "@/lib/auth";
import { sendBackupNotification } from "@/lib/email";

// Update the main backup function
export async function POST(request: NextRequest) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { configId } = await request.json();
    const config = getBackupConfig(configId);

    if (!config || config.user_id !== user.userId) {
      return NextResponse.json({ error: "Config not found" }, { status: 404 });
    }

    if (!config.sources || config.sources.length === 0) {
      return NextResponse.json(
        { error: "No source folders configured" },
        { status: 400 }
      );
    }

    const startTime = Date.now();
    const now = new Date();
    const dateStr = now.toISOString().split("T")[0]; // YYYY-MM-DD
    const timeStr = now.toTimeString().split(" ")[0].replace(/:/g, "-"); // HH-MM-SS
    const fileName = `backup_${config.name}_${dateStr}_${timeStr}.zip`;

    console.log(
      `[BACKUP] Starting backup for config: ${config.name} (ID: ${config.id})`
    );

    // Create backup history entry
    const historyEntry = createBackupHistory({
      config_id: configId,
      backup_date: dateStr,
      file_name: fileName,
      file_size: 0,
      onedrive_uploaded: false,
      googledrive_uploaded: false,
      status: "processing",
    });

    try {
      // Get access tokens
      const microsoftToken = await getMicrosoftAccessToken();
      const googleToken = await getGoogleAccessToken();

      // Compress multiple folders - Fixed: Use user-specific endpoint
      const sourcePaths = config.sources.map((source) => source.source_path);
      const compressedFile = await compressMultipleFolders(
        microsoftToken,
        sourcePaths
      );

      // Upload to OneDrive - Fixed: Use user-specific endpoint
      await uploadToOneDrive(
        microsoftToken,
        compressedFile,
        config.onedrive_path,
        fileName
      );

      // Upload to Google Drive
      await uploadToGoogleDrive(
        googleToken,
        compressedFile,
        config.googledrive_path,
        fileName
      );

      // Update history entry
      updateBackupHistory(historyEntry.id, {
        file_size: compressedFile.length,
        onedrive_uploaded: true,
        googledrive_uploaded: true,
        status: "completed",
      });

      // Clean up old backups
      const oldBackups = await cleanupOldBackups(
        configId,
        config.retention_days
      );

      // Delete old backup files from cloud storage
      for (const oldBackup of oldBackups) {
        try {
          await deleteFromOneDrive(
            microsoftToken,
            config.onedrive_path,
            oldBackup.file_name
          );
          await deleteFromGoogleDrive(googleToken, oldBackup.file_name);
        } catch (deleteError) {
          console.error("Error deleting old backup:", deleteError);
        }
      }

      const processingTime = Date.now() - startTime;
      console.log(
        `[BACKUP] Successfully completed backup for config: ${config.name}`
      );

      // Send success notification
      await sendBackupNotification(user.userId, "backup_success", {
        configName: config.name,
        fileName: fileName,
        fileSize: compressedFile.length,
        sourceFolders: config.sources?.length || 0,
        processingTime: processingTime,
        deletedOldBackups: oldBackups.length,
      });

      return NextResponse.json({
        success: true,
        message: `${sourcePaths.length} klasör başarıyla yedeklendi`,
        fileName,
        deletedOldBackups: oldBackups.length,
      });
    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(
        `[BACKUP] Error in backup process for config ${config.name}:`,
        error
      );

      // Update history entry with error
      await updateBackupHistory(historyEntry.id, {
        status: "failed",
        error_message: error instanceof Error ? error.message : "Unknown error",
      });

      // Send error notification
      await sendBackupNotification(user.userId, "backup_error", {
        configName: config.name,
        error: error instanceof Error ? error.message : "Unknown error",
        processingTime: processingTime,
      });

      throw error;
    }
  } catch (error) {
    console.error("Backup error:", error);
    return NextResponse.json({ error: "Backup failed" }, { status: 500 });
  }
}

// Helper functions
async function getMicrosoftAccessToken(): Promise<string> {
  const tokenUrl = `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID}/oauth2/v2.0/token`;

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID!,
      client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    }),
  });

  const data = await response.json();
  return data.access_token;
}

async function getGoogleAccessToken(): Promise<string> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN!,
      grant_type: "refresh_token",
    }),
  });

  const data = await response.json();
  return data.access_token;
}

// Fixed: Recursive folder compression with proper folder structure
async function compressMultipleFolders(
  accessToken: string,
  sourcePaths: string[]
): Promise<Buffer> {
  const JSZip = require("jszip");
  const zip = new JSZip();

  // Get target user email and user ID
  const targetUserEmail = process.env.TARGET_USER_EMAIL;
  if (!targetUserEmail) {
    throw new Error("TARGET_USER_EMAIL not configured");
  }

  const userId = await getUserIdFromEmail(accessToken, targetUserEmail);

  for (const folderPath of sourcePaths) {
    try {
      console.log(`[BACKUP] Processing folder: ${folderPath}`);
      const folderName = folderPath.split("/").pop() || "folder";

      // Create a folder in the ZIP for each source folder
      const folderInZip = zip.folder(folderName);

      // Recursively process the folder
      await processFolder(accessToken, userId, folderPath, folderInZip);
    } catch (folderError) {
      console.warn(`[BACKUP] Klasör işleme hatası: ${folderPath}`, folderError);
    }
  }

  return await zip.generateAsync({ type: "nodebuffer" });
}

// New recursive function to process folders
async function processFolder(
  accessToken: string,
  userId: string,
  folderPath: string,
  zipFolder: any
): Promise<void> {
  try {
    const graphUrl = `https://graph.microsoft.com/v1.0/users/${userId}/drive/root:${folderPath}:/children`;

    const response = await fetch(graphUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      console.warn(`[BACKUP] Klasör erişim hatası: ${folderPath}`);
      return;
    }

    const folderData = await response.json();

    for (const item of folderData.value) {
      if (item.file) {
        // It's a file - download and add to zip
        try {
          console.log(`[BACKUP] Downloading file: ${item.name}`);
          const fileResponse = await fetch(
            item["@microsoft.graph.downloadUrl"]
          );
          const fileBuffer = await fileResponse.arrayBuffer();
          zipFolder?.file(item.name, fileBuffer);
        } catch (fileError) {
          console.warn(
            `[BACKUP] Dosya indirme hatası: ${item.name}`,
            fileError
          );
        }
      } else if (item.folder) {
        // It's a folder - create subfolder in zip and process recursively
        console.log(`[BACKUP] Processing subfolder: ${item.name}`);
        const subFolderInZip = zipFolder?.folder(item.name);
        const subFolderPath = `${folderPath}/${item.name}`;

        // Recursive call for subfolder
        await processFolder(accessToken, userId, subFolderPath, subFolderInZip);
      }
    }
  } catch (error) {
    console.warn(`[BACKUP] Klasör işleme hatası: ${folderPath}`, error);
  }
}

async function uploadToOneDrive(
  accessToken: string,
  fileBuffer: Buffer,
  targetPath: string,
  fileName: string
): Promise<void> {
  // Get target user email and user ID
  const targetUserEmail = process.env.TARGET_USER_EMAIL;
  if (!targetUserEmail) {
    throw new Error("TARGET_USER_EMAIL not configured");
  }

  const userId = await getUserIdFromEmail(accessToken, targetUserEmail);

  // Fixed: Use user-specific endpoint instead of /me
  const uploadUrl = `https://graph.microsoft.com/v1.0/users/${userId}/drive/root:${targetPath}/${fileName}:/content`;

  await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/zip",
    },
    body: fileBuffer,
  });
}

async function uploadToGoogleDrive(
  accessToken: string,
  fileBuffer: Buffer,
  targetPath: string,
  fileName: string
): Promise<void> {
  const folderId = await getGoogleDriveFolderId(accessToken, targetPath);

  const metadata = {
    name: fileName,
    parents: [folderId],
  };

  const form = new FormData();
  form.append(
    "metadata",
    new Blob([JSON.stringify(metadata)], { type: "application/json" })
  );
  form.append("file", new Blob([fileBuffer], { type: "application/zip" }));

  await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    }
  );
}

async function deleteFromOneDrive(
  accessToken: string,
  folderPath: string,
  fileName: string
): Promise<void> {
  // Get target user email and user ID
  const targetUserEmail = process.env.TARGET_USER_EMAIL;
  if (!targetUserEmail) {
    throw new Error("TARGET_USER_EMAIL not configured");
  }

  const userId = await getUserIdFromEmail(accessToken, targetUserEmail);

  // Fixed: Use user-specific endpoint instead of /me
  const deleteUrl = `https://graph.microsoft.com/v1.0/users/${userId}/drive/root:${folderPath}/${fileName}`;

  await fetch(deleteUrl, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

async function deleteFromGoogleDrive(
  accessToken: string,
  fileName: string
): Promise<void> {
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=name='${fileName}'`;

  const response = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const data = await response.json();

  if (data.files && data.files.length > 0) {
    const fileId = data.files[0].id;
    await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  }
}

async function getGoogleDriveFolderId(
  accessToken: string,
  folderPath: string
): Promise<string> {
  const folderName = folderPath.split("/").pop();
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=name='${folderName}' and mimeType='application/vnd.google-apps.folder'`;

  const response = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const data = await response.json();

  if (data.files && data.files.length > 0) {
    return data.files[0].id;
  }

  // Create folder if it doesn't exist
  const createResponse = await fetch(
    "https://www.googleapis.com/drive/v3/files",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: "application/vnd.google-apps.folder",
      }),
    }
  );

  const newFolder = await createResponse.json();
  return newFolder.id;
}

// Helper function to get user ID from email
async function getUserIdFromEmail(
  accessToken: string,
  email: string
): Promise<string> {
  const userUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(
    email
  )}`;

  const response = await fetch(userUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `User not found: ${email}. Error: ${response.status} - ${errorText}`
    );
  }

  const userData = await response.json();
  return userData.id;
}
