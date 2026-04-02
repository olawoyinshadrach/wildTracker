/* eslint-disable prettier/prettier */
import { Module } from '@nestjs/common';
import { CleanupController } from './cleanup.controller';
import { CleanupService } from '../untils/servicesHelper/cleanup.service';
import { QueueModule } from '../untils/bullProcessor/queue.module';
import { PrismaModule } from '../database/database.module';

@Module({
  imports: [
    QueueModule,       
    PrismaModule,       
  ],
  controllers: [CleanupController],
  providers: [CleanupService],
  exports: [CleanupService],
})
export class CleanupModule {}
