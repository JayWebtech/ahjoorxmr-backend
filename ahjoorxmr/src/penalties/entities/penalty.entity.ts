import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
    Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Group } from '../../groups/entities/group.entity';

export enum PenaltyStatus {
    PENDING = 'PENDING',
    PAID = 'PAID',
    WAIVED = 'WAIVED',
}

/**
 * Penalty entity representing a late contribution fee in a ROSCA group.
 * Tracks penalty assessment, payment, and waiver status.
 */
@Entity('penalties')
@Index(['groupId', 'roundNumber'])
@Index(['userId', 'groupId'])
@Index(['status'])
export class Penalty {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column('uuid')
    @Index()
    groupId: string;

    @ManyToOne(() => Group)
    @JoinColumn({ name: 'groupId' })
    group: Group;

    @Column('uuid')
    @Index()
    userId: string;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'userId' })
    user: User;

    @Column('int')
    roundNumber: number;

    @Column('varchar', { length: 255 })
    amount: string;

    @Column({ type: 'varchar', length: 12, default: 'XLM' })
    assetCode: string;

    @Column('timestamp')
    dueAt: Date;

    @Column('timestamp', { nullable: true })
    paidAt?: Date | null;

    @Column({
        type: 'enum',
        enum: PenaltyStatus,
        default: PenaltyStatus.PENDING,
    })
    status: PenaltyStatus;

    @Column('text', { nullable: true })
    waiverReason?: string | null;

    @Column('uuid', { nullable: true })
    waivedByUserId?: string | null;

    @Column('timestamp', { nullable: true })
    waivedAt?: Date | null;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
