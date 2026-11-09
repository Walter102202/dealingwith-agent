import { formatUsd } from '@dealingwith/contracts';
import { Link } from 'react-router';
import { CopyField } from '../components/CopyField.js';
import { AgentTerminal } from './AgentTerminal.js';
import { MCP_GUIDE_URL, REPO_URL } from './demo-quote.js';
import styles from './Landing.module.css';
import { Reveal } from './Reveal.js';

interface HeadProps {
  n: string;
  eyebrow: string;
  titleId: string;
  title: string;
  lede: string;
}

/** Eyebrow across the top, the claim on the left, the explanation on the right. */
function SectionHead({ n, eyebrow, titleId, title, lede }: HeadProps) {
  return (
    <div className={styles.head}>
      <Reveal as="p" className={styles.eyebrow}>
        <span className={styles.eyebrowN}>{n}</span>
        {eyebrow}
      </Reveal>
      <Reveal delay={1}>
        <h2 id={titleId} className={styles.h2}>
          {title}
        </h2>
      </Reveal>
      <Reveal as="p" className={styles.lede} delay={2}>
        {lede}
      </Reveal>
    </div>
  );
}

const QUESTIONS = [
  [
    'Is this already included?',
    'Nobody rereads the contract mid-project, so extras get done for free.',
  ],
  [
    'What does the extra cost, and why?',
    'Writing a quote for an eighty-dollar change takes longer than the change.',
  ],
  [
    'Who chases the payment?',
    'Approved work waits on invoices. And clients now send AI agents to buy.',
  ],
] as const;

const DELAYS = [0, 1, 2, 3] as const;
const delay = (i: number) => DELAYS[i % 4] ?? 0;

