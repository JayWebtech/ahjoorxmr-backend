import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
  MODERATOR = 'moderator',
}

/**
 * User entity representing authenticated users in the system.
 */
@Entity('users')
export class User extends BaseEntity {
  @Column({ unique: true })
  @Index()
  walletAddress: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.USER,
  })
  role: UserRole;

  @Column({ nullable: true })
  refreshTokenHash: string | null;
}
