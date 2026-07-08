import { Test, TestingModule } from '@nestjs/testing';
import { InternalServerErrorException } from '@nestjs/common';
import { UploadService } from './upload.service';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

jest.mock('@aws-sdk/client-s3');
jest.mock('@aws-sdk/s3-request-presigner');

describe('UploadService', () => {
  let service: UploadService;

  const mockSend = jest.fn();
  const BUCKET = 'test-bucket';
  const REGION = 'eu-west-1';

  beforeEach(async () => {
    (S3Client as jest.Mock).mockImplementation(() => ({ send: mockSend }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UploadService,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: (key: string) => {
              if (key === 'AWS_S3_REGION') return REGION;
              if (key === 'AWS_S3_BUCKET_NAME') return BUCKET;
              throw new Error(`Unknown config key: ${key}`);
            },
          },
        },
      ],
    }).compile();

    service = module.get(UploadService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('upload', () => {
    const mockFile: Express.Multer.File = {
      fieldname: 'coverImage',
      originalname: 'soup.jpg',
      encoding: '7bit',
      mimetype: 'image/jpeg',
      buffer: Buffer.from('fake-image'),
      size: 1024,
      stream: null,
      destination: '',
      filename: '',
      path: '',
    };

    it('sends a PutObjectCommand with correct parameters', async () => {
      mockSend.mockResolvedValue({});

      await service.upload('recipes/test.jpg', mockFile);

      expect(mockSend).toHaveBeenCalledTimes(1);
      const command = mockSend.mock.calls[0][0];
      expect(command).toBeInstanceOf(PutObjectCommand);
    });

    it('returns void on success', async () => {
      mockSend.mockResolvedValue({});

      const result = await service.upload('recipes/test.jpg', mockFile);

      expect(result).toBeUndefined();
    });

    it('propagates errors from S3', async () => {
      mockSend.mockRejectedValue(new Error('S3 error'));

      await expect(service.upload('recipes/test.jpg', mockFile)).rejects.toThrow('S3 error');
    });
  });

  describe('remove', () => {
    it('sends a DeleteObjectCommand and returns true on success', async () => {
      mockSend.mockResolvedValue({});

      const result = await service.remove('recipes/test.jpg');

      expect(result).toBe(true);
      const command = mockSend.mock.calls[0][0];
      expect(command).toBeInstanceOf(DeleteObjectCommand);
    });

    it('returns false when S3 throws', async () => {
      mockSend.mockRejectedValue(new Error('S3 error'));

      const result = await service.remove('recipes/test.jpg');

      expect(result).toBe(false);
    });
  });

  describe('getFileUrl', () => {
    it('generates a presigned URL using GetObjectCommand', async () => {
      const fakeUrl = 'https://s3.example.com/recipes/test.jpg?signature=xxx';
      (getSignedUrl as jest.Mock).mockResolvedValue(fakeUrl);

      const result = await service.getFileUrl('recipes/test.jpg');

      expect(getSignedUrl).toHaveBeenCalledTimes(1);
      const [, command, options] = (getSignedUrl as jest.Mock).mock.calls[0];
      expect(command).toBeInstanceOf(GetObjectCommand);
      expect(options.expiresIn).toBe(3600);
      expect(result).toBe(fakeUrl);
    });

    it('uses a custom expiresIn when provided', async () => {
      (getSignedUrl as jest.Mock).mockResolvedValue('https://example.com/url');

      await service.getFileUrl('recipes/test.jpg', 7200);

      const [, , options] = (getSignedUrl as jest.Mock).mock.calls[0];
      expect(options.expiresIn).toBe(7200);
    });

    it('throws InternalServerErrorException when signing fails', async () => {
      (getSignedUrl as jest.Mock).mockRejectedValue(new Error('signing failed'));

      await expect(service.getFileUrl('recipes/test.jpg')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });
});
