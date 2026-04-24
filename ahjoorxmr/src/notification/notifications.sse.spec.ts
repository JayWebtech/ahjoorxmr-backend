import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { RedisService } from '../common/redis/redis.service';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { TooManyRequestsException } from '@nestjs/common';
import { Subject } from 'rxjs';

const mockNotificationsService = () => ({
  findAll: jest.fn(),
  getUnreadCount: jest.fn(),
  markAllAsRead: jest.fn(),
  markAsRead: jest.fn(),
});

const mockRedisClient = {
  duplicate: jest.fn(),
  publish: jest.fn().mockResolvedValue(1),
};

const mockRedisService = () => ({
  getClient: jest.fn().mockReturnValue(mockRedisClient),
});

const mockConfigService = () => ({
  get: jest.fn((key: string, def?: any) => {
    if (key === 'SSE_MAX_CONNECTIONS_PER_USER') return 3;
    return def;
  }),
});

const mockJwtService = () => ({
  verify: jest.fn().mockReturnValue({ sub: 'user-123' }),
});

describe('NotificationsController – SSE', () => {
  let controller: NotificationsController;

  const buildMockReq = (userId = 'user-123') => {
    const eventEmitter: Record<string, Function> = {};
    return {
      headers: { authorization: 'Bearer valid-token' },
      query: {},
      on: (event: string, cb: Function) => { eventEmitter[event] = cb; },
      _emit: (event: string) => eventEmitter[event]?.(),
    };
  };

  const buildMockRes = () => ({
    status: jest.fn().mockReturnThis(),
    end: jest.fn(),
  });

  beforeEach(async () => {
    const dupClient = {
      subscribe: jest.fn().mockResolvedValue(undefined),
      unsubscribe: jest.fn().mockResolvedValue(undefined),
      quit: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
    };
    mockRedisClient.duplicate.mockReturnValue(dupClient);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsController,
        { provide: NotificationsService, useFactory: mockNotificationsService },
        { provide: RedisService, useFactory: mockRedisService },
        { provide: ConfigService, useFactory: mockConfigService },
        { provide: JwtService, useFactory: mockJwtService },
      ],
    }).compile();

    controller = module.get(NotificationsController);
  });

  afterEach(() => {
    controller.onModuleDestroy();
  });

  it('returns an observable for a valid connection', async () => {
    const req = buildMockReq();
    const res = buildMockRes();
    const obs = await controller.stream(req as any, res as any);
    expect(obs).toBeDefined();
    expect(typeof obs.subscribe).toBe('function');
  });

  it('rejects connection when limit is reached', async () => {
    // Fill up to max (3)
    for (let i = 0; i < 3; i++) {
      const req = buildMockReq();
      await controller.stream(req as any, buildMockRes() as any);
    }

    const req = buildMockReq();
    await expect(controller.stream(req as any, buildMockRes() as any)).rejects.toThrow(
      TooManyRequestsException,
    );
  });

  it('cleans up connection on client disconnect', async () => {
    const req = buildMockReq();
    await controller.stream(req as any, buildMockRes() as any);

    const connections = (controller as any).connections as Map<string, Set<Subject<void>>>;
    expect(connections.get('user-123')?.size).toBe(1);

    // Simulate disconnect
    req._emit('close');

    // Allow microtasks to flush
    await new Promise((r) => setTimeout(r, 10));
    expect(connections.get('user-123')?.size).toBe(0);
  });
});
