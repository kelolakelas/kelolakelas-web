import { isIP } from 'node:net';
import { headers } from 'next/headers';

const GATEWAY_API_URL_ENV = 'GATEWAY_API_URL';
const CLIENT_IP_SOURCE_ENV = 'CLIENT_IP_SOURCE_HEADER';

/** The edge must overwrite this header, not append a client-supplied value. */
export async function withGatewayClientIp<T extends Record<string, string>>(outgoing: T): Promise<T & Record<string, string>> {
  const source = process.env[CLIENT_IP_SOURCE_ENV]?.trim();
  // Do not access request context at all unless forwarding is explicitly enabled.
  if (!source || !/^[a-z0-9!#$%&'*+.^_`|~-]+$/i.test(source)) return outgoing;

  let value: string | null;
  try {
    value = (await headers()).get(source);
  } catch {
    // Build-time and requestless callers do not have an incoming request.
    return outgoing;
  }
  const ip = value?.trim();
  // Reject lists, port suffixes, and any other non-literal IP rather than
  // selecting an untrusted element from a proxy chain.
  if (!ip || !isIP(ip)) return outgoing;
  return { ...outgoing, 'X-Forwarded-For': ip };
}

/**
 * Returns the server-side API gateway origin used by all backend requests.
 * The value is intentionally not public because requests are made by Server
 * Components and Server Actions, not directly by the browser.
 */
export function getGatewayBaseUrl(): string {
  const configuredUrl = process.env[GATEWAY_API_URL_ENV]?.trim();

  if (!configuredUrl) {
    throw new Error(`${GATEWAY_API_URL_ENV} must be set to the API gateway URL.`);
  }

  let url: URL;
  try {
    url = new URL(configuredUrl);
  } catch {
    throw new Error(`${GATEWAY_API_URL_ENV} must be a valid absolute HTTP(S) URL.`);
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`${GATEWAY_API_URL_ENV} must use the http or https protocol.`);
  }

  if (url.pathname !== '/' || url.search || url.hash) {
    throw new Error(`${GATEWAY_API_URL_ENV} must be a gateway origin without a path, query, or hash.`);
  }

  return url.origin;
}

export function getGatewayConfigurationErrorMessage(error: unknown): string | null {
  if (error instanceof Error && error.message.startsWith(GATEWAY_API_URL_ENV)) {
    return `Gateway API configuration error: ${error.message}`;
  }

  return null;
}
