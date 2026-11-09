import { Link } from 'react-router';
import { QuoteCard } from '../components/QuoteCard.js';
import { DEMO_QUOTE, DEMO_REQUEST } from './demo-quote.js';
import styles from './Landing.module.css';
import { useDemoCta } from './LandingHeader.js';

/**
 * The promise on the left; on the right the product itself, played once:
 * Mara's request, the quote the agent answers with, and the PayPal capture
 * that adds the extra to her project. The animation is CSS only and resolves
 * to the final frame; with reduced motion the final frame is all there is.
 */
export function Hero() {
  const cta = useDemoCta();
  return (
    <section className={styles.hero} aria-labelledby="hero-title">
      <div className={styles.heroInner}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>For freelancers and service firms · Paid with PayPal</p>
          <h1 id="hero-title" className={styles.heroTitle}>
            Turn service requests into <em>paid work.</em>
          </h1>
          <p className={styles.heroLead}>
            Your client, or their AI agent, asks for one more thing in plain language. DealingWith
            says what is already included, prices the extra from your own rules, explains why, and
            collects with PayPal. The project scope updates itself.
          </p>
          <div className={styles.heroActions}>
            <Link to={cta.to} className={styles.ctaPrimary}>
              {cta.label}
            </Link>
            <a href="#for-agents" className={styles.ctaSecondary}>
              Connect your agent
            </a>
          </div>
          <p className={styles.heroNote}>
            Live on PayPal sandbox with a real model. No sign-up, no real money.
          </p>
        </div>

        <figure className={styles.stage} aria-label="Example: a change order, quoted and paid">
          <div className={styles.request}>
            <span className={styles.requestWho}>Mara · Lukas Retail</span>
            <p className={styles.requestText}>“{DEMO_REQUEST}”</p>
          </div>
          <div className={styles.stageQuote}>
            <QuoteCard quote={DEMO_QUOTE} preview />
          </div>
          <div className={styles.receipt} role="note">
            <span className={styles.receiptDot} aria-hidden="true" />
            <span>
              <strong>US$80.00 captured with PayPal.</strong> Clause C4 “Weekly Monday summary
              email” added to the project.
            </span>
          </div>
        </figure>
      </div>
    </section>
  );
}
