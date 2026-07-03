export class User {
  id: string;
  email: string;
  name: string | null;
  hashedPassword: string;
}

export class CreateUser {
  email: string;
  name?: string | null;
  hashedPassword: string;
}
