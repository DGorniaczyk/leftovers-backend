import { IsEmail, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ConfirmRegisterDto {
  @ApiProperty({
    example: 'john.smith@example.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'kmsdfp12ld256123sx',
  })
  @IsString()
  token: string;
}
