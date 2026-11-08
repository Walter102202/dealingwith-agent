import { useState } from 'react';
import { errorMessage } from '../api/client.js';
import { Button } from '../components/Button.js';
import { Layout } from '../components/Layout.js';
import { type Role, useSession } from '../session.js';
import styles from './LoginPage.module.css';

/** Demo mode has two doors: the client and the provider. No passwords (spec section 3). */
export function LoginPage() {
  const { loginAs } = useSession();
  const [busy, setBusy] = useState<Role | null>(null);
  const [error, setError] = useState<string | null>(null);

  const enter = async (role: Role) => {
    setBusy(role);
    setError(null);
    try {
      await loginAs(role);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(null);
    }
  };

  return (
    <Layout>
      <div className={styles.page}>
        <h1 className={styles.title}>Choose who you are in the demo</h1>
        <p className={styles.lead}>
          Mara runs retail analytics at Lukas Retail and asks for changes to her dashboard. Andes
          Data Studio quotes and gets paid.
        </p>
        <div className={styles.doors}>
          <Button
            variant="primary"
            busy={busy === 'client'}
            disabled={busy !== null}
            onClick={() => void enter('client')}
          >
            Enter as client (Mara)
          </Button>
          <Button
            busy={busy === 'provider'}
            disabled={busy !== null}
            onClick={() => void enter('provider')}
          >
            Enter as provider (Andes Data Studio)
          </Button>
        </div>
        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </Layout>
  );
}
