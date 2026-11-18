import type { TagId } from '../domain/tags';

export interface TagVisual {
  label: string;
  className: string;
  paths: readonly string[];
}

export const TAG_VISUALS: Record<TagId, TagVisual> = {
  issue: {
    label: 'Issue',
    className: 'tag-issue',
    paths: [
      'm8 2 1.88 1.88',
      'M14.12 3.88 16 2',
      'M9 7.13v-1a3 3 0 1 1 6 0v1',
      'M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6',
      'M12 20v-9',
      'M6.53 9C4.6 8.8 3 7.1 3 5',
      'M6 13H2',
      'M3 21c0-2.1 1.7-3.9 3.8-4',
      'M20.97 5c0 2.1-1.6 3.8-3.5 4',
      'M22 13h-4',
      'M17.2 17c2.1.1 3.8 1.9 3.8 4',
    ],
  },
  feat: {
    label: 'Feature',
    className: 'tag-feat',
    paths: [
      'm12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z',
    ],
  },
  chore: {
    label: 'Chore',
    className: 'tag-chore',
    paths: [
      'M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.3 2.3-2.3-2.3z',
    ],
  },
  spec: {
    label: 'Spec',
    className: 'tag-spec',
    paths: [
      'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z',
      'M14 2v6h6',
      'M8 13h8',
      'M8 17h8',
    ],
  },
};
