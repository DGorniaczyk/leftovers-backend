import { Injectable } from '@nestjs/common';
import { UsersRepository } from './users.repository';
import { User, CreateUser } from './models/user.model';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async findAll(): Promise<User[]> {
    return this.usersRepository.findAll();
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findByEmail(email);
  }

  async create(input: CreateUser): Promise<User> {
    return this.usersRepository.create(input);
  }
}
