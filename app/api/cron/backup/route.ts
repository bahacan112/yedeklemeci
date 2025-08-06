import { NextRequest, NextResponse } from "next/server";
import {
  verifyUser,
  getBackupConfigsByUser,
  createBackupHistory,
  cleanupOldBackups,
  updateBackupHistory,
} from "@/lib/database";
import { sendBackupNotification } from "@/lib/email";
import { PassThrough } from "stream";
import axios from "axios";

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

          // Compress multiple folders - returns stream
          const sourcePaths = config.sources.map(
            (source) => source.source_path
          );
          const { compressedStream, estimatedSize } =
            await compressMultipleFolders(microsoftToken, sourcePaths);

          // Create two streams for parallel upload
          const oneDriveStream = new PassThrough();
          const googleDriveStream = new PassThrough();

          // Pipe the compressed stream to both upload streams
          compressedStream.pipe(oneDriveStream);
          compressedStream.pipe(googleDriveStream);

          // Upload to both services in parallel
          const [oneDriveResult, googleDriveResult] = await Promise.all([
            uploadToOneDrive(
              microsoftToken,
              oneDriveStream,
              config.onedrive_path,
              fileName
            ),
            uploadToGoogleDrive(
              googleToken,
              googleDriveStream,
              config.googledrive_path,
              fileName
            ),
          ]);

          // Update history entry
          updateBackupHistory(historyEntry.id, {
            file_size: oneDriveResult.fileSize || estimatedSize,
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
          configResult.fileSize = oneDriveResult.fileSize || estimatedSize;
          configResult.deletedOldBackups = oldBackups.length;
          successCount++;

          console.log(
            `[CRON] Successfully completed backup for config: ${config.name}`
          );

          // Send success notification
          await sendBackupNotification(user.id, "backup_success", {
            configName: config.name,
            fileName: configResult.fileName,
            fileSize: configResult.fileSize,
            sourceFolders: config.sources?.length || 0,
            processingTime: configResult.processingTime,
            deletedOldBackups: configResult.deletedOldBackups,
          });
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
        await sendBackupNotification(user.id, "backup_error", {
          configName: config.name,
          error: configResult.error,
          processingTime: configResult.processingTime,
        });
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

// Helper functions - same as backup/route.ts
async function getMicrosoftAccessToken(): Promise<string> {
  const tokenUrl = `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID}/oauth2/v2.0/token`;

  const response = await axios.post(
    tokenUrl,
    new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID!,
      client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    }),
    {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    }
  );

  return response.data.access_token;
}

async function getGoogleAccessToken(): Promise<string> {
  const response = await axios.post(
    "https://oauth2.googleapis.com/token",
    new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN!,
      grant_type: "refresh_token",
    }),
    {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    }
  );

  return response.data.access_token;
}

// Stream-based compression with archiver for memory efficiency
async function compressMultipleFolders(
  accessToken: string,
  sourcePaths: string[]
): Promise<{ compressedStream: NodeJS.ReadableStream; estimatedSize: number }> {
  const archiver = require("archiver");

  // Get target user email and user ID
  const targetUserEmail = process.env.TARGET_USER_EMAIL;
  if (!targetUserEmail) {
    throw new Error("TARGET_USER_EMAIL not configured");
  }

  const userId = await getUserIdFromEmail(accessToken, targetUserEmail);

  // Create archive stream
  const archive = archiver("zip", {
    zlib: { level: 9 }, // Maximum compression
  });

  let estimatedSize = 0;

  // Handle archive errors
  archive.on("error", (err: Error) => {
    throw err;
  });

  // Track progress
  archive.on("progress", (progress: any) => {
    console.log(
      `[CRON] Compression progress: ${progress.entries.processed}/${progress.entries.total} files`
    );
  });

  // Process each folder
  for (const folderPath of sourcePaths) {
    try {
      console.log(`[CRON] Processing folder: ${folderPath}`);
      const folderName = folderPath.split("/").pop() || "folder";

      // Recursively add folder contents to archive
      const folderSize = await addFolderToArchive(
        accessToken,
        userId,
        folderPath,
        folderName,
        archive
      );
      estimatedSize += folderSize;
    } catch (folderError) {
      console.warn(`[CRON] Klasör işleme hatası: ${folderPath}`, folderError);
    }
  }

  // Finalize the archive
  archive.finalize();

  return { compressedStream: archive, estimatedSize };
}

