import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { SendEmailDto } from './dto/mailer.dto';

@Injectable()
export class MailerService {
  mailTransport() {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    return transporter;
  }
  async sendEmail(dto: SendEmailDto) {}
}
