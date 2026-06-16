import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';
import { UsersService } from './users/users.service';
import { UsersModule } from './users/users.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }),
    UsersModule
  ],
  controllers: [AppController],
  providers: [AppService, PrismaService, UsersService],
})
export class AppModule {}
