import {
  Controller,
  Post,
  Body,
  UsePipes,
  ValidationPipe,
  HttpCode,
} from '@nestjs/common';
import { MailerService } from './mailer.service';
import { ApiResponse, ApiTags } from '@nestjs/swagger';
import { SendEmailDto } from './dto/mailer.dto';

@ApiTags('mailer')
@Controller('mailer')
export class MailerController {
  constructor(private readonly mailerService: MailerService) {}

  @Post('sendEmail')
  @HttpCode(201)
  @ApiResponse({ status: 201, description: 'Email sent successfully' })
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async sendEmail(@Body() dto: SendEmailDto) {
    return this.mailerService.sendEmail(dto);
  }
}
