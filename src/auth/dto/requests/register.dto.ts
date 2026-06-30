import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, IsStrongPassword, Validate } from 'class-validator';

export class RegisterRequest {
  @ApiProperty()
  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  name: string;

  @IsStrongPassword()
  password: string;
}
