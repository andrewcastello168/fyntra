import {
  BadGatewayException,
  GatewayTimeoutException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type AiMessage = {
  role: 'system' | 'user';
  content: string;
};

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: unknown;
      refusal?: string | null;
    };
  }>;
};

@Injectable()
export class AiService {
  private static readonly REQUEST_TIMEOUT_MS = 15_000;

  constructor(private readonly configService: ConfigService) {}

  async generateJson<T>(messages: AiMessage[]): Promise<T> {
    const routerUrl = this.configService.get<string>('AI_ROUTER_URL')?.trim();
    const routerKey = this.configService.get<string>('AI_ROUTER_KEY')?.trim();
    const model = this.configService.get<string>('AI_MODEL')?.trim();

    if (!routerUrl || !routerKey || !model) {
      throw new ServiceUnavailableException(
        'AI transaction drafting is not configured.',
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      AiService.REQUEST_TIMEOUT_MS,
    );

    try {
      const response = await fetch(this.chatCompletionsUrl(routerUrl), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${routerKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages,
          response_format: { type: 'json_object' },
          stream: false,
        }),
        signal: controller.signal,
      });

      // console.log(response);

      if (!response.ok) {
        throw new BadGatewayException(
          'The AI provider could not generate a transaction draft.',
        );
      }

      const responseBody = (await response.json()) as ChatCompletionResponse;
      const message = responseBody.choices?.[0]?.message;

      if (message?.refusal) {
        throw new BadGatewayException(
          'The AI provider declined to generate a transaction draft.',
        );
      }

      const content = this.readMessageContent(message?.content);

      if (!content) {
        throw new BadGatewayException(
          'The AI provider returned an empty transaction draft.',
        );
      }

      try {
        return JSON.parse(content) as T;
      } catch {
        throw new BadGatewayException(
          'The AI provider returned an invalid transaction draft.',
        );
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new GatewayTimeoutException(
          'The AI provider timed out while generating the transaction draft.',
        );
      }

      if (
        error instanceof BadGatewayException ||
        error instanceof GatewayTimeoutException ||
        error instanceof ServiceUnavailableException
      ) {
        throw error;
      }

      throw new BadGatewayException(
        'The AI provider could not generate a transaction draft.',
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private chatCompletionsUrl(routerUrl: string): string {
    let url: URL;

    try {
      url = new URL(routerUrl);
    } catch {
      throw new ServiceUnavailableException(
        'AI transaction drafting is not configured correctly.',
      );
    }

    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new ServiceUnavailableException(
        'AI transaction drafting is not configured correctly.',
      );
    }

    const path = url.pathname.replace(/\/+$/, '');

    if (!path.endsWith('/chat/completions')) {
      url.pathname = `${path}/chat/completions`;
    }

    return url.toString();
  }

  private readMessageContent(content: unknown): string | null {
    if (typeof content === 'string') {
      return content;
    }

    if (!Array.isArray(content)) {
      return null;
    }

    const text = content
      .map((part) => {
        if (this.isRecord(part) && typeof part.text === 'string') {
          return part.text;
        }

        return '';
      })
      .join('');

    return text || null;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
