import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Group } from '../../groups/entities/group.entity';
import { GroupStatus } from '../../groups/entities/group-status.enum';
import { PenaltyService } from './penalty.service';

@Injectable()
export class PenaltyAssessmentJob {
    private readonly logger = new Logger(PenaltyAssessmentJob.name);

    constructor(
        @InjectRepository(Group)
        private readonly groupRepository: Repository<Group>,
        private readonly penaltyService: PenaltyService,
    ) { }

    /**
     * Run penalty assessment for all active groups
     * Should be called 1 hour after each round deadline
     */
    async assessPenalties(): Promise<{ groupsProcessed: number; totalPenalties: number }> {
        const activeGroups = await this.groupRepository.find({
            where: { status: GroupStatus.ACTIVE },
        });

        let totalPenalties = 0;
        let groupsProcessed = 0;

        for (const group of activeGroups) {
            try {
                const penaltyCount = await this.penaltyService.assessPenaltiesForRound(
                    group.id,
                    group.currentRound,
                );
                totalPenalties += penaltyCount;
                groupsProcessed++;

                if (penaltyCount > 0) {
                    this.logger.log(
                        `Assessed ${penaltyCount} penalties for group ${group.id} round ${group.currentRound}`,
                    );
                }
            } catch (error) {
                this.logger.error(
                    `Failed to assess penalties for group ${group.id}:`,
                    error,
                );
            }
        }

        this.logger.log(
            `Penalty assessment completed. Processed ${groupsProcessed} groups, assessed ${totalPenalties} penalties.`,
        );

        return { groupsProcessed, totalPenalties };
    }
}
