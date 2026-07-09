import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';

export const RESET_PASSWORD_TOKEN_JWT_SERVICE = 'RESET_PASSWORD_TOKEN_JWT_SERVICE';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('RESET_PASSWORD_JWT_SECRET'),
        signOptions: { expiresIn: '24h' },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    {
      provide: RESET_PASSWORD_TOKEN_JWT_SERVICE,
      useExisting: JwtService,
    },
  ],
  exports: [RESET_PASSWORD_TOKEN_JWT_SERVICE],
})
export class ResetPasswordTokenModule {}
