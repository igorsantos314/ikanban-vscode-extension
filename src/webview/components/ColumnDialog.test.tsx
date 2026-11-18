import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ColumnView } from '../../shared/board';
import { ColumnDialog } from './ColumnDialog';

const column: ColumnView = {
  id: 'backlog',
  title: 'Backlog',
  color: '#64748b',
  revision: 'col-rev',
  taskCount: 0,
};

describe('ColumnDialog', () => {
  it('validates title and color before submitting', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<ColumnDialog onSubmit={onSubmit} onClose={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Save column' }));
    expect(screen.getByText('Column title is required.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText('Title'), 'Review');
    const color = screen.getByLabelText('Column color hex value');
    await user.clear(color);
    await user.type(color, 'red');
    await user.click(screen.getByRole('button', { name: 'Save column' }));
    expect(screen.getByText('Color must be a six-digit hexadecimal value.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits valid values for a new column', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(async () => undefined);
    render(<ColumnDialog onSubmit={onSubmit} onClose={vi.fn()} />);
    await user.type(screen.getByLabelText('Title'), 'Review');
    await user.click(screen.getByRole('button', { name: 'Save column' }));
    expect(onSubmit).toHaveBeenCalledWith({ title: 'Review', color: '#64748b' });
  });

  it('loads an existing column and keeps the dialog open on failure', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(async () => {
      throw new Error('Board revision changed.');
    });
    render(<ColumnDialog column={column} onSubmit={onSubmit} onClose={vi.fn()} />);
    expect(screen.getByLabelText('Title')).toHaveValue('Backlog');
    await user.click(screen.getByRole('button', { name: 'Save column' }));
    expect(await screen.findByText('Board revision changed.')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
