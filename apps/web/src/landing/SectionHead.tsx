import base from './Landing.module.css';
import { Reveal } from './Reveal.js';

interface HeadProps {
  n: string;
  eyebrow: string;
  titleId: string;
  title: string;
  lede: string;
}

/** Eyebrow across the top, the claim on the left, the explanation on the right. */
export function SectionHead({ n, eyebrow, titleId, title, lede }: HeadProps) {
  return (
    <div className={base.head}>
      <Reveal as="p" className={base.eyebrow}>
        <span className={base.eyebrowN}>{n}</span>
        {eyebrow}
      </Reveal>
      <Reveal delay={1}>
        <h2 id={titleId} className={base.h2}>
          {title}
        </h2>
      </Reveal>
      <Reveal as="p" className={base.lede} delay={2}>
        {lede}
      </Reveal>
    </div>
  );
}

const DELAYS = [0, 1, 2, 3] as const;
/** Staggers a list's reveals in steps of 0 to 3. */
export const delay = (i: number) => DELAYS[i % 4] ?? 0;
