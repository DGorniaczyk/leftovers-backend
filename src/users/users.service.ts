import { Injectable } from '@nestjs/common';
import { UsersRepository } from './users.repository';

@Injectable()
export class UsersService {
  constructor(private usersRepository: UsersRepository) {}

  async findAll() {
    return this.usersRepository.findAll();
  }

  async findByEmail(email: string) {
    return this.usersRepository.findByEmail(email);
  }

  async create(email: string, password: string) {
    return this.usersRepository.create(email, password);
  }
}
