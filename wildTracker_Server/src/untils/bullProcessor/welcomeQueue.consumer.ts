/* eslint-disable prettier/prettier */
import { Process, Processor } from '@nestjs/bull';
import type { Job } from 'bull';
import {
  BadRequestException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ResendService } from 'src/sms/resend/resend.service';
import { generateWelcomeTemplate, WELCOME_QUEUE } from '../constants/constant';

interface WelcomeJobData {
  email: string;
  userName?: string;
}

@Processor(WELCOME_QUEUE)
export class WelcomeQueueConsumer {
  constructor(private readonly resendService: ResendService) {}
  
  private readonly logger = new Logger(WelcomeQueueConsumer.name);

  @Process({ name: 'send-welcome', concurrency: 3 })
  async handle(job: Job<WelcomeJobData>) {
    const { email, userName } = job.data;
    const jobId = job.id?.toString();
    
    this.logger.log(
      `Running job to send Welcome email to: ${email}`,
    );

    try {
      // � Send Welcome Email
      const welcomeResponse = await this.resendService.send({
        from: process.env.WILDTRACKER_EMAIL!,
        to: email,
        subject: 'Welcome to WildTracker - Ethical Primate Tracking & Rescue',
        html: generateWelcomeTemplate(userName),
      });

      this.logger.log(`Welcome email sent successfully to ${email}`, {
        messageId: welcomeResponse?.data?.id || 'unknown',
        jobId,
      });

      console.log('Welcome New User Response:', welcomeResponse);
      
      job.progress(100);
      
      return {
        status: 'success',
        messageId: welcomeResponse?.data?.id || 'unknown',
        email,
        userName,
        processed_at: new Date().toISOString(),
      };

    } catch (error) {
      this.logger.error(
        `Failed to send Welcome email to ${email}:`,
        {
          error: error?.message || error,
          jobId,
          stack: error?.stack,
        }
      );
      
      console.error('Error occurred while sending welcome message:', error);

      // Handle different error types appropriately
      if (error instanceof NotFoundException) return error;
      if (error instanceof BadRequestException) return error;
      if (error instanceof UnauthorizedException) return error;

      // Retry server errors with exponential backoff
      if (job.attemptsMade < 3) {
        const delay = Math.pow(2, job.attemptsMade) * 1000; // 1s, 2s, 4s
        this.logger.log(`Retrying welcome email job ${jobId} in ${delay}ms (attempt ${job.attemptsMade + 1}/3)`);
        throw error; // Bull will handle retry
      }

      // Final attempt failed
      throw new InternalServerErrorException({
        message: 'Failed to send welcome email after multiple attempts',
        status: false,
        errorCode: 'WELCOME_EMAIL_SEND_FAILED',
        email,
        attempts: job.attemptsMade + 1,
      });
    }
  }
}
