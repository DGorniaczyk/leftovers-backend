import { Test, TestingModule } from '@nestjs/testing';
import { MailerService } from './mailer.service';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';

const nodemailer = require('nodemailer');

let transporter;
let testAccount;
let verifySpy: jest.SpyInstance;
let sendMailSpy: jest.SpyInstance;

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

beforeAll(async () => {
  testAccount = await nodemailer.createTestAccount();
  transporter = nodemailer.createTransport({
    host: testAccount.smtp.host,
    port: testAccount.smtp.port,
    secure: testAccount.smtp.secure,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  });
});

describe('MailerService', () => {
  let service: MailerService;

  beforeAll(() => {
    jest.spyOn(nodemailer, 'createTransport').mockReturnValue(transporter as any);
    jest.spyOn(nodemailer, 'getTestMessageUrl').mockReturnValue('https://ethereal.email/message/preview');
    verifySpy = jest.spyOn(transporter, 'verify');
    sendMailSpy = jest.spyOn(transporter, 'sendMail');
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailerService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<MailerService>(MailerService);
    verifySpy.mockClear();
    sendMailSpy.mockClear();
    (mockConfigService.getOrThrow as jest.Mock).mockClear();
    (mockConfigService.get as jest.Mock).mockClear();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should send HTML and text email using provided dto', async () => {
    const dto = {
      from: 'sender@example.com',
      recipients: ['recipient@example.com'],
      subject: 'Test',
      html: '<b>Your email content here</b>',
      text: 'Your text content',
    } as any;

    const result = await service.sendEmail(dto);

    expect(verifySpy).toHaveBeenCalled();
    expect(sendMailSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'sender@example.com',
        to: ['recipient@example.com'],
        subject: 'Test',
        html: '<b>Your email content here</b>',
        text: 'Your text content',
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        info: expect.objectContaining({
          accepted: ['recipient@example.com'],
        }),
      }),
    );
  });

  it('should render a template when templateDto.template is provided', async () => {
    const dto = {
      from: 'sender@example.com',
      recipients: ['recipient@example.com'],
      subject: 'Template Test',
      html: '<b>fallback</b>',
      text: 'fallback text',
    } as any;

    jest.spyOn(fs, 'readFile').mockResolvedValue('<p>Hello {{name}}</p>');

    const result = await service.sendEmail(dto, { template: 'welcome' } as any);

    expect(fs.readFile).toHaveBeenCalledWith(
      expect.stringContaining('src/mailer/templates/welcome.hbs'),
      'utf8',
    );
    expect(sendMailSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        html: '<p>Hello recipient@example.com</p>',
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        info: expect.objectContaining({
          accepted: ['recipient@example.com'],
        }),
      }),
    );
  });
});
