import { type ElementType, type ReactNode, useEffect, useRef, useState } from 'react';
import styles from './Landing.module.css';

/** True once the element has entered the viewport; stays true. */
export function useInView<T extends Element>(rootMargin = '0px 0px -12% 0px') {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node || inView) return;
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [inView, rootMargin]);
  return { ref, inView };
}

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
}

interface RevealProps {
  children: ReactNode;
  as?: ElementType;
  delay?: 0 | 1 | 2 | 3;
  className?: string | undefined;
}

/** Rises out of a soft focus the first time it scrolls into view. */
export function Reveal({ children, as: Tag = 'div', delay = 0, className }: RevealProps) {
  const { ref, inView } = useInView<HTMLElement>();
  const classes = [styles.reveal, inView ? styles.revealIn : '', className]
    .filter(Boolean)
    .join(' ');
  return (
    <Tag ref={ref} className={classes} data-delay={delay}>
      {children}
    </Tag>
  );
}
