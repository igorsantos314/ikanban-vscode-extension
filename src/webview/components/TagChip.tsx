import type { TagId } from '../../domain/tags';
import { TAG_VISUALS } from '../tagVisuals';

export function TagIcon({ tag }: { tag: TagId }) {
  const visual = TAG_VISUALS[tag];
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {visual.paths.map((path) => (
        <path key={path} d={path} />
      ))}
    </svg>
  );
}

export function TagChip({ tag }: { tag: TagId }) {
  const visual = TAG_VISUALS[tag];
  return (
    <span className={`tag-chip ${visual.className}`} data-tag={tag}>
      <TagIcon tag={tag} />
      <span>{visual.label}</span>
    </span>
  );
}

export function TagSelector({
  selected,
  onChange,
}: {
  selected: readonly TagId[];
  onChange(tags: TagId[]): void;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Task tags">
      {(Object.keys(TAG_VISUALS) as TagId[]).map((tag) => {
        const visual = TAG_VISUALS[tag];
        const isSelected = selected.includes(tag);
        return (
          <button
            key={tag}
            type="button"
            aria-pressed={isSelected}
            className={`tag-option ${visual.className} ${isSelected ? 'tag-option-selected' : ''}`}
            onClick={() =>
              onChange(
                isSelected ? selected.filter((entry) => entry !== tag) : [...selected, tag],
              )
            }
          >
            <TagIcon tag={tag} />
            <span>{visual.label}</span>
            {isSelected ? <span aria-hidden="true">✓</span> : null}
          </button>
        );
      })}
    </div>
  );
}
