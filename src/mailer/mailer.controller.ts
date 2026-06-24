import {
  Controller,
  Post,
  Body,
  UsePipes,
  ValidationPipe,
  HttpStatus,
} from '@nestjs/common';
import { MailerService } from './mailer.service';
import { ApiResponse, ApiTags } from '@nestjs/swagger';
import { SendEmailDto } from './dto/mailer.dto';
import { SendEmailResponse } from './dto/responses/send-email.dto';

@ApiTags('mailer')
@Controller('mailer')
export class MailerController {
  constructor(private readonly mailerService: MailerService) {}

  @Post('sendEmail')
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Email sent successfully',
  })
  sendEmail(@Body() dto: SendEmailDto): Promise<SendEmailResponse> {
    return this.mailerService.sendEmail(dto);
  }
}
