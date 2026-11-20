import type { Priority } from '../domain/types';

export interface PriorityVisual {
  label: string;
  paths: readonly string[];
}

export const PRIORITY_VISUALS: Record<Priority, PriorityVisual> = {
  low: {
    label: 'Low',
    paths: ['M12 5v14', 'm19 12-7 7-7-7'],
  },
  medium: {
    label: 'Medium',
    paths: ['M5 12h14'],
  },
  high: {
    label: 'High',
    paths: ['m5 12 7-7 7 7', 'M12 19V5'],
  },
};

export function PriorityIcon({ priority, size = 11 }: { priority: Priority; size?: number }) {
  const visual = PRIORITY_VISUALS[priority];
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {visual.paths.map((path) => (
        <path key={path} d={path} />
      ))}
    </svg>
  );
}
