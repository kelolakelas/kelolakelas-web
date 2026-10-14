import { Suspense, type ReactNode } from 'react';
import { AdminReadGate } from '../_components/AdminReadGate';

export default function MembersLayout({ children }: { children: ReactNode }) {
  return <Suspense fallback={null}><AdminReadGate permission="member:read">{children}</AdminReadGate></Suspense>;
}
