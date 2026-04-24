import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class ProxyHopMiddleware implements NestMiddleware {
  private readonly maxHops: number;

  constructor(private readonly configService: ConfigService) {
    this.maxHops = this.configService.get<number>('MAX_PROXY_HOPS', 2);
  }

  use(req: Request, _res: Response, next: NextFunction): void {
    const xff = req.headers['x-forwarded-for'];
    if (!xff) return next();

    const hops = (Array.isArray(xff) ? xff.join(',') : xff)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (hops.length > this.maxHops) {
      throw new ForbiddenException('Too many proxy hops');
    }

    next();
  }
}
