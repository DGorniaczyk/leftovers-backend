import { Controller, Post, Body, HttpStatus, HttpCode, Request, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import {
  ApiResponse,
  ApiOperation,
  ApiBody,
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiConflictResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ConfirmRegisterDto } from './dto/confirm-register.dto';
import { SignUpDto } from './dto/SignUp.dto';
import { AuthGuard } from '@nestjs/passport';
import { LoginResponse } from './dto/responses/login.dto';
import { RegisterInput } from './dto/inputs/register-input.dto';
import { CurrentUser } from './decorators/current-user-decorator.dto';
import { ConfirmRegisterInput } from './dto/inputs/confirm-register-input.dto';
import type { User as AuthenticatedUser } from './interface/user.interface';
import { RegisterConfirmationSentResponse } from './dto/responses/register-confirmation-sent.response';
import { ConfirmRegisterResponse } from './dto/responses/confirm-register.response';
import { ResetPasswordInput } from './dto/inputs/reset-password.input';
import { ConfirmResetPasswordInput } from './dto/inputs/confirm-reset-password.input';
import { ResetPasswordRequestDto } from './dto/requests/reset-password-request.dto';
import { ConfirmResetPasswordDto } from './dto/confirm-reset-password.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({
    summary: 'User signup',
    description: 'Deprecated. Use POST /auth/register instead',
    deprecated: true,
  })
  @ApiOkResponse({ description: 'User successfully signed up' })
  @ApiConflictResponse({ description: 'User already exists' })
  @ApiBadRequestResponse({ description: 'User data is invalid' })
  @Post('signup')
  async signUp(@Body() createUserDto: SignUpDto) {
    return this.authService.signUp(createUserDto.email, createUserDto.password);
  }

  @ApiOperation({ summary: 'User login' })
  @ApiOkResponse({ description: 'User successfully logged in' })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials' })
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('local'))
  @Post('login')
  async login(@CurrentUser() user: AuthenticatedUser): Promise<LoginResponse> {
    return this.authService.login(user);
  }

  @ApiOperation({
    summary: 'Start the signup process to get an email with confirmation link',
  })
  @ApiBody({ type: SignUpDto, description: 'User registration data' })
  @ApiOkResponse({
    description: 'User began registration process',
    schema: { example: { message: 'Confirmation email sent.' } },
  })
  @ApiConflictResponse({
    description: 'User already exists or has a not confirmed signup request',
    schema: {
      example: {
        message: 'Email already registered',
        error: 'Conflict',
        statusCode: HttpStatus.CONFLICT,
      },
    },
  })
  @Post('register')
  @HttpCode(HttpStatus.OK)
  async register(@Body() dto: SignUpDto): Promise<RegisterConfirmationSentResponse> {
    const input: RegisterInput = {
      email: dto.email,
      password: dto.password,
    };

    const result = await this.authService.register(input);

    return RegisterConfirmationSentResponse.from(result);
  }

  @ApiOperation({ summary: 'Confirm registration using email and token' })
  @ApiBody({
    type: ConfirmRegisterDto,
    description: 'Email and verification token received via email',
  })
  @ApiOkResponse({
    description: 'User account successfully created',
    schema: { example: { id: 'a3f1c2e4-...', email: 'john.doe@email.com' } },
  })
  @ApiBadRequestResponse({
    description: 'Invalid or expired token, or no valid email in the request',
    schema: {
      example: {
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Invalid or expired token',
        error: 'Bad Request',
      },
    },
  })
  @Post('confirm-register')
  @HttpCode(HttpStatus.OK)
  async confirmRegistration(@Body() dto: ConfirmRegisterDto): Promise<ConfirmRegisterResponse> {
    const input: ConfirmRegisterInput = {
      token: dto.token,
    };

    const user = await this.authService.confirmRegister(input);

    return ConfirmRegisterResponse.from(user);
  }

  @ApiOperation({ summary: 'Initialize password reset process' })
  @ApiBody({ type: ResetPasswordRequestDto })
  @ApiOkResponse({
    description: "Reset password link sent (or not, if the email doesn't exist)",
    schema: { example: { message: 'If this email is registered, a reset link has been sent.' } },
  })
  @ApiBadRequestResponse({ description: 'Invalid email format' })
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordRequestDto): Promise<{ message: string }> {
    const input: ResetPasswordInput = {
      email: dto.email,
    };
    return this.authService.resetPassword(input);
  }

  @ApiOperation({ summary: 'Confirm password reset using token and new password' })
  @ApiBody({ type: ConfirmResetPasswordDto })
  @ApiOkResponse({
    description: 'Password successfully reset',
    schema: { example: { message: 'Password has been reset successfully.' } },
  })
  @ApiBadRequestResponse({
    description: 'Invalid or expired token, or invalid new password format',
  })
  @Post('confirm-reset-password')
  @HttpCode(HttpStatus.OK)
  async confirmResetPassword(@Body() dto: ConfirmResetPasswordDto): Promise<{ message: string }> {
    const input: ConfirmResetPasswordInput = {
      token: dto.token,
      password: dto.password,
    };
    return this.authService.confirmPasswordReset(input);
  }
}
