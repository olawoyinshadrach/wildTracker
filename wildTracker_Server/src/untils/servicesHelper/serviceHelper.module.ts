import { Module } from '@nestjs/common';
import { PrismaService } from 'src/database/database.service';
import { OtpService } from 'src/sms/OtpService.service';
import { ConfigService } from '@nestjs/config';
import { ResendModule } from 'src/sms/resend/resend.module';
import { HetznerBucketModule } from 'src/heznerBucket/heznerBucket.module';
import { CacheModule } from '@nestjs/cache-manager';
import { CacheService } from 'src/cache.service';
import { QueueModule } from '../bullProcessor/queue.module';
import { JwtModule } from '@nestjs/jwt';
import { OtpHelperService } from './otp.service';


@Module({
  imports: [
    ResendModule, 
    HetznerBucketModule, 
    CacheModule.register({ ttl: 60 * 60 }),
    QueueModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  providers: [
    PrismaService, 
    OtpService, 
    ConfigService, 
    CacheService,
    OtpHelperService,
  ],
  exports: [OtpHelperService, CacheService],
})
export class ServicesHelperModule {}
