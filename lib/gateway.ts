const GATEWAY_API_URL_ENV = 'GATEWAY_API_URL';

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
