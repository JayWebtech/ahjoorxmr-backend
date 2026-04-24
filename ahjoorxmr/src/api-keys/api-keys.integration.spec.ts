import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ApiKeysService } from './api-keys.service';
import { ApiKey } from './entities/api-key.entity';
import { AuditService } from '../audit/audit.service';
import { createHash } from 'crypto';

const mockRepo = () => ({
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
});

const mockAuditService = { createLog: jest.fn().mockResolvedValue(null) };

describe('ApiKeysService', () => {
  let service: ApiKeysService;
  let repo: ReturnType<typeof mockRepo>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiKeysService,
        { provide: getRepositoryToken(ApiKey), useFactory: mockRepo },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get(ApiKeysService);
    repo = module.get(getRepositoryToken(ApiKey));
  });

  describe('create', () => {
    it('returns plaintext key starting with ak_live_ and stores hash', async () => {
      const saved = { id: 'uuid-1', ownerId: 'owner-1', scopes: [], name: 'Test', keyHash: '', createdAt: new Date(), updatedAt: new Date(), lastUsedAt: null, expiresAt: null, revokedAt: null };
      repo.create.mockReturnValue(saved);
      repo.save.mockResolvedValue(saved);

      const { key, apiKey } = await service.create({ name: 'Test', scopes: [] }, 'owner-1');

      expect(key).toMatch(/^ak_live_[0-9a-f]{64}$/);
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          keyHash: createHash('sha256').update(key).digest('hex'),
          ownerId: 'owner-1',
        }),
      );
      expect(apiKey).toBe(saved);
    });
  });

  describe('validateAndTouch', () => {
    it('returns apiKey for valid non-expired, non-revoked key', async () => {
      const plaintext = 'ak_live_' + 'a'.repeat(64);
      const keyHash = createHash('sha256').update(plaintext).digest('hex');
      const apiKey = { id: 'k1', ownerId: 'u1', scopes: ['read'], keyHash, revokedAt: null, expiresAt: null };
      repo.findOne.mockResolvedValue(apiKey);
      repo.update.mockResolvedValue({});

      const result = await service.validateAndTouch(plaintext, { ip: '127.0.0.1' });
      expect(result).toBe(apiKey);
    });

    it('throws 401 for unknown key', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.validateAndTouch('bad_key', {})).rejects.toThrow('Invalid API key');
    });

    it('throws 401 for revoked key', async () => {
      repo.findOne.mockResolvedValue({ revokedAt: new Date(), expiresAt: null });
      await expect(service.validateAndTouch('ak_live_x', {})).rejects.toThrow('API key revoked');
    });

    it('throws 401 for expired key', async () => {
      const past = new Date(Date.now() - 1000);
      repo.findOne.mockResolvedValue({ revokedAt: null, expiresAt: past });
      await expect(service.validateAndTouch('ak_live_x', {})).rejects.toThrow('API key expired');
    });
  });

  describe('revoke', () => {
    it('sets revokedAt on the key', async () => {
      const key = { id: 'k1', revokedAt: null };
      repo.findOne.mockResolvedValue(key);
      repo.save.mockResolvedValue({ ...key, revokedAt: new Date() });

      await service.revoke('k1');
      expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ revokedAt: expect.any(Date) }));
    });

    it('throws 404 for unknown id', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.revoke('bad-id')).rejects.toThrow('API key not found');
    });
  });

  describe('scope enforcement via ApiKeyAuthGuard', () => {
    it('populates req.user with scopes from the key', async () => {
      const { ApiKeyAuthGuard } = await import('./guards/api-key-auth.guard');
      const plaintext = 'ak_live_' + 'b'.repeat(64);
      const apiKey = { id: 'k2', ownerId: 'u2', scopes: ['read:groups'], revokedAt: null, expiresAt: null };
      repo.findOne.mockResolvedValue(apiKey);
      repo.update.mockResolvedValue({});

      const guard = new ApiKeyAuthGuard(service);
      const req: any = { headers: { 'x-api-key': plaintext }, ip: '127.0.0.1' };
      const ctx: any = { switchToHttp: () => ({ getRequest: () => req }) };

      await guard.canActivate(ctx);
      expect(req.user).toEqual({ id: 'u2', apiKeyId: 'k2', scopes: ['read:groups'] });
    });
  });
});
