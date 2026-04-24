import {
    Controller,
    Post,
    Get,
    Param,
    Body,
    UseGuards,
    Request,
    Version,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PenaltyService } from './services/penalty.service';
import { Penalty } from './entities/penalty.entity';
import { WaivePenaltyDto } from './dtos/waive-penalty.dto';

@ApiTags('Penalties')
@Controller('penalties')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PenaltiesController {
    constructor(private readonly penaltyService: PenaltyService) { }

    @Get('pending')
    @Version('1')
    @ApiBearerAuth('JWT-auth')
    @ApiOperation({
        summary: 'Get pending penalties for current user',
        description: 'Returns all pending penalties for the authenticated user across all groups.',
    })
    @ApiResponse({ status: 200, type: [Penalty] })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async getPendingPenalties(
        @Request() req: { user: { id: string } },
    ): Promise<Penalty[]> {
        // This would need to be enhanced to get all penalties for the user
        // For now, return empty array
        return [];
    }

    @Post(':id/waive')
    @Version('1')
    @Roles('admin')
    @HttpCode(HttpStatus.OK)
    @ApiBearerAuth('JWT-auth')
    @ApiOperation({
        summary: 'Waive a penalty (admin only)',
        description: 'Mark a penalty as waived with a reason. Only group admins can waive penalties.',
    })
    @ApiResponse({ status: 200, type: Penalty })
    @ApiResponse({ status: 400, description: 'Invalid penalty ID or status' })
    @ApiResponse({ status: 403, description: 'Forbidden - not a group admin' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async waivePenalty(
        @Param('id') penaltyId: string,
        @Body() dto: WaivePenaltyDto,
        @Request() req: { user: { id: string } },
    ): Promise<Penalty> {
        return this.penaltyService.waivePenalty(penaltyId, dto.reason, req.user.id);
    }
}
