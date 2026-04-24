import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { WebhookService } from './webhook.service';
import {
  CreateWebhookDto,
  WebhookResponseDto,
  TestWebhookResponseDto,
} from './dto/webhook.dto';

@ApiTags('Webhooks')
@Controller('webhooks')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new webhook' })
  @ApiResponse({ status: 201, type: WebhookResponseDto })
  async createWebhook(
    @Request() req: any,
    @Body() dto: CreateWebhookDto,
  ): Promise<WebhookResponseDto> {
    const webhook = await this.webhookService.createWebhook(
      req.user.id ?? req.user.userId,
      dto.url,
      dto.eventTypes,
    );
    return this.toResponse(webhook);
  }

  @Get()
  @ApiOperation({ summary: 'Get all webhooks for the authenticated user' })
  @ApiResponse({ status: 200, type: [WebhookResponseDto] })
  async getUserWebhooks(@Request() req: any): Promise<WebhookResponseDto[]> {
    const webhooks = await this.webhookService.getUserWebhooks(req.user.id ?? req.user.userId);
    return webhooks.map((w) => this.toResponse(w));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a webhook' })
  async deleteWebhook(@Request() req: any, @Param('id') id: string): Promise<void> {
    await this.webhookService.deleteWebhook(id, req.user.id ?? req.user.userId);
  }

  @Post(':id/test')
  @ApiOperation({ summary: 'Test a webhook with a synthetic event' })
  @ApiResponse({ status: 200, type: TestWebhookResponseDto })
  async testWebhook(
    @Request() req: any,
    @Param('id') id: string,
  ): Promise<TestWebhookResponseDto> {
    try {
      const result = await this.webhookService.testWebhook(id, req.user.id ?? req.user.userId);
      return {
        success: result.statusCode >= 200 && result.statusCode < 300,
        statusCode: result.statusCode,
        responseBody: result.responseBody,
        deliveryTime: result.deliveryTime,
      };
    } catch (error) {
      throw new BadRequestException(`Failed to test webhook: ${(error as Error).message}`);
    }
  }

  @Get(':id/deliveries')
  @ApiOperation({ summary: 'Get last 50 delivery attempts for a webhook' })
  async getDeliveries(@Request() req: any, @Param('id') id: string) {
    return this.webhookService.getDeliveries(id, req.user.id ?? req.user.userId);
  }

  @Post(':id/deliveries/:deliveryId/replay')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Replay a failed delivery' })
  async replayDelivery(
    @Request() req: any,
    @Param('id') id: string,
    @Param('deliveryId') deliveryId: string,
  ): Promise<{ queued: true }> {
    await this.webhookService.replayDelivery(deliveryId, req.user.id ?? req.user.userId);
    return { queued: true };
  }

  private toResponse(webhook: any): WebhookResponseDto {
    return {
      id: webhook.id,
      userId: webhook.userId,
      url: webhook.url,
      eventTypes: webhook.eventTypes,
      isActive: webhook.isActive,
      createdAt: webhook.createdAt,
      updatedAt: webhook.updatedAt,
    };
  }
}

@ApiTags('Admin – Webhooks')
@Controller('admin/webhooks')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@ApiBearerAuth('JWT-auth')
export class WebhookAdminController {
  constructor(private readonly webhookService: WebhookService) {}

  @Get()
  @ApiOperation({ summary: 'Get all webhook subscriptions (admin)' })
  async getAllWebhooks() {
    return this.webhookService.getAllWebhooks();
  }

  @Post(':id/test')
  @ApiOperation({ summary: 'Fire a test payload for any webhook (admin)' })
  async testWebhook(@Param('id') id: string): Promise<TestWebhookResponseDto> {
    try {
      const result = await this.webhookService.testWebhook(id);
      return {
        success: result.statusCode >= 200 && result.statusCode < 300,
        statusCode: result.statusCode,
        responseBody: result.responseBody,
        deliveryTime: result.deliveryTime,
      };
    } catch (error) {
      throw new BadRequestException(`Failed to test webhook: ${(error as Error).message}`);
    }
  }
}
