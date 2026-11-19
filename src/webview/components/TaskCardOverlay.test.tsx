import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { TaskView } from '../../shared/board';
import { TaskCardOverlay } from './TaskCard';

function task(overrides: Partial<TaskView> = {}): TaskView {
  return {
    id: '550e8400-e29b-41d4-a716-446655440000',
    title: 'Fix login',
    description: 'Login fails on refresh',
    columnId: 'backlog',
    tags: ['issue', 'feat'],
    priority: 'high',
    position: 1024,
    checklists: [
      {
        id: '650e8400-e29b-41d4-a716-446655440001',
        title: 'Implementation',
        position: 1024,
        items: [
          {
            id: '750e8400-e29b-41d4-a716-446655440002',
            text: 'Done',
            completed: true,
            position: 1024,
          },
          {
            id: '750e8400-e29b-41d4-a716-446655440003',
            text: 'Todo',
            completed: false,
            position: 2048,
          },
        ],
      },
    ],
    createdAt: '2026-11-18T10:00:00.000Z',
    updatedAt: '2026-11-18T10:00:00.000Z',
    revision: 'task-1-rev',
    ...overrides,
  };
}

describe('TaskCardOverlay', () => {
  it('renders title, priority, tags and checklist progress without sortable controls', () => {
    const { container } = render(<TaskCardOverlay task={task()} cardLayout="expanded" />);
    expect(screen.getByText('Fix login')).toBeInTheDocument();
    expect(screen.getByText('Login fails on refresh')).toBeInTheDocument();
    expect(screen.getByLabelText('Priority: High')).toBeInTheDocument();
    expect(screen.getByText('Issue')).toBeInTheDocument();
    expect(screen.getByText('1/2')).toBeInTheDocument();
    expect(container.querySelector('.task-card-overlay-content')).toBeInTheDocument();
    expect(container.querySelector('button')).toBeNull();
  });

  it('renders the compact presentation without description or tag labels', () => {
    const { container } = render(<TaskCardOverlay task={task()} cardLayout="compact" />);
    expect(screen.queryByText('Login fails on refresh')).not.toBeInTheDocument();
    expect(screen.queryByText('Issue')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Issue')).toBeInTheDocument();
    expect(screen.getByLabelText('Priority: High')).toBeInTheDocument();
    expect(screen.getByText('1/2')).toBeInTheDocument();
    expect(container.querySelector('button')).toBeNull();
  });
});
