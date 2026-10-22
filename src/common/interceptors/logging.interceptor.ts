import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { Observable, tap } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const reply = context.switchToHttp().getResponse<FastifyReply>();
    const requestId =
      (request.headers['x-request-id'] as string) ?? randomUUID();

    request.headers['x-request-id'] = requestId;
    reply.header('x-request-id', requestId);

    const method = request.method;
    const url = request.url;
    const startedAt = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          this.logger.log(
            `${method} ${url} ${reply.statusCode} ${Date.now() - startedAt}ms [${requestId}]`
          );
        },
        error: (error: { status?: number }) => {
          const status = error?.status ?? 500;
          const message = `${method} ${url} ${status} ${Date.now() - startedAt}ms [${requestId}]`;

          if (status >= 500) {
            this.logger.error(message);
          } else {
            this.logger.warn(message);
          }
        },
      })
    );
  }
}
