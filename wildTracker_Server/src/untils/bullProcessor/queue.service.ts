/* eslint-disable prettier/prettier */
import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue, Job } from 'bull';
import { OLD_AUTH_TOKEN_QUEUE, WELCOME_QUEUE, OldAuthTokenJobData } from '../constants/constant';
import { Cron, CronExpression } from '@nestjs/schedule';

export interface WelcomeJobData {
  email: string;
  userName?: string;
}

// Job interfaces are now exported from constants/constant.ts

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @InjectQueue(WELCOME_QUEUE)
    private readonly welcomeQueue: Queue,

    @InjectQueue(OLD_AUTH_TOKEN_QUEUE)
    private readonly oldAuthTokenQueue: Queue,
  ) {}

  /**
   * Add welcome email job
   */
  async addWelcomeJob(data: WelcomeJobData): Promise<{ jobId: string; status: string }> {
    const jobId = `welcome_${data.email}_${Date.now()}`;
    
    const job = await this.welcomeQueue.add(
      'send-welcome',
      data,
      {
        priority: 7, // Medium priority for welcome emails
        removeOnComplete: 25, // Keep for audit
        removeOnFail: 10,
        jobId: jobId,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      }
    );

    this.logger.log(`Added welcome email job ${job.id} for ${data.email}`);
    
    return {
      jobId: job.id?.toString() || 'unknown',
      status: 'queued',
    };
  }


  /**
   * Get job status by ID
   */
  async getJobStatus(queueName: string, jobId: string): Promise<any> {
    let queue: Queue;
    
    switch (queueName) {
      case WELCOME_QUEUE:
        queue = this.welcomeQueue;
        break;
      case OLD_AUTH_TOKEN_QUEUE:
        queue = this.oldAuthTokenQueue;
        break;
      default:
        throw new Error(`Unknown queue: ${queueName}`);
    }

    const job = await queue.getJob(jobId);
    if (!job) {
      return { status: 'not_found' };
    }

    const state = await job.getState();
    const progress = job.progress();

    return {
      id: job.id,
      status: state,
      progress,
      data: job.data,
      timestamp: job.timestamp,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
      attemptsMade: job.attemptsMade,
      failedReason: job.failedReason,
    };
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(queueName: string): Promise<any> {
    let queue: Queue;
    
    switch (queueName) {
      case WELCOME_QUEUE:
        queue = this.welcomeQueue;
        break;
      case OLD_AUTH_TOKEN_QUEUE:
        queue = this.oldAuthTokenQueue;
        break;
      default:
        throw new Error(`Unknown queue: ${queueName}`);
    }

    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaiting(),
      queue.getActive(),
      queue.getCompleted(),
      queue.getFailed(),
      queue.getDelayed(),
    ]);

    return {
      queueName,
      counts: {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
        delayed: delayed.length,
      },
      total: waiting.length + active.length + completed.length + failed.length + delayed.length,
    };
  }

  /**
   * Clean up old jobs (manual)
   */
  async cleanQueue(queueName: string, grace: number = 24 * 60 * 60 * 1000): Promise<void> {
    let queue: Queue;
    
    switch (queueName) {
      case WELCOME_QUEUE:
        queue = this.welcomeQueue;
        break;
      case OLD_AUTH_TOKEN_QUEUE:
        queue = this.oldAuthTokenQueue;
        break;
      default:
        throw new Error(`Unknown queue: ${queueName}`);
    }

    await queue.clean(grace, 'completed');
    await queue.clean(grace, 'failed');
    
    this.logger.log(`Cleaned up old jobs in queue ${queueName}`);
  }

  /**
   * 🤖 AUTOMATIC CLEANUP - Runs every day at 2 AM
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async automaticCleanup(): Promise<void> {
    this.logger.log('🧹 Starting automatic queue cleanup...');
    
    try {
      // Clean welcome queue (keep jobs for 24 hours)
      await this.cleanQueue(WELCOME_QUEUE, 24 * 60 * 60 * 1000);
      
      this.logger.log('✅ Automatic queue cleanup completed successfully');
    } catch (error) {
      this.logger.error('❌ Automatic queue cleanup failed:', error);
    }
  }

 
  @Cron(CronExpression.EVERY_HOUR)
  async hourlyCleanup(): Promise<void> {
    this.logger.log('🕐 Starting hourly queue cleanup...');
    
    try {
      await this.cleanQueue(WELCOME_QUEUE, 60 * 60 * 1000);
      
      this.logger.log('✅ Hourly queue cleanup completed');
    } catch (error) {
      this.logger.error('❌ Hourly queue cleanup failed:', error);
    }
  }


  @Cron('0 */4 * * *') // Every 4 hours at minute 0
  async authTokenCleanup(): Promise<void> {
    this.logger.log('🔐 Starting automatic auth token cleanup...');
    
    try {
      const jobData: OldAuthTokenJobData = {
        tokenIds: [], 
        cleanupReason: 'EXPIRED',
        cleanupDate: new Date(),
      };
      
      await this.oldAuthTokenQueue.add('cleanup-auth-tokens', jobData, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      });
      
      this.logger.log('✅ Auth token cleanup job added to queue');
    } catch (error) {
      this.logger.error('❌ Auth token cleanup failed:', error);
    }
  }

 
  async manualAuthTokenCleanup(tokenIds: string[], reason: 'TERMINATED' | 'EXPIRED' | 'MANUAL' = 'MANUAL'): Promise<void> {
    this.logger.log(`🔧 Starting manual auth token cleanup for ${tokenIds.length} tokens...`);
    
    try {
      const jobData: OldAuthTokenJobData = {
        tokenIds,
        cleanupReason: reason,
        cleanupDate: new Date(),
      };
      
      await this.oldAuthTokenQueue.add('manual-cleanup-auth-tokens', jobData, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        priority: 10,
      });
      
      this.logger.log(`✅ Manual auth token cleanup job added for ${tokenIds.length} tokens`);
    } catch (error) {
      this.logger.error('❌ Manual auth token cleanup failed:', error);
    }
  }
}
