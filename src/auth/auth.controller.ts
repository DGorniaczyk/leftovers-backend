import { Controller, Post, Body, HttpStatus, HttpCode, Request, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import {
  ApiResponse,
  ApiOperation,
  ApiBody,
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiConflictResponse,
} from '@nestjs/swagger';
import { ConfirmRegisterDto } from './dto/confirm-register.dto';
import { SignUpDto } from './dto/SignUp.dto';
import { AuthGuard } from '@nestjs/passport';
import { LoginResponse } from './dto/responses/login.dto';
import { RegisterInput } from './dto/inputs/register.input';
import { ConfirmRegisterInput } from './dto/inputs/confirm-register.input';
import { RegisterConfirmationSentResponse } from './dto/responses/register-confirmation-sent.response';
import { ConfirmRegisterResponse } from './dto/responses/confirm-register.response';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({
    summary: 'User signup',
    description: 'Deprecated. Use POST /auth/register instead',
    deprecated: true,
  })
  @ApiResponse({ status: 201, description: 'User successfully signed up' })
  @ApiResponse({ status: 409, description: 'User already exists' })
  @ApiResponse({ status: 400, description: 'User data is invalid' })
  @Post('signup')
  async signUp(@Body() createUserDto: SignUpDto) {
    return this.authService.signUp(createUserDto.email, createUserDto.password);
  }

  @ApiOperation({ summary: 'User login' })
  @ApiResponse({ status: HttpStatus.OK, description: 'User successfully logged in' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Invalid credentials' })
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('local'))
  @Post('login')
  async login(@Request() req): Promise<LoginResponse> {
    return this.authService.login(req.user);
  }

  @ApiOperation({
    summary: 'Start the signup process to get an email with confirmation link',
  })
  @ApiBody({ type: SignUpDto, description: 'User registration data' })
  @ApiOkResponse({
    description: 'User logged in',
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
      name: dto.name,
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
  async confirmRegistration(@Body() dto: ConfirmRegisterDto): Promise<ConfirmRegisterResponse> {
    const input: ConfirmRegisterInput = {
      email: dto.email,
      token: dto.token,
    };

    const user = await this.authService.confirmRegister(input);

    return ConfirmRegisterResponse.from(user);
  }
}
