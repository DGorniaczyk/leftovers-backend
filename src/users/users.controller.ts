import { Controller, Get } from '@nestjs/common';
import { UsersService } from './users.service';
import { ApiOkResponse, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { GetUsersResponseDto } from './dtos/get-users.dto';

@Controller()
export class UsersController {
  constructor(private usersService: UsersService) {}

  @ApiOperation({ summary: 'Get all users' })
  @ApiOkResponse({
    description: 'Successfully retrieved users',
    type: [GetUsersResponseDto],
  })
  @Get()
  async findAll(): Promise<GetUsersResponseDto[]> {
    return this.usersService.findAll();
  }
}
