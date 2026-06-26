import { User } from '../../../users/models/user.model';

export class ConfirmRegisterResponse {
  id: string;
  email: string;

  static from(user: User): ConfirmRegisterResponse {
    return { id: user.id, email: user.email };
  }
}
