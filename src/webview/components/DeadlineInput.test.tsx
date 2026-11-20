import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { DeadlineInput, hasFullDate, maskDate, maskTime } from './DeadlineInput';

function Harness({ initial = { date: '', time: '' } }: { initial?: { date: string; time: string } }) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | undefined>();
  return (
    <>
      <DeadlineInput value={value} onChange={setValue} error={error} />
      <button
        type="button"
        onClick={() => setError('Fill the deadline.')}
      >
        Validate
      </button>
      <output data-testid="value">{JSON.stringify(value)}</output>
    </>
  );
}

describe('DeadlineInput', () => {
  it('masks date and time digits', () => {
    expect(maskDate('25112026')).toBe('25/11/2026');
    expect(maskDate('25/11/2026extra99')).toBe('25/11/2026');
    expect(maskTime('1430')).toBe('14:30');
    expect(maskTime('14:30:59')).toBe('14:30');
    expect(hasFullDate('25/11/2026')).toBe(true);
  });

  it('accepts quick entry and advances from date to time', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const date = screen.getByLabelText('Deadline date');
    await user.type(date, '251120261430');

    expect(screen.getByLabelText('Deadline date')).toHaveValue('25/11/2026');
    expect(screen.getByLabelText('Deadline time')).toHaveValue('14:30');
  });

  it('shows persisted local values and edits them', async () => {
    const user = userEvent.setup();
    render(<Harness initial={{ date: '25/11/2026', time: '14:30' }} />);
    const time = screen.getByLabelText('Deadline time');
    await user.clear(time);
    await user.type(time, '0930');
    expect(time).toHaveValue('09:30');
  });

  it('clears both fields and exposes a clear label', async () => {
    const user = userEvent.setup();
    render(<Harness initial={{ date: '25/11/2026', time: '14:30' }} />);
    await user.click(screen.getByRole('button', { name: 'Clear deadline' }));
    expect(screen.getByLabelText('Deadline date')).toHaveValue('');
    expect(screen.getByLabelText('Deadline time')).toHaveValue('');
  });

  it('keeps letters out and reports an error near the field', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(screen.getByLabelText('Deadline date'), '25abc11');
    expect(screen.getByLabelText('Deadline date')).toHaveValue('25/11');
    await user.click(screen.getByRole('button', { name: 'Validate' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Fill the deadline.');
  });

  it('disables clearing when both fields are empty', () => {
    render(<DeadlineInput value={{ date: '', time: '' }} onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Clear deadline' })).toBeDisabled();
  });
});
