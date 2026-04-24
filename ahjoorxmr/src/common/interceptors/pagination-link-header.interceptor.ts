import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

@Injectable()
export class PaginationLinkHeaderInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      tap((body) => {
        if (!body?.meta) return;

        const { page, limit, totalPages } = body.meta;
        const ctx = context.switchToHttp();
        const req = ctx.getRequest<Request>();
        const res = ctx.getResponse<Response>();

        const base = `${req.protocol}://${req.get('host')}${req.path}`;
        const params = new URLSearchParams(req.query as Record<string, string>);
        const links: string[] = [];

        if (page > 1) {
          params.set('page', String(page - 1));
          params.set('limit', String(limit));
          links.push(`<${base}?${params.toString()}>; rel="prev"`);
        }

        if (page < totalPages) {
          params.set('page', String(page + 1));
          params.set('limit', String(limit));
          links.push(`<${base}?${params.toString()}>; rel="next"`);
        }

        if (links.length) {
          res.setHeader('Link', links.join(', '));
        }
      }),
    );
  }
}
