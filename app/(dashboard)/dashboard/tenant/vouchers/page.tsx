import Link from 'next/link';
import { VoucherForm } from './_components/VoucherForm';
import { VoucherList } from './_components/VoucherList';
import { parseVoucherPage, TENANT_VOUCHERS_PATH } from './_lib/schema';
import { getTenantVouchers } from './_queries/queries';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function TenantVouchersPage({ searchParams }: PageProps) {
  const page = parseVoucherPage(await searchParams);
  const result = await getTenantVouchers(page);
  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Vouchers</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">Create, edit, and deactivate tenant vouchers. Checkout redemption is not yet available.</p>
      </header>
      {result.error ? (
        <div role="alert" className="rounded-xl border border-amber-200 p-4 text-sm">
          <p>{result.message}</p>
          {result.error !== 'forbidden' && <Link href={TENANT_VOUCHERS_PATH} className="underline">Try again</Link>}
        </div>
      ) : (
        <>
          <section className="rounded-2xl border border-gray-200 p-5 dark:border-gray-800">
            <h2 className="mb-4 text-lg font-semibold">Create voucher</h2>
            <VoucherForm />
          </section>
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Your vouchers ({result.data.pagination.total_items})</h2>
            <VoucherList vouchers={result.data.vouchers} />
            <nav aria-label="Voucher pages" className="flex items-center gap-4 text-sm">
              {page > 1 && <Link className="underline" href={`${TENANT_VOUCHERS_PATH}?page=${page - 1}`}>Previous</Link>}
              <span>Page {page} of {Math.max(1, result.data.pagination.total_pages)}</span>
              {page < result.data.pagination.total_pages && <Link className="underline" href={`${TENANT_VOUCHERS_PATH}?page=${page + 1}`}>Next</Link>}
            </nav>
          </section>
        </>
      )}
    </main>
  );
}
