import { useState } from 'react';
import type { ChecklistDraftState } from './checklistDraft';
import { newClientId } from './checklistDraft';
import { ClickToEditInput } from './ClickToEditField';

export function ChecklistEditor({
  checklists,
  errors,
  onChange,
}: {
  checklists: ChecklistDraftState[];
  errors: Record<string, string>;
  onChange(next: ChecklistDraftState[]): void;
}) {
  const [editableIds, setEditableIds] = useState<Set<string>>(() => new Set());
  const markEditable = (id: string) =>
    setEditableIds((current) => {
      const next = new Set(current);
      next.add(id);
      return next;
    });

  const addChecklist = () => {
    const id = newClientId();
    markEditable(id);
    onChange([...checklists, { id, title: '', items: [] }]);
  };

  const updateChecklist = (id: string, update: Partial<ChecklistDraftState>) => {
    onChange(checklists.map((checklist) => (checklist.id === id ? { ...checklist, ...update } : checklist)));
  };

  const removeChecklist = (id: string) => {
    onChange(checklists.filter((checklist) => checklist.id !== id));
  };

  return (
    <div className="space-y-2">
      {checklists.length === 0 ? (
        <p className="text-xs" style={{ color: 'var(--ikanban-muted)' }}>
          No checklists yet.
        </p>
      ) : null}

      {checklists.map((checklist, checklistIndex) => {
        const completed = checklist.items.filter((item) => item.completed).length;
        const titleError = errors[`checklists.${checklist.id}.title`];
        return (
          <section
            key={checklist.id}
            className="checklist-card"
            aria-label={`Checklist ${checklistIndex + 1}`}
          >
            <div className="checklist-header">
              <ClickToEditInput
                className="input flex-1"
                value={checklist.title}
                onValueChange={(value) => updateChecklist(checklist.id, { title: value })}
                placeholder="Checklist title"
                aria-label={`Checklist ${checklistIndex + 1} title`}
                aria-invalid={Boolean(titleError)}
                aria-describedby={titleError ? `checklist-title-${checklist.id}` : undefined}
                initiallyEditable={editableIds.has(checklist.id)}
                reveal={Boolean(titleError)}
              />
              <span className="checklist-progress" aria-label="Checklist progress">
                {completed}/{checklist.items.length}
              </span>
              <button
                type="button"
                className="icon-button icon-button-danger"
                aria-label={`Delete checklist ${checklist.title || checklistIndex + 1}`}
                onClick={() => removeChecklist(checklist.id)}
              >
                ×
              </button>
            </div>
            {titleError ? (
              <p id={`checklist-title-${checklist.id}`} role="alert" className="error-text">
                {titleError}
              </p>
            ) : null}

            <div className="mt-1 space-y-1">
              {checklist.items.map((item, itemIndex) => {
                const itemError = errors[`checklists.${checklist.id}.items.${item.id}.text`];
                return (
                  <div key={item.id}>
                    <div className="checklist-row">
                      <input
                        type="checkbox"
                        className="checklist-checkbox"
                        checked={item.completed}
                        aria-label={`Complete item ${itemIndex + 1} in ${checklist.title || 'checklist'}`}
                        onChange={(event) =>
                          updateChecklist(checklist.id, {
                            items: checklist.items.map((candidate) =>
                              candidate.id === item.id
                                ? { ...candidate, completed: event.target.checked }
                                : candidate,
                            ),
                          })
                        }
                      />
                      <ClickToEditInput
                        className="input flex-1"
                        value={item.text}
                        onValueChange={(value) =>
                          updateChecklist(checklist.id, {
                            items: checklist.items.map((candidate) =>
                              candidate.id === item.id
                                ? { ...candidate, text: value }
                                : candidate,
                            ),
                          })
                        }
                        placeholder="Item text"
                        aria-label={`Checklist ${checklistIndex + 1} item ${itemIndex + 1} text`}
                        aria-invalid={Boolean(itemError)}
                        aria-describedby={itemError ? `item-error-${item.id}` : undefined}
                        initiallyEditable={editableIds.has(item.id)}
                        reveal={Boolean(itemError)}
                      />
                      <button
                        type="button"
                        className="icon-button icon-button-danger"
                        aria-label={`Delete checklist item ${itemIndex + 1}`}
                        onClick={() =>
                          updateChecklist(checklist.id, {
                            items: checklist.items.filter((candidate) => candidate.id !== item.id),
                          })
                        }
                      >
                        ×
                      </button>
                    </div>
                    {itemError ? (
                      <p id={`item-error-${item.id}`} role="alert" className="error-text mt-1">
                        {itemError}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              className="btn self-start"
              onClick={() => {
                const id = newClientId();
                markEditable(id);
                updateChecklist(checklist.id, {
                  items: [
                    ...checklist.items,
                    { id, text: '', completed: false },
                  ],
                });
              }}
            >
              + Add item
            </button>
          </section>
        );
      })}

      <button type="button" className="btn self-start" onClick={addChecklist}>
        + Add checklist
      </button>
    </div>
  );
}
