import { promises as fs } from 'fs';
import { join } from 'path';
import { getServiceLogger } from '@/log/logger';
import { settings } from '@/config/config';
import { databaseService } from '@/database/services';
import { AppError } from '@/exception/exceptions';
import { HTTP_STATUS_CODES, SUPPORTED_IMAGE_FORMATS, SUPPORTED_AUDIO_FORMATS, SUPPORTED_VIDEO_FORMATS } from '@/core/constants';
import { generateId } from '@/utils/helpers';

const logger = getServiceLogger();

export interface FileUploadRequest {
  filename: string;
  mimeType: string;
  size: number;
  buffer: Buffer;
  originalName?: string;
}

export interface FileUploadResponse {
  id: number;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  provider: string;
  uploadedAt: Date;
}

export interface FileInfo {
  id: number;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string | null;
  provider: string;
  uploadedAt: Date;
}

export class FilesService {
  private uploadDir: string;
  private maxFileSize: number = 100 * 1024 * 1024; // 100MB
  private allowedMimeTypes: string[];

  constructor() {
    this.uploadDir = join(process.cwd(), 'uploads');
    this.allowedMimeTypes = [
      ...SUPPORTED_IMAGE_FORMATS,
      ...SUPPORTED_AUDIO_FORMATS,
      ...SUPPORTED_VIDEO_FORMATS,
      'application/pdf',
      'text/plain',
      'application/json',
    ];
    this.ensureUploadDir();
  }

  private async ensureUploadDir(): Promise<void> {
    try {
      await fs.mkdir(this.uploadDir, { recursive: true });
    } catch (error) {
      logger.error('Failed to create upload directory:', error);
    }
  }

  async uploadFile(request: FileUploadRequest): Promise<FileUploadResponse> {
    try {
      // Validate file
      this.validateFile(request);

      // Generate unique filename
      const filename = this.generateFilename(request.filename);
      const filePath = join(this.uploadDir, filename);

      // Save file to disk
      await fs.writeFile(filePath, request.buffer);

      // Get file URL based on provider
      const url = await this.getFileUrl(filename);

      // Save to database
      const fileRecord = await databaseService.createFileUpload({
        filename,
        originalName: request.originalName || request.filename,
        mimeType: request.mimeType,
        size: BigInt(request.size),
        url,
        provider: settings.UPLOAD_HANDLER,
      });

      logger.info('File uploaded successfully', {
        filename,
        originalName: request.originalName,
        size: request.size,
        provider: settings.UPLOAD_HANDLER,
      });

      return {
        id: fileRecord.id,
        filename: fileRecord.filename,
        originalName: fileRecord.originalName,
        mimeType: fileRecord.mimeType,
        size: Number(fileRecord.size),
        url: fileRecord.url || '',
        provider: fileRecord.provider,
        uploadedAt: fileRecord.uploadedAt,
      };

    } catch (error) {
      logger.error('File upload failed:', error);
      throw error;
    }
  }

  async getFile(id: number): Promise<FileInfo | null> {
    try {
      const fileRecord = await databaseService.getFileUpload(id);
      
      if (!fileRecord) {
        return null;
      }

      return {
        id: fileRecord.id,
        filename: fileRecord.filename,
        originalName: fileRecord.originalName,
        mimeType: fileRecord.mimeType,
        size: Number(fileRecord.size),
        url: fileRecord.url,
        provider: fileRecord.provider,
        uploadedAt: fileRecord.uploadedAt,
      };

    } catch (error) {
      logger.error('Failed to get file:', error);
      return null;
    }
  }

  async downloadFile(id: number): Promise<Buffer | null> {
    try {
      const fileInfo = await this.getFile(id);
      
      if (!fileInfo) {
        return null;
      }

      const filePath = join(this.uploadDir, fileInfo.filename);
      return await fs.readFile(filePath);

    } catch (error) {
      logger.error('Failed to download file:', error);
      return null;
    }
  }

