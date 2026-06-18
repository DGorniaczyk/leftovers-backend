import { Controller, Get } from '@nestjs/common';
import { UsersService } from './users.service';
import { ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { GetUsersResponseDto } from './dto/get-users.dto';

@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiOperation({ summary: 'Get all users' })
  @ApiOkResponse({
    description: 'Successfully retrieved users',
    type: [GetUsersResponseDto],
  })
  @Get()
  async findAll(): Promise<GetUsersResponseDto[]> {
    const users = await this.usersService.findAll();
    return users.map(({ password, ...user }) => user);
  }
}
