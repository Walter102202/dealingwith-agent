import {
  type ClientAgent,
  ClientAgentSchema,
  type IssuedAgent,
  IssuedAgentSchema,
} from '@dealingwith/contracts';
import { type FormEvent, useId, useState } from 'react';
import { api, errorMessage } from '../api/client.js';
import { routes } from '../api/routes.js';
import { Button } from './Button.js';
import styles from './ConnectAgent.module.css';
import { CopyField } from './CopyField.js';
import { formatDate } from './ScopeList.js';

interface ConnectAgentProps {
  agents: ClientAgent[];
  /** The mandate the new token spends against, when the project has one. */
  mandateId?: string;
  onChange: () => Promise<void>;
}

/** Issues agent tokens, shows the connection snippets once, and lists and revokes agents. */
export function ConnectAgent({ agents, mandateId, onChange }: ConnectAgentProps) {
  // The API keeps revoked agents in the list (with `revokedAt`); only live ones are shown.
  const liveAgents = agents.filter((agent) => agent.revokedAt === undefined);
  const id = useId();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [issued, setIssued] = useState<IssuedAgent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  const create = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = label.trim();
    if (!trimmed) {
      setError('Give the agent a name you will recognise.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await api.post(
        routes.agents.create,
        { label: trimmed, ...(mandateId ? { mandateId } : {}) },
        IssuedAgentSchema,
      );
      setIssued(result);
      setOpen(false);
      setLabel('');
      await onChange();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (agent: ClientAgent) => {
    setRevoking(agent.id);
    setError(null);
    try {
      await api.del(routes.agents.revoke(agent.id), ClientAgentSchema);
      if (issued?.agent.id === agent.id) setIssued(null);
      await onChange();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setRevoking(null);
    }
  };

  return (
    <div className={styles.wrap}>
      <p className="muted small">
        Your own AI agent can request quotes and pay within the budget above, through our MCP
        server.
      </p>

      {issued ? (
        <div className={styles.issued} aria-live="polite">
          <p className={styles.warning}>Copy it now; it is not shown again.</p>
          <CopyField label="Agent token" value={issued.token} />
          <CopyField label="Claude Desktop" value={issued.snippets.claudeDesktop} multiline />
          <CopyField label="Claude Code" value={issued.snippets.claudeCode} multiline />
          <CopyField label="Cursor" value={issued.snippets.cursor} multiline />
          <Button variant="ghost" onClick={() => setIssued(null)}>
            Done, I copied it
          </Button>
        </div>
      ) : null}

      {open ? (
        <form className={styles.form} onSubmit={(e) => void create(e)}>
          <label htmlFor={id}>Name for this agent</label>
          <input
            id={id}
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Mara's assistant"
            disabled={busy}
          />
          <div className={styles.actions}>
            <Button type="submit" variant="primary" busy={busy}>
              Create token
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <Button variant="primary" onClick={() => setOpen(true)}>
          Connect my agent
        </Button>
      )}

      {liveAgents.length > 0 ? (
        <ul className={styles.list} aria-label="Connected agents">
          {liveAgents.map((agent) => (
            <li key={agent.id} className={styles.agent}>
              <div className={styles.agentText}>
                <span className={styles.agentLabel}>{agent.label}</span>
                <span className="muted small">
                  Connected {formatDate(agent.createdAt)}
                  {agent.lastUsedAt
                    ? `, last used ${formatDate(agent.lastUsedAt)}`
                    : ', not used yet'}
                </span>
              </div>
              <Button
                variant="danger"
                busy={revoking === agent.id}
                onClick={() => void revoke(agent)}
              >
                Revoke
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
