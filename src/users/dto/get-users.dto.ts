import { ApiProperty } from '@nestjs/swagger';

export class GetUsersResponseDto {
  @ApiProperty({
    description: 'The unique identifier of the user',
    example: '420',
  })
  id: string;

  @ApiProperty({
    description: 'The name of the user',
    example: 'John Smith',
    nullable: true,
  })
  name: string | null;

  @ApiProperty({
    description: 'The email address of the user',
    example: 'john.smith@example.com',
  })
  email: string;
}
