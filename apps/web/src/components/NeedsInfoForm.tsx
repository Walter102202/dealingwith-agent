import type { NeedsInfoItem } from '@dealingwith/contracts';
import { type FormEvent, useId, useState } from 'react';
import { errorMessage } from '../api/client.js';
import { Button } from './Button.js';
import styles from './NeedsInfoForm.module.css';

interface NeedsInfoFormProps {
  items: NeedsInfoItem[];
  onSubmit: (answers: Record<string, string>) => Promise<void>;
}

/** The agent's questions, each with why the answer changes the price. */
export function NeedsInfoForm({ items, onSubmit }: NeedsInfoFormProps) {
  const base = useId();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const missing = items.some((item) => !(answers[item.question] ?? '').trim());
    if (missing) {
      setError('Answer every question so the quote can be priced.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit(answers);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={(e) => void submit(e)}>
      <p className={styles.lead}>The price depends on your answers.</p>
      {items.map((item, index) => {
        const id = `${base}-${index}`;
        return (
          <div key={item.question} className={styles.field}>
            <label htmlFor={id} className={styles.question}>
              {item.question}
            </label>
            <input
              id={id}
              type="text"
              value={answers[item.question] ?? ''}
              onChange={(e) => setAnswers({ ...answers, [item.question]: e.target.value })}
              aria-describedby={`${id}-why`}
              disabled={busy}
            />
            <p id={`${id}-why`} className="muted small">
              {item.whyItChangesPrice}
            </p>
          </div>
        );
      })}
      <div>
        <Button type="submit" variant="primary" busy={busy}>
          Send answers
        </Button>
      </div>
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
