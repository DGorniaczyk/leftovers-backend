import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, IsStrongPassword } from 'class-validator';

export class SignUpDto {
  @ApiProperty({
    description: 'The email address of the user. Must be unique and in a valid email format.',
    example: 'john.smith@example.com',
  })
  @IsEmail({}, { message: 'Email must be a valid email address' })
  email: string;

  @ApiProperty({
    description: 'Full name of the user',
    example: 'John Smith',
  })
  @IsNotEmpty({ message: 'Name must be provided' })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'The password for the user account. Must be at least 8 characters long.',
    example: 'P@ssw0rd',
  })
  @IsNotEmpty({ message: 'Password is required' })
  @IsStrongPassword(
    {
      minLength: 8,
      minLowercase: 1,
      minUppercase: 1,
      minNumbers: 1,
      minSymbols: 1,
    },
    {
      message:
        'Password must be at least 8 characters long and include uppercase, lowercase, numbers, and symbols',
    },
  )
  password: string;
}
