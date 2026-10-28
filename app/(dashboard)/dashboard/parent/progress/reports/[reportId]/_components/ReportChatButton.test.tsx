// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
const create = vi.hoisted(() => vi.fn());
vi.mock('@/lib/chat-actions', () => ({ createReportChat: create }));
import { ReportChatButton } from './ReportChatButton';
afterEach(cleanup);
it('links parents to their inbox without attempting forbidden report creation', () => {
  render(<ReportChatButton />);
  expect(screen.getByRole('link', { name: 'Buka chat' }).getAttribute('href')).toBe('/dashboard/parent/chat');
  expect(screen.getByText(/Percakapan laporan dimulai oleh pengajar/)).toBeTruthy();
  expect(screen.queryByRole('button')).toBeNull();
  expect(create).not.toHaveBeenCalled();
});
