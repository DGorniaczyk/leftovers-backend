export interface UserJwtPayload {
  readonly sub: string;
  readonly email: string;
  readonly iat: number;
  readonly exp: number;
}

export interface User {
  readonly userId: string;
  readonly email: string;
}
