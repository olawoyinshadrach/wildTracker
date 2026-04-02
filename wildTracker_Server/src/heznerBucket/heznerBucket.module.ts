/* eslint-disable prettier/prettier */
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HetznerBucketService } from './heznerBucket.service';
import { HetznerS3ConfigProvider, HetznerS3ClientProvider } from './heznerBucket.provider';

@Module({
  imports: [ConfigModule],
  providers: [
    HetznerS3ConfigProvider,
    HetznerS3ClientProvider,
    HetznerBucketService,
  ],
  exports: [
    HetznerBucketService,
    HetznerS3ConfigProvider,
    HetznerS3ClientProvider,
  ],
})
export class HetznerBucketModule {}