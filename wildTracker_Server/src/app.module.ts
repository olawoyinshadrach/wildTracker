/* eslint-disable prettier/prettier */
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { CacheModule } from '@nestjs/cache-manager';
import { AppController } from './app.controller';
import { AppService } from './app.service';

import { PrismaModule } from './database/database.module';
import { join } from 'path';


import { ConfigModule, ConfigService } from '@nestjs/config';
import * as redisStore from 'cache-manager-redis-store';
import * as Joi from 'joi';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { JwtModule, JwtService } from '@nestjs/jwt';
import "dotenv/config";
import { ResendModule } from './sms/resend/resend.module';
import { HetznerBucketModule } from './heznerBucket/heznerBucket.module';
import config from './config';
import { QueueModule } from './untils/bullProcessor/queue.module';
import { ServicesHelperModule } from './untils/servicesHelper/serviceHelper.module';
import { CleanupModule } from './cleanup/cleanup.module';



@Module({
  imports: [
    PrismaModule,
    ScheduleModule.forRoot(),
    JwtModule.register({}),

       ConfigModule.forRoot({
      load: [config],
      isGlobal: true,
    }),
  QueueModule,
    CacheModule.register({
      ttl: 60 * 60,
      isGlobal: true,
      store: redisStore,
      url: process.env.REDIS_PUBLIC_URL,
    }),

    ResendModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        apiKey: configService.get<string>(process.env.RESEND_API_KEY!)!,
      }),
      inject: [ConfigService],
    }),
    ThrottlerModule.forRoot([{
      ttl: 900000,
      limit: 10,
    }]),
 HetznerBucketModule,
    ServicesHelperModule,
    CleanupModule

  ],
  controllers: [AppController],
  providers: [
    AppService,
  ],
})
export class AppModule {}

