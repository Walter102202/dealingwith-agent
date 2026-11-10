import type { MandateStatus, PaymentStatus, QuoteStatus } from '@dealingwith/contracts';
import type { ReactNode } from 'react';
import styles from './Badge.module.css';

export type Tone = 'neutral' | 'positive' | 'warning' | 'danger' | 'info';

interface BadgeProps {
  tone: Tone;
  children: ReactNode;
}

/** A short status word. Color encodes the state; the word carries it for screen readers. */
export function Badge({ tone, children }: BadgeProps) {
  return <span className={`${styles.badge} ${styles[tone]}`}>{children}</span>;
}

export type Status = QuoteStatus | MandateStatus | PaymentStatus;

const TONES: Record<Status, Tone> = {
  draft: 'neutral',
  needs_info: 'warning',
  published: 'info',
  accepted: 'info',
  paid: 'positive',
  superseded: 'neutral',
  expired: 'neutral',
  rejected: 'danger',
  pending: 'warning',
  active: 'positive',
  exhausted: 'warning',
  revoked: 'danger',
  created: 'info',
  approved: 'info',
  captured: 'positive',
  denied: 'danger',
  refunded: 'neutral',
};

/** True for a status word the contracts define (the dashboard table gets free-form values). */
export const isStatus = (value: unknown): value is Status =>
  typeof value === 'string' && Object.hasOwn(TONES, value);

const LABELS: Partial<Record<Status, string>> = {
  needs_info: 'Needs info',
  approved: 'Approved in PayPal',
  created: 'Awaiting approval',
};

/** Status words from the contracts, in plain English. */
export function StatusBadge({ status }: { status: Status }) {
  const label = LABELS[status] ?? status.charAt(0).toUpperCase() + status.slice(1);
  return <Badge tone={TONES[status]}>{label}</Badge>;
}
