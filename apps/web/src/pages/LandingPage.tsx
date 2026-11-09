import { Hero } from '../landing/Hero.js';
import styles from '../landing/Landing.module.css';
import { LandingHeader } from '../landing/LandingHeader.js';
import {
  Agents,
  BuiltOnPayPal,
  Footer,
  ForProviders,
  HowItWorks,
  Problem,
  TryIt,
} from '../landing/Sections.js';

/** `/`: what DealingWith is, for a first-time visitor and a judge. The demo starts at `/login`. */
export function LandingPage() {
  return (
    <div className={styles.page}>
      <LandingHeader />
      <main>
        <Hero />
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
