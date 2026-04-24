import { Test, TestingModule } from '@nestjs/testing';
import { AdminGuard } from './admin.guard';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

const makeCtx = (headers: Record<string, string>, ip = '127.0.0.1') => ({
  switchToHttp: () => ({
    getRequest: () => ({ headers, ip, connection: { remoteAddress: ip } }),
  }),
});

describe('AdminGuard', () => {
  let guard: AdminGuard;
  let jwtService: JwtService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminGuard,
        {
          provide: JwtService,
          useValue: { verify: jest.fn() },
        },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'JWT_ACCESS_SECRET') return 'test_secret';
              if (key === 'ADMIN_ALLOWED_IPS') return null; // no IP restriction by default
              return null;
            },
          },
        },
      ],
    }).compile();

    guard = module.get(AdminGuard);
    jwtService = module.get(JwtService);
  });

  it('throws 401 when no Authorization header', () => {
    expect(() => guard.canActivate(makeCtx({}) as any)).toThrow('Unauthorized');
  });

  it('throws 401 when JWT is invalid', () => {
    (jwtService.verify as jest.Mock).mockImplementation(() => { throw new Error('invalid'); });
    expect(() =>
      guard.canActivate(makeCtx({ authorization: 'Bearer bad.token' }) as any),
    ).toThrow('Unauthorized');
  });

  it('throws 403 when JWT role is not admin', () => {
    (jwtService.verify as jest.Mock).mockReturnValue({ role: 'user', sub: 'u1' });
    expect(() =>
      guard.canActivate(makeCtx({ authorization: 'Bearer valid.token' }) as any),
    ).toThrow('Admin role required');
  });

  it('allows request when JWT role is admin', () => {
    (jwtService.verify as jest.Mock).mockReturnValue({ role: 'admin', sub: 'u1' });
    const result = guard.canActivate(makeCtx({ authorization: 'Bearer valid.token' }) as any);
    expect(result).toBe(true);
  });

  it('throws 403 when IP is not in allowlist', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminGuard,
        { provide: JwtService, useValue: { verify: jest.fn().mockReturnValue({ role: 'admin' }) } },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'ADMIN_ALLOWED_IPS') return '10.0.0.1,10.0.0.2';
              if (key === 'JWT_ACCESS_SECRET') return 'secret';
              return null;
            },
          },
        },
      ],
    }).compile();

    const ipGuard = module.get(AdminGuard);
    expect(() =>
      ipGuard.canActivate(makeCtx({ authorization: 'Bearer t' }, '1.2.3.4') as any),
    ).toThrow('IP not allowed');
  });

  it('allows request from allowlisted IP', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminGuard,
        { provide: JwtService, useValue: { verify: jest.fn().mockReturnValue({ role: 'admin' }) } },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'ADMIN_ALLOWED_IPS') return '10.0.0.1';
              if (key === 'JWT_ACCESS_SECRET') return 'secret';
              return null;
            },
          },
        },
      ],
    }).compile();

    const ipGuard = module.get(AdminGuard);
    const result = ipGuard.canActivate(makeCtx({ authorization: 'Bearer t' }, '10.0.0.1') as any);
    expect(result).toBe(true);
  });
});
