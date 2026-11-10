import { formatUsd } from '@dealingwith/contracts';
import styles from './ReminderDetail.module.css';

/** What a drafted reminder shows. The model wrote the words; amounts are cents from the quote data. */
export interface ReminderView {
  clientName: string;
  greeting: string;
  message: string;
  signOff: string;
  lines: { quoteRef: string; label: string; amountCents: number }[];
  totalCents: number;
}

/**
 * A payment reminder draft: the model's words around an itemised table whose
 * amounts and total are formatted here from integer cents (decision
 * 2026-11-10-collections-agent-amounts-from-data). Shown in the chat step and
 * in the card above the report.
 */
export function ReminderDraft({ reminder }: { reminder: ReminderView }) {
  return (
    <section
      className={styles.draft}
      aria-label={`Payment reminder draft for ${reminder.clientName}`}
    >
      <p>{reminder.greeting}</p>
      <p className={styles.message}>{reminder.message}</p>
      <table className={styles.lines}>
        <tbody>
          {reminder.lines.map((line) => (
            <tr key={`${line.quoteRef}:${line.label}`}>
              <td>
                {line.label}
                <span className={styles.ref}>{line.quoteRef}</span>
              </td>
              <td className={styles.amount}>{formatUsd(line.amountCents)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>Total due</td>
            <td className={styles.amount}>{formatUsd(reminder.totalCents)}</td>
          </tr>
        </tfoot>
      </table>
      <p className={styles.message}>{reminder.signOff}</p>
      <p className={styles.note}>Draft only. Nothing has been sent.</p>
    </section>
  );
}
