import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TagChip, TagSelector } from './TagChip';
import { TAG_VISUALS } from '../tagVisuals';

describe('TagChip', () => {
  it('renders each tag with an icon and a readable label', () => {
    for (const [tag, visual] of Object.entries(TAG_VISUALS)) {
      const { unmount } = render(<TagChip tag={tag as keyof typeof TAG_VISUALS} />);
      expect(screen.getByText(visual.label)).toBeInTheDocument();
      expect(document.querySelector(`[data-tag="${tag}"] svg`)).not.toBeNull();
      unmount();
    }
  });
});

describe('TagSelector', () => {
  it('selects and deselects tags without relying on color only', () => {
    const onChange = vi.fn();
    render(<TagSelector selected={['issue']} onChange={onChange} />);
    const issue = screen.getByRole('button', { name: /issue/i });
    expect(issue).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /feature/i })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    issue.click();
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('adds a tag to the selection', () => {
    const onChange = vi.fn();
    render(<TagSelector selected={['issue']} onChange={onChange} />);
    screen.getByRole('button', { name: /feature/i }).click();
    expect(onChange).toHaveBeenCalledWith(['issue', 'feat']);
  });
});
