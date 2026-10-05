import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import { getGatewayBaseUrl, getGatewayConfigurationErrorMessage } from '@/lib/gateway';
import {
  parseTransactionFilters,
  transactionExportQuery,
} from '../_lib/transactions';

const AUTH_COOKIE = process.env.AUTH_COOKIE_NAME || 'auth_token';
const TENANT_COOKIE = process.env.TENANT_ID_COOKIE_NAME || 'tenant_id';

/**
 * CSV proxy for the transaction export (KEL-148).
 *
 * The gateway token stays server-side: the browser only ever calls this
 * route with the same filter parameters the list page understands, and the
 * route forwards them to `GET /api/v1/billing/transactions/export` with the
 * session cookies. The export query is built by `transactionExportQuery`, so
 * the download always covers exactly the rows the list shows.
 *
 * A range over 366 days is refused by billing with `400`; that refusal is
 * surfaced as `400` here with the explanation instead of an empty file. A
 * member without `billing:read` meets billing's `403`, which is surfaced
 * unchanged rather than as a technical failure.
 */
export async function GET(request: NextRequest) {
  const input: Record<string, string | string[] | undefined> = {};
  request.nextUrl.searchParams.forEach((value, key) => {
    const current = input[key];
    if (current === undefined) {
      input[key] = value;
    } else if (Array.isArray(current)) {
      current.push(value);
    } else {
      input[key] = [current, value];
    }
  });

  const parsed = parseTransactionFilters(input);

  if (parsed.error === 'invalid_filter') {
    return Response.json(
      { status: 'error', message: 'Filter tidak valid.', data: null },
      { status: 400 },
    );
  }

  let baseUrl: string;
  try {
    baseUrl = getGatewayBaseUrl();
  } catch (error) {
    return Response.json(
      {
        status: 'error',
        message: getGatewayConfigurationErrorMessage(error) ?? 'Layanan transaksi sedang tidak tersedia.',
        data: null,
      },
      { status: 503 },
    );
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value || '';
  const tenantId = cookieStore.get(TENANT_COOKIE)?.value || '';

  const headers: Record<string, string> = { Accept: 'text/csv' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (tenantId) headers['X-Tenant-ID'] = tenantId;

  let upstream: Response;
  try {
    upstream = await fetch(
      `${baseUrl}/api/v1/billing/transactions/export?${transactionExportQuery(parsed.filters)}`,
      { method: 'GET', headers, cache: 'no-store' },
    );
  } catch {
    return Response.json(
      { status: 'error', message: 'Unduhan CSV belum dapat dibuat. Coba lagi.', data: null },
      { status: 502 },
    );
  }

  if (!upstream.ok) {
    const refused = upstream.status === 400;
    return Response.json(
      {
        status: 'error',
        message: refused
          ? 'Rentang tanggal melebihi batas 366 hari yang diizinkan backend. Persempit rentang lalu coba lagi.'
          : upstream.status === 403 || upstream.status === 401
            ? 'Anda tidak memiliki izin mengunduh transaksi tenant ini.'
            : 'Unduhan CSV belum dapat dibuat. Coba lagi.',
        data: null,
      },
      { status: refused ? 400 : upstream.status === 403 || upstream.status === 401 ? 403 : 502 },
    );
  }

  const body = await upstream.arrayBuffer();
  const filename = `transactions-${parsed.filters.date_from}_to_${parsed.filters.date_to}.csv`;

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition':
        upstream.headers.get('Content-Disposition') ?? `attachment; filename="${filename}"`,
    },
  });
}
