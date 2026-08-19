import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHmac, randomBytes } from 'node:crypto';

import { KnexService } from '../database/knex.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshSessionDto } from './dto/refresh-session.dto';
import { BiometricEnrollDto } from './dto/biometric-enroll.dto';
import { BiometricLoginDto } from './dto/biometric-login.dto';

import { SupabaseService } from '../supabase/supabase.service';
import { SupabaseMode } from '../supabase/supabase.config';

import type { Session, SupabaseClient, User } from '@supabase/supabase-js';

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

type BiometricCredentialRow = {
  id: string;
  user_id: string;
  credential_hash: string;
  device_id: string;
  created_at?: Date;
  last_used_at: Date | null;
  revoked_at: Date | null;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly knexService: KnexService,
  ) {}

  // ============================================================
  // REGISTER
  // ============================================================

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

    const supabaseClient = this.supabaseService.getClient(envService);

    const signUpResponse = await supabaseClient.auth.signUp({
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

  // ============================================================
  // LOGIN
  // ============================================================

  async login(loginDto: LoginDto, envService: SupabaseMode) {
    const supabaseClient = this.supabaseService.getClient(envService);

    const loginResponse = await supabaseClient.auth.signInWithPassword({
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

  // ============================================================
  // REFRESH SESSION
  // ============================================================

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

  // ============================================================
  // BIOMETRIC ENROLL
  // ============================================================

  async enrollBiometric(userId: string, dto: BiometricEnrollDto) {
    if (!dto.deviceId) {
      throw new BadRequestException('Device ID is required');
    }

    const credential = randomBytes(32).toString('base64url');

    const credentialHash = this.hashBiometricCredential(credential);

    await this.knexService.connection.transaction(async (trx) => {
      // Revoke existing biometric credential
      // for this user + device.
      await trx<BiometricCredentialRow>('biometric_credentials')
        .where({
          user_id: userId,
          device_id: dto.deviceId,
        })
        .whereNull('revoked_at')
        .update({
          revoked_at: new Date(),
        });

      // Create new credential.
      await trx<BiometricCredentialRow>('biometric_credentials').insert({
        user_id: userId,
        credential_hash: credentialHash,
        device_id: dto.deviceId,
        last_used_at: null,
        revoked_at: null,
      });
    });

    return {
      credential,
    };
  }

  // ============================================================
  // BIOMETRIC LOGIN
  // ============================================================

  async loginWithBiometric(dto: BiometricLoginDto, envService: SupabaseMode) {
    if (!dto.credential) {
      throw new BadRequestException('Biometric credential is required');
    }

    if (!dto.deviceId) {
      throw new BadRequestException('Device ID is required');
    }

    const credentialHash = this.hashBiometricCredential(dto.credential);

    const biometricCredential = await this.knexService
      .connection<BiometricCredentialRow>('biometric_credentials')
      .where({
        credential_hash: credentialHash,
        device_id: dto.deviceId,
      })
      .whereNull('revoked_at')
      .first();

    if (!biometricCredential) {
      throw new UnauthorizedException('Biometric credential is invalid');
    }

    const user = await this.knexService
      .connection<UserProfileRow>('users')
      .where({
        id: biometricCredential.user_id,
      })
      .select('id', 'email')
      .first();

    if (!user?.email) {
      throw new UnauthorizedException('Biometric credential is invalid');
    }

    const adminClient = this.getAdminClient();

    // Generate a server-side magic link.
    const generatedLink = await adminClient.auth.admin.generateLink({
      type: 'magiclink',
      email: user.email,
    });

    if (generatedLink.error || !generatedLink.data?.properties) {
      throw new InternalServerErrorException(
        'Unable to create a biometric sign-in session',
      );
    }

    const tokenHash = generatedLink.data.properties.hashed_token;

    if (!tokenHash) {
      throw new InternalServerErrorException(
        'Unable to create a biometric sign-in session',
      );
    }

    // Exchange the one-time token for a fresh
    // Supabase session.
    const sessionClient = this.supabaseService.getClient(envService);

    const verified = await sessionClient.auth.verifyOtp({
      token_hash: tokenHash,
      type: 'magiclink',
    });

    if (
      verified.error ||
      !verified.data.user ||
      !verified.data.session ||
      verified.data.user.id !== biometricCredential.user_id
    ) {
      throw new UnauthorizedException('Unable to complete biometric sign-in');
    }

    // Update last-used timestamp.
    await this.knexService
      .connection<BiometricCredentialRow>('biometric_credentials')
      .where({
        id: biometricCredential.id,
      })
      .whereNull('revoked_at')
      .update({
        last_used_at: new Date(),
      });

    return this.buildSessionResponse(
      verified.data.user,
      verified.data.session,
      'Biometric login successful',
    );
  }

  // ============================================================
  // REVOKE BIOMETRIC
  // ============================================================

  async revokeBiometric(userId: string, deviceId: string) {
    if (!deviceId) {
      throw new BadRequestException('Device ID is required');
    }

    await this.knexService
      .connection<BiometricCredentialRow>('biometric_credentials')
      .where({
        user_id: userId,
        device_id: deviceId,
      })
      .whereNull('revoked_at')
      .update({
        revoked_at: new Date(),
      });

    return {
      message: 'Biometric login disabled',
    };
  }

  // ============================================================
  // CHECK USER
  // ============================================================

  async checkUser(accessToken: string, envService: SupabaseMode) {
    const supabaseClient = this.supabaseService.getClient(envService);

    const {
      data: { user: authUser },
      error,
    } = await supabaseClient.auth.getUser(accessToken);

    if (error || !authUser) {
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

  // ============================================================
  // LOGOUT
  // ============================================================

  async logout(accessToken: string) {
    const adminClient = this.getAdminClient();

    // IMPORTANT:
    // Revoke the normal Supabase session.
    // This does NOT revoke the biometric credential.
    const { error } = await adminClient.auth.admin.signOut(
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

  // ============================================================
  // SESSION RESPONSE
  // ============================================================

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

  // ============================================================
  // BIOMETRIC HASH
  // ============================================================

  private hashBiometricCredential(credential: string) {
    const pepper = process.env.BIOMETRIC_CREDENTIAL_PEPPER;

    if (!pepper) {
      throw new InternalServerErrorException(
        'Biometric credential security is not configured',
      );
    }

    return createHmac('sha256', pepper).update(credential).digest('hex');
  }

  // ============================================================
  // SUPABASE ADMIN CLIENT
  // ============================================================

  private getAdminClient(): SupabaseClient {
    const service = this.supabaseService;

    if (!service.getAdminClient) {
      throw new InternalServerErrorException(
        'Supabase server authentication is not configured',
      );
    }

    const client: SupabaseClient = service.getAdminClient('prod');

    return client;
  }
}
