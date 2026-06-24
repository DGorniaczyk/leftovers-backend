import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { GetTemplateDto, SendEmailDto } from './dto/mailer.dto';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as Handlebars from 'handlebars';
import type { Address } from 'nodemailer/lib/mailer';
import { IsOptional } from 'class-validator';

interface NormalizedRecipient {
  address: string;
  name?: string;
}

@Injectable()
export class MailerService {
  constructor(private readonly configService: ConfigService) {}

  private normalizeRecipient(recipient: Address): NormalizedRecipient {
    if (typeof recipient === 'string') {
      return { address: recipient };
    }
    return { address: recipient.address, name: recipient.name };
  }

  async mailTransport(): Promise<nodemailer.Transporter> {
    const transporter = nodemailer.createTransport({
      host: this.configService.getOrThrow<string>('EMAIL_HOST'),
      port: Number(this.configService.getOrThrow<string>('EMAIL_PORT')),
      secure: false,
      auth: {
        user: this.configService.getOrThrow<string>('EMAIL_USER'),
        pass: this.configService.getOrThrow<string>('EMAIL_PASS'),
      },
    });

    try {
      await transporter.verify();
      console.log('Mail server is ready to take messages');
    } catch (err) {
      console.error('Mail server verification failed:', err);
    }

    return transporter;
  }

  async sendEmail(dto: SendEmailDto, templateDto: GetTemplateDto = {}) {
    const transporter = await this.mailTransport();

    const from =
      dto.from ||
      this.configService.get<string>('EMAIL_FROM') ||
      this.configService.get<string>('EMAIL_USER');

    const normalizedRecipients = dto.recipients.map((recipient) =>
      this.normalizeRecipient(recipient as Address),
    );

    let html = dto.html;

    const firstRecipient = normalizedRecipients?.[0];
    const mergedContext = {
      recipients: normalizedRecipients,
      recipient: firstRecipient,
      name: firstRecipient?.name || firstRecipient?.address,
      email: firstRecipient?.address,
    };

    if (templateDto.template) {
      const srcRoot = path.resolve(process.cwd(), 'src');
      const templatePath = path.join(
        srcRoot,
        'mailer/templates',
        `${templateDto.template}.hbs`,
      );
      try {
        const templateSource = await fs.readFile(templatePath, 'utf8');
        const tpl = Handlebars.compile(templateSource);
        html = tpl(mergedContext);
      } catch (err) {
        console.error('Failed to render template', err);
        throw err;
      }
    }

    const mailOptions: nodemailer.SendMailOptions = {
      from,
      to: normalizedRecipients.map((recipient) =>
        recipient.name
          ? { name: recipient.name, address: recipient.address }
          : recipient.address,
      ),
      subject: dto.subject,
      html,
      text: dto.text,
    };

    const info = await transporter.sendMail(mailOptions);
    const previewUrl = nodemailer.getTestMessageUrl(info);
    console.log('Preview URL: %s', previewUrl);
    return { success: true, info, status: 'success' };
  }
}
