import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('signup')
  async signup(
    @Body() { email, password }: { email: string; password: string },
  ) {
    return this.authService.signup(email, password);
  }
}
