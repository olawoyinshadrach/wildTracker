import { BadRequestException, ConflictException, Injectable, InternalServerErrorException, Logger, NotFoundException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { CacheService } from 'src/cache.service';
import { PrismaService } from 'src/database/database.service';
import { OtpService } from 'src/sms/OtpService.service';
import { QueueService } from '../bullProcessor/queue.service';

// DTOs for OTP operations
export interface VerifyEmailOtpDto {
  verification_code: string;
  email?: string; // Optional - can be retrieved from OTP
  purpose: 'password_reset';
}

export interface RequestEmailOtpDto {
  email: string;
  purpose: 'password_reset';
}

export interface OtpResponse {
  success: boolean;
  message: string;
  data?: {
    email?: string;
    userId?: string;
    tokens?: {
      accessToken?: string;
      refreshToken?: string;
    };
    otpReference?: string;
    passwordResetToken?: string;
  };
  errorCode?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class OtpHelperService {
  private readonly logger = new Logger(OtpHelperService.name);
  
  // OTP TTL configurations (in seconds)
  private readonly OTP_TTL = {
    password_reset: 900, // 15 minutes for password reset
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly otpService: OtpService,
    private readonly config: ConfigService,
    private readonly cacheService: CacheService,
    private readonly queueService: QueueService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Get email associated with an OTP
   */
  async getEmailByOtp(otp: string): Promise<string | null> {
    try {
      // Get reference for the OTP
      const reference = await this.cacheService.getCacheKey(`otp_lookup:${otp}`);
      if (!reference) {
        this.logger.warn(`No reference found for OTP: ${otp}`);
        return null;
      }

      // Get OTP details by reference
      const cached = await this.cacheService.getCacheKey(`otp:${reference}`);
      if (!cached) {
        this.logger.warn(`No cached data found for reference: ${reference}`);
        return null;
      }

      const { email, purpose, expiresAt } = JSON.parse(cached);
      
      // Check if OTP has expired
      if (Date.now() > expiresAt) {
        this.logger.warn(`OTP expired for email: ${email}`);
        await this.cleanupExpiredOtp(reference, otp);
        return null;
      }

      return email;
    } catch (error) {
      this.logger.error(`Error getting email by OTP: ${error.message}`);
      return null;
    }
  }

  /**
   * Verify email address using OTP
   */
  async verifyEmailAddressOtp(verifyOtpInput: VerifyEmailOtpDto): Promise<OtpResponse> {
    const { verification_code, email: providedEmail } = verifyOtpInput;

    try {
      // Get email by OTP (or use provided email)
      const emailFromOtp = await this.getEmailByOtp(verification_code);
      const email = providedEmail || emailFromOtp;

      if (!email) {
        throw new BadRequestException({
          message: 'OTP expired or invalid',
          errorCode: 'OTP_EXPIRED_OR_INVALID',
        });
      }

      // Verify user exists
      const user = await this.prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        throw new NotFoundException({
          message: 'User not found',
          errorCode: 'USER_NOT_FOUND',
        });
      }

      // Verify OTP with the OTP service
      const isValid = await this.otpService.verifyOtp(email, verification_code);
      
      if (!isValid) {
        throw new UnauthorizedException({
          message: 'Invalid OTP',
          errorCode: 'INVALID_OTP',
        });
      }

      // Generate password reset token (short-lived for security)
      const passwordResetToken = this.jwtService.sign(
        { 
          sub: user.id, 
          email: user.email, 
          purpose: 'password_reset' 
        },
        { expiresIn: '15m' } // Short expiry for security
      );

      // Clean up OTP after successful verification
      await this.cleanupUsedOtp(email, verification_code);

      this.logger.log(`Password reset OTP verified successfully for: ${email}`);

      return {
        success: true,
        message: 'OTP verified successfully. You can now reset your password.',
        data: {
          email,
          userId: user.id,
          passwordResetToken, // Return token for password reset
        },
      };
    } catch (error) {
      this.logger.error(`Error verifying password reset OTP: ${error.message}`);
      
      if (error instanceof BadRequestException || 
          error instanceof UnauthorizedException ||
          error instanceof NotFoundException) {
        return {
          success: false,
          message: error.message,
          errorCode: error.getResponse()['errorCode'] || 'VERIFICATION_FAILED',
        };
      }

      return {
        success: false,
        message: 'Failed to verify OTP',
        errorCode: 'INTERNAL_SERVER_ERROR',
      };
    }
  }

  /**
   * Request new OTP for email
   */
  async requestEmailOtp(requestOtpInput: RequestEmailOtpDto): Promise<OtpResponse> {
    const { email, purpose } = requestOtpInput; // purpose is always 'password_reset'

    try {
      // Check if user exists
      const user = await this.prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        throw new NotFoundException({
          message: 'No user found with the provided email',
          errorCode: 'USER_NOT_FOUND',
        });
      }

      // Check rate limiting - prevent OTP spam
      const rateLimitKey = `otp_rate_limit:${email}:${purpose}`;
      const lastRequest = await this.cacheService.getCacheKey(rateLimitKey);
      
      if (lastRequest) {
        const timeSinceLastRequest = Date.now() - parseInt(lastRequest);
        const rateLimitDelay = 60 * 1000; // 1 minute

        if (timeSinceLastRequest < rateLimitDelay) {
          const remainingTime = Math.ceil((rateLimitDelay - timeSinceLastRequest) / 1000);
          throw new BadRequestException({
            message: `Please wait ${remainingTime} seconds before requesting another OTP`,
            errorCode: 'RATE_LIMIT_EXCEEDED',
          });
        }
      }

      // Generate OTP
      const ttl = this.OTP_TTL[purpose];
      const { otp, reference } = await this.otpService.generateOtp(email, ttl);

      if (!otp) {
        throw new InternalServerErrorException({
          message: 'Failed to generate OTP',
          errorCode: 'OTP_GENERATION_FAILED',
        });
      }

      // Update the existing OTP cache entry to include purpose and additional metadata
      const existingCache = await this.cacheService.getCacheKey(`otp:${reference}`);
      if (existingCache) {
        const existingData = JSON.parse(existingCache);
        // Merge existing data with additional metadata
        await this.cacheService.setCacheKey(
          `otp:${reference}`,
          JSON.stringify({
            ...existingData,
            purpose,
            createdAt: Date.now(),
            expiresAt: Date.now() + (ttl * 1000),
          }),
          ttl
        );
      }

      // Set rate limit
      await this.cacheService.setCacheKey(rateLimitKey, Date.now().toString(), 60);

      // Add job to welcome queue for password reset
      await this.queueOtpEmail(email, otp, purpose, user.fullName);

      this.logger.log(`Password reset OTP sent successfully to ${email}`);

      return {
        success: true,
        message: `Password reset OTP sent successfully to ${email}. Please check your inbox and spam folder.`,
        data: {
          email,
          otpReference: reference,
        },
      };
    } catch (error) {
      this.logger.error(`Error requesting password reset OTP: ${error.message}`);

      if (error instanceof NotFoundException ||
          error instanceof ConflictException ||
          error instanceof BadRequestException) {
        return {
          success: false,
          message: error.message,
          errorCode: error.getResponse()['errorCode'] || 'OTP_REQUEST_FAILED',
        };
      }

      // Handle external service errors
      if (error.response?.status && error.response.status >= 500) {
        return {
          success: false,
          message: 'OTP service is temporarily unavailable',
          errorCode: 'OTP_SERVICE_UNAVAILABLE',
        };
      }

      return {
        success: false,
        message: 'Failed to send password reset OTP',
        errorCode: 'INTERNAL_SERVER_ERROR',
      };
    }
  }

  /**
   * Queue OTP email based on purpose
   */
  private async queueOtpEmail(
    email: string, 
    otp: string, 
    purpose: string, 
    fullName: string
  ): Promise<void> {
    try {
      switch (purpose) {
        case 'password_reset':
          // For password reset, use welcome queue with custom template
          await this.queueService.addWelcomeJob({
            email,
            userName: fullName,
          });
          break;
        
        default:
          // Default to welcome queue for other purposes
          await this.queueService.addWelcomeJob({
            email,
            userName: fullName,
          });
      }
    } catch (error) {
      this.logger.error(`Error queuing OTP email: ${error.message}`);
      throw error;
    }
  }


  /**
   * Clean up used OTP
   */
  private async cleanupUsedOtp(email: string, otp: string): Promise<void> {
    try {
      const reference = await this.cacheService.getCacheKey(`otp_lookup:${otp}`);
      if (reference) {
        await this.cacheService.deleteCacheKey(`otp_lookup:${otp}`);
        await this.cacheService.deleteCacheKey(`otp:${reference}`);
      }
    } catch (error) {
      this.logger.warn(`Error cleaning up used OTP: ${error.message}`);
    }
  }

  /**
   * Clean up expired OTP
   */
  private async cleanupExpiredOtp(reference: string, otp: string): Promise<void> {
    try {
      await this.cacheService.deleteCacheKey(`otp_lookup:${otp}`);
      await this.cacheService.deleteCacheKey(`otp:${reference}`);
    } catch (error) {
      this.logger.warn(`Error cleaning up expired OTP: ${error.message}`);
    }
  }

  /**
   * Validate OTP format
   */
  validateOtpFormat(otp: string): boolean {
    return /^\d{6}$/.test(otp);
  }

  /**
   * Get OTP status
   */
  async getOtpStatus(email: string, purpose: string = 'signup'): Promise<{
    canRequest: boolean;
    nextRequestIn?: number;
    message: string;
  }> {
    try {
      const rateLimitKey = `otp_rate_limit:${email}:${purpose}`;
      const lastRequest = await this.cacheService.getCacheKey(rateLimitKey);

      if (lastRequest) {
        const timeSinceLastRequest = Date.now() - parseInt(lastRequest);
        const rateLimitDelay = 60 * 1000; // 1 minute

        if (timeSinceLastRequest < rateLimitDelay) {
          const remainingTime = Math.ceil((rateLimitDelay - timeSinceLastRequest) / 1000);
          return {
            canRequest: false,
            nextRequestIn: remainingTime,
            message: `Please wait ${remainingTime} seconds before requesting another OTP`,
          };
        }
      }

      return {
        canRequest: true,
        message: 'You can request a new OTP',
      };
    } catch (error) {
      this.logger.error(`Error getting OTP status: ${error.message}`);
      return {
        canRequest: false,
        message: 'Unable to check OTP status',
      };
    }
  }
}
