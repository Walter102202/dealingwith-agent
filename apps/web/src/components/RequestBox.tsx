import { type FormEvent, useId, useState } from 'react';
import { errorMessage } from '../api/client.js';
import { Button } from './Button.js';
import styles from './RequestBox.module.css';

interface RequestBoxProps {
  onSubmit: (text: string) => Promise<void>;
  placeholder?: string;
  /** The button label; the same words name the result (a quote). */
  action?: string;
}

/** The plain-language box: a person describes what they need; the agent answers with a quote. */
export function RequestBox({
  onSubmit,
  placeholder = 'Describe what you need',
  action = 'Get a quote',
}: RequestBoxProps) {
  const id = useId();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) {
      setError('Write what you need first.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit(trimmed);
      setText('');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={(e) => void submit(e)}>
      <label htmlFor={id}>{placeholder}</label>
      <textarea
        id={id}
        value={text}
        placeholder="For example: I need a summary email every Monday."
        onChange={(e) => setText(e.target.value)}
        disabled={busy}
        rows={3}
      />
      <div className={styles.row}>
        <Button type="submit" variant="primary" busy={busy}>
          {busy ? 'Reading your request…' : action}
        </Button>
        <span className="muted small">Priced from the contract and the published rules.</span>
      </div>
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
