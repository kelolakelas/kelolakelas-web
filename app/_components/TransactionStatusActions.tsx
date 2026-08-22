'use client';

import { refreshParentTransaction } from '@/app/_actions/parent-transaction';
import type { BillingTransaction } from '@/lib/api/types';
import { formatTransactionAmount, getTransactionStatus } from '@/lib/billing/formatters';
import { ExternalLink, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';

const MAX_POLL_ATTEMPTS = 5;
const POLL_INTERVAL_MS = 3000;

const statusClasses = {
  pending: 'bg-amber-100 text-amber-800',
  paid: 'bg-emerald-100 text-emerald-800',
  failed: 'bg-red-100 text-red-800',
  canceled: 'bg-gray-200 text-gray-700',
  unknown: 'bg-gray-100 text-gray-700',
} as const;

const statusLabels = {
  pending: 'Menunggu pembayaran',
  paid: 'Berhasil',
  failed: 'Gagal',
  canceled: 'Dibatalkan',
  unknown: 'Status tidak tersedia',
} as const;

export function TransactionStatusActions({ initialTransaction, showAmount = false }: { initialTransaction: BillingTransaction; showAmount?: boolean }) {
  const [transaction, setTransaction] = useState(initialTransaction);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState('');
  const [pollAttempts, setPollAttempts] = useState(0);
  const currentStatus = getTransactionStatus(transaction.status);
  const paymentUrl = transaction.checkout_session_url?.trim();

  useEffect(() => {
    if (currentStatus !== 'pending' || pollAttempts >= MAX_POLL_ATTEMPTS) return;
    let isMounted = true;
    const timer = window.setTimeout(async () => {
      setPollAttempts((attempts) => attempts + 1);
      setIsChecking(true);
      const result = await refreshParentTransaction(transaction.id);
      if (!isMounted) return;
      setIsChecking(false);
      if (result.data) setTransaction(result.data);
      if (result.error) setError(result.error);
    }, POLL_INTERVAL_MS);
    return () => {
      isMounted = false;
      window.clearTimeout(timer);
    };
  }, [currentStatus, transaction.id, pollAttempts]);

  async function checkStatus() {
    setIsChecking(true);
    setError('');
    const result = await refreshParentTransaction(transaction.id);
    if (result.data) {
      setTransaction(result.data);
      if (result.data.status !== 'pending') setPollAttempts(MAX_POLL_ATTEMPTS);
    }
    if (result.error) setError(result.error);
    setIsChecking(false);
  }

  return <div className="space-y-3" data-status={currentStatus}>
    <div className={`inline-flex rounded-full px-3 py-1 text-sm font-bold ${statusClasses[currentStatus]}`}>{statusLabels[currentStatus]}</div>
    {showAmount && <p className="font-semibold">{formatTransactionAmount(transaction.gross_amount, transaction.currency || 'IDR')}</p>}
    {currentStatus === 'pending' && <div className="flex flex-wrap items-center gap-3"><button type="button" onClick={checkStatus} disabled={isChecking} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-gray-300 px-4 text-sm font-semibold disabled:opacity-50"><RefreshCw size={16} aria-hidden="true" />{isChecking ? 'Memeriksa...' : 'Cek status lagi'}</button>{paymentUrl && <a href={paymentUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white"><ExternalLink size={16} aria-hidden="true" />Bayar sekarang</a>}{pollAttempts > 0 && pollAttempts < MAX_POLL_ATTEMPTS && <span className="text-sm text-gray-500">Pemeriksaan otomatis {pollAttempts}/{MAX_POLL_ATTEMPTS}</span>}</div>}
    {currentStatus === 'paid' && <p className="text-sm text-emerald-800">Pembayaran diterima. Enrollment sedang atau berhasil diaktifkan.</p>}
    {(currentStatus === 'failed' || currentStatus === 'canceled') && paymentUrl && <a href={paymentUrl} target="_blank" rel="noreferrer" onClick={(event) => { if (!window.confirm('Buka ulang checkout untuk mencoba pembayaran lagi?')) event.preventDefault(); }} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white"><ExternalLink size={16} aria-hidden="true" />Bayar sekarang</a>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </div>;
}
