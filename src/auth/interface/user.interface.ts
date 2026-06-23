export interface UserJwtPayload {
  readonly sub: string;
  readonly email: string;
  readonly iat: number;
  readonly exp: number;
}

export interface User {
  readonly userID: string;
  readonly email: string;
}
