import { CopyField } from '../components/CopyField.js';
import { Money } from '../components/Money.js';
import { MCP_GUIDE_URL } from './demo-quote.js';
import styles from './Landing.module.css';

const TOOLS = [
  'list_services',
  'list_projects',
  'get_project',
  'request_quote',
  'answer_questions',
  'get_quote',
  'accept_quote',
  'get_payment',
  'get_mandate',
] as const;

/** The three answers `accept_quote` can give, with the demo script's own requests. */
const OUTCOMES = [
  {
    status: 'paid',
    tone: styles.outcomePaid,
    request: '“Alert me when any branch’s daily sales drop more than 20%.”',
    cents: 6000,
    body: 'Within the mandate. PayPal captures against the authorization; the client’s page updates live.',
  },
  {
    status: 'approval_required',
    tone: styles.outcomeApproval,
    request: '“Add our Amazon sales as a second source.”',
    cents: 19000,
    body: 'Over the US$100.00 per-purchase limit. The agent gets a PayPal link for a human to approve.',
  },
  {
    status: 'denied',
    tone: styles.outcomeDenied,
    request: 'A stale quote version, another project or another currency.',
    cents: null,
    body: 'Refused outright. Nothing is charged and nothing changes.',
  },
] as const;

export function ForAgents() {
  const origin = typeof window === 'undefined' ? 'https://dealingwith.si' : window.location.origin;
  return (
    <section id="for-agents" className={styles.section} aria-labelledby="agents-title">
      <div className={styles.sectionInner}>
        <p className={styles.kicker}>For agents</p>
        <h2 id="agents-title" className={styles.sectionTitle}>
          Same quote, two doors.
        </h2>
        <p className={styles.sectionLead}>
          People use the web. Agents use our MCP server from Claude, Cursor or any MCP client. Both
          see the same quote id and version, and pay through the same PayPal flows.
        </p>

        <div className={styles.split}>
          <div className={styles.connect}>
            <h3 className={styles.subTitle}>Connect in one line</h3>
            <p className={styles.muted}>
              On the project page, “Connect my agent” issues a token and prints this with your token
              filled in.
            </p>
            <CopyField
              label="Claude Code"
              value={`claude mcp add --transport http dealingwith ${origin}/mcp --header "Authorization: Bearer dwa_…"`}
              multiline
            />
            <ul className={styles.tools} aria-label="MCP tools">
              {TOOLS.map((tool) => (
                <li key={tool}>
                  <code>{tool}</code>
                </li>
              ))}
            </ul>
            <a href={MCP_GUIDE_URL} target="_blank" rel="noreferrer" className={styles.textLink}>
              Read the MCP guide
            </a>
          </div>

          <div className={styles.mandate}>
            <h3 className={styles.subTitle}>Autonomy with a budget</h3>
            <p className={styles.muted}>
              Mara gives her agent a mandate: at most <Money cents={10000} /> per purchase and{' '}
              <Money cents={30000} /> in total, funded once with a PayPal authorization. Every{' '}
              <code>accept_quote</code> passes through the policy engine first.
            </p>
            <ul className={styles.outcomes}>
              {OUTCOMES.map((o) => (
                <li key={o.status} className={`${styles.outcome} ${o.tone}`}>
                  <div className={styles.outcomeHead}>
                    <code className={styles.outcomeStatus}>{o.status}</code>
                    {o.cents === null ? null : <Money cents={o.cents} />}
                  </div>
                  <p className={styles.outcomeRequest}>{o.request}</p>
                  <p className={styles.outcomeBody}>{o.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
