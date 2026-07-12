import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthUser } from './crypto';

/** Injects the authenticated AuthUser (populated by JwtAuthGuard). */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser =>
    ctx.switchToHttp().getRequest().user,
);
