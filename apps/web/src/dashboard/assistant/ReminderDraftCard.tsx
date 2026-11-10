import { Button } from '../../components/Button.js';
import { ReminderDraft, type ReminderView } from './ReminderDraft.js';
import styles from './ReminderDraftCard.module.css';

interface ReminderDraftCardProps {
  reminder: ReminderView;
  onDismiss: () => void;
}

/**
 * The latest reminder draft, above the report, as soon as the Collections
 * agent finishes it. Studio keeps tool steps collapsed (two clicks deep under
 * a delegation), so the page shows the draft itself; the chat step keeps it in
 * the history (decision 2026-11-10-reminder-draft-above-the-report).
 */
export function ReminderDraftCard({ reminder, onDismiss }: ReminderDraftCardProps) {
  return (
    <aside className={styles.card} aria-label="Reminder draft from the assistant">
      <div className={styles.head}>
        <p className={styles.title}>Payment reminder for {reminder.clientName}</p>
        <Button variant="ghost" onClick={onDismiss}>
          Dismiss
        </Button>
      </div>
      <div className={styles.body}>
        <ReminderDraft reminder={reminder} />
      </div>
    </aside>
  );
}
