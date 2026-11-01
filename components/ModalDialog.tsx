'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** Native top-layer focus/inert behavior, outside responsive/overflow ancestors. */
export function ModalDialog({ children, labelledBy, label, onClose, className = '', dismissOnBackdrop = false, layout = 'centered' }: {
  children: ReactNode;
  labelledBy?: string;
  label?: string;
  onClose: () => void;
  className?: string;
  dismissOnBackdrop?: boolean;
  layout?: 'centered' | 'drawer';
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      element.close();
      document.body.style.overflow = overflow;
      if (previous instanceof HTMLElement && previous.isConnected && previous.getClientRects().length) previous.focus();
    };
  }, []);

  if (typeof document === 'undefined') return null;
  return createPortal(
    <dialog
      ref={dialog}
      data-modal-layout={layout}
      aria-modal="true"
      aria-label={label}
      aria-labelledby={labelledBy}
      onCancel={event => { event.preventDefault(); onClose(); }}
      onClick={event => { if (dismissOnBackdrop && event.target === event.currentTarget) onClose(); }}
      className={`fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none overflow-y-auto border-0 bg-transparent text-inherit open:flex ${layout === 'drawer' ? 'p-0' : ''} ${className}`}
    >
      {children}
    </dialog>, document.body,
  );
}
