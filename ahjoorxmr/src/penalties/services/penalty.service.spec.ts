import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PenaltyService } from './penalty.service';
import { Penalty, PenaltyStatus } from '../entities/penalty.entity';
import { Group } from '../../groups/entities/group.entity';
import { Membership } from '../../memberships/entities/membership.entity';
import { Contribution } from '../../contributions/entities/contribution.entity';
import { NotificationsService } from '../../notification/notifications.service';

describe('PenaltyService', () => {
    let service: PenaltyService;
    let penaltyRepository: Repository<Penalty>;
    let groupRepository: Repository<Group>;
    let membershipRepository: Repository<Membership>;
    let contributionRepository: Repository<Contribution>;
    let notificationsService: NotificationsService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                PenaltyService,
                {
                    provide: getRepositoryToken(Penalty),
                    useValue: {
                        findOne: jest.fn(),
                        find: jest.fn(),
                        create: jest.fn(),
                        save: jest.fn(),
                    },
                },
                {
                    provide: getRepositoryToken(Group),
                    useValue: {
                        findOne: jest.fn(),
                    },
                },
                {
                    provide: getRepositoryToken(Membership),
                    useValue: {
                        find: jest.fn(),
                    },
                },
                {
                    provide: getRepositoryToken(Contribution),
                    useValue: {
                        findOne: jest.fn(),
                    },
                },
                {
                    provide: NotificationsService,
                    useValue: {
                        sendNotification: jest.fn(),
                    },
                },
            ],
        }).compile();

        service = module.get<PenaltyService>(PenaltyService);
        penaltyRepository = module.get<Repository<Penalty>>(getRepositoryToken(Penalty));
        groupRepository = module.get<Repository<Group>>(getRepositoryToken(Group));
        membershipRepository = module.get<Repository<Membership>>(getRepositoryToken(Membership));
        contributionRepository = module.get<Repository<Contribution>>(
            getRepositoryToken(Contribution),
        );
        notificationsService = module.get<NotificationsService>(NotificationsService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('calculatePenaltyAmount', () => {
        it('should calculate penalty correctly', () => {
            const amount = '100';
            const rate = 0.05; // 5%
            const daysLate = 2;

            const result = service.calculatePenaltyAmount(amount, rate, daysLate);

            // 100 * 0.05 * 2 = 10
            expect(result).toBe('10.0000000');
        });

        it('should handle decimal amounts', () => {
            const amount = '50.5';
            const rate = 0.1; // 10%
            const daysLate = 3;

            const result = service.calculatePenaltyAmount(amount, rate, daysLate);

            // 50.5 * 0.1 * 3 = 15.15
            expect(result).toBe('15.1500000');
        });

        it('should handle zero penalty rate', () => {
            const amount = '100';
            const rate = 0;
            const daysLate = 5;

            const result = service.calculatePenaltyAmount(amount, rate, daysLate);

            expect(result).toBe('0.0000000');
        });
    });

    describe('waivePenalty', () => {
        it('should waive a pending penalty', async () => {
            const penalty: Partial<Penalty> = {
                id: 'penalty-1',
                status: PenaltyStatus.PENDING,
                userId: 'user-1',
                groupId: 'group-1',
                roundNumber: 1,
                amount: '10',
            };

            const group: Partial<Group> = {
                id: 'group-1',
                name: 'Test Group',
            };

            jest.spyOn(penaltyRepository, 'findOne').mockResolvedValue(penalty as Penalty);
            jest.spyOn(groupRepository, 'findOne').mockResolvedValue(group as Group);
            jest.spyOn(penaltyRepository, 'save').mockResolvedValue(penalty as Penalty);
            jest.spyOn(notificationsService, 'sendNotification').mockResolvedValue(undefined);

            const result = await service.waivePenalty('penalty-1', 'Member paid in full', 'admin-1');

            expect(result.status).toBe(PenaltyStatus.WAIVED);
            expect(result.waiverReason).toBe('Member paid in full');
            expect(result.waivedByUserId).toBe('admin-1');
            expect(penaltyRepository.save).toHaveBeenCalled();
        });

        it('should not waive a non-pending penalty', async () => {
            const penalty: Partial<Penalty> = {
                id: 'penalty-1',
                status: PenaltyStatus.PAID,
            };

            jest.spyOn(penaltyRepository, 'findOne').mockResolvedValue(penalty as Penalty);

            await expect(
                service.waivePenalty('penalty-1', 'Reason', 'admin-1'),
            ).rejects.toThrow();
        });

        it('should throw error if penalty not found', async () => {
            jest.spyOn(penaltyRepository, 'findOne').mockResolvedValue(null);

            await expect(
                service.waivePenalty('non-existent', 'Reason', 'admin-1'),
            ).rejects.toThrow();
        });
    });

    describe('getPendingPenalties', () => {
        it('should return pending penalties for user in group', async () => {
            const penalties: Partial<Penalty>[] = [
                {
                    id: 'penalty-1',
                    userId: 'user-1',
                    groupId: 'group-1',
                    status: PenaltyStatus.PENDING,
                    amount: '10',
                },
                {
                    id: 'penalty-2',
                    userId: 'user-1',
                    groupId: 'group-1',
                    status: PenaltyStatus.PENDING,
                    amount: '15',
                },
            ];

            jest.spyOn(penaltyRepository, 'find').mockResolvedValue(penalties as Penalty[]);

            const result = await service.getPendingPenalties('user-1', 'group-1');

            expect(result).toHaveLength(2);
            expect(result[0].status).toBe(PenaltyStatus.PENDING);
        });

        it('should return empty array if no pending penalties', async () => {
            jest.spyOn(penaltyRepository, 'find').mockResolvedValue([]);

            const result = await service.getPendingPenalties('user-1', 'group-1');

            expect(result).toHaveLength(0);
        });
    });

    describe('deductPenaltiesFromContribution', () => {
        it('should deduct all pending penalties', async () => {
            const penalties: Partial<Penalty>[] = [
                {
                    id: 'penalty-1',
                    amount: '10',
                    status: PenaltyStatus.PENDING,
                },
                {
                    id: 'penalty-2',
                    amount: '5',
                    status: PenaltyStatus.PENDING,
                },
            ];

            jest.spyOn(service, 'getPendingPenalties').mockResolvedValue(penalties as Penalty[]);
            jest.spyOn(penaltyRepository, 'save').mockResolvedValue({} as Penalty);

            const result = await service.deductPenaltiesFromContribution('user-1', 'group-1', '100');

            expect(result.deductedAmount).toBe('15.0000000');
            expect(result.penaltiesApplied).toHaveLength(2);
        });

        it('should return zero deduction if no pending penalties', async () => {
            jest.spyOn(service, 'getPendingPenalties').mockResolvedValue([]);

            const result = await service.deductPenaltiesFromContribution('user-1', 'group-1', '100');

            expect(result.deductedAmount).toBe('0');
            expect(result.penaltiesApplied).toHaveLength(0);
        });
    });
});
