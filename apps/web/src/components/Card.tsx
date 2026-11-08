import type { HTMLAttributes, ReactNode } from 'react';
import styles from './Card.module.css';

interface CardProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title?: ReactNode;
  /** Shown at the right of the title: a badge, an amount, a small action. */
  aside?: ReactNode;
  as?: 'section' | 'article' | 'div';
  children: ReactNode;
}

/** A white surface on the paper background. Titles are optional; the body sets its own spacing. */
export function Card({ title, aside, as = 'section', className, children, ...rest }: CardProps) {
  const Tag = as;
  const classes = [styles.card, className].filter(Boolean).join(' ');
  return (
    <Tag className={classes} {...rest}>
      {title || aside ? (
        <header className={styles.header}>
          {title ? <h2 className={styles.title}>{title}</h2> : <span />}
          {aside ? <div className={styles.aside}>{aside}</div> : null}
        </header>
      ) : null}
      <div className={styles.body}>{children}</div>
    </Tag>
  );
}
