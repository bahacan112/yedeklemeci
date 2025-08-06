import { NextRequest, NextResponse } from "next/server";
import {
  verifyUser,
  getBackupConfigsByUser,
  createBackupHistory,
  cleanupOldBackups,
  updateBackupHistory,
} from "@/lib/database";
// Import the email notification function at the top
import { sendBackupNotification } from "@/lib/email";

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        {
          success: false,
          error: "Username and password are required",
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // Authenticate user
    const user = await verifyUser(username, password);
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid credentials",
          timestamp: new Date().toISOString(),
        },
        { status: 401 }
      );
    }

    console.log(`[CRON] Starting backup process for user: ${username}`);

    // Get all backup configurations for the user
    const configs = await getBackupConfigsByUser(user.id);

    if (configs.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No backup configurations found",
        user: username,
        timestamp: new Date().toISOString(),
        results: [],
      });
    }

    const results = [];
    let successCount = 0;
    let errorCount = 0;

    // Process each backup configuration
    for (const config of configs) {
      const configResult = {
        configId: config.id,
        configName: config.name,
        sourceFolders: config.sources?.length || 0,
        success: false,
        error: null as string | null,
        fileName: null as string | null,
        fileSize: null as number | null,
        deletedOldBackups: 0,
        processingTime: 0,
      };

      const startTime = Date.now();

      try {
        console.log(
          `[CRON] Processing config: ${config.name} (ID: ${config.id})`
        );

        if (!config.sources || config.sources.length === 0) {
          throw new Error("No source folders configured");
        }

        // Generate filename with timestamp
        const now = new Date();
        const dateStr = now.toISOString().split("T")[0]; // YYYY-MM-DD
        const timeStr = now.toTimeString().split(" ")[0].replace(/:/g, "-"); // HH-MM-SS
        const fileName = `backup_${config.name}_${dateStr}_${timeStr}.zip`;

        // Create backup history entry
        const historyEntry = createBackupHistory({
          config_id: config.id,
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

          // Compress multiple folders
          const sourcePaths = config.sources.map(
            (source) => source.source_path
          );
          const compressedFile = await compressMultipleFolders(
            microsoftToken,
            sourcePaths
          );

          // Upload to OneDrive
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
          const oldBackups = cleanupOldBackups(
            config.id,
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
              console.error(
                `[CRON] Error deleting old backup: ${oldBackup.file_name}`,
                deleteError
              );
            }
          }

          configResult.success = true;
          configResult.fileName = fileName;
          configResult.fileSize = compressedFile.length;
          configResult.deletedOldBackups = oldBackups.length;
          successCount++;

          console.log(
            `[CRON] Successfully completed backup for config: ${config.name}`
          );

          // Send success notification
          if (configResult.success) {
            // Send success notification
            await sendBackupNotification(user.id, "backup_success", {
              configName: config.name,
              fileName: configResult.fileName,
              fileSize: configResult.fileSize,
              sourceFolders: config.sources?.length || 0,
              processingTime: configResult.processingTime,
              deletedOldBackups: configResult.deletedOldBackups,
            });
          }
        } catch (backupError) {
          // Update history entry with error
          updateBackupHistory(historyEntry.id, {
            status: "failed",
            error_message:
              backupError instanceof Error
                ? backupError.message
                : "Unknown error",
          });
          throw backupError;
        }
      } catch (error) {
        configResult.error =
          error instanceof Error ? error.message : "Unknown error";
        errorCount++;
        console.error(`[CRON] Error processing config ${config.name}:`, error);

        // Send error notification
        if (configResult.error) {
          // Send error notification
          await sendBackupNotification(user.id, "backup_error", {
            configName: config.name,
            error: configResult.error,
            processingTime: configResult.processingTime,
          });
        }
      }

      configResult.processingTime = Date.now() - startTime;
      results.push(configResult);
    }

    const totalTime = results.reduce(
      (sum, result) => sum + result.processingTime,
      0
    );

    console.log(
      `[CRON] Backup process completed for user: ${username}. Success: ${successCount}, Errors: ${errorCount}`
    );

    // Send summary notification
    await sendBackupNotification(user.id, "backup_summary", {
      totalConfigs: configs.length,
      successCount,
      errorCount,
      totalProcessingTime: totalTime,
      results,
    });

    return NextResponse.json({
      success: errorCount === 0,
      message: `Processed ${configs.length} configurations. Success: ${successCount}, Errors: ${errorCount}`,
      user: username,
      timestamp: new Date().toISOString(),
      summary: {
        totalConfigs: configs.length,
        successCount,
        errorCount,
        totalProcessingTime: totalTime,
      },
      results,
    });
  } catch (error) {
    console.error("[CRON] Backup process failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// Helper functions (same as in backup/route.ts)
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

  if (!response.ok) {
    throw new Error("Microsoft token alınamadı");
  }

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

  if (!response.ok) {
    throw new Error("Google token alınamadı");
  }

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
      console.log(`[CRON] Processing folder: ${folderPath}`);
      const folderName = folderPath.split("/").pop() || "folder";

      // Create a folder in the ZIP for each source folder
      const folderInZip = zip.folder(folderName);

      // Recursively process the folder
      await processFolder(accessToken, userId, folderPath, folderInZip);
    } catch (folderError) {
      console.warn(`[CRON] Klasör işleme hatası: ${folderPath}`, folderError);
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
      console.warn(`[CRON] Klasör erişim hatası: ${folderPath}`);
      return;
    }

    const folderData = await response.json();

    for (const item of folderData.value) {
      if (item.file) {
        // It's a file - download and add to zip
        try {
          console.log(`[CRON] Downloading file: ${item.name}`);
          const fileResponse = await fetch(
            item["@microsoft.graph.downloadUrl"]
          );
          const fileBuffer = await fileResponse.arrayBuffer();
          zipFolder?.file(item.name, fileBuffer);
        } catch (fileError) {
          console.warn(`[CRON] Dosya indirme hatası: ${item.name}`, fileError);
        }
      } else if (item.folder) {
        // It's a folder - create subfolder in zip and process recursively
        console.log(`[CRON] Processing subfolder: ${item.name}`);
        const subFolderInZip = zipFolder?.folder(item.name);
        const subFolderPath = `${folderPath}/${item.name}`;

        // Recursive call for subfolder
        await processFolder(accessToken, userId, subFolderPath, subFolderInZip);
      }
    }
  } catch (error) {
    console.warn(`[CRON] Klasör işleme hatası: ${folderPath}`, error);
  }
}

// Helper function to get user ID from email (add this if not exists)
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

async function uploadToOneDrive(
  accessToken: string,
  fileBuffer: Buffer,
  targetPath: string,
  fileName: string
): Promise<void> {
  const uploadUrl = `https://graph.microsoft.com/v1.0/me/drive/root:${targetPath}/${fileName}:/content`;

  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/zip",
    },
    body: fileBuffer,
  });

  if (!response.ok) {
    throw new Error(`OneDrive upload failed: ${response.statusText}`);
  }
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

  const response = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    }
  );

  if (!response.ok) {
    throw new Error(`Google Drive upload failed: ${response.statusText}`);
  }
}

async function deleteFromOneDrive(
  accessToken: string,
  folderPath: string,
  fileName: string
): Promise<void> {
  const deleteUrl = `https://graph.microsoft.com/v1.0/me/drive/root:${folderPath}/${fileName}`;

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
