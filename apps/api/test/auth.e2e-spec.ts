import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Authentication & Authorization (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Public Routes', () => {
    it('/api/v1 (GET) - should return hello message', () => {
      return request(app.getHttpServer())
        .get('/api/v1')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('message');
          expect(res.body).toHaveProperty('version', 'v1');
        });
    });

    it('/api/v1/public/health (GET) - should return health status', () => {
      return request(app.getHttpServer())
        .get('/api/v1/public/health')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('status', 'healthy');
        });
    });

    it('/api/v1/public/info (GET) - should return church info without auth', () => {
      return request(app.getHttpServer())
        .get('/api/v1/public/info')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('name');
          expect(res.body).toHaveProperty('currency', 'JPY');
        });
    });
  });

  describe('Protected Admin Routes', () => {
    it('/api/v1/admin/dashboard (GET) - should return 401 without token', () => {
      return request(app.getHttpServer())
        .get('/api/v1/admin/dashboard')
        .expect(401);
    });

    it('/api/v1/admin/finances (GET) - should return 401 without token', () => {
      return request(app.getHttpServer())
        .get('/api/v1/admin/finances')
        .expect(401);
    });

    it('/api/v1/admin/settings (GET) - should return 401 without token', () => {
      return request(app.getHttpServer())
        .get('/api/v1/admin/settings')
        .expect(401);
    });

    it('/api/v1/admin/audit (GET) - should return 401 without token', () => {
      return request(app.getHttpServer())
        .get('/api/v1/admin/audit')
        .expect(401);
    });
  });

  describe('Auth Endpoints', () => {
    it('/api/v1/auth/me (GET) - should return 401 without token', () => {
      return request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .expect(401);
    });

    it('/api/v1/auth/login (POST) - should validate input', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'invalid', password: 'short' })
        .expect(400);
    });
  });
});
