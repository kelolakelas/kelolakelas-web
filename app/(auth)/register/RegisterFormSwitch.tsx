'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { ParentRegisterForm } from './components/ParentRegisterForm';
import { TenantRegisterForm } from './components/TenantRegisterForm';

export function RegisterFormSwitch() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const type = searchParams.get('type');
  const isTenant = type === 'tenant';

  const handleToggle = (selectedType: 'parent' | 'tenant') => {
    const params = new URLSearchParams(searchParams.toString());
    if (selectedType === 'tenant') {
      params.set('type', 'tenant');
    } else {
      params.delete('type');
    }
    const queryString = params.toString();
    router.push(`/register${queryString ? `?${queryString}` : ''}`);
  };

  return (
    <div className="w-full max-w-xl space-y-6">
      <div className="flex w-full rounded-xl bg-gray-200/80 p-1 border border-gray-200">
        <button
          type="button"
          onClick={() => handleToggle('parent')}
          className={`flex min-h-[44px] flex-1 items-center justify-center rounded-lg py-2.5 text-xs font-semibold transition-all duration-200 sm:text-sm ${
            !isTenant
              ? 'bg-white text-indigo-600 shadow-xs'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Parent Registration
        </button>
        <button
          type="button"
          onClick={() => handleToggle('tenant')}
          className={`flex min-h-[44px] flex-1 items-center justify-center rounded-lg py-2.5 text-xs font-semibold transition-all duration-200 sm:text-sm ${
            isTenant
              ? 'bg-white text-indigo-600 shadow-xs'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Organization Registration
        </button>
      </div>

      {isTenant ? <TenantRegisterForm /> : <ParentRegisterForm />}
    </div>
  );
}
