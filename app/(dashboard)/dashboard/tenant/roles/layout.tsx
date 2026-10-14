import { Suspense, type ReactNode } from 'react';
import { AdminReadGate } from '../_components/AdminReadGate';

export default function RolesLayout({ children }: { children: ReactNode }) {
  return <Suspense fallback={null}><AdminReadGate permission="role:read">{children}</AdminReadGate></Suspense>;
}
