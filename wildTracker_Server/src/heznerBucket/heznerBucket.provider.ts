/* eslint-disable prettier/prettier */
import { S3Client } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';
import { HETZNER_S3_CLIENT, HETZNER_S3_CONFIG } from './constant';

export interface HetznerS3Config {
  accessKeyId: string;
  secretAccessKey: string;
  endpoint: string;
  region: string;
  bucketName: string;
}

export const HetznerS3ConfigProvider = {
  provide: HETZNER_S3_CONFIG,
  useFactory: (configService: ConfigService): HetznerS3Config => ({
    accessKeyId: configService.get<string>('WILDTRACKER_HEZNER_BUCKET_ACCESS_KEY')!,
    secretAccessKey: configService.get<string>('WILDTRACKER_HEZNER_BUCKET_SECRET_KEY')!,
    endpoint: configService.get<string>('WILDTRACKER_HEZNER_BUCKET_ENDPOINT')!,
    region: 'nbg1',
    bucketName: 'dnbwaybucket',
  }),
  inject: [ConfigService],
};

export const HetznerS3ClientProvider = {
  provide: HETZNER_S3_CLIENT,
  useFactory: (config: HetznerS3Config): S3Client => {
    return new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle: true, 
    });
  },
  inject: [HETZNER_S3_CONFIG],
};