export function Problem() {
  return (
    <section className={styles.section} aria-labelledby="problem-title">
      <div className={styles.container}>
        <SectionHead
          n="01"
          eyebrow="The problem"
          titleId="problem-title"
          title="“Can you also add…?” is where small firms lose money."
          lede="Freelancers and service firms live on change orders. Three questions go unanswered every time, and an AI agent asking on the client’s behalf makes them harder."
        />
        <ol className={styles.questions}>
          {QUESTIONS.map(([q, note], i) => (
            <Reveal as="li" key={q} delay={delay(i + 1)} className={styles.question}>
              <span className={styles.questionText}>{q}</span>
              <span className={styles.questionNote}>{note}</span>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}

const STEPS = [
  [
    'Publish once',
    'Services and pricing rules: fixed prices, per-unit extras, rush multipliers. Each project keeps its scope as numbered clauses.',
  ],
  [
    'Ask in plain language',
    'On the project page or over MCP. Missing information gets one clear question before anything is priced.',
  ],
  [
    'Included or extra, explained',
    'Each part maps to a clause or a rule. A deterministic engine computes every amount.',
  ],
  [
    'Pay, and the scope grows',
    'PayPal collects. Paid extras become new clauses, so asking again comes back included.',
  ],
] as const;

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className={`${styles.section} ${styles.sectionAlt}`}
      aria-labelledby="how-title"
    >
      <div className={styles.container}>
        <SectionHead
          n="02"
          eyebrow="How it works"
          titleId="how-title"
          title="Included or extra. Explained, line by line."
          lede="The agent reads the request against the contract and cites a source for every line. The price comes from your rules, never from the model."
        />
        <div className={styles.verdicts}>
          <Reveal className={`${styles.verdict} ${styles.verdictIn}`}>
            <span className={styles.verdictTag}>Included</span>
            <span className={styles.verdictAmount}>{formatUsd(0)}</span>
            <span className={styles.verdictWhat}>Per-branch view</span>
            <code className={styles.verdictSource}>clause C1 · five views incl. per-branch</code>
          </Reveal>
          <Reveal className={`${styles.verdict} ${styles.verdictExtra}`} delay={1}>
            <span className={styles.verdictTag}>Extra</span>
            <span className={styles.verdictAmount}>{formatUsd(8000)}</span>
            <span className={styles.verdictWhat}>Weekly Monday summary email</span>
            <code className={styles.verdictSource}>rule S2.report.v1 · excluded by clause C2</code>
          </Reveal>
        </div>
        <ol className={styles.steps}>
          {STEPS.map(([title, body], i) => (
            <Reveal as="li" key={title} delay={delay(i)} className={styles.step}>
              <span className={styles.stepN}>{String(i + 1).padStart(2, '0')}</span>
              <h3 className={styles.stepTitle}>{title}</h3>
              <p className={styles.stepBody}>{body}</p>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function Agents() {
  const spent = 6000;
  return (
    <section id="for-agents" className={styles.section} aria-labelledby="agents-title">
      <div className={styles.container}>
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
            <h3 className={styles.h3}>Autonomy, with a budget.</h3>
            <p className={styles.lede}>
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

const PAYPAL = [
  [
    'intent: CAPTURE',
    'Pay now',
    'Accepting creates an order; the client approves on PayPal and we capture on return or on the webhook, whichever comes first.',
  ],
  [
    'intent: AUTHORIZE',
    'Mandates for agents',
    'The budget is funded once. Each purchase within the limits is a partial capture against that authorization.',
  ],
  [
    'paypal_event_id',
    'Verified webhooks',
    'Every event is signature-verified, stored once and applied idempotently. A repeat is recorded as a duplicate.',
  ],
  [
    'PayPal-Request-Id',
    'Idempotent by design',
    'pay:<quoteId>:<version> keys the payment and the call. A double click never charges twice.',
  ],
] as const;

export function BuiltOnPayPal() {
  return (
    <section
      id="paypal"
      className={`${styles.section} ${styles.sectionAlt}`}
      aria-labelledby="paypal-title"
    >
      <div className={styles.container}>
        <SectionHead
          n="04"
          eyebrow="Built on PayPal"
          titleId="paypal-title"
          title="Payment is the transaction, not an afterthought."
          lede="Orders v2, authorizations with partial capture, verified webhooks. The hosted demo runs on the PayPal sandbox: real API calls, no real money."
        />
        <div className={styles.cards}>
          {PAYPAL.map(([code, title, body], i) => (
            <Reveal key={title} delay={delay(i)} className={styles.card}>
              <code className={styles.cardCode}>{code}</code>
              <h3 className={styles.cardTitle}>{title}</h3>
              <p className={styles.cardBody}>{body}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

const WIDGETS = [
  ['Revenue by service', 'Paid quote lines, by service.'],
  ['Quotes pipeline', 'By status, and by channel: web or agent.'],
  ['Unpaid additionals', 'Priced extras still waiting for a payment.'],
  ['Requests over time', 'What clients ask for, day by day.'],
] as const;

export function ForProviders() {
  return (
    <section id="for-providers" className={styles.section} aria-labelledby="providers-title">
      <div className={styles.container}>
        <SectionHead
          n="05"
          eyebrow="For providers"
          titleId="providers-title"
          title="See every extra you used to give away."
          lede="A dashboard built with AG Studio on AG Grid and AG Charts, fed by the same quotes and payments the client sees. Rearrange or add widgets on the spot."
        />
        <div className={styles.cards}>
          {WIDGETS.map(([name, body], i) => (
            <Reveal key={name} delay={delay(i)} className={styles.card}>
              <h3 className={styles.cardTitle}>{name}</h3>
              <p className={styles.cardBody}>{body}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function TryIt() {
  const origin = typeof window === 'undefined' ? 'https://dealingwith.si' : window.location.origin;
  return (
    <section className={`${styles.section} ${styles.invite}`} aria-labelledby="try-title">
      <div className={styles.container}>
        <Reveal>
          <h2 id="try-title" className={`${styles.display} ${styles.inviteTitle}`}>
            Try it in two minutes.
          </h2>
        </Reveal>
        <Reveal as="p" className={styles.inviteLead} delay={1}>
          No password. Pick a side of the deal; reset the demo any time from the provider header.
        </Reveal>
        <div className={styles.doors}>
          <Reveal delay={1}>
            <Link to="/login" className={styles.door}>
              <span className={styles.doorWho}>Mara, the client</span>
              <span className={styles.doorWhat}>
                Ask for a change, see what is included, pay the extra, connect your agent.
              </span>
              <span className={styles.doorGo}>Enter as Mara →</span>
            </Link>
          </Reveal>
          <Reveal delay={2}>
            <Link to="/login" className={styles.door}>
              <span className={styles.doorWho}>Andes Data Studio, the provider</span>
              <span className={styles.doorWhat}>
                Revenue, the quote pipeline and unpaid extras on the AG Studio dashboard.
              </span>
              <span className={styles.doorGo}>Enter as provider →</span>
            </Link>
          </Reveal>
          <Reveal delay={3}>
            <Link to="/store" className={styles.door}>
              <span className={styles.doorWho}>The storefront</span>
              <span className={styles.doorWhat}>
                The demo business’s services, with a fixed-price purchase you can pay right away.
              </span>
              <span className={styles.doorGo}>Browse the storefront →</span>
            </Link>
          </Reveal>
        </div>
        <Reveal className={styles.install} delay={1}>
          <CopyField
            label="Or connect Claude Code (the token comes from “Connect my agent”)"
            value={`claude mcp add --transport http dealingwith ${origin}/mcp --header "Authorization: Bearer dwa_…"`}
            multiline
          />
          <a href={MCP_GUIDE_URL} target="_blank" rel="noreferrer" className={styles.textLink}>
            Read the MCP guide
          </a>
        </Reveal>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={`${styles.container} ${styles.footerInner}`}>
        <span className={styles.wordmark}>
          <span className={styles.mark} aria-hidden="true" />
          DealingWith
        </span>
        <span>Built for the PayPal AI Hackathon 2026 · MIT license</span>
        <nav className={styles.footerLinks} aria-label="Project">
          <a href={REPO_URL} target="_blank" rel="noreferrer">
            Source on GitHub
          </a>
          <a href={MCP_GUIDE_URL} target="_blank" rel="noreferrer">
            MCP guide
          </a>
        </nav>
      </div>
    </footer>
  );
}
