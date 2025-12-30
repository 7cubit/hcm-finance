import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Income Module (e2e)', () => {
  let app: INestApplication;
  let authToken: string;
  let generalFundId: string;
  let buildingFundId: string;
  let accountId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    // Login to get auth token
    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'admin@hcmj.church',
        password: 'Admin@123!',
      });

    authToken = loginResponse.body.tokens?.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Setup', () => {
    it('should have auth token', () => {
      expect(authToken).toBeDefined();
    });
  });

  describe('POST /income - Split Donation Test', () => {
    it('should reject income without authentication', () => {
      return request(app.getHttpServer())
        .post('/api/v1/income')
        .send({
          totalAmount: 10000,
          accountId: 'test',
          splits: [],
        })
        .expect(401);
    });

    it('should reject income when splits do not equal total', async () => {
      // First get funds and accounts
      const fundsResponse = await request(app.getHttpServer())
        .get('/api/v1/admin/dashboard')
        .set('Authorization', `Bearer ${authToken}`);

      // This would require actual fund/account IDs from the database
      // For now, we test validation logic
      return request(app.getHttpServer())
        .post('/api/v1/income')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          totalAmount: 10000,
          accountId: 'invalid-account-id',
          splits: [
            { fundId: 'fund1', amount: 3000 },
            { fundId: 'fund2', amount: 3000 },
            // Total: 6000, but totalAmount is 10000
          ],
        })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toContain('Split amounts');
        });
    });
  });

  describe('GET /income', () => {
    it('should return income list with authentication', () => {
      return request(app.getHttpServer())
        .get('/api/v1/income')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
          expect(res.body).toHaveProperty('pagination');
          expect(Array.isArray(res.body.data)).toBe(true);
        });
    });

    it('should reject income list without authentication', () => {
      return request(app.getHttpServer())
        .get('/api/v1/income')
        .expect(401);
    });
  });

  describe('GET /income/summary', () => {
    it('should return income summary', () => {
      return request(app.getHttpServer())
        .get('/api/v1/income/summary')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('byFund');
          expect(res.body).toHaveProperty('grandTotal');
        });
    });
  });
});
