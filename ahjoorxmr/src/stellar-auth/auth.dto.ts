import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class ChallengeRequestDto {
  @ApiProperty({
    description: 'Stellar wallet address',
    example: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
  })
  @IsString()
  @IsNotEmpty()
  walletAddress: string;
}

export class ChallengeResponseDto {
  @ApiProperty({
    description: 'Challenge message to sign',
    example: 'Sign this message to authenticate with Cheese Platform.\n\nWallet: G...\nNonce: ...\nTimestamp: ...',
  })
  challenge: string;
}

export class VerifyRequestDto {
  @ApiProperty({
    description: 'Stellar wallet address',
    example: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
  })
  @IsString()
  @IsNotEmpty()
  walletAddress: string;

  @ApiProperty({
    description: 'Base64-encoded signature',
    example: 'base64signature...',
  })
  @IsString()
  @IsNotEmpty()
  signature: string;

  @ApiProperty({
    description: 'Challenge message that was signed',
    example: 'Sign this message to authenticate with Cheese Platform.\n\nWallet: G...\nNonce: ...\nTimestamp: ...',
  })
  @IsString()
  @IsNotEmpty()
  challenge: string;
}

export class RefreshRequestDto {
  @ApiProperty({
    description: 'Refresh token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

export class TokenResponseDto {
  @ApiProperty({
    description: 'JWT access token',
    example: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken: string;

  @ApiProperty({
    description: 'JWT refresh token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  refreshToken: string;
}
