/* eslint-disable prettier/prettier */
export const HETZNER_S3_CONFIG = 'HETZNER_S3_CONFIG';
export const HETZNER_S3_CLIENT = 'HETZNER_S3_CLIENT';

export const HETZNER_BUCKET_NAME = 'dnbway-storage';

export const SUPPORTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
];

export const SUPPORTED_DOCUMENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
];

export const SUPPORTED_MEDIA_TYPES = [
  'video/mp4',
  'video/mpeg',
  'video/quicktime',
  'video/x-msvideo',
  'audio/mpeg',
  'audio/ogg',
  'audio/wav', 
  'audio/x-wav', 
  'audio/wave',
];

export const MAX_FILE_SIZE = 300 * 1024 * 1024; 
export const MAX_IMAGE_SIZE = 50 * 1024 * 1024; 
