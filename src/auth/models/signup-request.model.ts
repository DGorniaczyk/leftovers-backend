export class SignupRequest {
  id: string;
  email: string;
  name: string | null;
  passwordHash: string;
  token: string;
  expiresAt: Date;
}

export class CreateSignupRequest {
  email: string;
  name: string;
  passwordHash: string;
  token: string;
  expiresAt: Date;
}
