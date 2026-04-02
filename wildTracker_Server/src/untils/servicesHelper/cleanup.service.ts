/* eslint-disable prettier/prettier */
import { Injectable, Logger } from '@nestjs/common';
import { QueueService } from '../bullProcessor/queue.service';
import { PrismaService } from '../../database/database.service';

@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);

  constructor(
    private readonly queueService: QueueService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * 🧹 MANUAL AUTH TOKEN CLEANUP - Clean specific auth tokens
   */
  async cleanupSpecificAuthTokens(tokenIds: string[], reason: 'TERMINATED' | 'EXPIRED' | 'MANUAL' = 'MANUAL'): Promise<{ success: boolean; cleanedCount: number; message: string }> {
    try {
      this.logger.log(`🔧 Starting manual cleanup for ${tokenIds.length} auth tokens...`);
      
      await this.queueService.manualAuthTokenCleanup(tokenIds, reason);
      
      return {
        success: true,
        cleanedCount: tokenIds.length,
        message: `Cleanup job queued for ${tokenIds.length} auth tokens with reason: ${reason}`,
      };
    } catch (error) {
      this.logger.error('❌ Manual auth token cleanup failed:', error);
      return {
        success: false,
        cleanedCount: 0,
        message: `Failed to queue cleanup job: ${error.message}`,
      };
    }
  }

  /**
   * 🧹 CLEANUP USER AUTH TOKENS - Clean all auth tokens for a specific user
   */
  async cleanupUserAuthTokens(userId: string, reason: 'TERMINATED' | 'EXPIRED' | 'MANUAL' = 'MANUAL'): Promise<{ success: boolean; cleanedCount: number; message: string }> {
    try {
      this.logger.log(`🔧 Starting cleanup for all auth tokens of user ${userId}...`);
      
      // Find all auth tokens for the user
      const userTokens = await this.prisma.userAuthRefreshToken.findMany({
        where: { userId },
        select: { id: true },
      });

      if (userTokens.length === 0) {
        return {
          success: true,
          cleanedCount: 0,
          message: `No auth tokens found for user ${userId}`,
        };
      }

      const tokenIds = userTokens.map(token => token.id);
      await this.queueService.manualAuthTokenCleanup(tokenIds, reason);
      
      return {
        success: true,
        cleanedCount: tokenIds.length,
        message: `Cleanup job queued for ${tokenIds.length} auth tokens of user ${userId} with reason: ${reason}`,
      };
    } catch (error) {
      this.logger.error('User auth token cleanup failed:', error);
      return {
        success: false,
        cleanedCount: 0,
        message: `Failed to queue user auth token cleanup: ${error.message}`,
      };
    }
  }

  /**
   * CLEANUP EXPIRED AUTH TOKENS - Clean all expired auth tokens
   */
  async cleanupExpiredAuthTokens(): Promise<{ success: boolean; cleanedCount: number; message: string }> {
    try {
      this.logger.log('Starting cleanup for all expired auth tokens...');
      
      // Find all expired auth tokens
      const expiredTokens = await this.prisma.userAuthRefreshToken.findMany({
        where: {
          expiresAt: { lt: new Date() },
        },
        select: { id: true },
      });

      if (expiredTokens.length === 0) {
        return {
          success: true,
          cleanedCount: 0,
          message: 'No expired auth tokens found',
        };
      }

      const tokenIds = expiredTokens.map(token => token.id);
      await this.queueService.manualAuthTokenCleanup(tokenIds, 'EXPIRED');
      
      return {
        success: true,
        cleanedCount: tokenIds.length,
        message: `Cleanup job queued for ${tokenIds.length} expired auth tokens`,
      };
    } catch (error) {
      this.logger.error('Expired auth token cleanup failed:', error);
      return {
        success: false,
        cleanedCount: 0,
        message: `Failed to queue expired auth token cleanup: ${error.message}`,
      };
    }
  }

  /**
   * GET CLEANUP STATISTICS - Get statistics for cleanup operations
   */
  async getCleanupStatistics(): Promise<{
    authTokens: { total: number; active: number; expired: number };
  }> {
    try {
      const [
        totalTokens,
        activeTokens,
        expiredTokens,
      ] = await Promise.all([
        this.prisma.userAuthRefreshToken.count(),
        this.prisma.userAuthRefreshToken.count({ 
          where: { expiresAt: { gt: new Date() } } 
        }),
        this.prisma.userAuthRefreshToken.count({ 
          where: { expiresAt: { lt: new Date() } } 
        }),
      ]);

      return {
        authTokens: {
          total: totalTokens,
          active: activeTokens,
          expired: expiredTokens,
        },
      };
    } catch (error) {
      this.logger.error('Failed to get cleanup statistics:', error);
      throw error;
    }
  }
}
