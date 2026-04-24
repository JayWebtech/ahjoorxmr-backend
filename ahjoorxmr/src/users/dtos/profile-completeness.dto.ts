import { ApiProperty } from '@nestjs/swagger';

export class CompletionStepDto {
    @ApiProperty({ example: 'email_verified' })
    key: string;

    @ApiProperty({ example: 'Email Verified' })
    label: string;

    @ApiProperty({ example: 'Verify your email address' })
    description: string;

    @ApiProperty({ example: true })
    completed: boolean;

    @ApiProperty({ example: 20 })
    weight: number;
}

export class ProfileCompletenessDto {
    @ApiProperty({ example: 60, description: 'Profile completeness score (0-100)' })
    score: number;

    @ApiProperty({ type: [CompletionStepDto], description: 'Completed onboarding steps' })
    completedSteps: CompletionStepDto[];

    @ApiProperty({ type: [CompletionStepDto], description: 'Pending onboarding steps' })
    pendingSteps: CompletionStepDto[];
}
