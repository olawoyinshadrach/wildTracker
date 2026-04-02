import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { CacheModule } from '@nestjs/cache-manager';
import { QueueService } from './queue.service';
import { WelcomeQueueConsumer } from './welcomeQueue.consumer';
import { OldAuthTokenQueueConsumer } from './oldAuthTokenQueue.consumer';
import { CacheService } from '../../cache.service';
import { OLD_AUTH_TOKEN_QUEUE, WELCOME_QUEUE} from '../constants/constant';

@Module({
  imports: [
    BullModule.forRoot({
      redis: {
        host: process.env.REDISHOST,
        port: Number(process.env.REDISPORT),
        password: process.env.REDIS_PASSWORD,
      },
    }),
    CacheModule.register(),
    BullModule.registerQueue(
      { name: WELCOME_QUEUE },
      { name: OLD_AUTH_TOKEN_QUEUE }
    ),
  ],
  providers: [
    QueueService,
    CacheService,
    WelcomeQueueConsumer,
    OldAuthTokenQueueConsumer
  ],
  exports: [QueueService, CacheService],
})
export class QueueModule {}
