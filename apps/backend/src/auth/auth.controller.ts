import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshSessionDto } from './dto/refresh-session.dto';
import { SupabaseMode } from '../supabase/supabase.config';
import { SupabaseAuthGuard } from './guards/supabase-auth.guard';
import { BiometricEnrollDto } from './dto/biometric-enroll.dto';
import { BiometricLoginDto } from './dto/biometric-login.dto';
import { RevokeBiometricDto } from './dto/revoke-biometric.dto';
import type { AuthenticatedRequest } from './types/authenticated-request.type';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() registerDto: RegisterDto) {
    const envService = process.env.APP_ENV as SupabaseMode;
    return this.authService.register(registerDto, envService);
  }

  @Post('login')
  login(@Body() loginDto: LoginDto) {
    const envService = process.env.APP_ENV as SupabaseMode;
    return this.authService.login(loginDto, envService);
  }

  @Post('refresh')
  refresh(@Body() refreshSessionDto: RefreshSessionDto) {
    const envService = process.env.APP_ENV as SupabaseMode;
    return this.authService.refreshSession(refreshSessionDto, envService);
  }

  @UseGuards(SupabaseAuthGuard)
  @Post('biometric/enroll')
  enrollBiometric(
    @Req() request: AuthenticatedRequest,
    @Body() biometricEnrollDto: BiometricEnrollDto,
  ) {
    return this.authService.enrollBiometric(
      request.user.id,
      biometricEnrollDto,
    );
  }

  @Post('biometric/login')
  biometricLogin(@Body() biometricLoginDto: BiometricLoginDto) {
    const envService = process.env.APP_ENV as SupabaseMode;
    return this.authService.loginWithBiometric(biometricLoginDto, envService);
  }

  @UseGuards(SupabaseAuthGuard)
  @Delete('biometric')
  revokeBiometric(
    @Req() request: AuthenticatedRequest,
    @Body() revokeBiometricDto: RevokeBiometricDto,
  ) {
    return this.authService.revokeBiometric(
      request.user.id,
      revokeBiometricDto.deviceId,
    );
  }

  @UseGuards(SupabaseAuthGuard)
  @Post('logout')
  logout(@Headers('authorization') authorization?: string) {
    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Bearer token tidak ditemukan');
    }

    const accessToken = authorization.substring(7);
    // const envService = process.env.APP_ENV as SupabaseMode;

    return this.authService.logout(accessToken);
  }

  @UseGuards(SupabaseAuthGuard)
  @Get('me')
  getMe(
    @Headers('authorization') authorization?: string,
    // @Headers('x-supabase-mode') mode?: string,
  ) {
    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Bearer token tidak ditemukan');
    }
    const envService = process.env.APP_ENV as SupabaseMode;

    // if (mode !== 'sim' && mode !== 'prod') {
    //   throw new BadRequestException(
    //     'Header x-supabase-mode harus sim atau prod',
    //   );
    // }

    const accessToken = authorization.substring(7);

    return this.authService.checkUser(accessToken, envService);
  }
}
