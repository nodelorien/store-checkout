import { createUiError } from '@/shared/api/uiError';
import { mapTokenResponse, toTokenRequestBody } from './tokenMapping';
import type { CardInput, GatewayConfig, TokenizeResult } from './types';

const failure = (code: string, status: number | null = null): TokenizeResult => ({
  ok: false,
  error: createUiError(code, status),
});

/**
 * Exchanges card data for a gateway token, straight from the browser: card data never reaches our
 * API. This is the only function that receives a card number or CVC.
 *
 * It never throws and never logs; failures come back as a `UiError` whose copy is our own (the
 * gateway's messages may quote the input and are not in English).
 */
export async function tokenizeCard(
  config: GatewayConfig,
  card: CardInput,
  signal?: AbortSignal,
): Promise<TokenizeResult> {
  let response: Response;
  try {
    response = await fetch(config.tokenizationUrl, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.publicKey}`,
      },
      body: JSON.stringify(toTokenRequestBody(card)),
      // Card data must not be cached, carry cookies or leak a referrer.
      cache: 'no-store',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      signal,
    });
  } catch {
    return failure('NETWORK_ERROR');
  }

  if (response.status === 422 || response.status === 400) {
    return failure('CARD_REJECTED', response.status);
  }
  if (!response.ok) {
    return failure('CARD_TOKENIZATION_FAILED', response.status);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return failure('CARD_TOKENIZATION_FAILED', response.status);
  }

  const mapped = mapTokenResponse(body);
  if (mapped.kind === 'token') return { ok: true, token: mapped.token };
  return failure(
    mapped.kind === 'unsupported-brand' ? 'CARD_BRAND_UNSUPPORTED' : 'CARD_TOKENIZATION_FAILED',
    response.status,
  );
}
