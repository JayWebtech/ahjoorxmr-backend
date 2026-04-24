import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken, getDataSourceToken } from '@nestjs/typeorm';
import { GroupInviteService } from './group-invite.service';
import { GroupInvite, InviteStatus } from '../entities/group-invite.entity';
import { Group } from '../entities/group.entity';
import { Membership } from '../../memberships/entities/membership.entity';
import { User } from '../../users/entities/user.entity';
import { MailService } from '../../mail/mail.service';
import { ConfigService } from '@nestjs/config';
import { GoneException, NotFoundException, ForbiddenException } from '@nestjs/common';

const mockRepo = () => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
  update: jest.fn(),
  count: jest.fn(),
});

const mockDataSource = {
  transaction: jest.fn((cb) => cb(mockEntityManager)),
};

const mockEntityManager: any = {
  createQueryBuilder: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  increment: jest.fn(),
  update: jest.fn(),
};

describe('GroupInviteService', () => {
  let service: GroupInviteService;
  let inviteRepo: ReturnType<typeof mockRepo>;
  let groupRepo: ReturnType<typeof mockRepo>;
  let userRepo: ReturnType<typeof mockRepo>;

  const adminUser = { id: 'admin-1', walletAddress: 'GADMIN' };
  const group = { id: 'group-1', adminWallet: 'GADMIN', name: 'Test Group' };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GroupInviteService,
        { provide: getRepositoryToken(GroupInvite), useFactory: mockRepo },
        { provide: getRepositoryToken(Group), useFactory: mockRepo },
        { provide: getRepositoryToken(Membership), useFactory: mockRepo },
        { provide: getRepositoryToken(User), useFactory: mockRepo },
        { provide: getDataSourceToken(), useValue: mockDataSource },
        { provide: ConfigService, useValue: { get: () => 'https://app.example.com' } },
        { provide: MailService, useValue: { sendMail: jest.fn().mockResolvedValue(null) } },
      ],
    }).compile();

    service = module.get(GroupInviteService);
    inviteRepo = module.get(getRepositoryToken(GroupInvite));
    groupRepo = module.get(getRepositoryToken(Group));
    userRepo = module.get(getRepositoryToken(User));
  });

  describe('createInvite', () => {
    it('creates invite and returns link', async () => {
      groupRepo.findOne.mockResolvedValue(group);
      userRepo.findOne.mockResolvedValue(adminUser);
      const invite = { id: 'inv-1', code: 'abc123def456', maxUses: 5, usedCount: 0, expiresAt: new Date(), status: InviteStatus.ACTIVE };
      inviteRepo.create.mockReturnValue(invite);
      inviteRepo.save.mockResolvedValue(invite);

      const result = await service.createInvite('group-1', 'admin-1', { expiryHours: 24, maxUses: 5 });

      expect(result.inviteLink).toContain('/groups/join/');
      expect(result.invite.code).toBe('abc123def456');
    });

    it('throws 403 when requester is not group admin', async () => {
      groupRepo.findOne.mockResolvedValue(group);
      userRepo.findOne.mockResolvedValue({ id: 'other-user', walletAddress: 'GOTHER' });

      await expect(
        service.createInvite('group-1', 'other-user', { expiryHours: 24 }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws 404 when group not found', async () => {
      groupRepo.findOne.mockResolvedValue(null);
      await expect(
        service.createInvite('bad-group', 'admin-1', { expiryHours: 24 }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('joinByCode', () => {
    const validInvite = {
      id: 'inv-1',
      groupId: 'group-1',
      status: InviteStatus.ACTIVE,
      expiresAt: new Date(Date.now() + 3600_000),
      maxUses: 10,
      usedCount: 0,
    };

    beforeEach(() => {
      mockEntityManager.createQueryBuilder.mockReturnValue({
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(validInvite),
      });
      mockEntityManager.findOne.mockResolvedValue(null); // no existing membership
      mockEntityManager.increment.mockResolvedValue({});
      mockEntityManager.update.mockResolvedValue({});
      const membership = { id: 'mem-1', groupId: 'group-1', userId: 'user-1' };
      mockEntityManager.create.mockReturnValue(membership);
      mockEntityManager.save.mockResolvedValue(membership);
    });

    it('creates membership on successful join', async () => {
      const result = await service.joinByCode('abc123def456', 'user-1', 'GWALLET');
      expect(result.groupId).toBe('group-1');
      expect(mockEntityManager.increment).toHaveBeenCalledWith(GroupInvite, { id: 'inv-1' }, 'usedCount', 1);
    });

    it('returns existing membership idempotently on duplicate join', async () => {
      const existing = { id: 'mem-existing', groupId: 'group-1', userId: 'user-1' };
      mockEntityManager.findOne.mockResolvedValue(existing);

      const result = await service.joinByCode('abc123def456', 'user-1', 'GWALLET');
      expect(result).toBe(existing);
      expect(mockEntityManager.save).not.toHaveBeenCalled();
    });

    it('throws 410 for expired invite', async () => {
      mockEntityManager.createQueryBuilder.mockReturnValue({
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({
          ...validInvite,
          expiresAt: new Date(Date.now() - 1000),
        }),
      });

      await expect(service.joinByCode('code', 'user-1', 'GWALLET')).rejects.toThrow(GoneException);
    });

    it('throws 410 when max uses exhausted', async () => {
      mockEntityManager.createQueryBuilder.mockReturnValue({
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({
          ...validInvite,
          maxUses: 5,
          usedCount: 5,
        }),
      });

      await expect(service.joinByCode('code', 'user-1', 'GWALLET')).rejects.toThrow(GoneException);
    });

    it('throws 404 for unknown code', async () => {
      mockEntityManager.createQueryBuilder.mockReturnValue({
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      });

      await expect(service.joinByCode('bad-code', 'user-1', 'GWALLET')).rejects.toThrow(NotFoundException);
    });
  });

  describe('expireStaleInvites', () => {
    it('updates ACTIVE past-due invites to EXPIRED', async () => {
      inviteRepo.update.mockResolvedValue({ affected: 3 });
      const count = await service.expireStaleInvites();
      expect(count).toBe(3);
      expect(inviteRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: InviteStatus.ACTIVE }),
        { status: InviteStatus.EXPIRED },
      );
    });
  });
});
