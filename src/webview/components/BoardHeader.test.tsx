import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { BoardHeader } from './BoardHeader';

function renderHeader(cardLayout: 'expanded' | 'compact' = 'expanded') {
  const onCardLayoutChange = vi.fn();
  render(
    <BoardHeader
      boardName="Board"
      workspaceName="Workspace"
      columnCount={2}
      taskCount={3}
      errorCount={0}
      warningCount={0}
      busy={false}
      cardLayout={cardLayout}
      onRefresh={vi.fn()}
      onValidate={vi.fn()}
      onAddColumn={vi.fn()}
      onShowValidation={vi.fn()}
      onCardLayoutChange={onCardLayoutChange}
    />,
  );
  return { onCardLayoutChange };
}

describe('BoardHeader card density', () => {
  it('reports the selected layout with aria-pressed', () => {
    renderHeader('expanded');
    expect(screen.getByRole('button', { name: 'Expanded' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Compact' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('requests a layout change from each option', async () => {
    const user = userEvent.setup();
    const { onCardLayoutChange } = renderHeader('expanded');

    await user.click(screen.getByRole('button', { name: 'Compact' }));
    expect(onCardLayoutChange).toHaveBeenCalledWith('compact');

    await user.click(screen.getByRole('button', { name: 'Expanded' }));
    expect(onCardLayoutChange).toHaveBeenCalledWith('expanded');
  });
});
