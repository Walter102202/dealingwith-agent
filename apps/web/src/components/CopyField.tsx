import { useId, useState } from 'react';
import { Button } from './Button.js';
import styles from './CopyField.module.css';

interface CopyFieldProps {
  label: string;
  value: string;
  /** Multi-line values (JSON, commands) render in a code block. */
  multiline?: boolean;
  /** A message in plain words, rendered multi-line in the body font. */
  prose?: boolean;
}

/** A read-only value with a copy button. "Copied" confirms for two seconds. */
export function CopyField({ label, value, multiline = false, prose = false }: CopyFieldProps) {
  const id = useId();
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setFailed(false);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setFailed(true);
    }
  };

  return (
    <div className={styles.field}>
      <div className={styles.head}>
        <span id={id} className={styles.label}>
          {label}
        </span>
        <Button variant="ghost" onClick={() => void copy()} aria-describedby={id}>
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      {prose ? (
        <pre className={styles.prose}>{value}</pre>
      ) : multiline ? (
        <pre className={styles.code}>{value}</pre>
      ) : (
        <code className={styles.value}>{value}</code>
      )}
      {failed ? (
        <p className="small muted">Copy is blocked here. Select the text instead.</p>
      ) : null}
    </div>
  );
}
