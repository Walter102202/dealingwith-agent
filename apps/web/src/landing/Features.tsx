import styles from './Features.module.css';
import base from './Landing.module.css';
import { Reveal } from './Reveal.js';
import { delay, SectionHead } from './SectionHead.js';

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
      className={`${base.section} ${base.sectionAlt}`}
      aria-labelledby="paypal-title"
    >
      <div className={base.container}>
        <SectionHead
          n="04"
          eyebrow="Built on PayPal"
          titleId="paypal-title"
          title="Payment is the transaction, not an afterthought."
          lede="Orders v2, authorizations with partial capture, verified webhooks. The hosted demo runs on the PayPal sandbox: real API calls, no real money."
        />
        <div className={styles.cards}>
          {PAYPAL.map(([code, title, body], i) => (
            <Reveal key={title} delay={delay(i)}>
              <div className={styles.card}>
                <code className={styles.cardCode}>{code}</code>
                <h3 className={styles.cardTitle}>{title}</h3>
                <p className={styles.cardBody}>{body}</p>
              </div>
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
    <section id="for-providers" className={base.section} aria-labelledby="providers-title">
      <div className={base.container}>
        <SectionHead
          n="05"
          eyebrow="For providers"
          titleId="providers-title"
          title="See every extra you used to give away."
          lede="A dashboard built with AG Studio on AG Grid and AG Charts, fed by the same quotes and payments the client sees. Rearrange or add widgets on the spot."
        />
        <div className={styles.cards}>
          {WIDGETS.map(([name, body], i) => (
            <Reveal key={name} delay={delay(i)}>
              <div className={`${styles.card} ${styles.cardRaised}`}>
                <h3 className={styles.cardTitle}>{name}</h3>
                <p className={styles.cardBody}>{body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
