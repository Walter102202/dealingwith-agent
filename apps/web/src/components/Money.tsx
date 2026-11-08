import { formatUsd } from '@dealingwith/contracts';
import styles from './Money.module.css';

interface MoneyProps {
  cents: number;
  /** `total` sets the large display face used for quote totals. */
  size?: 'inline' | 'total';
}

/** The one way money appears on screen: `US$80.00`, never computed here. */
export function Money({ cents, size = 'inline' }: MoneyProps) {
  return <span className={size === 'total' ? styles.total : styles.money}>{formatUsd(cents)}</span>;
}
