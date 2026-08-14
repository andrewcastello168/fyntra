import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import type { KnexService } from '../database/knex.service';

jest.mock('../supabase/supabase.config', () => ({ supabaseClients: {} }));

describe('AuthService', () => {
  const profile = {
    id: 'user-1',
    email: 'user@example.com',
    username: null,
    full_name: 'Example User',
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    modify_dt: null,
  };
  const authUser = {
    id: 'user-1',
    email: 'user@example.com',
  };
  const session = {
    access_token: 'new-access-token',
    refresh_token: 'new-refresh-token',
  };

  function createService(refreshSession: jest.Mock) {
    const first = jest.fn().mockResolvedValue(profile);
    const select = jest.fn().mockReturnValue({ first });
    const where = jest.fn().mockReturnValue({ select });
    const knexService = {
      connection: jest.fn().mockReturnValue({ where }),
    };
    const supabaseService = {
      getClient: jest.fn().mockReturnValue({
        auth: { refreshSession },
      }),
    };

    return new AuthService(
      supabaseService,
      knexService as unknown as KnexService,
    );
  }

  it('rotates a refresh token and preserves the login response shape', async () => {
    const refreshSession = jest.fn().mockResolvedValue({
      data: { user: authUser, session },
      error: null,
    });
    const service = createService(refreshSession);

    await expect(
      service.refreshSession(
        { refreshToken: 'old-refresh-token', type: 'prod' },
        'prod',
      ),
    ).resolves.toEqual({
      message: 'Session refreshed successfully',
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
      user: {
        id: 'user-1',
        email: 'user@example.com',
        profile,
      },
    });
    expect(refreshSession).toHaveBeenCalledWith({
      refresh_token: 'old-refresh-token',
    });
  });

  it('rejects an expired or revoked refresh token', async () => {
    const service = createService(
      jest.fn().mockResolvedValue({
        data: { user: null, session: null },
        error: new Error('invalid refresh token'),
      }),
    );

    await expect(
      service.refreshSession(
        { refreshToken: 'revoked-refresh-token', type: 'prod' },
        'prod',
      ),
    ).rejects.toThrow(UnauthorizedException);
  });
});
