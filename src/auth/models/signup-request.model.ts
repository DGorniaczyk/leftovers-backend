export class SignupRequest {
  id: string;
  email: string;
  name: string | null;
  hashedPassword: string;
  expiresAt: Date;
}

export class CreateSignupRequest {
  email: string;
  name?: string | null;
  hashedPassword: string;
  expiresAt: Date;
}
