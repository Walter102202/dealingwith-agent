import { Agents } from '../landing/Agents.js';
import { Footer, TryIt } from '../landing/Closing.js';
import { useDemoCta } from '../landing/cta.js';
import { BuiltOnPayPal, ForProviders } from '../landing/Features.js';
import { Hero } from '../landing/Hero.js';
import styles from '../landing/Landing.module.css';
import { LandingHeader } from '../landing/LandingHeader.js';
import { HowItWorks, Problem } from '../landing/Story.js';

/** `/`: what DealingWith is, for a first-time visitor and a judge. The demo starts at `/login`. */
export function LandingPage() {
  // One lookup for the header and the hero: a signed-in client's project is fetched once.
  const cta = useDemoCta();
  return (
    <div className={styles.page}>
      <LandingHeader cta={cta} />
      <main>
        <Hero cta={cta} />
        <Problem />
        <HowItWorks />
        <Agents />
        <BuiltOnPayPal />
        <ForProviders />
        <TryIt />
      </main>
      <Footer />
    </div>
  );
}
