import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, IsNull } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { QueueService } from '../../bullmq/queue.service';
import { ProfileCompletenessService } from '../../users/services/profile-completeness.service';

@Injectable()
export class ProfileIncompleteReminderService {
    private readonly logger = new Logger(ProfileIncompleteReminderService.name);
    private readonly REMINDER_THRESHOLD_SCORE = 60;
    private readonly HOURS_AFTER_REGISTRATION = 24;

    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        private readonly queueService: QueueService,
        private readonly profileCompletenessService: ProfileCompletenessService,
    ) { }

    async sendProfileIncompleteReminders(): Promise<{ sentCount: number }> {
        // Calculate the cutoff time: 24 hours ago
        const cutoffTime = new Date(Date.now() - this.HOURS_AFTER_REGISTRATION * 60 * 60 * 1000);

        // Find users registered 24 hours ago who haven't received a reminder yet
        const users = await this.userRepository.find({
            where: {
                createdAt: LessThan(cutoffTime),
                profileIncompleteReminderSentAt: IsNull(),
            },
            relations: ['memberships'],
        });

        this.logger.log(`Found ${users.length} users eligible for profile incomplete reminder`);

        let sentCount = 0;

        for (const user of users) {
            try {
                const completeness = await this.profileCompletenessService.calculateProfileCompleteness(
                    user.id,
                );

                // Only send reminder if score is below threshold
                if (completeness.score < this.REMINDER_THRESHOLD_SCORE) {
                    await this.queueService.addSendNotificationEmail({
                        userId: user.id,
                        to: user.email,
                        templateName: 'profile-incomplete-reminder',
                        context: {
                            userName: user.fullName,
                            score: completeness.score,
                            completedSteps: completeness.completedSteps,
                            pendingSteps: completeness.pendingSteps,
                            profileUrl: `${process.env.BASE_URL || 'https://app.example.com'}/profile`,
                        },
                    });

                    // Mark that reminder was sent
                    user.profileIncompleteReminderSentAt = new Date();
                    await this.userRepository.save(user);

                    sentCount++;
                    this.logger.log(
                        `Sent profile incomplete reminder to user ${user.id} (score: ${completeness.score})`,
                    );
                }
            } catch (error) {
                this.logger.error(
                    `Failed to send profile incomplete reminder to user ${user.id}:`,
                    error,
                );
            }
        }

        return { sentCount };
    }
}