  async deleteFile(id: number): Promise<boolean> {
    try {
      const fileInfo = await this.getFile(id);
      
      if (!fileInfo) {
        return false;
      }

      // Delete from disk
      const filePath = join(this.uploadDir, fileInfo.filename);
      try {
        await fs.unlink(filePath);
      } catch (error) {
        logger.warn('Failed to delete file from disk:', error);
      }

      // Delete from database
      // Note: This would need to be implemented in the database service
      // await databaseService.deleteFileUpload(id);

      logger.info('File deleted successfully', { id, filename: fileInfo.filename });
      return true;

    } catch (error) {
      logger.error('Failed to delete file:', error);
      return false;
    }
  }

  async processFileForGemini(fileBuffer: Buffer, mimeType: string): Promise<{
    mimeType: string;
    data: string;
  }> {
    try {
      // Convert file to base64 for Gemini API
      const base64Data = fileBuffer.toString('base64');

      // Validate supported formats
      if (!this.isSupportedMimeType(mimeType)) {
        throw new AppError(`Unsupported file type: ${mimeType}`, HTTP_STATUS_CODES.BAD_REQUEST);
      }

      return {
        mimeType,
        data: base64Data,
      };

    } catch (error) {
      logger.error('Failed to process file for Gemini:', error);
      throw error;
    }
  }

  private validateFile(request: FileUploadRequest): void {
    // Check file size
    if (request.size > this.maxFileSize) {
      throw new AppError(
        `File size exceeds maximum limit of ${this.maxFileSize / (1024 * 1024)}MB`,
        HTTP_STATUS_CODES.BAD_REQUEST
      );
    }

    // Check MIME type
    if (!this.isSupportedMimeType(request.mimeType)) {
      throw new AppError(
        `Unsupported file type: ${request.mimeType}`,
        HTTP_STATUS_CODES.BAD_REQUEST
      );
    }

    // Check filename
    if (!request.filename || request.filename.trim() === '') {
      throw new AppError('Filename is required', HTTP_STATUS_CODES.BAD_REQUEST);
    }
  }

  private generateFilename(originalFilename: string): string {
    const timestamp = Date.now();
    const randomId = generateId();
    const extension = originalFilename.split('.').pop() || '';
    return `${timestamp}_${randomId}.${extension}`;
  }

  private async getFileUrl(filename: string): Promise<string> {
    switch (settings.UPLOAD_HANDLER) {
      case 'INTERNAL':
        return `/files/${filename}`;
      case 'SMMS':
        return await this.uploadToSMMS(filename);
      case 'PICGO':
        return await this.uploadToPicGo(filename);
      case 'CLOUDFLARE':
        return await this.uploadToCloudflare(filename);
      default:
        return `/files/${filename}`;
    }
  }

  private async uploadToSMMS(filename: string): Promise<string> {
    // TODO: Implement SMMS upload
    logger.warn('SMMS upload not implemented yet');
    return `/files/${filename}`;
  }

  private async uploadToPicGo(filename: string): Promise<string> {
    // TODO: Implement PicGo upload
    logger.warn('PicGo upload not implemented yet');
    return `/files/${filename}`;
  }

  private async uploadToCloudflare(filename: string): Promise<string> {
    // TODO: Implement Cloudflare upload
    logger.warn('Cloudflare upload not implemented yet');
    return `/files/${filename}`;
  }

  private isSupportedMimeType(mimeType: string): boolean {
    return this.allowedMimeTypes.includes(mimeType);
  }

  isImageFile(mimeType: string): boolean {
    return SUPPORTED_IMAGE_FORMATS.includes(mimeType);
  }

  isAudioFile(mimeType: string): boolean {
    return SUPPORTED_AUDIO_FORMATS.includes(mimeType);
  }

  isVideoFile(mimeType: string): boolean {
    return SUPPORTED_VIDEO_FORMATS.includes(mimeType);
  }

  async getFileStats(): Promise<{
    totalFiles: number;
    totalSize: number;
    averageSize: number;
  }> {
    try {
      // TODO: Implement file stats query
      logger.warn('File stats not implemented yet');
      return {
        totalFiles: 0,
        totalSize: 0,
        averageSize: 0,
      };
    } catch (error) {
      logger.error('Failed to get file stats:', error);
      return {
        totalFiles: 0,
        totalSize: 0,
        averageSize: 0,
      };
    }
  }
}

export const filesService = new FilesService();