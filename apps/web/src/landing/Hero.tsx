import { AppReplay } from './AppReplay.js';
import { CtaLink, type DemoCta } from './cta.js';
import styles from './Hero.module.css';
import base from './Landing.module.css';

/** The promise, centered and large; below it the product, played once. */
export function Hero({ cta }: { cta: DemoCta }) {
  return (
    <section className={styles.hero} aria-labelledby="hero-title">
      <div className={styles.heroCopy}>
        <p className={`${base.eyebrow} ${base.rise}`}>Change orders · Paid with PayPal</p>
        <h1
          id="hero-title"
          className={`${base.display} ${styles.heroTitle} ${base.rise}`}
          data-delay="1"
        >
          Turn service requests into paid work.
        </h1>
        <p className={`${styles.heroLead} ${base.rise}`} data-delay="2">
          Your client, or their AI agent, asks for one more thing. DealingWith says what is already
          included, prices the extra from your own rules, explains why, and collects with PayPal.
        </p>
        <div className={`${styles.heroActions} ${base.rise}`} data-delay="3">
          <CtaLink cta={cta} className={`${base.pill} ${base.pillPrimary}`} />
          <a href="#for-agents" className={`${base.pill} ${base.pillSecondary}`}>
            Connect your agent
          </a>
        </div>
        <p className={`${styles.heroNote} ${base.rise}`} data-delay="3">
          Live on PayPal sandbox with a real model. No sign-up, no real money.
        </p>
      </div>
      <div className={`${styles.heroStage} ${base.riseLate}`}>
        <AppReplay />
      </div>
    </section>
  );
}
