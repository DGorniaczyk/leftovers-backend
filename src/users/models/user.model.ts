export class User {
  id: string;
  email: string;
  name: string | null;
  passwordHash: string;
}

export class CreateUser {
  email: string;
  name?: string | null;
  passwordHash: string;
}
