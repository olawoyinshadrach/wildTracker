/* eslint-disable prettier/prettier */
import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as crypto from 'crypto';
import { CacheService } from 'src/cache.service';


@Injectable()
export class OtpService {
  private readonly maxAttempts = 5;
  private readonly ttlSeconds = 240; 
  private readonly attemptWindow = 240; 

  constructor(private cacheService: CacheService) {}


  async generateOtp(
    email: string,
    ttlSeconds = this.ttlSeconds,
  ): Promise<{ otp: string; reference: string }> {
    try {
     
      const otp = Math.floor(10000 + Math.random() * 90000).toString();
      const reference = randomUUID();

      await Promise.all([
        this.cacheService.setCacheKey(
          `otp:${reference}`,
          JSON.stringify({ otp, email }),
          ttlSeconds,
        ),
        this.cacheService.setCacheKey(
          `otp_lookup:${otp}`,
          reference,
          ttlSeconds,
        ),
        this.cacheService.setCacheKey(
          `otp_attempts:${reference}`,
          '0',
          ttlSeconds,
        ), 
      ]);

      return { otp, reference };
    } catch (error) {
      throw new ServiceUnavailableException({
        message:
          'OTP service is temporarily unavailable, please try again later.',
        status: false,
        errorCode: 'OTP_SERVICE_UNAVAILABLE',
      });
    }
  }

  private timingSafeEqual(a: string, b: string): boolean {
    const buffA = Buffer.from(a);
    const buffB = Buffer.from(b);

    if (buffA.length !== buffB.length) return false;
    return crypto.timingSafeEqual(buffA, buffB);
  }

  async verifyOtp(email: string, inputOtp: string): Promise<boolean> {
    const reference = await this.cacheService.getCacheKey(
      `otp_lookup:${inputOtp}`,
    );

    if (!reference) {
      throw new BadRequestException('OTP expired or invalid');
    }

    const cached = await this.cacheService.getCacheKey(`otp:${reference}`);
    if (!cached) throw new BadRequestException('OTP expired or invalid');

    const { otp, email: storedemail } = JSON.parse(cached);

    if (storedemail !== email) {
      throw new UnauthorizedException('Invalid OTP for this user');
    }

    const attemptCountStr = await this.cacheService.getCacheKey(
      `otp_attempts:${reference}`,
    );
    const attemptCount = attemptCountStr ? parseInt(attemptCountStr, 10) : 0;

    if (attemptCount >= this.maxAttempts) {
      await Promise.all([
        this.cacheService.deleteCacheKey(`otp:${reference}`),
        this.cacheService.deleteCacheKey(`otp_lookup:${inputOtp}`),
        this.cacheService.deleteCacheKey(`otp_attempts:${reference}`),
      ]);
      throw new BadRequestException(
        'Too many attempts, please request a new OTP',
      );
    }

    if (!this.timingSafeEqual(otp, inputOtp)) {
      await this.cacheService.setCacheKey(
        `otp_attempts:${reference}`,
        (attemptCount + 1).toString(),
        this.attemptWindow,
      );
      throw new UnauthorizedException('Invalid OTP');
    }

    await Promise.all([
      this.cacheService.deleteCacheKey(`otp:${reference}`),
      this.cacheService.deleteCacheKey(`otp_lookup:${inputOtp}`),
      this.cacheService.deleteCacheKey(`otp_attempts:${reference}`),
    ]);

    return true;
  }
}
