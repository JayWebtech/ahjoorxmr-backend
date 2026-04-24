import { Controller, Get, UseGuards, Version } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { NotificationsController } from './notifications.controller';

@ApiTags('Admin – SSE')
@Controller('admin/sse')
@Version('1')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@ApiBearerAuth('JWT-auth')
export class SseAdminController {
  constructor(private readonly notificationsController: NotificationsController) {}

  @Get('connections')
  @ApiOperation({ summary: 'Get active SSE connection count per user' })
  getConnections(): Record<string, number> {
    const result: Record<string, number> = {};
    this.notificationsController.connections.forEach((conns, userId) => {
      result[userId] = conns.size;
    });
    return result;
  }
}
