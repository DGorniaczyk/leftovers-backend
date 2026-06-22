import { IsNotEmpty, IsOptional, IsString, IsEmail } from 'class-validator';
import { Address } from 'nodemailer/lib/mailer';

export class SendEmailDto {
  @IsEmail()
  from?: Address;
  @IsNotEmpty()
  @IsEmail({}, { each: true })
  recipients: Address[];
  @IsString()
  subject: string;
  html: string;
  @IsOptional()
  @IsString()
  text?: string;
}
