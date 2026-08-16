import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { KnexService } from '../database/knex.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshSessionDto } from './dto/refresh-session.dto';
import { SupabaseService } from '../supabase/supabase.service';
import { SupabaseMode } from '../supabase/supabase.config';
import type { Session, User } from '@supabase/supabase-js';

type UserProfileRow = {
  id: string;
  email: string;
  username: string | null;
  full_name: string;
  created_at: Date;
  modify_dt: Date | null;
};

type UserProfilePublic = {
  id: string;
  email: string;
  username: string | null;
  full_name: string;
  created_at: Date;
  modify_dt: Date | null;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly knexService: KnexService,
  ) {}

  async register(registerDto: RegisterDto, envService: SupabaseMode) {
    if (registerDto.username) {
      const existingUsername = await this.knexService
        .connection<UserProfileRow>('users')
        .where({
          username: registerDto.username,
        })
        .first();

      if (existingUsername) {
        throw new ConflictException('Username sudah digunakan');
      }
    }

    const supabaseClients = this.supabaseService.getClient(envService);

    const signUpResponse = await supabaseClients.auth.signUp({
      email: registerDto.email,
      password: registerDto.password,
      options: {
        data: {
          full_name: registerDto.fullName,
          username: registerDto.username ?? null,
        },
      },
    });

    if (signUpResponse.error) {
      throw new BadRequestException(signUpResponse.error.message);
    }

    const authUser = signUpResponse.data.user;

    if (!authUser) {
      throw new BadRequestException('Register gagal');
    }

    const existingProfile = await this.knexService
      .connection<UserProfileRow>('users')
      .where({
        id: authUser.id,
      })
      .first();

    if (!existingProfile) {
      await this.knexService.connection<UserProfileRow>('users').insert({
        id: authUser.id,
        email: authUser.email ?? registerDto.email,
        username: registerDto.username ?? null,
        full_name: registerDto.fullName,
      });
    }

    return {
      message: 'Register berhasil',
      user: {
        id: authUser.id,
        email: authUser.email ?? registerDto.email,
        username: registerDto.username ?? null,
        fullName: registerDto.fullName,
      },
      session: signUpResponse.data.session,
    };
  }

  async login(loginDto: LoginDto, envService: SupabaseMode) {
    // const supabaseClients = this.supabaseService.getClient('prod');
    const supabaseClients = this.supabaseService.getClient(envService);

    const loginResponse = await supabaseClients.auth.signInWithPassword({
      email: loginDto.email,
      password: loginDto.password,
    });

    if (loginResponse.error) {
      throw new UnauthorizedException(loginResponse.error.message);
    }

    const authUser = loginResponse.data.user;

    const session = loginResponse.data.session;

    if (!authUser || !session) {
      throw new UnauthorizedException('Login gagal');
    }

    return this.buildSessionResponse(authUser, session, 'Login berhasil');
  }

  async refreshSession(
    refreshSessionDto: RefreshSessionDto,
    envService: SupabaseMode,
  ) {
    const supabaseClient = this.supabaseService.getClient(envService);
    const refreshResponse = await supabaseClient.auth.refreshSession({
      refresh_token: refreshSessionDto.refreshToken,
    });

    const authUser = refreshResponse.data.user;
    const session = refreshResponse.data.session;

    if (refreshResponse.error || !authUser || !session) {
      throw new UnauthorizedException(
        'Session is no longer valid. Sign in with your password.',
      );
    }

    return this.buildSessionResponse(
      authUser,
      session,
      'Session refreshed successfully',
    );
  }

  async checkUser(accessToken: string, envService: SupabaseMode) {
    const supabaseClients = this.supabaseService.getClient(envService);

    const {
      data: { user: authUser },
      error,
    } = await supabaseClients.auth.getUser(accessToken);

    if (error || !authUser) {
      // await this.logout(accessToken, envService);
      throw new UnauthorizedException(
        'Token tidak valid atau sudah kedaluwarsa',
      );
    }

    const profile = await this.knexService
      .connection<UserProfileRow, UserProfilePublic>('users')
      .where({
        id: authUser.id,
      })
      .select('id', 'email', 'username', 'full_name', 'created_at', 'modify_dt')
      .first();

    return {
      message: 'User ditemukan',
      user: {
        id: authUser.id,
        email: authUser.email,
        emailConfirmedAt: authUser.email_confirmed_at,
        profile: profile ?? null,
      },
    };
  }

  async logout(accessToken: string, envService: SupabaseMode) {
    const supabaseClient = this.supabaseService.getClient(envService);

    const { error } = await supabaseClient.auth.admin.signOut(
      accessToken,
      'local',
    );

    if (error) {
      throw new UnauthorizedException(error.message);
    }

    return {
      message: 'Logout berhasil',
    };
  }

  private async buildSessionResponse(
    authUser: User,
    session: Session,
    message: string,
  ) {
    const profile = await this.knexService
      .connection<UserProfileRow, UserProfilePublic>('users')
      .where({
        id: authUser.id,
      })
      .select('id', 'email', 'username', 'full_name', 'created_at', 'modify_dt')
      .first();

    return {
      message,
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      user: {
        id: authUser.id,
        email: authUser.email,
        profile: profile ?? null,
      },
    };
  }
}