// New function to add folder contents to archive recursively
async function addFolderToArchive(
  accessToken: string,
  userId: string,
  folderPath: string,
  archivePath: string,
  archive: any
): Promise<number> {
  let totalSize = 0;

  try {
    const graphUrl = `https://graph.microsoft.com/v1.0/users/${userId}/drive/root:${folderPath}:/children`;

    const response = await axios.get(graphUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    const folderData = response.data;

    for (const item of folderData.value) {
      if (item.file) {
        // It's a file - add as stream to archive
        try {
          console.log(
            `[CRON] Adding file to archive: ${item.name} (${item.size} bytes)`
          );

          // Use axios to get file stream
          const fileResponse = await axios.get(
            item["@microsoft.graph.downloadUrl"],
            {
              responseType: "stream",
            }
          );

          const filePath = `${archivePath}/${item.name}`;
          archive.append(fileResponse.data, { name: filePath });
          totalSize += item.size || 0;
        } catch (fileError) {
          console.warn(`[CRON] Dosya ekleme hatası: ${item.name}`, fileError);
        }
      } else if (item.folder) {
        // It's a folder - process recursively
        console.log(`[CRON] Processing subfolder: ${item.name}`);
        const subFolderPath = `${folderPath}/${item.name}`;
        const subArchivePath = `${archivePath}/${item.name}`;

        // Recursive call for subfolder
        const subFolderSize = await addFolderToArchive(
          accessToken,
          userId,
          subFolderPath,
          subArchivePath,
          archive
        );
        totalSize += subFolderSize;
      }
    }
  } catch (error) {
    console.warn(`[CRON] Klasör işleme hatası: ${folderPath}`, error);
  }

  return totalSize;
}

async function uploadToOneDrive(
  accessToken: string,
  fileStream: NodeJS.ReadableStream,
  targetPath: string,
  fileName: string
): Promise<{ fileSize?: number }> {
  // Get target user email and user ID
  const targetUserEmail = process.env.TARGET_USER_EMAIL;
  if (!targetUserEmail) {
    throw new Error("TARGET_USER_EMAIL not configured");
  }

  const userId = await getUserIdFromEmail(accessToken, targetUserEmail);

  // For large files, use resumable upload session
  const uploadUrl = `https://graph.microsoft.com/v1.0/users/${userId}/drive/root:${targetPath}/${fileName}:/createUploadSession`;

  try {
    // Create upload session
    const sessionResponse = await axios.post(
      uploadUrl,
      {
        item: {
          "@microsoft.graph.conflictBehavior": "replace",
        },
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    const uploadSessionUrl = sessionResponse.data.uploadUrl;

    // Upload the file stream
    const response = await axios.put(uploadSessionUrl, fileStream, {
      headers: {
        "Content-Type": "application/zip",
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total) {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          console.log(`[CRON] OneDrive upload progress: ${percentCompleted}%`);
        }
      },
    });

    return { fileSize: response.data.size };
  } catch (error) {
    console.error("[CRON] OneDrive upload error:", error);
    throw new Error(
      `OneDrive upload failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

async function uploadToGoogleDrive(
  accessToken: string,
  fileStream: NodeJS.ReadableStream,
  targetPath: string,
  fileName: string
): Promise<{ fileSize?: number }> {
  const folderId = await getGoogleDriveFolderId(accessToken, targetPath);

  try {
    // Use resumable upload for Google Drive
    const initResponse = await axios.post(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable",
      {
        name: fileName,
        parents: [folderId],
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    const uploadUrl = initResponse.headers.location;

    // Upload the file stream
    const response = await axios.put(uploadUrl, fileStream, {
      headers: {
        "Content-Type": "application/zip",
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total) {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          console.log(
            `[CRON] Google Drive upload progress: ${percentCompleted}%`
          );
        }
      },
    });

    return { fileSize: response.data.size };
  } catch (error) {
    console.error("[CRON] Google Drive upload error:", error);
    throw new Error(
      `Google Drive upload failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

async function deleteFromOneDrive(
  accessToken: string,
  folderPath: string,
  fileName: string
): Promise<void> {
  const targetUserEmail = process.env.TARGET_USER_EMAIL;
  if (!targetUserEmail) {
    throw new Error("TARGET_USER_EMAIL not configured");
  }

  const userId = await getUserIdFromEmail(accessToken, targetUserEmail);
  const deleteUrl = `https://graph.microsoft.com/v1.0/users/${userId}/drive/root:${folderPath}/${fileName}`;

  try {
    await axios.delete(deleteUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status !== 404) {
      throw error;
    }
  }
}

async function deleteFromGoogleDrive(
  accessToken: string,
  fileName: string
): Promise<void> {
  try {
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=name='${fileName}'`;

    const response = await axios.get(searchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const data = response.data;

    if (data.files && data.files.length > 0) {
      const fileId = data.files[0].id;
      await axios.delete(
        `https://www.googleapis.com/drive/v3/files/${fileId}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
    }
  } catch (error) {
    console.warn("Error deleting from Google Drive:", error);
  }
}

async function getGoogleDriveFolderId(
  accessToken: string,
  folderPath: string
): Promise<string> {
  const folderName = folderPath.split("/").pop();
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=name='${folderName}' and mimeType='application/vnd.google-apps.folder'`;

  const response = await axios.get(searchUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const data = response.data;

  if (data.files && data.files.length > 0) {
    return data.files[0].id;
  }

  // Create folder if it doesn't exist
  const createResponse = await axios.post(
    "https://www.googleapis.com/drive/v3/files",
    {
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    }
  );

  return createResponse.data.id;
}

async function getUserIdFromEmail(
  accessToken: string,
  email: string
): Promise<string> {
  const userUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(
    email
  )}`;

  const response = await axios.get(userUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  return response.data.id;
}
