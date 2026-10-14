import { Suspense, type ReactNode } from 'react';
import { AdminReadGate } from '../_components/AdminReadGate';

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return <Suspense fallback={null}><AdminReadGate permission="tenant:read">{children}</AdminReadGate></Suspense>;
}
