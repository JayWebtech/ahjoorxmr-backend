import { IsInt, IsOptional, IsEmail, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateGroupInviteDto {
  @ApiProperty({ example: 24, description: 'Hours until invite expires' })
  @IsInt()
  @Min(1)
  @Max(720)
  expiryHours: number;

  @ApiPropertyOptional({ example: 10 })
  @IsInt()
  @Min(1)
  @IsOptional()
  maxUses?: number;

  @ApiPropertyOptional({ example: 'partner@example.com' })
  @IsEmail()
  @IsOptional()
  recipientEmail?: string;
}

export class GroupInviteResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  inviteLink: string;

  @ApiProperty()
  code: string;

  @ApiProperty()
  maxUses: number;

  @ApiProperty()
  usedCount: number;

  @ApiProperty()
  expiresAt: Date;

  @ApiProperty()
  status: string;
}
