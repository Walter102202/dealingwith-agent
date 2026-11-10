import { formatUsd } from '@dealingwith/contracts';
import styles from './Agents.module.css';
import { AgentTerminal } from './AgentTerminal.js';
import base from './Landing.module.css';
import { Reveal } from './Reveal.js';
import { SectionHead } from './SectionHead.js';

export function Agents() {
  const spent = 6000;
  return (
    <section id="for-agents" className={base.section} aria-labelledby="agents-title">
      <div className={base.container}>
        <SectionHead
          n="03"
          eyebrow="For agents"
          titleId="agents-title"
          title="Same quote, two doors."
          lede="People use the web. Agents use our MCP server from Claude, Cursor or any MCP client. Same quote id and version, same PayPal flows."
        />
        <Reveal>
          <AgentTerminal />
        </Reveal>
        <div className={styles.mandate}>
          <Reveal className={styles.mandateCopy}>
            <h3 className={base.h3}>Autonomy, with a budget.</h3>
            <p className={base.lede}>
              Mara funds a mandate once with a PayPal authorization. Every <code>accept_quote</code>{' '}
              passes the policy engine, under a row lock, before a cent moves.
            </p>
          </Reveal>
          <Reveal className={styles.meterCard} delay={1}>
            <div className={styles.meterHead}>
              <span>Mandate M1</span>
              <span>
                {formatUsd(spent)} of {formatUsd(30000)}
              </span>
            </div>
            <div className={styles.meter} aria-hidden="true">
              <span className={styles.meterFill} style={{ width: `${(spent / 30000) * 100}%` }} />
              <span className={styles.meterCap} style={{ left: `${(10000 / 30000) * 100}%` }} />
            </div>
            <div className={styles.meterLegend}>
              <span>spent</span>
              <span>per-purchase limit {formatUsd(10000)}</span>
            </div>
            <ul className={styles.outcomes}>
              <li data-tone="ok">
                <code className={styles.outcomeCode}>paid</code>
                <span>within both limits</span>
              </li>
              <li data-tone="warn">
                <code className={styles.outcomeCode}>approval_required</code>
                <span>over a limit: a PayPal link for a human</span>
              </li>
              <li data-tone="danger">
                <code className={styles.outcomeCode}>denied</code>
                <span>wrong project, currency or a stale version</span>
              </li>
            </ul>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
