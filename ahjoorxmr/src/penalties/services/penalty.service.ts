import { Injectable, Logger, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, And } from 'typeorm';
import { Penalty, PenaltyStatus } from '../entities/penalty.entity';
import { Group } from '../../groups/entities/group.entity';
import { User } from '../../users/entities/user.entity';
import { Membership } from '../../memberships/entities/membership.entity';
import { Contribution } from '../../contributions/entities/contribution.entity';
import { NotificationsService } from '../../notification/notifications.service';
import { NotificationType } from '../../notification/notification-type.enum';
import { Decimal } from 'decimal.js';

@Injectable()
export class PenaltyService {
    private readonly logger = new Logger(PenaltyService.name);

    constructor(
        @InjectRepository(Penalty)
        private readonly penaltyRepository: Repository<Penalty>,
        @InjectRepository(Group)
        private readonly groupRepository: Repository<Group>,
        @InjectRepository(Membership)
        private readonly membershipRepository: Repository<Membership>,
        @InjectRepository(Contribution)
        private readonly contributionRepository: Repository<Contribution>,
        private readonly notificationsService: NotificationsService,
    ) { }

    /**
     * Calculate penalty amount for a missed contribution
     * penaltyAmount = contributionAmount × penaltyRate × daysLate
     */
    calculatePenaltyAmount(
        contributionAmount: string,
        penaltyRate: number,
        daysLate: number,
    ): string {
        const amount = new Decimal(contributionAmount);
        const rate = new Decimal(penaltyRate);
        const days = new Decimal(daysLate);

        const penalty = amount.times(rate).times(days);
        return penalty.toFixed(7); // Stellar precision
    }

    /**
     * Assess penalties for members who missed the contribution deadline
     * Called 1 hour after round deadline passes
     */
    async assessPenaltiesForRound(groupId: string, roundNumber: number): Promise<number> {
        const group = await this.groupRepository.findOne({ where: { id: groupId } });
        if (!group) {
            throw new Error(`Group ${groupId} not found`);
        }

        // Find all members of the group
        const memberships = await this.membershipRepository.find({
            where: { groupId },
            relations: ['user'],
        });

        let penaltyCount = 0;

        for (const membership of memberships) {
            // Check if member has contributed for this round
            const contribution = await this.contributionRepository.findOne({
                where: {
                    userId: membership.userId,
                    groupId,
                    roundNumber,
                },
            });

            if (!contribution) {
                // Member did not contribute - assess penalty
                const daysLate = this.calculateDaysLate(group, roundNumber);
                const penaltyAmount = this.calculatePenaltyAmount(
                    group.contributionAmount,
                    group.penaltyRate,
                    daysLate,
                );

                // Check if penalty already exists
                const existingPenalty = await this.penaltyRepository.findOne({
                    where: {
                        userId: membership.userId,
                        groupId,
                        roundNumber,
                    },
                });

                if (!existingPenalty) {
                    const penalty = this.penaltyRepository.create({
                        userId: membership.userId,
                        groupId,
                        roundNumber,
                        amount: penaltyAmount,
                        assetCode: group.assetCode,
                        dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Due in 7 days
                        status: PenaltyStatus.PENDING,
                    });

                    await this.penaltyRepository.save(penalty);
                    penaltyCount++;

                    // Send notification
                    await this.notificationsService.sendNotification(
                        membership.userId,
                        NotificationType.PENALTY_ASSESSED,
                        {
                            groupId,
                            groupName: group.name,
                            roundNumber,
                            penaltyAmount,
                            assetCode: group.assetCode,
                        },
                    );

                    this.logger.log(
                        `Assessed penalty of ${penaltyAmount} ${group.assetCode} to user ${membership.userId} for group ${groupId} round ${roundNumber}`,
                    );
                }
            }
        }

        return penaltyCount;
    }

    /**
     * Waive a penalty with a reason (admin only)
     */
    async waivePenalty(
        penaltyId: string,
        waiverReason: string,
        adminUserId: string,
    ): Promise<Penalty> {
        const penalty = await this.penaltyRepository.findOne({ where: { id: penaltyId } });
        if (!penalty) {
            throw new BadRequestException(`Penalty ${penaltyId} not found`);
        }

        if (penalty.status !== PenaltyStatus.PENDING) {
            throw new BadRequestException(
                `Cannot waive penalty with status ${penalty.status}. Only PENDING penalties can be waived.`,
            );
        }

        penalty.status = PenaltyStatus.WAIVED;
        penalty.waiverReason = waiverReason;
        penalty.waivedByUserId = adminUserId;
        penalty.waivedAt = new Date();

        await this.penaltyRepository.save(penalty);

        // Send notification to user
        const group = await this.groupRepository.findOne({ where: { id: penalty.groupId } });
        await this.notificationsService.sendNotification(
            penalty.userId,
            NotificationType.PENALTY_WAIVED,
            {
                groupId: penalty.groupId,
                groupName: group?.name,
                roundNumber: penalty.roundNumber,
                penaltyAmount: penalty.amount,
                waiverReason,
            },
        );

        this.logger.log(`Waived penalty ${penaltyId} with reason: ${waiverReason}`);

        return penalty;
    }

    /**
     * Get pending penalties for a user in a group
     */
    async getPendingPenalties(userId: string, groupId: string): Promise<Penalty[]> {
        return this.penaltyRepository.find({
            where: {
                userId,
                groupId,
                status: PenaltyStatus.PENDING,
            },
            order: { dueAt: 'ASC' },
        });
    }

    /**
     * Deduct pending penalties from a contribution
     * Returns the amount to deduct and updates penalty status
     */
    async deductPenaltiesFromContribution(
        userId: string,
        groupId: string,
        contributionAmount: string,
    ): Promise<{ deductedAmount: string; penaltiesApplied: Penalty[] }> {
        const pendingPenalties = await this.getPendingPenalties(userId, groupId);

        if (pendingPenalties.length === 0) {
            return { deductedAmount: '0', penaltiesApplied: [] };
        }

        let totalDeduction = new Decimal(0);
        const appliedPenalties: Penalty[] = [];

        for (const penalty of pendingPenalties) {
            const penaltyAmount = new Decimal(penalty.amount);
            totalDeduction = totalDeduction.plus(penaltyAmount);
            penalty.status = PenaltyStatus.PAID;
            penalty.paidAt = new Date();
            await this.penaltyRepository.save(penalty);
            appliedPenalties.push(penalty);
        }

        return {
            deductedAmount: totalDeduction.toFixed(7),
            penaltiesApplied: appliedPenalties,
        };
    }

    /**
     * Calculate days late for penalty calculation
     */
    private calculateDaysLate(group: Group, roundNumber: number): number {
        // Simplified: assume 1 day late for now
        // In production, calculate based on actual deadline and current time
        return 1;
    }
}
