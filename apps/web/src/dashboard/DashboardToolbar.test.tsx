import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DashboardToolbar } from './DashboardToolbar.js';
import styles from './DashboardToolbar.module.css';

const pages = [{ id: 'overview', title: 'Overview' }];

describe('DashboardToolbar', () => {
  it('groups Assistant and Edit, so phones place them side by side instead of on top of each other', () => {
    const onToggle = vi.fn();
    const onToggleEdit = vi.fn();
    render(
      <DashboardToolbar
        pages={pages}
        pageId="overview"
        onSelectPage={() => undefined}
        editing={false}
        onToggleEdit={onToggleEdit}
        assistant={{ open: true, onToggle }}
      />,
    );
    const assistant = screen.getByRole('button', { name: 'Assistant' });
    const edit = screen.getByRole('button', { name: 'Edit' });
    expect(assistant.parentElement).toBe(edit.parentElement);
    expect(assistant.parentElement).toHaveClass(styles.actions ?? 'actions');
    // The labels are the accessible names even where only the icons show.
    expect(assistant.querySelector(`.${styles.label ?? 'label'}`)).toHaveTextContent('Assistant');
    expect(assistant).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(assistant);
    fireEvent.click(edit);
    expect(onToggle).toHaveBeenCalledOnce();
    expect(onToggleEdit).toHaveBeenCalledOnce();
  });
});
