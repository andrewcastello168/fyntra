import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import { supabaseClients, type SupabaseMode } from './supabase.config';

@Injectable()
export class SupabaseService {
  getClient(mode: SupabaseMode) {
    // let APP_ENV = process.env.APP_ENV;
    // console.log(APP_ENV);
    return supabaseClients[mode];
  }

  getAdminClient?(mode: SupabaseMode) {
    if (mode !== 'prod') {
      throw new InternalServerErrorException('Supabase environment is invalid');
    }

    const url = process.env.SUPABASE_PROD_URL;
    const serviceRoleKey = process.env.SUPABASE_PROD_SERVICE_ROLE_KEY;
    if (!url || !serviceRoleKey) {
      throw new InternalServerErrorException(
        'Supabase server authentication is not configured',
      );
    }

    return createClient(url, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }
}
