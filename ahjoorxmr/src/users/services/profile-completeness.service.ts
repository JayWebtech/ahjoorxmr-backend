import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { KycStatus } from '../../kyc/entities/kyc-status.enum';

export interface CompletionStep {
    key: string;
    label: string;
    description: string;
    completed: boolean;
    weight: number;
}

export interface ProfileCompletenessResult {
    score: number;
    completedSteps: CompletionStep[];
    pendingSteps: CompletionStep[];
}

@Injectable()
export class ProfileCompletenessService {
    private readonly STEPS = [
        {
            key: 'email_verified',
            label: 'Email Verified',
            description: 'Verify your email address',
            weight: 20,
        },
        {
            key: 'wallet_linked',
            label: 'Wallet Linked',
            description: 'Link your Stellar wallet',
            weight: 20,
        },
        {
            key: 'kyc_approved',
            label: 'KYC Approved',
            description: 'Complete identity verification',
            weight: 20,
        },
        {
            key: '2fa_enabled',
            label: '2FA Enabled',
            description: 'Enable two-factor authentication',
            weight: 20,
        },
        {
            key: 'first_group_joined',
            label: 'First Group Joined',
            description: 'Join your first savings group',
            weight: 20,
        },
    ];

    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
    ) { }

    async calculateProfileCompleteness(userId: string): Promise<ProfileCompletenessResult> {
        const user = await this.userRepository.findOne({
            where: { id: userId },
            relations: ['memberships'],
        });

        if (!user) {
            throw new Error(`User ${userId} not found`);
        }

        const completedSteps: CompletionStep[] = [];
        const pendingSteps: CompletionStep[] = [];
        let totalScore = 0;

        for (const step of this.STEPS) {
            const isCompleted = this.isStepCompleted(user, step.key);

            const stepData: CompletionStep = {
                ...step,
                completed: isCompleted,
            };

            if (isCompleted) {
                completedSteps.push(stepData);
                totalScore += step.weight;
            } else {
                pendingSteps.push(stepData);
            }
        }

        return {
            score: totalScore,
            completedSteps,
            pendingSteps,
        };
    }

    private isStepCompleted(user: User, stepKey: string): boolean {
        switch (stepKey) {
            case 'email_verified':
                return !!user.email && user.emailVerified === true;
            case 'wallet_linked':
                return !!user.walletAddress;
            case 'kyc_approved':
                return user.kycStatus === KycStatus.APPROVED;
            case '2fa_enabled':
                return user.twoFactorEnabled === true;
            case 'first_group_joined':
                return user.memberships && user.memberships.length > 0;
            default:
                return false;
        }
    }
}
