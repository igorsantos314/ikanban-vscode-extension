# Design

## Context

See `proposal.md` for motivation. The webview already has a small token layer in `src/webview/styles.css`, but most components mix those tokens with Tailwind utilities and inline `vscode-*` variables. Cards use a 4px radius and full borders, columns use a top accent border, the header is a plain action row and the dialog uses a separate visual treatment. The result is functional but visually flat.

The reference `editor-view.png` (3020x1814) uses a near-black canvas (`#141414`), slightly lighter columns and toolbar (`#202021`), cards around `#27272a`, quiet borders around `#323234`, compact typography, 6-8px radii, colored priority text badges and neutral tag chips. It is a dark-theme reference only; the extension must still support light and high-contrast themes.

## Goals / Non-Goals

**Goals:**

- Create one coherent visual system that both the board and the task dialog use.
- Improve scanability of columns, cards and task metadata without changing information architecture.
- Make the dark theme feel close to the reference while remaining theme-derived and accessible.
- Preserve every existing interaction, accessible name, keyboard path, focus trap and drag-and-drop behavior.

**Non-Goals:**

- Adding search, filtering, assignment, labels beyond the existing tags, or workflow semantics.
- Reproducing the reference's file sidebar, editor tabs or status bar; the extension lives inside the VS Code workbench.
- Persisting any new task fields or changing the message protocol.
- Copying exact hex values from the screenshot; theme adaptation takes priority.

## Decisions

### Build the redesign on semantic tokens in `styles.css`

Extend the existing token layer with semantic variables for canvas, panel, card, inset, border, muted text, radii, shadows and priority colors. Components consume the tokens rather than repeating arbitrary colors. Layering is produced with `color-mix()` over theme foreground/background values, with a plain theme variable fallback declared first for environments without color-mix support.

Rationale: a token layer keeps the board and dialog consistent and lets light, dark and high-contrast themes adapt without per-component overrides. It also makes visual review and future theme adjustments cheap. Alternatives considered: Tailwind palette classes (would hard-code colors and ignore VS Code themes) and per-component CSS (hard to keep the dialog and board aligned).

Suggested token roles:

- `--ikanban-canvas`: board background.
- `--ikanban-panel`: column and toolbar surface.
- `--ikanban-card`: task and checklist surface.
- `--ikanban-inset`: inputs and empty-state wells.
- `--ikanban-border` / `--ikanban-border-strong`: quiet and emphasized borders.
- `--ikanban-muted`: secondary metadata.
- `--ikanban-radius-sm/md/lg`: 4/6/8px.
- `--ikanban-priority-low/medium/high`: tinted badge foregrounds with matching translucent backgrounds.
- `--ikanban-shadow-card` / `--ikanban-shadow-dialog`: subtle elevation only.

### Refine the board header and columns as a compact editor surface

`BoardHeader` becomes a compact toolbar: board identity and workspace summary on the left, grouped action buttons on the right, with the board title at a stronger weight and the summary in muted micro type. `BoardColumn` moves the colored status dot into the header next to the title, turns the task count into a pill, moves the add-task affordance to a full-width row at the top of the list and demotes the reorder/edit/delete buttons to a quiet action cluster that becomes fully visible on hover or focus.

Rationale: this mirrors the reference's column rhythm and keeps focus on the task content. The actions remain real buttons with their current accessible labels, so the redesign is purely visual. The old top accent border is replaced by the status dot to reduce visual noise; the column color still communicates identity.

### Give cards a three-level hierarchy

`TaskCard` is restructured into: a top meta row with the priority badge aligned right, the title in the strongest card type, an optional description preview and neutral tag chips, then a footer with checklist progress and last-updated metadata. The drag handle remains present but becomes visually quiet until hover/focus. Hover uses a small surface/border change and shadow; drag uses opacity/transform only so layout does not shift.

Rationale: the reference cards are easy to scan because priority, title, tags and metadata occupy predictable zones. The redesign reuses the existing task data, including `updatedAt` from the previously implemented timestamp work, and does not invent new identifiers or fields. Tag chips become neutral surfaces with colored icons so color is never the only signal.

### Apply the same language to the task dialog

`Modal` and `TaskDialog` share the card/panel tokens. The modal grows to a wider surface (roughly 760-820px) with an 8-10px radius and a soft shadow. The header shows the dialog title and the current priority badge. A compact metadata strip shows the existing Created/Last updated timestamps. The body is grouped into Details, Organization and Checklists sections with micro uppercase labels; checklist groups look like small cards. Inputs use the inset surface and the same focus ring; tag chips and priority badges are shared with the board. The footer stays sticky and uses the same primary/secondary button styling.

Rationale: the user asked for the dialog to follow the card pattern. Reusing the exact tokens and shared `TagChip`/priority classes makes the dialog feel like an expanded card rather than a separate form. The existing focus trap, Escape handling and scrollable body stay intact.

### Keep motion and density restrained

Transitions are limited to 120-160ms color/border/opacity changes. Hover elevation uses shadow, not layout-changing transforms. The density targets a 13px card title, 11-12px metadata and 18rem columns, with 16px board padding and 8-10px card padding. `prefers-reduced-motion` removes non-essential transitions.

Rationale: the reference is calm and dense; exaggerated animation would break that feel and can harm accessibility.

## Risks / Trade-offs

- **Theme-specific colors can break light or high-contrast themes** → Derive layers from `--vscode-*` tokens with `color-mix`, declare fallbacks and review all three theme modes.
- **Muted metadata may fail contrast** → Use `--vscode-descriptionForeground` with limited opacity and verify key labels at the target font size.
- **Quiet column actions may be hard to discover** → Keep them in the tab order, reveal them on hover and focus-within, and retain tooltips/accessible names.
- **Card hover/drag effects can shift layout** → Use border, shadow, opacity and transform only; never change padding or size.
- **Existing component tests may rely on current labels or structure** → Preserve roles and accessible names; update selectors only where the visual structure genuinely changes.
- **Visual-only search/filter controls would be misleading** → Do not add them in this change; the toolbar only restyles existing actions.
- **Color-mix support** → Target the Electron version shipped with VS Code 1.147 and keep plain theme-variable fallbacks.

## Migration Plan

1. Replace the token layer and base component classes in `styles.css`.
2. Restyle the board header, columns and task cards, preserving accessible names and drag behavior.
3. Restyle the modal and task dialog with the shared tokens and section grouping.
4. Run the existing unit/component and Extension Host suites, then review screenshots in dark, light and high-contrast themes.

Rollback is limited to the CSS tokens and the affected view components; no data or protocol migration is required.
