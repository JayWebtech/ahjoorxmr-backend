import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import * as request from 'supertest';
import helmet from 'helmet';
import { AppModule } from '../src/app.module';

describe('Security Headers & CORS (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.CORS_ALLOWED_ORIGINS = 'https://allowed.example.com';
    process.env.CORS_ALLOW_CREDENTIALS = 'false';
    process.env.MAX_PROXY_HOPS = '2';
    process.env.NODE_ENV = 'test';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1', prefix: 'api/v' });
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));

    const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS ?? '')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);

    app.enableCors({
      origin: allowedOrigins.length ? allowedOrigins : false,
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
      credentials: false,
    });

    app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'none'"],
            scriptSrc: ["'self'"],
          },
        },
        referrerPolicy: { policy: 'strict-origin' },
        noSniff: true,
        frameguard: { action: 'deny' },
        hsts: false,
      }),
    );

    app.use((_req: any, res: any, next: any) => {
      res.setHeader('Permissions-Policy', 'geolocation=()');
      next();
    });

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects CORS preflight from non-allowed origin', async () => {
    const res = await request(app.getHttpServer())
      .options('/api/v1/health')
      .set('Origin', 'https://evil.example.com')
      .set('Access-Control-Request-Method', 'GET');

    // No Access-Control-Allow-Origin header for disallowed origin
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('allows CORS preflight from allowed origin', async () => {
    const res = await request(app.getHttpServer())
      .options('/api/v1/health')
      .set('Origin', 'https://allowed.example.com')
      .set('Access-Control-Request-Method', 'GET');

    expect(res.headers['access-control-allow-origin']).toBe('https://allowed.example.com');
  });

  it('sets X-Content-Type-Options: nosniff', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('sets Referrer-Policy: strict-origin', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health');
    expect(res.headers['referrer-policy']).toBe('strict-origin');
  });

  it('sets Content-Security-Policy', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health');
    expect(res.headers['content-security-policy']).toBeDefined();
  });

  it('sets Permissions-Policy', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health');
    expect(res.headers['permissions-policy']).toBe('geolocation=()');
  });

  it('rejects requests with too many X-Forwarded-For hops', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/health')
      .set('X-Forwarded-For', '1.1.1.1, 2.2.2.2, 3.3.3.3');

    expect(res.status).toBe(403);
  });

  it('allows requests within the hop limit', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/health')
      .set('X-Forwarded-For', '1.1.1.1, 2.2.2.2');

    expect(res.status).not.toBe(403);
  });
});
