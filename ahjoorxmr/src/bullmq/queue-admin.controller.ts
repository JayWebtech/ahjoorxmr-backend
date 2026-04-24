import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Request,
  ForbiddenException,
  NotFoundException,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { IsArray, IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';
import { QueueService, AllQueueStats } from './queue.service';
import { JobFailureService, BulkRetryFilter } from './job-failure.service';
import { AuditService } from '../audit/audit.service';
import { JwtAuthGuard } from '../stellar-auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PaginationDto, PaginatedResponseDto } from '../common/dto/pagination.dto';
import { PaginationLinkHeaderInterceptor } from '../common/interceptors/pagination-link-header.interceptor';

class BulkRetryDto implements BulkRetryFilter {
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  ids?: string[];

  @IsOptional()
  @IsString()
  queueName?: string;

  @IsOptional()
  @IsString()
  errorType?: string;

  @IsOptional()
  @IsDateString()
  createdBefore?: string;
}

@ApiTags('Admin – Queue')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller({ path: 'admin/queue', version: '1' })
export class QueueAdminController {
  constructor(
    private readonly queueService: QueueService,
    private readonly jobFailureService: JobFailureService,
    private readonly auditService: AuditService,
  ) {}

  @Get('stats')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get queue depths and failed-job counts (admin only)' })
  @ApiResponse({ status: 200, description: 'Queue statistics for all queues including the dead-letter queue' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
  async getStats(): Promise<AllQueueStats> {
    return this.queueService.getStats();
  }

  @Get('dead-letter')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(PaginationLinkHeaderInterceptor)
  @ApiOperation({ summary: 'Get dead letter queue jobs (admin only)' })
  @ApiResponse({ status: 200, description: 'Dead letter queue jobs retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
  async getDeadLetterJobs(@Query() pagination: PaginationDto) {
    const { page = 1, limit = 20 } = pagination;
    const all = await this.queueService.getDeadLetterJobs();
    const start = (page - 1) * limit;
    const data = all.slice(start, start + limit);
    return PaginatedResponseDto.of(data, all.length, page, limit);
  }

  /**
   * POST /admin/dead-letter/:id/retry
   * Re-enqueues a single job from the dead-letter records and marks it RETRYING.
   */
  @Post('dead-letter/:id/retry')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Retry a single dead-letter job by its record ID (admin only)' })
  @ApiParam({ name: 'id', description: 'UUID of the JobFailure record' })
  @ApiResponse({ status: 200, description: 'Job re-enqueued successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
  @ApiResponse({ status: 404, description: 'Job failure record not found' })
  async retryDeadLetterJob(
    @Param('id') id: string,
    @Request() req: any,
  ) {
    let result: Awaited<ReturnType<typeof this.jobFailureService.retryById>>;
    try {
      result = await this.jobFailureService.retryById(id);
    } catch (err) {
      if ((err as Error).message?.includes('Could not find any entity')) {
        throw new NotFoundException(`JobFailure record ${id} not found`);
      }
      throw err;
    }

    const adminUserId: string = req.user?.id ?? 'unknown';
    await this.auditService.createLog({
      userId: adminUserId,
      action: 'ADMIN_DEAD_LETTER_RETRY',
      resource: 'job_failures',
      metadata: {
        recordId: id,
        queueName: result.record.queueName,
        jobName: result.record.jobName,
        originalJobId: result.record.jobId,
        enqueuedJobId: result.enqueuedJobId,
      },
    });

    return {
      success: true,
      recordId: id,
      enqueuedJobId: result.enqueuedJobId,
      status: result.record.status,
      retryCount: result.record.retryCount,
    };
  }

  /**
   * POST /admin/dead-letter/bulk-retry
   * Accepts either an array of IDs or a filter {queueName, errorType, createdBefore}.
   */
  @Post('dead-letter/bulk-retry')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bulk retry dead-letter jobs by IDs or filter (admin only)' })
  @ApiBody({ type: BulkRetryDto })
  @ApiResponse({ status: 200, description: 'Bulk retry results' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
  async bulkRetryDeadLetterJobs(
    @Body() dto: BulkRetryDto,
    @Request() req: any,
  ) {
    const result = await this.jobFailureService.bulkRetry(dto);
    const adminUserId: string = req.user?.id ?? 'unknown';

    await this.auditService.createLog({
      userId: adminUserId,
      action: 'ADMIN_DEAD_LETTER_BULK_RETRY',
      resource: 'job_failures',
      metadata: {
        filter: dto,
        total: result.total,
        succeeded: result.results.filter((r) => r.success).length,
        failed: result.results.filter((r) => !r.success).length,
      },
    });

    return result;
  }

  @Post('retry')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Retry a failed job from dead letter queue (admin only)' })
  @ApiResponse({ status: 200, description: 'Job retry initiated successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
  async retryJob(@Body() body: { jobId: string }) {
    return this.queueService.retryDeadLetterJob(body.jobId);
  }
}
