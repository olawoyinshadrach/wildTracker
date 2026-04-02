/* eslint-disable prettier/prettier */
import { memoryStorage } from 'multer';
import { BadRequestException } from '@nestjs/common';
import { SUPPORTED_IMAGE_TYPES, SUPPORTED_DOCUMENT_TYPES, SUPPORTED_MEDIA_TYPES, MAX_FILE_SIZE, MAX_IMAGE_SIZE } from './constant';

export const hetznerMulterOptions = {
  storage: memoryStorage(),
  fileFilter: (req: any, file: Express.Multer.File, cb: any) => {
    const allSupportedTypes = [
      ...SUPPORTED_IMAGE_TYPES,
      ...SUPPORTED_DOCUMENT_TYPES,
      ...SUPPORTED_MEDIA_TYPES,
    ];

    if (!allSupportedTypes.includes(file.mimetype)) {
      return cb(new BadRequestException(`Unsupported file type: ${file.mimetype}`), false);
    }

    cb(null, true);
  },
  limits: {
    fileSize: MAX_FILE_SIZE, 
  },
};


export const hetznerImageMulterOptions = {
  storage: memoryStorage(),
  fileFilter: (req: any, file: Express.Multer.File, cb: any) => {
    if (!SUPPORTED_IMAGE_TYPES.includes(file.mimetype)) {
      return cb(new BadRequestException(`Only image files are allowed`), false);
    }
    cb(null, true);
  },
  limits: {
    fileSize: MAX_IMAGE_SIZE, 
  },
};

export const hetznerDocumentMulterOptions = {
  storage: memoryStorage(),
  fileFilter: (req: any, file: Express.Multer.File, cb: any) => {
    if (!SUPPORTED_DOCUMENT_TYPES.includes(file.mimetype)) {
      return cb(new BadRequestException(`Only document files are allowed`), false);
    }
    cb(null, true);
  },
  limits: {
    fileSize: MAX_FILE_SIZE, 
  },
};
