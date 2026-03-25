import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { AuditLogResponseDto, GetAuditLogsQueryDto } from './dto/audit-log.dto';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  async getAuditLogs(query: GetAuditLogsQueryDto): Promise<AuditLogResponseDto> {
    const page = query.page || 1;
    const limit = query.limit || 50;
    const skip = (page - 1) * limit;

    const queryBuilder = this.auditLogRepository.createQueryBuilder('audit');

    if (query.action) {
      queryBuilder.andWhere('audit.action = :action', { action: query.action });
    }

    if (query.entityType) {
      queryBuilder.andWhere('audit.entityType = :entityType', { entityType: query.entityType });
    }

    if (query.userId) {
      queryBuilder.andWhere('audit.userId = :userId', { userId: query.userId });
    }

    const [logs, total] = await queryBuilder
      .orderBy('audit.createdAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return {
      data: logs.map(log => ({
        id: log.id,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        userId: log.userId,
        metadata: log.metadata,
        createdAt: log.createdAt.toISOString(),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async createLog(
    action: string,
    entityType: string,
    entityId: string,
    userId: string,
    metadata?: Record<string, any>,
  ): Promise<AuditLog> {
    const log = this.auditLogRepository.create({
      action,
      entityType,
      entityId,
      userId,
      metadata,
    });

    return this.auditLogRepository.save(log);
  }
}
