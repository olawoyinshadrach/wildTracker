/* eslint-disable prettier/prettie */
import { INestApplication, Injectable, OnModuleInit, OnModuleDestroy, Logger, Global } from '@nestjs/common';
import { PrismaClient } from 'generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import "dotenv/config";


@Global()
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL!,
    });
    
    super({
      log: ['warn', 'error'],
      errorFormat: 'pretty',
      adapter,
    });
  }

  async onModuleInit() {
    try {
      this.logger.log('Connecting to database...');
      this.logger.log(`Database URL: ${process.env.DATABASE_URL?.replace(/:[^:@]*@/, ':***@')}`);
      
      await this.$connect();
      this.logger.log('Database connected successfully!');
      
      this.logger.log('Database connection established, skipping immediate test');
      

      this.startConnectionMonitoring();
    } catch (error) {
      this.logger.error('Failed to connect to database:', {
        message: error.message,
        code: error.code,
        stack: error.stack?.split('\n').slice(0, 3).join('\n')
      });
      

      if (process.env.NODE_ENV === 'production') {
        this.logger.warn('Database connection failed in production, continuing startup...');

        setTimeout(async () => {
          try {
            await this.$connect();
            this.logger.log('Background reconnection successful!');
            this.startConnectionMonitoring();
          } catch (retryError) {
            this.logger.error('Background reconnection failed:', retryError);
          }
        }, 10000);
      } else {

        this.logger.log('Attempting to reconnect in 5 seconds...');
        setTimeout(async () => {
          try {
            await this.$connect();
            this.logger.log('Reconnection successful!');
            this.startConnectionMonitoring();
          } catch (retryError) {
            this.logger.error('Reconnection failed:', retryError);
            process.exit(1);
          }
        }, 5000);
      }
    }
  }

  async onModuleDestroy() {
    try {
      this.logger.log('Disconnecting from database...');
      

      this.stopConnectionMonitoring();
      
      await this.$disconnect();
      this.logger.log('Database disconnected successfully!');
    } catch (error) {
      this.logger.error('Error disconnecting from database:', error);
    }
  }

  async enableShutdownHooks(app: INestApplication) {

  }


  async isHealthy(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      this.logger.error('Database health check failed:', error);
      return false;
    }
  }

  
  async withRetry<T>(operation: () => Promise<T>, maxRetries = 3): Promise<T> {
    let lastError: Error = new Error('Operation failed after maximum retries');
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        const errorMessage = error.message || error.toString();
        
        const isConnectionError = errorMessage.includes('ECONNRESET') || 
                                 errorMessage.includes('Connection terminated') ||
                                 errorMessage.includes('Server has closed the connection') ||
                                 errorMessage.includes('Can\'t reach database server');
        
        this.logger.warn(`Database operation failed (attempt ${attempt}/${maxRetries}): ${errorMessage}`);
        
        if (attempt < maxRetries && isConnectionError) {
          const delay = attempt === 1 ? 2000 : attempt === 2 ? 5000 : 10000;
          this.logger.log(`Waiting ${delay}ms before retry due to connection error...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          
          try {
            await this.$disconnect();
            await new Promise(resolve => setTimeout(resolve, 1000)); 
            await this.$connect();
            this.logger.log('Successfully reconnected to database');
          } catch (reconnectError) {
            this.logger.error('Failed to reconnect:', reconnectError);
          }
        } else if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt - 1) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError;
  }

  private connectionCheckInterval?: NodeJS.Timeout;

  startConnectionMonitoring() {
    setTimeout(() => {
      this.connectionCheckInterval = setInterval(async () => {
        try {
          const isHealthy = await this.isHealthy();
          if (!isHealthy) {
            this.logger.warn('Database connection unhealthy, attempting to reconnect...');
            try {
              await this.$disconnect();
              await new Promise(resolve => setTimeout(resolve, 2000));
              await this.$connect();
              this.logger.log('Database reconnection successful');
            } catch (error) {
              this.logger.error('Database reconnection failed:', error);
            }
          }
        } catch (error) {
          this.logger.warn('Health check failed:', error.message);
        }
      }, 60000); 
    }, 10000); 
  }

  stopConnectionMonitoring() {
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval);
      this.connectionCheckInterval = undefined;
    }
  }
}
