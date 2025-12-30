import { NestFactory } from '@nestjs/core';
import { VersioningType, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ============================================
  // CORS Configuration
  // ============================================
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://finance.hcmj.org',
    'https://www.finance.hcmj.org',
  ];

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // In development, allow all localhost and 127.0.0.1 origins
      if (process.env.NODE_ENV !== 'production' && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
        return callback(null, true);
      }

      callback(new Error('Not allowed by CORS'));
    },
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
  const port = process.env.PORT ?? 3001;
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 HCMJ Finance API running at http://0.0.0.0:${port}/api/v1`);
  console.log(`📖 Public endpoints: /api/v1/public/*`);
  console.log(`🔒 Admin endpoints: /api/v1/admin/* (requires auth)`);
  console.log(`🔑 Auth endpoints: /api/v1/auth/*`);
}
bootstrap();
