import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, MaxLength } from 'class-validator';

export class WaivePenaltyDto {
    @ApiProperty({
        example: 'Member paid in full the following round',
        description: 'Reason for waiving the penalty',
    })
    @IsString()
    @MinLength(10)
    @MaxLength(500)
    reason: string;
}
