import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity('audit_logs')
export class AuditLog extends BaseEntity {
  @Column()
  action: string;

  @Column()
  entityType: string;

  @Column()
  entityId: string;

  @Column()
  userId: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;
}
