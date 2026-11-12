import {
  type ClientAgent,
  ClientAgentSchema,
  type IssuedAgent,
  IssuedAgentSchema,
} from '@dealingwith/contracts';
import { type FormEvent, useId, useState } from 'react';
import { api, errorMessage } from '../api/client.js';
import { routes } from '../api/routes.js';
import { claudeCodeMessage, connectorUrl } from '../lib/agent-setup.js';
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

/**
 * Issues agent tokens and shows them once: first a message to paste into
 * Claude Code and the Claude Desktop / claude.ai connector link, then the
 * technical snippets behind a disclosure. Lists and revokes agents.
 */
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
          <p className="small">
            It holds a secret key that lets an agent spend from your budget. Give it only to your
            own AI agent.
          </p>

          <section className={styles.option} aria-labelledby={`${id}-code`}>
            <h3 id={`${id}-code`} className={styles.optionTitle}>
              Claude Code
            </h3>
            <p className="muted small">
              Paste this message into Claude Code. It connects itself and tells you the one step
              left.
            </p>
            <CopyField
              label="Message for Claude Code"
              value={claudeCodeMessage(issued.snippets)}
              prose
            />
          </section>

          <section className={styles.option} aria-labelledby={`${id}-desktop`}>
            <h3 id={`${id}-desktop`} className={styles.optionTitle}>
              Claude Desktop or claude.ai
            </h3>
            <p className="muted small">
              Open Settings, then Connectors, then Add custom connector. Paste this link and choose
              “No sign in”.
            </p>
            <CopyField label="Connector link" value={connectorUrl(issued.snippets)} />
          </section>

          <details className={styles.technical}>
            <summary>Technical setup (terminal, Cursor, raw token)</summary>
            <div className={styles.technicalBody}>
              <CopyField label="Claude Code command" value={issued.snippets.claudeCode} multiline />
              <CopyField label="Cursor (mcp.json)" value={issued.snippets.cursor} multiline />
              <CopyField label="Agent token" value={issued.token} />
            </div>
          </details>

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
