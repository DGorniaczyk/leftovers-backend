import { Controller, Get, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { GetUsersResponseDto } from './dto/get-users.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth-guard';

@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiOperation({ summary: 'Get all users' })
  @ApiOkResponse({
    description: 'Successfully retrieved users',
    type: [GetUsersResponseDto],
  })
  @UseGuards(JwtAuthGuard)
  @Get()
  async findAll(): Promise<GetUsersResponseDto[]> {
    const users = await this.usersService.findAll();
    return users.map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name,
    }));
  }
}
