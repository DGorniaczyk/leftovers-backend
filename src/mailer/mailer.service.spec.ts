import { Test, TestingModule } from '@nestjs/testing';
import { MailerService } from './mailer.service';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import * as nodemailer from 'nodemailer';
import * as path from 'path';
import { SendEmailDto } from './dto/mailer.dto';

// Replace the whole module with an auto-mock so Jest never has to
// redefine a property on the real (non-configurable) namespace object.
jest.mock('nodemailer');

const mockConfigService = {
  getOrThrow: jest.fn((key: string) => {
    switch (key) {
      case 'EMAIL_HOST':
        return 'smtp.ethereal.email';
      case 'EMAIL_PORT':
        return '587';
      case 'EMAIL_USER':
        return 'user';
      case 'EMAIL_PASS':
        return 'pass';
      default:
        throw new Error(`Unexpected key ${key}`);
    }
  }),
  get: jest.fn((key: string) => {
    if (key === 'EMAIL_FROM') return 'sender@example.com';
    return undefined;
  }),
};

describe('MailerService', () => {
  let service: MailerService;
  let verifySpy: jest.Mock;
  let sendMailSpy: jest.Mock;

  beforeEach(async () => {
    verifySpy = jest.fn().mockResolvedValue(true);

    // Mirrors back whatever "to" was passed in, so info.accepted reflects
    // the actual recipient instead of being a hardcoded fake value.
    sendMailSpy = jest.fn().mockImplementation((mailOptions) =>
      Promise.resolve({
        accepted: Array.isArray(mailOptions.to)
          ? mailOptions.to
          : [mailOptions.to],
        response: '250 OK',
      }),
    );

    (nodemailer.createTransport as jest.Mock).mockReturnValue({
      verify: verifySpy,
      sendMail: sendMailSpy,
    });
    (nodemailer.getTestMessageUrl as jest.Mock).mockReturnValue(
      'https://ethereal.email/message/preview',
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailerService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<MailerService>(MailerService);

    mockConfigService.getOrThrow.mockClear();
    mockConfigService.get.mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should send HTML and text email using provided dto', async () => {
    const fromEmail = 'sender@example.com';
    const recipientEmail = 'recipient@example.com';

    const dto: SendEmailDto = {
      from: fromEmail,
      recipients: [recipientEmail],
      subject: 'Test',
      html: '<b>Your email content here</b>',
      text: 'Your text content',
    };

    const result = await service.sendEmail(dto);

    expect(verifySpy).toHaveBeenCalled();
    expect(sendMailSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        from: fromEmail,
        to: [recipientEmail],
        subject: 'Test',
        html: '<b>Your email content here</b>',
        text: 'Your text content',
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        status: 'success',
        info: expect.objectContaining({
          accepted: [recipientEmail],
        }),
      }),
    );
  });

  it('should render a template when templateDto.template is provided', async () => {
    const recipientEmail = 'recipient@example.com';

    const dto: SendEmailDto = {
      from: 'sender@example.com',
      recipients: [recipientEmail],
      subject: 'Template Test',
      html: '<b>fallback</b>',
      text: 'fallback text',
    };

    jest.spyOn(fs, 'readFile').mockResolvedValue('<p>Hello {{name}}</p>');

    const result = await service.sendEmail(dto, { template: 'welcome' });

    expect(fs.readFile).toHaveBeenCalledWith(
      expect.stringContaining(
        path.join('src', 'mailer', 'templates', 'welcome.hbs'),
      ),
      'utf8',
    );
    expect(sendMailSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        html: `<p>Hello ${recipientEmail}</p>`,
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        status: 'success',
        info: expect.objectContaining({
          accepted: [recipientEmail],
        }),
      }),
    );
  });
});
