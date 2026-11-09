import { Link } from 'react-router';
import { MCP_GUIDE_URL, REPO_URL } from './demo-quote.js';
import styles from './Landing.module.css';

export function Problem() {
  return (
    <section className={styles.section} aria-labelledby="problem-title">
      <div className={styles.sectionInner}>
        <p className={styles.kicker}>The change order problem</p>
        <h2 id="problem-title" className={styles.sectionTitle}>
          “Can you also add…?” is where small service businesses lose money.
        </h2>
        <ol className={styles.questions}>
          <li>
            <span className={styles.questionText}>Is this already included?</span>
            <span className={styles.questionNote}>
              Nobody rereads the contract mid-project, so extras get done for free.
            </span>
          </li>
          <li>
            <span className={styles.questionText}>What does the extra cost, and why?</span>
            <span className={styles.questionNote}>
              Writing a quote for an eighty-dollar change takes longer than the change.
            </span>
          </li>
          <li>
            <span className={styles.questionText}>Who chases the payment?</span>
            <span className={styles.questionNote}>
              Approved work waits on invoices. And clients now send AI agents to buy for them.
            </span>
          </li>
        </ol>
      </div>
    </section>
  );
}

const STEPS = [
  {
    title: 'Publish once',
    body: 'The provider lists services and pricing rules: fixed prices, per-unit extras, rush multipliers. Each project keeps its contracted scope as numbered clauses.',
  },
  {
    title: 'Ask in plain language',
    body: 'The client types a request on the project page, or their agent sends it over MCP. Missing information gets one clear question before anything is priced.',
  },
  {
    title: 'Included or extra, explained',
    body: 'The agent maps each part of the request to a clause (included, US$0.00) or a rule (extra). A deterministic engine computes every amount. The model never prices.',
  },
  {
    title: 'Pay and update the scope',
    body: 'The client pays with PayPal, or their agent pays within a pre-authorized budget. Paid extras become new clauses, so asking again comes back included.',
  },
] as const;

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className={`${styles.section} ${styles.sectionAlt}`}
      aria-labelledby="how-title"
    >
      <div className={styles.sectionInner}>
        <p className={styles.kicker}>How it works</p>
        <h2 id="how-title" className={styles.sectionTitle}>
          From a sentence to a versioned, paid quote.
        </h2>
        <ol className={styles.steps}>
          {STEPS.map((step, index) => (
            <li key={step.title} className={styles.step}>
              <span className={styles.stepNumber} aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
              <h3 className={styles.stepTitle}>{step.title}</h3>
              <p className={styles.stepBody}>{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

const PAYPAL_FACTS = [
  {
    title: 'Pay now',
    body: 'Accepting a quote creates a PayPal order with intent CAPTURE. The client approves on PayPal and the server captures on return or on the webhook, whichever comes first.',
  },
  {
    title: 'Mandates for agents',
    body: 'The client funds a budget once with an AUTHORIZE order. Each purchase their agent makes inside the limits is a partial capture against that authorization.',
  },
  {
    title: 'Verified webhooks',
    body: 'Every event is signature-verified, stored once by its PayPal event id and applied idempotently, so a late or repeated webhook never double-counts.',
  },
  {
    title: 'Idempotent by design',
    body: 'Each payment carries one key, pay:<quoteId>:<version>, sent as the PayPal-Request-Id. A retry or a double click never creates a second charge.',
  },
] as const;

export function BuiltOnPayPal() {
  return (
    <section id="paypal" className={styles.section} aria-labelledby="paypal-title">
      <div className={styles.sectionInner}>
        <p className={styles.kicker}>Built on PayPal</p>
        <h2 id="paypal-title" className={styles.sectionTitle}>
          Payment is the transaction, not an afterthought.
        </h2>
        <div className={styles.factGrid}>
          {PAYPAL_FACTS.map((fact) => (
            <div key={fact.title} className={styles.fact}>
              <h3 className={styles.factTitle}>{fact.title}</h3>
              <p className={styles.factBody}>{fact.body}</p>
            </div>
          ))}
        </div>
        <p className={styles.footnote}>
          The hosted demo runs on the PayPal sandbox: real API calls, no real money.
        </p>
      </div>
    </section>
  );
}

const WIDGETS = [
  ['Revenue by service', 'Paid quote lines, by service.'],
  ['Quotes pipeline', 'Quotes by status and by channel: web or agent.'],
  ['Unpaid additionals', 'Priced extras still waiting for a payment.'],
  ['Requests over time', 'What clients ask for, day by day.'],
] as const;

export function ForProviders() {
  return (
    <section
      id="for-providers"
      className={`${styles.section} ${styles.sectionAlt}`}
      aria-labelledby="providers-title"
    >
      <div className={styles.sectionInner}>
        <p className={styles.kicker}>For providers</p>
        <h2 id="providers-title" className={styles.sectionTitle}>
          See every extra you used to give away.
        </h2>
        <p className={styles.sectionLead}>
          The provider dashboard is built with AG Studio on AG Grid and AG Charts, fed by the same
          quotes and payments the client sees. Rearrange or add widgets on the spot.
        </p>
        <ul className={styles.widgets}>
          {WIDGETS.map(([name, body]) => (
            <li key={name} className={styles.widget}>
              <h3 className={styles.widgetName}>{name}</h3>
              <p className={styles.widgetBody}>{body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function TryIt() {
  return (
    <section className={`${styles.section} ${styles.tryIt}`} aria-labelledby="try-title">
      <div className={styles.sectionInner}>
        <h2 id="try-title" className={styles.tryTitle}>
          Try it in two minutes.
        </h2>
        <p className={styles.tryLead}>
          No password. Pick a side of the deal; reset the demo any time from the provider header.
        </p>
        <div className={styles.doors}>
          <Link to="/login" className={styles.door}>
            <span className={styles.doorWho}>Enter as Mara, the client</span>
            <span className={styles.doorWhat}>
              Ask for a change, see what is included, pay the extra with PayPal, connect your own
              agent.
            </span>
          </Link>
          <Link to="/login" className={styles.door}>
            <span className={styles.doorWho}>Enter as Andes Data Studio, the provider</span>
            <span className={styles.doorWhat}>
              Watch revenue, the quote pipeline and unpaid extras on the AG Studio dashboard.
            </span>
          </Link>
          <Link to="/store" className={styles.door}>
            <span className={styles.doorWho}>Browse the storefront</span>
            <span className={styles.doorWhat}>
              The demo business’s services, with a fixed-price purchase you can pay right away.
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        <span className={styles.wordmarkSmall}>DealingWith</span>
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
