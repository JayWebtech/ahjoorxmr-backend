import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  Version,
  Req,
  Res,
  TooManyRequestsException,
  Logger,
  Sse,
  MessageEvent,
  OnModuleDestroy,
} from '@nestjs/common';
import { Observable, Subject, interval, merge } from 'rxjs';
import { map, takeUntil } from 'rxjs/operators';
import { Request, Response } from 'express';
import { NotificationsService } from './notifications.service';
import { PaginateNotificationsDto } from './notifications.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RedisService } from '../common/redis/redis.service';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

@Controller('notifications')
@Version('1')
@UseGuards(JwtAuthGuard)
export class NotificationsController implements OnModuleDestroy {
  private readonly logger = new Logger(NotificationsController.name);
  /** userId -> set of destroy subjects (one per active SSE connection) */
  readonly connections = new Map<string, Set<Subject<void>>>();

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {}

  @Get()
  findAll(
    @CurrentUser('id') userId: string,
    @Query() query: PaginateNotificationsDto,
    @Query('cursor') cursor?: string,
  ) {
    return this.notificationsService.findAll(userId, query, cursor);
  }

  @Get('unread-count')
  getUnreadCount(@CurrentUser('id') userId: string) {
    return this.notificationsService.getUnreadCount(userId);
  }

  @Patch('read-all')
  @HttpCode(HttpStatus.OK)
  markAllAsRead(@CurrentUser('id') userId: string) {
    return this.notificationsService.markAllAsRead(userId);
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  markAsRead(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.notificationsService.markAsRead(id, userId);
  }

  /**
   * SSE stream — authenticate via Bearer token or ?token= query param
   * (browser EventSource cannot set custom headers).
   */
  @Sse('stream')
  async stream(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Observable<MessageEvent>> {
    const maxConns = this.configService.get<number>('SSE_MAX_CONNECTIONS_PER_USER', 3);

    const authHeader = req.headers['authorization'];
    const tokenFromQuery = (req.query as Record<string, string>)['token'];
    const raw = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : tokenFromQuery;

    let userId: string;
    try {
      const payload = this.jwtService.verify<{ sub: string }>(raw ?? '');
      userId = payload.sub;
    } catch {
      res.status(401).end();
      return new Observable();
    }

    if (!this.connections.has(userId)) {
      this.connections.set(userId, new Set());
    }
    const userConns = this.connections.get(userId)!;
    if (userConns.size >= maxConns) {
      throw new TooManyRequestsException('SSE connection limit reached');
    }

    const destroy$ = new Subject<void>();
    userConns.add(destroy$);

    // Dedicated Redis subscriber connection per SSE stream
    const redisClient = this.redisService.getClient().duplicate();
    await redisClient.subscribe(`notifications:${userId}`);

    const notification$ = new Subject<MessageEvent>();
    redisClient.on('message', (_channel: string, message: string) => {
      notification$.next({ data: JSON.parse(message) });
    });

    // Ping every 30 s to keep the connection alive through proxies
    const ping$ = interval(30_000).pipe(
      map(() => ({ type: 'ping', data: '' } as MessageEvent)),
    );

    req.on('close', () => {
      destroy$.next();
      destroy$.complete();
      userConns.delete(destroy$);
      redisClient.unsubscribe().then(() => redisClient.quit()).catch(() => {});
      this.logger.debug(`SSE disconnected for user ${userId}`);
    });

    return merge(notification$, ping$).pipe(takeUntil(destroy$));
  }

  onModuleDestroy() {
    this.connections.forEach((conns) => conns.forEach((s) => s.complete()));
    this.connections.clear();
  }
}
