/* eslint-disable prettier/prettier */
import { Controller, Post, Get, Body, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBody } from '@nestjs/swagger';
import { CleanupService } from '../untils/servicesHelper/cleanup.service';

@ApiTags('Cleanup')
@Controller('cleanup')
export class CleanupController {
  constructor(private readonly cleanupService: CleanupService) {}


  @Post('auth-tokens')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Manually cleanup specific auth tokens' })
  @ApiResponse({ status: 200, description: 'Auth token cleanup job queued successfully' })
  @ApiResponse({ status: 400, description: 'Failed to queue cleanup job' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        tokenIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of auth token IDs to cleanup',
        },
        reason: {
          type: 'string',
          enum: ['TERMINATED', 'EXPIRED', 'MANUAL'],
          description: 'Reason for cleanup',
          default: 'MANUAL',
        },
      },
      required: ['tokenIds'],
    },
  })
  async cleanupAuthTokens(
    @Body() body: { tokenIds: string[]; reason?: 'TERMINATED' | 'EXPIRED' | 'MANUAL' },
  ) {
    return await this.cleanupService.cleanupSpecificAuthTokens(
      body.tokenIds,
      body.reason || 'MANUAL',
    );
  }

  @Post('users/:userId/auth-tokens')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cleanup all auth tokens for a specific user' })
  @ApiResponse({ status: 200, description: 'User auth token cleanup job queued successfully' })
  @ApiResponse({ status: 400, description: 'Failed to queue cleanup job' })
  @ApiQuery({ name: 'userId', required: true, description: 'User ID' })
  @ApiQuery({ 
    name: 'reason', 
    required: false, 
    enum: ['TERMINATED', 'EXPIRED', 'MANUAL'],
    description: 'Reason for cleanup',
    example: 'MANUAL' 
  })
  async cleanupUserAuthTokens(
    @Query('userId') userId: string,
    @Query('reason') reason?: 'TERMINATED' | 'EXPIRED' | 'MANUAL',
  ) {
    return await this.cleanupService.cleanupUserAuthTokens(userId, reason || 'MANUAL');
  }


  @Post('auth-tokens/expired')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cleanup all expired auth tokens' })
  @ApiResponse({ status: 200, description: 'Expired auth token cleanup job queued successfully' })
  @ApiResponse({ status: 400, description: 'Failed to queue cleanup job' })
  async cleanupExpiredAuthTokens() {
    return await this.cleanupService.cleanupExpiredAuthTokens();
  }


  @Get('statistics')
  @ApiOperation({ summary: 'Get cleanup statistics for auth tokens' })
  @ApiResponse({ 
    status: 200, 
    description: 'Cleanup statistics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        authTokens: {
          type: 'object',
          properties: {
            total: { type: 'number' },
            active: { type: 'number' },
            expired: { type: 'number' },
          },
        },
      },
    },
  })
  async getCleanupStatistics() {
    return await this.cleanupService.getCleanupStatistics();
  }
}
