/* eslint-disable prettier/prettier */
import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../../database/database.service';
import { CacheService } from '../../cache.service';
import { OLD_AUTH_TOKEN_QUEUE, OldAuthTokenJobData } from '../constants/constant';

@Processor(OLD_AUTH_TOKEN_QUEUE)
export class OldAuthTokenQueueConsumer {
  private readonly logger = new Logger(OldAuthTokenQueueConsumer.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  @Process('cleanup-auth-tokens')
  async handleAutomaticTokenCleanup(job: Job<OldAuthTokenJobData>): Promise<void> {
    this.logger.log('🔐 Starting automatic auth token cleanup process...');
    
    try {
      const { cleanupReason, cleanupDate } = job.data;
      
      const tokensToCleanup = await this.prisma.userAuthRefreshToken.findMany({
        where: {
          expiresAt: { lt: new Date() },
        },
        select: {
          id: true,
          refreshToken: true,
          userId: true,
          expiresAt: true,
        },
      });

      if (tokensToCleanup.length === 0) {
        this.logger.log('✅ No expired auth tokens to cleanup');
        return;
      }

      this.logger.log(`🔍 Found ${tokensToCleanup.length} expired auth tokens to cleanup`);

      let cleanedCount = 0;
      for (const token of tokensToCleanup) {
        try {
          await this.cacheService.deleteCacheKey(`refresh_token:${token.refreshToken}`);

          await this.prisma.userAuthRefreshToken.delete({
            where: { id: token.id },
          });

          cleanedCount++;
          this.logger.log(`🧹 Cleaned expired auth token ${token.id} for user ${token.userId} (expired: ${token.expiresAt})`);
        } catch (error) {
          this.logger.error(`❌ Failed to cleanup auth token ${token.id}:`, error);
        }
      }

      this.logger.log(`✅ Auth token cleanup completed: ${cleanedCount}/${tokensToCleanup.length} tokens cleaned`);
      
      job.progress(100);
      
    } catch (error) {
      this.logger.error('❌ Automatic auth token cleanup failed:', error);
      throw error;
    }
  }


  @Process('manual-cleanup-auth-tokens')
  async handleManualTokenCleanup(job: Job<OldAuthTokenJobData>): Promise<void> {
    this.logger.log(`🔧 Starting manual auth token cleanup for ${job.data.tokenIds.length} tokens...`);
    
    try {
      const { tokenIds, cleanupReason, cleanupDate } = job.data;
      
      let cleanedCount = 0;
      for (const tokenId of tokenIds) {
        try {
          const token = await this.prisma.userAuthRefreshToken.findUnique({
            where: { id: tokenId },
            select: {
              id: true,
              refreshToken: true,
              userId: true,
              expiresAt: true,
            },
          });

          if (!token) {
            this.logger.warn(`⚠️ Auth token ${tokenId} not found, skipping...`);
            continue;
          }

          await this.cacheService.deleteCacheKey(`refresh_token:${token.refreshToken}`);
          
          await this.prisma.userAuthRefreshToken.delete({
            where: { id: tokenId },
          });

          cleanedCount++;
          this.logger.log(`🧹 Manually cleaned auth token ${tokenId} for user ${token.userId} (${cleanupReason})`);
        } catch (error) {
          this.logger.error(`❌ Failed to manually cleanup auth token ${tokenId}:`, error);
        }
      }

      this.logger.log(`✅ Manual auth token cleanup completed: ${cleanedCount}/${tokenIds.length} tokens cleaned`);
      
      job.progress(100);
      
    } catch (error) {
      this.logger.error('❌ Manual auth token cleanup failed:', error);
      throw error;
    }
  }


  @Process('bulk-cleanup-auth-tokens')
  async handleBulkTokenCleanup(job: Job<OldAuthTokenJobData>): Promise<void> {
    this.logger.log('🧹 Starting bulk auth token cleanup process...');
    
    try {
      
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const thirtyDaysExpiredAgo = new Date();
      thirtyDaysExpiredAgo.setDate(thirtyDaysExpiredAgo.getDate() - 30);

      const oldTokens = await this.prisma.userAuthRefreshToken.findMany({
        where: {
          expiresAt: { lt: thirtyDaysExpiredAgo },
        },
        select: {
          id: true,
          refreshToken: true,
          userId: true,
          expiresAt: true,
        },
      });

      if (oldTokens.length === 0) {
        this.logger.log('✅ No old auth tokens to cleanup');
        return;
      }

      this.logger.log(`🔍 Found ${oldTokens.length} old auth tokens to cleanup (expired over 30 days ago)`);
      let cleanedCount = 0;
      for (const token of oldTokens) {
        try {
          await this.cacheService.deleteCacheKey(`refresh_token:${token.refreshToken}`);
          
          await this.prisma.userAuthRefreshToken.delete({
            where: { id: token.id },
          });

          cleanedCount++;
          this.logger.log(`🧹 Cleaned old auth token ${token.id} for user ${token.userId} (expired: ${token.expiresAt})`);
        } catch (error) {
          this.logger.error(`❌ Failed to cleanup old auth token ${token.id}:`, error);
        }
      }

      this.logger.log(`✅ Bulk auth token cleanup completed: ${cleanedCount}/${oldTokens.length} old tokens cleaned`);
      
      job.progress(100);
      
    } catch (error) {
      this.logger.error('❌ Bulk auth token cleanup failed:', error);
      throw error;
    }
  }
}
