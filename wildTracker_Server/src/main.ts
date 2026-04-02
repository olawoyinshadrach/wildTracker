import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Request, Response, NextFunction } from 'express';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { PrismaService } from './database/database.service';
import helmet from 'helmet';
import toobusy from 'toobusy-js';
import cookieParser from 'cookie-parser';
import "dotenv/config";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.use(cookieParser());

  app.enableCors({
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
    ],
    credentials: true,
  });

  app.use(
    helmet({
      crossOriginEmbedderPolicy: false,
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          imgSrc: [
            `'self'`,
            'data:',
            'https:',
          ],
          scriptSrc: [`'self'`],
          styleSrc: [`'self'`, `'unsafe-inline'`],
          connectSrc: [`'self'`, 'https:'],
        },
      },
    }),
  );

  app.use(function (req, res, next) {
    if (toobusy()) {
      res.status(503).send("I'm busy right now, sorry.");
    } else {
      next();
    }
  });

  const prismaService = app.get(PrismaService);
  // Enable graceful shutdown
  app.enableShutdownHooks();

  // Add production error handling
  if (process.env.NODE_ENV === 'production') {
    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error);
      // Don't exit in production - log and continue
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
      // Don't exit in production - log and continue
    });
  }

  // Swagger configuration for API documentation
  const config = new DocumentBuilder()
    .setTitle('wildTracker API')
    .setDescription('The wildTracker API description')
    .setVersion('0.1')
    .addTag('wildTracker')
    .addBearerAuth()
    .addServer('http://localhost:3001')
    .addServer('https://wildTracker.devcloud.urikaa.com')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  // Start the application on the specific port
  await app.listen(process.env.PORT ?? 3001);
}

bootstrap();