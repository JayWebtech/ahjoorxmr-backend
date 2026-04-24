import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiKeysService } from '../api-keys.service';

@Injectable()
export class ApiKeyAuthGuard implements CanActivate {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const header: string | undefined = req.headers['x-api-key'];
    if (!header) throw new UnauthorizedException('Missing X-Api-Key header');

    const apiKey = await this.apiKeysService.validateAndTouch(header, {
      ip: req.ip,
    });

    req.user = { id: apiKey.ownerId, apiKeyId: apiKey.id, scopes: apiKey.scopes };
    return true;
  }
}
