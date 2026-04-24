import {
  Controller,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { GroupInviteService } from './group-invite.service';
import { CreateGroupInviteDto, GroupInviteResponseDto } from './group-invite.dto';

@ApiTags('Group Invites')
@Controller('groups')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class GroupInviteController {
  constructor(private readonly inviteService: GroupInviteService) {}

  @Post(':id/invites')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create invite link for a group (group admin only)' })
  @ApiResponse({ status: 201, type: GroupInviteResponseDto })
  @ApiResponse({ status: 403, description: 'Not the group admin' })
  @ApiResponse({ status: 404, description: 'Group not found' })
  async createInvite(
    @Param('id') groupId: string,
    @Body() dto: CreateGroupInviteDto,
    @Request() req: { user: { id: string } },
  ): Promise<GroupInviteResponseDto> {
    const { invite, inviteLink } = await this.inviteService.createInvite(
      groupId,
      req.user.id,
      dto,
    );
    return {
      id: invite.id,
      inviteLink,
      code: invite.code,
      maxUses: invite.maxUses,
      usedCount: invite.usedCount,
      expiresAt: invite.expiresAt,
      status: invite.status,
    };
  }

  @Post('join/:code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Join a group via invite code' })
  @ApiResponse({ status: 200, description: 'Membership created' })
  @ApiResponse({ status: 410, description: 'Invite expired or exhausted' })
  async joinByCode(
    @Param('code') code: string,
    @Request() req: { user: { id: string; walletAddress?: string } },
  ) {
    const membership = await this.inviteService.joinByCode(
      code,
      req.user.id,
      req.user.walletAddress ?? req.user.id,
    );
    return { membershipId: membership.id, groupId: membership.groupId };
  }
}
