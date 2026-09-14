import { afterEach, describe, expect, it } from 'vitest';
import { getGatewayBaseUrl, getGatewayConfigurationErrorMessage } from './gateway';

const originalGatewayApiUrl = process.env.GATEWAY_API_URL;

afterEach(() => {
  if (originalGatewayApiUrl === undefined) {
    delete process.env.GATEWAY_API_URL;
  } else {
    process.env.GATEWAY_API_URL = originalGatewayApiUrl;
  }
});

describe('getGatewayBaseUrl', () => {
  it('normalizes a valid gateway URL with a trailing slash', () => {
    process.env.GATEWAY_API_URL = 'https://gateway.example.test/';

    expect(getGatewayBaseUrl()).toBe('https://gateway.example.test');
  });

  it('fails with a diagnosable message when the configuration is missing', () => {
    delete process.env.GATEWAY_API_URL;

    expect(getGatewayBaseUrl).toThrow('GATEWAY_API_URL must be set');
    expect(getGatewayConfigurationErrorMessage(new Error('GATEWAY_API_URL must be set'))).toContain(
      'Gateway API configuration error'
    );
  });

  it('rejects a URL that is not an HTTP gateway origin', () => {
    process.env.GATEWAY_API_URL = 'ftp://gateway.example.test';

    expect(getGatewayBaseUrl).toThrow('must use the http or https protocol');
  });
});
