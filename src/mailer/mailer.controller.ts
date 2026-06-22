import { Controller, Post } from '@nestjs/common';
import { MailerService } from './mailer.service';
import { ApiProperty, ApiResponse } from '@nestjs/swagger';
import { SendEmailDto } from './dto/mailer.dto';

@Controller('mailer')
export class MailerController {
  constructor(private readonly mailerService: MailerService) {}
}
