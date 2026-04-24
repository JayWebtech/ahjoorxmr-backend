import {
  Controller,
  Get,
  Param,
  Query,
  ParseUUIDPipe,
  DefaultValuePipe,
  ParseBoolPipe,
  Version,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { GroupsService } from './groups.service';
import {
  GroupResponseDtoV2,
} from './dto/group-response-v2.dto';
import { Group } from './entities/group.entity';
import { Membership } from '../memberships/entities/membership.entity';
import { MembershipResponseDto } from '../memberships/dto/membership-response.dto';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { PaginationDto, PaginatedResponseDto } from '../common/dto/pagination.dto';
import { PaginationLinkHeaderInterceptor } from '../common/interceptors/pagination-link-header.interceptor';

/**
 * Controller for managing ROSCA groups (API v2).
 * This is a new version with breaking changes:
 * - GET /api/v2/groups/:id no longer includes members
 * - GET /api/v2/groups/:id/members is a dedicated endpoint for members
 *
 * IMPORTANT: The GET /my route is declared BEFORE GET /:id to prevent
 * NestJS from treating "my" as a UUID parameter.
 */
@ApiTags('Groups V2')
@Controller('groups')
@Version('2')
export class GroupsV2Controller {
  constructor(private readonly groupsService: GroupsService) {}

  /**
   * Returns a paginated list of all ROSCA groups (without members).
   *
   * @param page - Page number (default: 1)
   * @param limit - Items per page (default: 10)
   * @returns Paginated list of groups
   */
  @Get()
  @UseInterceptors(PaginationLinkHeaderInterceptor)
  @ApiOperation({
    summary: 'Get all ROSCA groups with pagination',
    description: 'Returns a paginated list of all ROSCA groups (v2: without members)',
  })
  @ApiQuery({ name: 'includeArchived', required: false, type: Boolean, example: false })
  @ApiResponse({ status: 200, description: 'Successfully retrieved groups' })
  async findAll(
    @Query() pagination: PaginationDto,
    @Query('includeArchived', new DefaultValuePipe(false), ParseBoolPipe)
    includeArchived: boolean,
  ): Promise<PaginatedResponseDto<GroupResponseDtoV2>> {
    const { page = 1, limit = 20 } = pagination;
    const result = await this.groupsService.findAll(page, limit, includeArchived);
    return PaginatedResponseDto.of(
      result.data.map((g) => this.toGroupResponseV2(g)),
      result.total,
      page,
      limit,
    );
  }

  /**
   * Returns full group details (without members).
   * To get members, use GET /api/v2/groups/:id/members
   *
   * @param id - The UUID of the group
   * @returns Group details without members array
   * @throws NotFoundException if the group doesn't exist
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Get group by ID',
    description:
      'Returns group details without members. Use GET /api/v2/groups/:id/members for members.',
  })
  @ApiParam({ name: 'id', description: 'Group UUID', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved group',
    type: GroupResponseDtoV2,
  })
  @ApiResponse({
    status: 404,
    description: 'Group not found',
    type: ErrorResponseDto,
  })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<GroupResponseDtoV2> {
    const group = await this.groupsService.findOne(id);
    return this.toGroupResponseV2(group);
  }

  /**
   * Returns the list of members for a specific group.
   * This is a dedicated endpoint for member data (v2 breaking change).
   *
   * @param id - The UUID of the group
   * @returns Array of members in the group
   * @throws NotFoundException if the group doesn't exist
   */
  @Get(':id/members')
  @UseInterceptors(PaginationLinkHeaderInterceptor)
  @ApiOperation({ summary: 'Get group members (paginated)' })
  @ApiParam({ name: 'id', description: 'Group UUID', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Successfully retrieved group members' })
  @ApiResponse({ status: 404, description: 'Group not found', type: ErrorResponseDto })
  async getGroupMembers(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() pagination: PaginationDto,
  ): Promise<PaginatedResponseDto<MembershipResponseDto>> {
    const { page = 1, limit = 20 } = pagination;
    const group = await this.groupsService.findOne(id);
    const all = (group.memberships ?? []).map((m: Membership) => this.toMembershipResponse(m));
    const start = (page - 1) * limit;
    const data = all.slice(start, start + limit);
    return PaginatedResponseDto.of(data, all.length, page, limit);
  }

  /**
   * Maps a Group entity to a GroupResponseDtoV2 (without members).
   */
  private toGroupResponseV2(group: Group): GroupResponseDtoV2 {
    return {
      id: group.id,
      name: group.name,
      contractAddress: group.contractAddress,
      adminWallet: group.adminWallet,
      contributionAmount: group.contributionAmount,
      token: group.token,
      roundDuration: group.roundDuration,
      status: group.status,
      currentRound: group.currentRound,
      totalRounds: group.totalRounds,
      createdAt: group.createdAt.toISOString(),
      updatedAt: group.updatedAt.toISOString(),
    };
  }

  /**
   * Maps a Membership entity to a MembershipResponseDto.
   */
  private toMembershipResponse(membership: Membership): MembershipResponseDto {
    return {
      id: membership.id,
      groupId: membership.groupId,
      userId: membership.userId,
      walletAddress: membership.walletAddress,
      payoutOrder: membership.payoutOrder,
      hasReceivedPayout: membership.hasReceivedPayout,
      hasPaidCurrentRound: membership.hasPaidCurrentRound,
      status: membership.status,
      createdAt: membership.createdAt.toISOString(),
      updatedAt: membership.updatedAt.toISOString(),
    };
  }
}
