import { Link } from 'react-router';
import { Card } from '../components/Card.js';
import { Layout } from '../components/Layout.js';
import styles from './ReturnPages.module.css';

/** `/pay/cancel`: the buyer left PayPal without approving. Nothing was charged. */
export function PayCancelPage() {
  return (
    <Layout>
      <div className={styles.page}>
        <Card title="Payment cancelled">
          <p className="muted">
            Nothing was charged. The quote is still open; you can accept it again whenever you are
            ready.
          </p>
          <p className={styles.links}>
            <Link to="/store" className={styles.primaryLink}>
              Back to the storefront
            </Link>
          </p>
        </Card>
      </div>
    </Layout>
  );
}
