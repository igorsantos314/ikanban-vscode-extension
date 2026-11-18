import { afterEach, describe, expect, it, vi } from 'vitest';
import { Debouncer } from './debounce';

afterEach(() => {
  vi.useRealTimers();
});

describe('Debouncer', () => {
  it('runs once after a burst of events', async () => {
    vi.useFakeTimers();
    const action = vi.fn();
    const debouncer = new Debouncer(200, action);
    debouncer.schedule();
    vi.advanceTimersByTime(100);
    debouncer.schedule();
    vi.advanceTimersByTime(100);
    debouncer.schedule();
    expect(action).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(200);
    expect(action).toHaveBeenCalledOnce();
  });

  it('can be cancelled and disposed', async () => {
    vi.useFakeTimers();
    const action = vi.fn();
    const debouncer = new Debouncer(200, action);
    debouncer.schedule();
    debouncer.cancel();
    debouncer.schedule();
    debouncer.dispose();
    await vi.advanceTimersByTimeAsync(500);
    expect(action).not.toHaveBeenCalled();
  });
});
