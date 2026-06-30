import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsEmail,
  IsArray,
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddressDto {
  @ApiProperty({ example: 'bob@example.com' })
  @IsEmail()
  address: string;

  @ApiPropertyOptional({ example: 'Bob' })
  @IsOptional()
  @IsString()
  name?: string;
}

function IsAddress(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isAddress',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: any) {
          if (typeof value === 'string') {
            return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
          }
          return (
            typeof value === 'object' &&
            value !== null &&
            typeof value.address === 'string'
          );
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be an email string or { address, name } object`;
        },
      },
    });
  };
}

export class SendEmailDto {
  @ApiPropertyOptional({
    description: 'From address',
    example: 'sender@example.com',
  })
  @IsOptional()
  @IsAddress()
  from?: string | AddressDto;

  @ApiProperty({
    description: 'Recipient addresses',
    example: ['alice@example.com', { address: 'bob@example.com', name: 'Bob' }],
  })
  @IsNotEmpty()
  @IsArray()
  @IsAddress({ each: true })
  recipients: (string | AddressDto)[];

  @ApiProperty({ description: 'Email subject' })
  @IsString()
  subject: string;

  @ApiProperty({ description: 'HTML body' })
  @IsString()
  @IsOptional()
  html?: string;

  @ApiPropertyOptional({ description: 'Plain text body' })
  @IsOptional()
  @IsString()
  text?: string;
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

  @IsOptional()
  context?: Record<string, unknown>;
}
