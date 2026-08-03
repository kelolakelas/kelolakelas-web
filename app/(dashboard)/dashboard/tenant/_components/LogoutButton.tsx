'use client';

import { logoutAction } from '@/app/_actions/logout';
import { useFormStatus } from 'react-dom';

function SubmitLabel() {
  const { pending } = useFormStatus();
  return <>{pending ? 'Keluar...' : 'Keluar'}</>;
}

export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <button type="submit" className="min-h-11 w-full rounded-lg px-3 text-left text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800">
        <SubmitLabel />
      </button>
    </form>
  );
}