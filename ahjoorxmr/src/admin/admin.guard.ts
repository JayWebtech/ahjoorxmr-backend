import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();

    // IP allowlisting
    const allowedIps = this.configService.get<string>('ADMIN_ALLOWED_IPS');
    if (allowedIps) {
      const list = allowedIps.split(',').map((ip) => ip.trim());
      const clientIp = req.ip || req.connection?.remoteAddress || '';
      if (!list.includes(clientIp)) {
        throw new ForbiddenException('IP not allowed');
      }
    }

    // JWT authentication
    const authHeader: string | undefined = req.headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException();
    }

    let payload: any;
    try {
      payload = this.jwtService.verify(authHeader.slice(7), {
        secret:
          this.configService.get<string>('JWT_ACCESS_SECRET') ||
          'default_access_secret',
      });
    } catch {
      throw new UnauthorizedException();
    }

    if (payload?.role !== 'admin') {
      throw new ForbiddenException('Admin role required');
    }

    req.user = payload;
    return true;
  }
}
