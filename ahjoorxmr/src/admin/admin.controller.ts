import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiSecurity,
} from '@nestjs/swagger';
import { AdminGuard } from './admin.guard';
import { ApiKeysService } from '../api-keys/api-keys.service';
import { CreateApiKeyDto, CreateApiKeyResponseDto, ApiKeyResponseDto } from '../api-keys/dto/api-key.dto';

@ApiTags('Admin')
@ApiBearerAuth('JWT-auth')
@UseGuards(AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Get()
  @ApiOperation({ summary: 'Admin route manifest' })
  @ApiResponse({ status: 200, description: 'List of all admin routes' })
  manifest() {
    return {
      routes: [
        { method: 'GET',    path: '/admin',              description: 'Admin route manifest' },
        { method: 'POST',   path: '/admin/api-keys',     description: 'Create API key' },
        { method: 'GET',    path: '/admin/api-keys',     description: 'List all API keys' },
        { method: 'DELETE', path: '/admin/api-keys/:id', description: 'Revoke API key' },
        { method: 'GET',    path: '/admin/users/:id',    description: 'Get full user profile' },
        { method: 'POST',   path: '/admin/users/:id/ban', description: 'Ban user' },
      ],
    };
  }

  @Post('api-keys')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create API key (admin)' })
  @ApiResponse({ status: 201, type: CreateApiKeyResponseDto })
  async createApiKey(
    @Body() dto: CreateApiKeyDto,
    @Request() req: { user: { id?: string; userId?: string; sub?: string } },
  ): Promise<CreateApiKeyResponseDto> {
    const ownerId = req.user.id ?? req.user.userId ?? req.user.sub;
    const { key, apiKey } = await this.apiKeysService.create(dto, ownerId);
    return { key, ...this.toResponse(apiKey) };
  }

  @Get('api-keys')
  @ApiOperation({ summary: 'List all API keys (admin)' })
  @ApiResponse({ status: 200, type: [ApiKeyResponseDto] })
  async listApiKeys(): Promise<ApiKeyResponseDto[]> {
    const keys = await this.apiKeysService.findAllForAdmin();
    return keys.map((k) => this.toResponse(k));
  }

  @Delete('api-keys/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke API key (admin)' })
  @ApiResponse({ status: 204 })
  async revokeApiKey(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.apiKeysService.revoke(id);
  }

  private toResponse(apiKey: any): ApiKeyResponseDto {
    return {
      id: apiKey.id,
      name: apiKey.name,
      ownerId: apiKey.ownerId,
      scopes: apiKey.scopes,
      lastUsedAt: apiKey.lastUsedAt,
      expiresAt: apiKey.expiresAt,
      revokedAt: apiKey.revokedAt,
      createdAt: apiKey.createdAt,
    };
  }
}
