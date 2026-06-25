import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { MailerService } from '../src/mailer/mailer.service';

describe('MailerService (e2e)', () => {
  let mailerService: MailerService;
  let testAccount: nodemailer.TestAccount;

  beforeAll(async () => {
    testAccount = await nodemailer.createTestAccount();

    const configMap: Record<string, string> = {
      EMAIL_HOST: testAccount.smtp.host,
      EMAIL_PORT: String(testAccount.smtp.port),
      EMAIL_USER: testAccount.user,
      EMAIL_PASS: testAccount.pass,
      EMAIL_FROM: testAccount.user,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailerService,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: (key: string) => {
              if (!(key in configMap)) {
                throw new Error(`Missing test config for key: ${key}`);
              }
              return configMap[key];
            },
            get: (key: string) => configMap[key],
          },
        },
      ],
    }).compile();

    mailerService = module.get(MailerService);
  });

  it('should send a plain HTML email successfully', async () => {
    const result = await mailerService.sendEmail({
      recipients: [{ address: 'recipient@example.com' }],
      subject: 'E2E Test Email',
      html: '<p>Hello from the e2e test</p>',
    });

    expect(result.success).toBe(true);
    expect(result.info.accepted).toContain('recipient@example.com');

    const previewUrl = nodemailer.getTestMessageUrl(result.info);
    expect(previewUrl).toBeTruthy();
    console.log('Preview URL:', previewUrl);
  });

  it('should render the confirm-register template with the provided context', async () => {
    const sendMailMock = jest.fn().mockResolvedValue({
      accepted: ['recipient@example.com'],
      rejected: [],
      messageId: 'test-message-id',
    });

    jest.spyOn(mailerService, 'mailTransport').mockResolvedValue({
      sendMail: sendMailMock,
    } as any);

    const confirmLink = 'http://localhost:3000/confirm-register?token=abc123';

    const result = await mailerService.sendEmail(
      {
        recipients: [{ address: 'recipient@example.com' }],
        subject: 'Confirm your account registration',
      },
      {
        template: 'confirm-register',
        context: {
          confirmLink,
          name: 'Jane Doe',
        },
      },
    );

    expect(result.success).toBe(true);

    expect(sendMailMock).toHaveBeenCalledTimes(1);

    const sentMailOptions = sendMailMock.mock.calls[0][0];

    expect(sentMailOptions.subject).toBe('Confirm your account registration');

    expect(sentMailOptions.html).toContain(confirmLink.replace('=', '&#x3D;'));
    expect(sentMailOptions.html).toContain('Jane Doe');
  });

  it('should reject if the SMTP credentials are invalid', async () => {
    const badModule: TestingModule = await Test.createTestingModule({
      providers: [
        MailerService,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: (key: string) => {
              const badConfig: Record<string, string> = {
                EMAIL_HOST: testAccount.smtp.host,
                EMAIL_PORT: String(testAccount.smtp.port),
                EMAIL_USER: 'wrong-user',
                EMAIL_PASS: 'wrong-password',
              };
              return badConfig[key];
            },
            get: () => undefined,
          },
        },
      ],
    }).compile();

    const badMailerService = badModule.get(MailerService);

    await expect(
      badMailerService.sendEmail({
        recipients: [{ address: 'recipient@example.com' }],
        subject: 'Should fail',
        html: '<p>test</p>',
      }),
    ).rejects.toThrow();
  });
});
