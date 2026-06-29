import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { User } from './interface/user.interface';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = User>(err: Error | null, user: TUser | false): TUser {
    if (err || !user) {
      return null as TUser;
    }
    return user;
  }

  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }
}
