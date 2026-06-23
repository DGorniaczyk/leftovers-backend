import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsEmail,
  IsArray,
  IsObject,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { Address } from 'nodemailer/lib/mailer';

export class SendEmailDto {
  @ApiPropertyOptional({
    description: 'From address',
    type: String,
    example: 'sender@example.com',
  })
  @IsOptional()
  @IsEmail()
  from: Address;

  @ApiProperty({
    description: 'Recipient addresses',
    type: [Object],
    example: ['alice@example.com', { address: 'bob@example.com', name: 'Bob' }],
  })
  @IsNotEmpty()
  @IsArray()
  recipients: Address[];

  @ApiProperty({ description: 'Email subject' })
  @IsString()
  subject: string;

  @ApiProperty({ description: 'HTML body' })
  @IsString()
  html: string;

  @ApiPropertyOptional({ description: 'Plain text body' })
  @IsOptional()
  @IsString()
  text: string;
}

export class GetTemplateDto {
  @ApiPropertyOptional({
    description: 'Template name to render (templates/<name>.hbs)',
    type: String,
    example: 'welcome',
  })
  @IsOptional()
  @IsString()
  template?: string;
}
