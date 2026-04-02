/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-inferrable-types */
/* eslint-disable prefer-const */
/* eslint-disable prettier/prettier */
import {
  Injectable,
  Inject,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  CopyObjectCommand,
  ObjectCannedACL,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import sharp from 'sharp';
import {
  HETZNER_S3_CLIENT,
  HETZNER_S3_CONFIG,
  SUPPORTED_IMAGE_TYPES,
  SUPPORTED_DOCUMENT_TYPES,
  SUPPORTED_MEDIA_TYPES,
  MAX_FILE_SIZE,
  MAX_IMAGE_SIZE,
} from './constant';
import * as heznerBucketProvider from './heznerBucket.provider';

export interface UploadResult {
  url: string;
  key: string;
  bucket: string;
  size: number;
  mimeType: string;
  originalName: string;
}

export interface FileMetadata {
  originalName: string;
  mimeType: string;
  size: number;
  uploadedAt: Date;
  folder?: string;
}

export interface UploadOptions {
  resize?: { width?: number; height?: number; quality?: number };
  generateThumbnail?: boolean;
}

@Injectable()
export class HetznerBucketService {
  constructor(
    @Inject(HETZNER_S3_CLIENT) private readonly s3Client: S3Client,
    @Inject(HETZNER_S3_CONFIG) private readonly config: heznerBucketProvider.HetznerS3Config,
  ) {}


  async uploadFile(
    file: Express.Multer.File,
    folder: string,
    options?: UploadOptions,
  ): Promise<UploadResult> {
    const uploadStartTime = Date.now();
    console.log(
      `📤 Starting upload for ${file.originalname} (${(
        file.size /
        1024 /
        1024
      ).toFixed(2)}MB)`,
    );

    try {
      this.validateFile(file);

      const fileKey = `${folder}/${this.generateUUID()}-${file.originalname}`;
      const key = fileKey;

      let fileBuffer = file.buffer;
      let finalMimeType = file.mimetype;
      const uploadCommand = new PutObjectCommand({
        Bucket: this.config.bucketName,
        Key: key,
        Body: fileBuffer,
        ContentType: finalMimeType,
        Metadata: {
          originalName: file.originalname,
          uploadedAt: new Date().toISOString(),
          folder: folder,
        },
      });

      const MAX_RETRIES = 5;
      const fileSizeMB = file.size / (1024 * 1024);

      let BASE_TIMEOUT_MS;
      if (fileSizeMB > 100) {
        BASE_TIMEOUT_MS = 3600000; 
        console.log(
          `🔥 VERY LARGE FILE DETECTED: ${fileSizeMB.toFixed(
            2,
          )}MB - Base timeout: ${BASE_TIMEOUT_MS}ms`,
        );
      } else if (fileSizeMB > 50) {
        BASE_TIMEOUT_MS = 2400000; 

        console.log(
          `🔥 LARGE FILE DETECTED: ${fileSizeMB.toFixed(
            2,
          )}MB - Base timeout: ${BASE_TIMEOUT_MS}ms`,
        );
      } else if (fileSizeMB > 20) {
        BASE_TIMEOUT_MS = 1440000; 
        console.log(
          `🔥 MEDIUM-LARGE FILE DETECTED: ${fileSizeMB.toFixed(
            2,
          )}MB - Base timeout: ${BASE_TIMEOUT_MS}ms`,
        );
      } else if (fileSizeMB > 5) {
        BASE_TIMEOUT_MS = 960000; 
      } else {
        BASE_TIMEOUT_MS = 3600000;
      }

      console.log(
        `⏱️ PROGRESSIVE TIMEOUT STRATEGY: Base ${BASE_TIMEOUT_MS}ms, scales 4x per retry`,
      );

      
      let uploadSuccessful = false;

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          
          const CURRENT_TIMEOUT_MS = BASE_TIMEOUT_MS * Math.pow(4, attempt - 1);

          console.log(
            `🔄 Upload attempt ${attempt}/${MAX_RETRIES} for ${file.originalname}`,
          );
          console.log(
            `⏱️ Timeout for this attempt: ${CURRENT_TIMEOUT_MS}ms (${(
              CURRENT_TIMEOUT_MS / 60000
            ).toFixed(1)} minutes)`,
          );

          
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(
              () =>
                reject(
                  new Error(`Upload timeout after ${CURRENT_TIMEOUT_MS}ms`),
                ),
              CURRENT_TIMEOUT_MS,
            );
          });

          await Promise.race([
            this.s3Client.send(uploadCommand),
            timeoutPromise,
          ]);

          console.log(
            `✅ Upload succeeded on attempt ${attempt} for ${file.originalname}`,
          );
          uploadSuccessful = true;
          break; 
        } catch (error) {
          const CURRENT_TIMEOUT_MS = BASE_TIMEOUT_MS * Math.pow(4, attempt - 1);
          console.warn(
            `⚠️ Upload attempt ${attempt} failed for ${file.originalname}:`,
            error.message,
          );
          console.warn(
            `⏱️ Failed with timeout: ${CURRENT_TIMEOUT_MS}ms (${(
              CURRENT_TIMEOUT_MS / 60000
            ).toFixed(1)} minutes)`,
          );

          if (attempt === MAX_RETRIES) {
            console.error(
              `❌ All ${MAX_RETRIES} upload attempts failed for ${file.originalname}`,
            );
            console.error(
              `🚫 FINAL TIMEOUT REACHED: ${CURRENT_TIMEOUT_MS}ms - NO URL WILL BE GENERATED`,
            );
            throw error;
          }

          
          const NEXT_TIMEOUT_MS = BASE_TIMEOUT_MS * Math.pow(4, attempt);
          console.log(
            `🔄 Next attempt will have ${NEXT_TIMEOUT_MS}ms timeout (${(
              NEXT_TIMEOUT_MS / 60000
            ).toFixed(1)} minutes)`,
          );

       
          const waitTime = Math.min(500 * attempt, 2000); 
          console.log(`⏳ Network retry in ${waitTime}ms...`);
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        }
      }

      if (!uploadSuccessful) {
        console.error(
          `🚫 Upload never succeeded for ${file.originalname} - this should not happen!`,
        );
        throw new InternalServerErrorException(
          'Upload failed after all retries',
        );
      }

      if (
        options?.generateThumbnail &&
        SUPPORTED_IMAGE_TYPES.includes(file.mimetype)
      ) {
        await this.generateThumbnail(file.buffer, folder, fileKey);
      }

      const url = `${this.config.endpoint}/${this.config.bucketName}/${key}`;

      try {
        const headCommand = new HeadObjectCommand({
          Bucket: this.config.bucketName,
          Key: key,
        });
        const headResult = await this.s3Client.send(headCommand);
        console.log(
          `🔍 File verification: ${file.originalname} exists, size: ${headResult.ContentLength}, type: ${headResult.ContentType}`,
        );
      } catch (verifyError) {
        console.error(
          `❌ File verification failed for ${file.originalname}:`,
          verifyError.message,
        );
        throw new InternalServerErrorException(
          `File verification failed: ${verifyError.message}`,
        );
      }

      const uploadDuration = Date.now() - uploadStartTime;
      const uploadSpeedMBps = (
        file.size /
        1024 /
        1024 /
        (uploadDuration / 1000)
      ).toFixed(2);
      console.log(
        `✅ Upload completed for ${file.originalname} in ${uploadDuration}ms (${uploadSpeedMBps} MB/s)`,
      );

      return {
        url,
        key,
        bucket: this.config.bucketName,
        size: fileBuffer.length,
        mimeType: finalMimeType,
        originalName: file.originalname,
      };
    } catch (error) {
      const uploadDuration = Date.now() - uploadStartTime;
      console.error(
        `❌ Upload failed for ${file.originalname} after ${uploadDuration}ms:`,
        error,
      );
      throw new InternalServerErrorException('Failed to upload file');
    }
  }

  async uploadMultipleFiles(
    files: Express.Multer.File[],
    folder: string = 'general',
    options?: {
      resize?: { width?: number; height?: number; quality?: number };
      generateThumbnail?: boolean;
    },
  ): Promise<UploadResult[]> {
    const uploadPromises = files.map((file) =>
      this.uploadFile(file, folder, options),
    );
    return Promise.all(uploadPromises);
  }


  async getFile(key: string): Promise<Buffer> {
    try {
      const params = {
        Bucket: this.config.bucketName,
        Key: key,
      };

      const getCommand = new GetObjectCommand(params);
      const response = await this.s3Client.send(getCommand);

      if (response.Body) {
        if (Buffer.isBuffer(response.Body)) {
          return response.Body;
        }

        const chunks: Buffer[] = [];
        const stream = response.Body as NodeJS.ReadableStream;

        return new Promise((resolve, reject) => {
          stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
          stream.on('end', () => resolve(Buffer.concat(chunks as any)));
          stream.on('error', reject);
        });
      }

      throw new NotFoundException('File body not found');
    } catch (error) {
      console.error('Error getting file from Hetzner S3:', error);
      throw new InternalServerErrorException('Failed to retrieve file');
    }
  }

  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    try {
      const params = {
        Bucket: this.config.bucketName,
        Key: key,
      };

      const getCommand = new GetObjectCommand(params);
      return await getSignedUrl(this.s3Client, getCommand, { expiresIn });
    } catch (error) {
      console.error('Error generating signed URL:', error);
      throw new InternalServerErrorException('Failed to generate signed URL');
    }
  }

  async deleteFile(key: string): Promise<boolean> {
    try {
      const params = {
        Bucket: this.config.bucketName,
        Key: key,
      };

      const deleteCommand = new DeleteObjectCommand(params);
      await this.s3Client.send(deleteCommand);

      const thumbnailKey = key.replace(/(\.[^.]+)$/, '_thumb$1');
      try {
        const thumbnailDeleteCommand = new DeleteObjectCommand({
          Bucket: this.config.bucketName,
          Key: thumbnailKey,
        });
        await this.s3Client.send(thumbnailDeleteCommand);
      } catch (thumbnailError) {

      }

      return true;
    } catch (error) {
      console.error('Error deleting file from Hetzner S3:', error);
      throw new InternalServerErrorException('Failed to delete file');
    }
  }

  async updateFile(
    oldKey: string,
    newFile: Express.Multer.File,
    folder?: string,
    options?: {
      resize?: { width?: number; height?: number; quality?: number };
      generateThumbnail?: boolean;
    },
  ): Promise<UploadResult> {
    try {

      await this.deleteFile(oldKey);

      const uploadFolder = folder || oldKey.split('/')[0];
      return await this.uploadFile(newFile, uploadFolder, options);
    } catch (error) {
      console.error('Error updating file in Hetzner S3:', error);
      throw new InternalServerErrorException('Failed to update file');
    }
  }


  async fileExists(key: string): Promise<boolean> {
    try {
      const params = {
        Bucket: this.config.bucketName,
        Key: key,
      };

      const headCommand = new HeadObjectCommand(params);
      await this.s3Client.send(headCommand);
      return true;
    } catch (error) {
      return false;
    }
  }


  async getFileMetadata(key: string): Promise<FileMetadata | null> {
    try {
      const params = {
        Bucket: this.config.bucketName,
        Key: key,
      };

      const headCommand = new HeadObjectCommand(params);
      const response = await this.s3Client.send(headCommand);

      return {
        originalName: response.Metadata?.originalName || 'unknown',
        mimeType: response.ContentType || 'application/octet-stream',
        size: response.ContentLength || 0,
        uploadedAt: response.Metadata?.uploadedAt
          ? new Date(response.Metadata.uploadedAt)
          : new Date(),
        folder: response.Metadata?.folder,
      };
    } catch (error) {
      console.error('Error getting file metadata:', error);
      return null;
    }
  }

  async copyFile(sourceKey: string, destinationKey: string): Promise<boolean> {
    try {
      const params = {
        Bucket: this.config.bucketName,
        CopySource: `${this.config.bucketName}/${sourceKey}`,
        Key: destinationKey,
      };

      const copyCommand = new CopyObjectCommand(params);
      await this.s3Client.send(copyCommand);
      return true;
    } catch (error) {
      console.error('Error copying file:', error);
      throw new InternalServerErrorException('Failed to copy file');
    }
  }

  getPublicUrl(key: string): string {
    return `${this.config.endpoint}/${this.config.bucketName}/${key}`;
  }

  extractKeyFromUrl(url: string): string | null {
    try {
      const urlParts = url.split(`${this.config.bucketName}/`);
      return urlParts.length > 1 ? urlParts[1] : null;
    } catch (error) {
      return null;
    }
  }


  private async generateThumbnail(
    buffer: Buffer,
    folder: string,
    fileName: string,
  ): Promise<void> {
    try {
      const thumbnailBuffer = await sharp(buffer)
        .resize(300, 300, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({ quality: 80 })
        .toBuffer();

      const thumbnailKey = `${folder}/${fileName.replace(
        /(\.[^.]+)$/,
        '_thumb$1',
      )}`;

      const uploadParams = {
        Bucket: this.config.bucketName,
        Key: thumbnailKey,
        Body: thumbnailBuffer,
        ContentType: 'image/jpeg',
        Metadata: {
          originalName: `thumb_${fileName}`,
          uploadedAt: new Date().toISOString(),
          folder: folder,
          isThumbnail: 'true',
        },
      };

      const thumbnailCommand = new PutObjectCommand(uploadParams);
      await this.s3Client.send(thumbnailCommand);
    } catch (error) {
      console.error('Error generating thumbnail:', error);
    }
  }


  private validateFile(file: Express.Multer.File): void {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const maxSize = SUPPORTED_IMAGE_TYPES.includes(file.mimetype)
      ? MAX_IMAGE_SIZE
      : MAX_FILE_SIZE;
    if (file.size > maxSize) {
      throw new BadRequestException(
        `File size exceeds limit of ${maxSize / (1024 * 1024)}MB`,
      );
    }

    const allSupportedTypes = [
      ...SUPPORTED_IMAGE_TYPES,
      ...SUPPORTED_DOCUMENT_TYPES,
      ...SUPPORTED_MEDIA_TYPES,
    ];

    if (!allSupportedTypes.includes(file.mimetype)) {
      throw new BadRequestException(`Unsupported file type: ${file.mimetype}`);
    }
  }

  async deleteMultipleFiles(
    keys: string[],
  ): Promise<{ success: string[]; failed: string[] }> {
    const results: { success: string[]; failed: string[] } = { success: [], failed: [] };

    for (const key of keys) {
      try {
        await this.deleteFile(key);
        results.success.push(key);
      } catch (error) {
        results.failed.push(key);
      }
    }

    return results;
  }

  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
      /[xy]/g,
      function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      },
    );
  }
}
