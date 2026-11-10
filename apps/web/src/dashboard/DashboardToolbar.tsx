import { Button } from '../components/Button.js';
import styles from './DashboardToolbar.module.css';

interface DashboardToolbarProps {
  pages: readonly { id: string; title: string }[];
  pageId: string;
  onSelectPage: (pageId: string) => void;
  editing: boolean;
  onToggleEdit: () => void;
}

/** Page tabs and the Edit toggle in the dashboard header. The dashboard opens as a report. */
export function DashboardToolbar({
  pages,
  pageId,
  onSelectPage,
  editing,
  onToggleEdit,
}: DashboardToolbarProps) {
  return (
    <div className={styles.toolbar}>
      <nav className={styles.tabs} aria-label="Dashboard pages">
        {pages.map((page) => {
          const current = page.id === pageId;
          return (
            <button
              key={page.id}
              type="button"
              className={current ? `${styles.tab} ${styles.current}` : styles.tab}
              aria-current={current ? 'page' : undefined}
              onClick={() => onSelectPage(page.id)}
            >
              {page.title}
            </button>
          );
        })}
      </nav>
      <Button
        variant="secondary"
        className={editing ? `${styles.edit} ${styles.editing}` : styles.edit}
        aria-pressed={editing}
        onClick={onToggleEdit}
      >
        <svg
          aria-hidden="true"
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M10.5 2.5 13.5 5.5 6 13H3v-3z" />
        </svg>
        Edit
      </Button>
    </div>
  );
}
