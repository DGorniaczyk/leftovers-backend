import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class ResetPasswordRequestDto {
  @ApiProperty({ example: 'john.smith@example.com' })
  @IsEmail({}, { message: 'Email must be a valid email address' })
  email: string;
}
