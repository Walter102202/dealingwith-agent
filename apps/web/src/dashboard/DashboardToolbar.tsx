import { Button } from '../components/Button.js';
import styles from './DashboardToolbar.module.css';

interface DashboardToolbarProps {
  pages: readonly { id: string; title: string }[];
  pageId: string;
  onSelectPage: (pageId: string) => void;
  editing: boolean;
  onToggleEdit: () => void;
  /** Present only when the server has the assistant on. */
  assistant?: { open: boolean; onToggle: () => void };
}

/**
 * Page tabs, the Assistant toggle and the Edit toggle in the dashboard header.
 * The dashboard opens as a report.
 */
export function DashboardToolbar({
  pages,
  pageId,
  onSelectPage,
  editing,
  onToggleEdit,
  assistant,
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
      {assistant ? (
        <Button
          variant="secondary"
          className={assistant.open ? `${styles.edit} ${styles.editing}` : styles.edit}
          aria-pressed={assistant.open}
          onClick={assistant.onToggle}
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
            <path d="M8 2.5 9.4 6.6 13.5 8 9.4 9.4 8 13.5 6.6 9.4 2.5 8 6.6 6.6z" />
          </svg>
          Assistant
        </Button>
      ) : null}
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
