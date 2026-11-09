import { Link } from 'react-router';
import { AppReplay } from './AppReplay.js';
import styles from './Landing.module.css';
import { useDemoCta } from './LandingHeader.js';

/** The promise, centered and large; below it the product, played once. */
export function Hero() {
  const cta = useDemoCta();
  return (
    <section className={styles.hero} aria-labelledby="hero-title">
      <div className={styles.heroCopy}>
        <p className={`${styles.eyebrow} ${styles.rise}`}>Change orders · Paid with PayPal</p>
        <h1 id="hero-title" className={`${styles.display} ${styles.rise}`} data-delay="1">
          Turn service requests into paid work.
        </h1>
        <p className={`${styles.heroLead} ${styles.rise}`} data-delay="2">
          Your client, or their AI agent, asks for one more thing. DealingWith says what is already
          included, prices the extra from your own rules, explains why, and collects with PayPal.
        </p>
        <div className={`${styles.heroActions} ${styles.rise}`} data-delay="3">
          <Link to={cta.to} className={`${styles.pill} ${styles.pillPrimary}`}>
            {cta.label}
          </Link>
          <a href="#for-agents" className={`${styles.pill} ${styles.pillSecondary}`}>
            Connect your agent
          </a>
        </div>
        <p className={`${styles.heroNote} ${styles.rise}`} data-delay="3">
          Live on PayPal sandbox with a real model. No sign-up, no real money.
        </p>
      </div>
      <div className={`${styles.heroStage} ${styles.riseLate}`}>
        <AppReplay />
      </div>
    </section>
  );
}
