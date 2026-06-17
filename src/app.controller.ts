import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { UsersService } from './users/users.service';

@Controller()
export class AppController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async users(): Promise<{ id: number; email: string; name: string }[]> {
    return await this.usersService.findAll();
  }
}
