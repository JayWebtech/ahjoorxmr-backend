import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SchedulerService } from './scheduler.service';
import { AuditLogService } from './services/audit-log.service';
import { ContributionSummaryService } from './services/contribution-summary.service';
import { GroupStatusService } from './services/group-status.service';
import { StaleGroupDetectionService } from './services/stale-group-detection.service';
import { DistributedLockService } from './services/distributed-lock.service';
import { AuditLog } from './entities/audit-log.entity';
import { Contribution } from '../contributions/entities/contribution.entity';
import { Group } from '../groups/entities/group.entity';
import { Membership } from '../memberships/entities/membership.entity';
import { NotificationsService } from '../notification/notifications.service';
import { GroupsModule } from '../groups/groups.module';
import { NotificationsModule } from '../notification/notifications.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([AuditLog, Contribution, Group, Membership]),
    GroupsModule,
    NotificationsModule,
  ],
  providers: [
    SchedulerService,
    AuditLogService,
    ContributionSummaryService,
    GroupStatusService,
    StaleGroupDetectionService,
    DistributedLockService,
  ],
  exports: [AuditLogService],
})
export class SchedulerModule {}
