import { NestFactory } from '@nestjs/core';
import { VersioningType, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';

import { validateEnv } from './common/config/env.config';

async function bootstrap() {
  const config = validateEnv();
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());

  // ============================================
  // CORS Configuration
  // ============================================
  app.enableCors({
    origin: config.FRONTEND_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });

  // ============================================
  // Global Prefix & Versioning
  // ============================================
  app.setGlobalPrefix('api');

  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // ============================================
  // Validation Pipe
  // ============================================
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip unknown properties
      forbidNonWhitelisted: true, // Throw error for unknown properties
      transform: true, // Auto-transform payloads to DTO instances
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // ============================================
  // Start Server
  // ============================================
  const port = config.PORT;
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 HCMJ Finance API running at http://0.0.0.0:${port}/api/v1`);
  console.log(`📖 Public endpoints: /api/v1/public/*`);
  console.log(`🔒 Admin endpoints: /api/v1/admin/* (requires auth)`);
  console.log(`🔑 Auth endpoints: /api/v1/auth/*`);
}
bootstrap();
