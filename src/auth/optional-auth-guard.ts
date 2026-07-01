import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = any>(
    err: unknown,
    user: unknown,
    info: unknown,
    context: ExecutionContext,
    status?: unknown,
  ): TUser {
    if (err) {
      throw err;
    } else return (user ?? null) as TUser;
  }
}
