import { formatUsd } from '@dealingwith/contracts';
import base from './Landing.module.css';
import { Reveal } from './Reveal.js';
import { delay, SectionHead } from './SectionHead.js';
import styles from './Story.module.css';

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

export function Problem() {
  return (
    <section className={base.section} aria-labelledby="problem-title">
      <div className={base.container}>
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
      className={`${base.section} ${base.sectionAlt}`}
      aria-labelledby="how-title"
    >
      <div className={base.container}>
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
