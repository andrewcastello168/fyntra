import {
  BadGatewayException,
  GatewayTimeoutException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiService } from './ai.service';

describe('AiService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    jest.useRealTimers();
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  function createService(overrides: Record<string, string | undefined> = {}) {
    const values: Record<string, string | undefined> = {
      AI_ROUTER_URL: 'https://router.example/v1',
      AI_ROUTER_KEY: 'test-key',
      AI_MODEL: 'test-model',
      ...overrides,
    };
    const configService = {
      get: jest.fn((key: string) => values[key]),
    } as unknown as ConfigService;

    return new AiService(configService);
  }

  it('calls the OpenAI-compatible chat completions endpoint and parses JSON', async () => {
    const fetchMock = jest.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: '{"amount":50000}' } }],
        }),
        { status: 200 },
      ),
    );
    global.fetch = fetchMock;
    const service = createService();

    await expect(
      service.generateJson([{ role: 'user', content: 'test' }]),
    ).resolves.toEqual({ amount: 50000 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0] as [
      string | URL | Request,
      RequestInit | undefined,
    ];
    expect(url).toBe('https://router.example/v1/chat/completions');
    expect(options?.method).toBe('POST');
    expect(new Headers(options?.headers).get('Authorization')).toBe(
      'Bearer test-key',
    );
  });

  it('returns a generic bad gateway error for an upstream failure', async () => {
    global.fetch = jest
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 502 }));
    const service = createService();

    await expect(
      service.generateJson([{ role: 'user', content: 'test' }]),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('rejects invalid JSON returned by the provider', async () => {
    global.fetch = jest.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: 'not-json' } }],
        }),
        { status: 200 },
      ),
    );
    const service = createService();

    await expect(
      service.generateJson([{ role: 'user', content: 'test' }]),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('aborts and reports a gateway timeout when the provider is too slow', async () => {
    jest.useFakeTimers();
    global.fetch = jest.fn<typeof fetch>().mockImplementation(
      (_input: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const error = new Error('aborted');
            error.name = 'AbortError';
            reject(error);
          });
        }),
    );
    const service = createService();
    const expectation = expect(
      service.generateJson([{ role: 'user', content: 'test' }]),
    ).rejects.toBeInstanceOf(GatewayTimeoutException);

    await jest.advanceTimersByTimeAsync(15_000);
    await expectation;
  });

  it('requires all AI environment variables', async () => {
    const service = createService({ AI_ROUTER_KEY: undefined });

    await expect(
      service.generateJson([{ role: 'user', content: 'test' }]),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
