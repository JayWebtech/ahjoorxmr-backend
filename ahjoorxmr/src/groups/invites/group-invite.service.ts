import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  GoneException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { GroupInvite, InviteStatus } from '../entities/group-invite.entity';
import { Group } from '../entities/group.entity';
import { Membership } from '../../memberships/entities/membership.entity';
import { MembershipStatus } from '../../memberships/entities/membership-status.enum';
import { CreateGroupInviteDto } from './group-invite.dto';
import { MailService } from '../../mail/mail.service';
import { User } from '../../users/entities/user.entity';

@Injectable()
export class GroupInviteService {
  constructor(
    @InjectRepository(GroupInvite)
    private readonly inviteRepo: Repository<GroupInvite>,
    @InjectRepository(Group)
    private readonly groupRepo: Repository<Group>,
    @InjectRepository(Membership)
    private readonly membershipRepo: Repository<Membership>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
  ) {}

  private generateCode(): string {
    return randomBytes(9).toString('base64url').slice(0, 12);
  }

  async createInvite(
    groupId: string,
    requesterId: string,
    dto: CreateGroupInviteDto,
  ): Promise<{ invite: GroupInvite; inviteLink: string }> {
    const group = await this.groupRepo.findOne({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Group not found');

    const membership = await this.membershipRepo.findOne({
      where: { groupId, userId: requesterId },
    });
    if (!membership || group.adminWallet !== requesterId) {
      // Check if requester is the group admin by userId match via wallet
      const requester = await this.userRepo.findOne({ where: { id: requesterId } });
      if (!requester || group.adminWallet !== requester.walletAddress) {
        throw new ForbiddenException('Only the group admin can create invites');
      }
    }

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + dto.expiryHours);

    const invite = this.inviteRepo.create({
      groupId,
      createdBy: requesterId,
      code: this.generateCode(),
      maxUses: dto.maxUses ?? 1,
      usedCount: 0,
      expiresAt,
      status: InviteStatus.ACTIVE,
    });

    await this.inviteRepo.save(invite);

    const appUrl = this.configService.get<string>('APP_URL') || 'https://app.example.com';
    const inviteLink = `${appUrl}/groups/join/${invite.code}`;

    if (dto.recipientEmail) {
      this.mailService
        .sendMail({
          to: dto.recipientEmail,
          subject: `You're invited to join ${group.name}`,
          html: `<p>Join the group using this link: <a href="${inviteLink}">${inviteLink}</a></p><p>Expires: ${expiresAt.toISOString()}</p>`,
        })
        .catch(() => null);
    }

    return { invite, inviteLink };
  }

  async joinByCode(
    code: string,
    userId: string,
    walletAddress: string,
  ): Promise<Membership> {
    return this.dataSource.transaction(async (manager) => {
      // Lock the invite row for atomic usedCount increment
      const invite = await manager
        .createQueryBuilder(GroupInvite, 'invite')
        .setLock('pessimistic_write')
        .where('invite.code = :code', { code })
        .getOne();

      if (!invite) throw new NotFoundException('Invite not found');

      if (invite.status !== InviteStatus.ACTIVE || invite.expiresAt < new Date()) {
        throw new GoneException('Invite has expired');
      }

      if (invite.usedCount >= invite.maxUses) {
        throw new GoneException('Invite has reached maximum uses');
      }

      // Idempotency: return existing membership if already joined
      const existing = await manager.findOne(Membership, {
        where: { groupId: invite.groupId, userId },
      });
      if (existing) return existing;

      // Increment usedCount atomically
      await manager.increment(GroupInvite, { id: invite.id }, 'usedCount', 1);

      if (invite.usedCount + 1 >= invite.maxUses) {
        await manager.update(GroupInvite, invite.id, { status: InviteStatus.EXHAUSTED });
      }

      const membership = manager.create(Membership, {
        groupId: invite.groupId,
        userId,
        walletAddress,
        status: MembershipStatus.ACTIVE,
        hasReceivedPayout: false,
        hasPaidCurrentRound: false,
        payoutOrder: null,
      });

      return manager.save(Membership, membership);
    });
  }

  async expireStaleInvites(): Promise<number> {
    const result = await this.inviteRepo.update(
      { status: InviteStatus.ACTIVE, expiresAt: LessThan(new Date()) },
      { status: InviteStatus.EXPIRED },
    );
    return result.affected ?? 0;
  }
}
