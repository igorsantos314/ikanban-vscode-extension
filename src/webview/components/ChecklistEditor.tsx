import type { ChecklistDraftState } from './checklistDraft';
import { newClientId } from './checklistDraft';

export function ChecklistEditor({
  checklists,
  errors,
  onChange,
}: {
  checklists: ChecklistDraftState[];
  errors: Record<string, string>;
  onChange(next: ChecklistDraftState[]): void;
}) {
  const addChecklist = () => {
    onChange([
      ...checklists,
      { id: newClientId(), title: '', items: [] },
    ]);
  };

  const updateChecklist = (id: string, update: Partial<ChecklistDraftState>) => {
    onChange(checklists.map((checklist) => (checklist.id === id ? { ...checklist, ...update } : checklist)));
  };

  const removeChecklist = (id: string) => {
    onChange(checklists.filter((checklist) => checklist.id !== id));
  };

  return (
    <div className="space-y-3">
      {checklists.length === 0 ? (
        <p className="text-sm opacity-70">No checklists yet.</p>
      ) : null}

      {checklists.map((checklist, checklistIndex) => {
        const completed = checklist.items.filter((item) => item.completed).length;
        const titleError = errors[`checklists.${checklist.id}.title`];
        return (
          <section
            key={checklist.id}
            className="rounded border p-3"
            style={{ borderColor: 'var(--vscode-widget-border)' }}
            aria-label={`Checklist ${checklistIndex + 1}`}
          >
            <div className="flex items-center gap-2">
              <input
                className="input flex-1"
                value={checklist.title}
                placeholder="Checklist title"
                aria-label={`Checklist ${checklistIndex + 1} title`}
                aria-invalid={Boolean(titleError)}
                aria-describedby={titleError ? `checklist-title-${checklist.id}` : undefined}
                onChange={(event) => updateChecklist(checklist.id, { title: event.target.value })}
              />
              <span className="text-xs opacity-70" aria-label="Checklist progress">
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
              <p id={`checklist-title-${checklist.id}`} role="alert" className="error-text mt-1">
                {titleError}
              </p>
            ) : null}

            <div className="mt-3 space-y-2">
              {checklist.items.map((item, itemIndex) => {
                const itemError = errors[`checklists.${checklist.id}.items.${item.id}.text`];
                return (
                  <div key={item.id}>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
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
                      <input
                        className="input flex-1"
                        value={item.text}
                        placeholder="Item text"
                        aria-label={`Checklist ${checklistIndex + 1} item ${itemIndex + 1} text`}
                        aria-invalid={Boolean(itemError)}
                        aria-describedby={itemError ? `item-error-${item.id}` : undefined}
                        onChange={(event) =>
                          updateChecklist(checklist.id, {
                            items: checklist.items.map((candidate) =>
                              candidate.id === item.id
                                ? { ...candidate, text: event.target.value }
                                : candidate,
                            ),
                          })
                        }
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
              className="btn mt-3"
              onClick={() =>
                updateChecklist(checklist.id, {
                  items: [
                    ...checklist.items,
                    { id: newClientId(), text: '', completed: false },
                  ],
                })
              }
            >
              + Add item
            </button>
          </section>
        );
      })}

      <button type="button" className="btn" onClick={addChecklist}>
        + Add checklist
      </button>
    </div>
  );
}
