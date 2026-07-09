export class ResetPasswordResult {
  public readonly message: string;
  constructor() {
    this.message = 'If this email is registered, a reset link has been sent.';
  }
}
