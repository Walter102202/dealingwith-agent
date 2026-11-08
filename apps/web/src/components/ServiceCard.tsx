import type { Service } from '@dealingwith/contracts';
import { Button } from './Button.js';
import { Money } from './Money.js';
import styles from './ServiceCard.module.css';

interface ServiceCardProps {
  service: Service;
  onBuy?: (service: Service) => void;
  busy?: boolean;
}

/** A service has one buyable price only when its single rule is a fixed amount. */
export function fixedPrice(service: Service): number | null {
  const [rule, ...rest] = service.pricingRules;
  return rule && rest.length === 0 && rule.type === 'fixed' ? rule.amountCents : null;
}

function ruleSummary(service: Service): string {
  return service.pricingRules
    .map((rule) => {
      if (rule.type === 'fixed') return `${rule.label} ${formatShort(rule.amountCents)}`;
      if (rule.type === 'per_unit')
        return `${rule.label} ${formatShort(rule.amountCents)} per ${rule.unit}`;
      return `${rule.label} +${rule.percent}%`;
    })
    .join(' · ');
}

const formatShort = (cents: number) =>
  cents % 100 === 0
    ? `US$${(cents / 100).toLocaleString('en-US')}`
    : `US$${(cents / 100).toFixed(2)}`;

/** One service of the storefront: what it is, what it includes and excludes, its price. */
export function ServiceCard({ service, onBuy, busy = false }: ServiceCardProps) {
  const price = fixedPrice(service);
  return (
    <article className={styles.card} aria-labelledby={`service-${service.id}`}>
      <div className={styles.head}>
        <h2 id={`service-${service.id}`} className={styles.name}>
          {service.name}
        </h2>
        {price !== null ? (
          <Money cents={price} size="total" />
        ) : (
          <p className={styles.rules}>{ruleSummary(service)}</p>
        )}
      </div>
      <p className={styles.description}>{service.description}</p>
      <dl className={styles.scope}>
        <div>
          <dt>Includes</dt>
          <dd>
            <ul>
              {service.inclusions.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </dd>
        </div>
        <div>
          <dt>Does not include</dt>
          <dd>
            <ul>
              {service.exclusions.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </dd>
        </div>
      </dl>
      <div className={styles.foot}>
        <span className="muted small">
          Delivery {service.deliveryDays} {service.deliveryDays === 1 ? 'day' : 'days'}
        </span>
        {price !== null && onBuy ? (
          <Button variant="primary" busy={busy} onClick={() => onBuy(service)}>
            Buy
          </Button>
        ) : null}
      </div>
    </article>
  );
}
