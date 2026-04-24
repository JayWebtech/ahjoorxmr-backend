import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProfileCompletenessService } from './profile-completeness.service';
import { User } from '../entities/user.entity';
import { KycStatus } from '../../kyc/entities/kyc-status.enum';
import { Membership } from '../../memberships/entities/membership.entity';

describe('ProfileCompletenessService', () => {
    let service: ProfileCompletenessService;
    let userRepository: Repository<User>;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ProfileCompletenessService,
                {
                    provide: getRepositoryToken(User),
                    useValue: {
                        findOne: jest.fn(),
                    },
                },
            ],
        }).compile();

        service = module.get<ProfileCompletenessService>(ProfileCompletenessService);
        userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('calculateProfileCompleteness', () => {
        it('should return 0 score for new user with no completions', async () => {
            const user: Partial<User> = {
                id: 'user-1',
                email: null,
                emailVerified: false,
                walletAddress: 'G123',
                kycStatus: null,
                twoFactorEnabled: false,
                memberships: [],
            };

            jest.spyOn(userRepository, 'findOne').mockResolvedValue(user as User);

            const result = await service.calculateProfileCompleteness('user-1');

            expect(result.score).toBe(0);
            expect(result.completedSteps).toHaveLength(0);
            expect(result.pendingSteps).toHaveLength(5);
        });

        it('should return 100 score for fully completed profile', async () => {
            const membership = { id: 'mem-1' } as Membership;
            const user: Partial<User> = {
                id: 'user-1',
                email: 'user@example.com',
                emailVerified: true,
                walletAddress: 'G123',
                kycStatus: KycStatus.APPROVED,
                twoFactorEnabled: true,
                memberships: [membership],
            };

            jest.spyOn(userRepository, 'findOne').mockResolvedValue(user as User);

            const result = await service.calculateProfileCompleteness('user-1');

            expect(result.score).toBe(100);
            expect(result.completedSteps).toHaveLength(5);
            expect(result.pendingSteps).toHaveLength(0);
        });

        it('should return 60 score for partially completed profile', async () => {
            const user: Partial<User> = {
                id: 'user-1',
                email: 'user@example.com',
                emailVerified: true,
                walletAddress: 'G123',
                kycStatus: KycStatus.APPROVED,
                twoFactorEnabled: false,
                memberships: [],
            };

            jest.spyOn(userRepository, 'findOne').mockResolvedValue(user as User);

            const result = await service.calculateProfileCompleteness('user-1');

            expect(result.score).toBe(60);
            expect(result.completedSteps).toHaveLength(3);
            expect(result.pendingSteps).toHaveLength(2);
        });

        it('should mark email_verified as completed only if both email and emailVerified are true', async () => {
            const user: Partial<User> = {
                id: 'user-1',
                email: 'user@example.com',
                emailVerified: false,
                walletAddress: 'G123',
                kycStatus: null,
                twoFactorEnabled: false,
                memberships: [],
            };

            jest.spyOn(userRepository, 'findOne').mockResolvedValue(user as User);

            const result = await service.calculateProfileCompleteness('user-1');

            const emailStep = result.pendingSteps.find((s) => s.key === 'email_verified');
            expect(emailStep).toBeDefined();
            expect(emailStep?.completed).toBe(false);
        });

        it('should mark wallet_linked as completed if walletAddress exists', async () => {
            const user: Partial<User> = {
                id: 'user-1',
                email: null,
                emailVerified: false,
                walletAddress: 'G123',
                kycStatus: null,
                twoFactorEnabled: false,
                memberships: [],
            };

            jest.spyOn(userRepository, 'findOne').mockResolvedValue(user as User);

            const result = await service.calculateProfileCompleteness('user-1');

            const walletStep = result.completedSteps.find((s) => s.key === 'wallet_linked');
            expect(walletStep).toBeDefined();
            expect(walletStep?.completed).toBe(true);
        });

        it('should mark kyc_approved as completed if kycStatus is APPROVED', async () => {
            const user: Partial<User> = {
                id: 'user-1',
                email: null,
                emailVerified: false,
                walletAddress: 'G123',
                kycStatus: KycStatus.APPROVED,
                twoFactorEnabled: false,
                memberships: [],
            };

            jest.spyOn(userRepository, 'findOne').mockResolvedValue(user as User);

            const result = await service.calculateProfileCompleteness('user-1');

            const kycStep = result.completedSteps.find((s) => s.key === 'kyc_approved');
            expect(kycStep).toBeDefined();
            expect(kycStep?.completed).toBe(true);
        });

        it('should mark 2fa_enabled as completed if twoFactorEnabled is true', async () => {
            const user: Partial<User> = {
                id: 'user-1',
                email: null,
                emailVerified: false,
                walletAddress: 'G123',
                kycStatus: null,
                twoFactorEnabled: true,
                memberships: [],
            };

            jest.spyOn(userRepository, 'findOne').mockResolvedValue(user as User);

            const result = await service.calculateProfileCompleteness('user-1');

            const twoFaStep = result.completedSteps.find((s) => s.key === '2fa_enabled');
            expect(twoFaStep).toBeDefined();
            expect(twoFaStep?.completed).toBe(true);
        });

        it('should mark first_group_joined as completed if memberships exist', async () => {
            const membership = { id: 'mem-1' } as Membership;
            const user: Partial<User> = {
                id: 'user-1',
                email: null,
                emailVerified: false,
                walletAddress: 'G123',
                kycStatus: null,
                twoFactorEnabled: false,
                memberships: [membership],
            };

            jest.spyOn(userRepository, 'findOne').mockResolvedValue(user as User);

            const result = await service.calculateProfileCompleteness('user-1');

            const groupStep = result.completedSteps.find((s) => s.key === 'first_group_joined');
            expect(groupStep).toBeDefined();
            expect(groupStep?.completed).toBe(true);
        });

        it('should throw error if user not found', async () => {
            jest.spyOn(userRepository, 'findOne').mockResolvedValue(null);

            await expect(service.calculateProfileCompleteness('non-existent')).rejects.toThrow();
        });
    });
});
