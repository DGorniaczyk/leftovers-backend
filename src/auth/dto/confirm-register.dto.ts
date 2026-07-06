import { IsEmail, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ConfirmRegisterDto {
  @ApiProperty({
    example: 'kmsdfp12ld256123sx',
  })
  @IsString()
  token: string;
}
