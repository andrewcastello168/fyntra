import { Controller, Get } from '@nestjs/common';
import { KnexService } from '../database/knex.service';

type HealthDbResult = {
  rows: {
    now: Date;
  }[];
};

@Controller('health')
export class HealthController {
  constructor(private readonly knexService: KnexService) {}

  @Get()
  checkHealth() {
    return {
      status: 'ok',
      service: 'fyntra-api',
      message: 'Service is healthy',
    };
  }

  @Get('db')
  async checkDb() {
    try {
      const result = (await this.knexService.connection.raw(
        'select now() as now',
      )) as unknown as HealthDbResult;

      return {
        status: 'ok',
        service: 'fyntra-api',
        database: {
          status: 'connected',
          now: result.rows[0]?.now,
        },
      };
    } catch (error: unknown) {
      console.error('DB CHECK ERROR:', error);

      return {
        status: 'error',
        service: 'fyntra-api',
        database: {
          status: 'disconnected',
        },
        message:
          error instanceof Error ? error.message : 'Unknown database error',
      };
    }
  }
}
