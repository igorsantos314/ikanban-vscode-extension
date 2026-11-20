# Proposal

## Why

The board works well but currently reads as a functional prototype: flat surfaces, heavy borders, small badges and a dialog that does not share the board's visual rhythm. The referenced `editor-view.png` shows a calmer dark interface with layered panels, compact metadata, quiet borders, colored priority badges and generous spacing. Adopting that visual language would make the board easier to scan and make task details feel like part of the same product.

This change is deliberately limited to design and presentation. Interaction models, data, persistence, protocol and component responsibilities stay as they are.

## What Changes

- Introduce a shared visual system for the webview: layered surface tokens, quiet borders, 6-8px radii, a compact typography scale, spacing rhythm, hover/focus treatments and priority/tag color treatments derived from the active VS Code theme.
- Refine the board canvas: a compact toolbar-like header, columns rendered as layered panels with a colored status dot, title and count pill, a prominent add-task row at the top of each column, and consistent column spacing.
- Refine task cards: a small metadata row with a tinted priority badge, a stronger title, neutral tag chips with colored icons, and a footer for checklist progress and last-updated metadata. Drag handles and column actions become quieter until hover or keyboard focus.
- Refine the task dialog to follow the same language: header with task context and priority badge, a metadata strip for created/last-updated timestamps, grouped Details/Organization/Checklists sections, card-like checklist groups, matching chips/inputs/buttons and a sticky footer.
- Preserve theme support: the visual system responds to VS Code light, dark and high-contrast themes, keeps contrast readable and never relies on color alone.
- Keep behavior unchanged: no new search, filtering, assignment or workflow semantics are introduced in this change.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `kanban-ui`: adds a shared visual system and refines board, column, card and task-dialog presentation while preserving existing interaction, accessibility and theme requirements.

## Impact

- `src/webview/styles.css` design tokens and component classes.
- `BoardHeader`, `BoardColumn`, `TaskCard`, `TaskDialog`, `Modal`, `TagChip`, `ChecklistEditor` and the board layout in `App.tsx`.
- Component tests for structure, labels and accessibility may need updated selectors; no new dependencies.
- Visual reference: `editor-view.png` at the repository root.
- No changes to board storage, YAML schemas, the messaging protocol, command behavior or persisted task data.
