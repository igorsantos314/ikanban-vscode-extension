# Design

## Context

See `proposal.md` for motivation.

- The home view is a static, script-free HTML document rendered by `HomeViewProvider`; it auto-invokes `ikanban.open` whenever the view becomes visible. Actions are `command:` links made possible by `enableCommandUris`, and the document uses a restrictive CSP.
- Board and task operations already flow through the extension host. `installAgentSkill` already refreshes `skills/ikanban/SKILL.md` and replaces the managed `AGENTS.md` block by comparing existing content with the bundled template.
- `WorkspaceResolver` resolves a single folder directly, reuses the remembered folder in multi-root workspaces, and otherwise prompts. There is no non-prompting lookup.
- The board webview renders task cards with `useSortable` from dnd-kit. There is no `DragOverlay`, no `onDragOver` preview, and each column's `SortableContext` is independent, so cross-column feedback only appears after the persisted snapshot returns.
- Card presentation is CSS-driven from one markup shape; task metadata is already derived (`getChecklistProgress`, tags, priority) and no board YAML changes are needed for density.

## Goals / Non-Goals

**Goals:**

- Make the sidebar a cheap, state-aware launcher without enabling webview scripts.
- Detect board and skill state without writing files; updating a skill stays a user action.
- Give card density a workspace-scoped, immediately switchable preference.
- Make cross-column drags legible: overlay, destination preview, placeholder space, animated drop, safe rollback.

**Non-Goals:**

- Changing the `.ikanban` YAML format, task schema or typed protocol.
- Automatically installing or updating the skill, or touching `AGENTS.md` outside the managed block.
- Persisting card density in the board files or syncing it across machines.
- Reworking column drag-and-drop or adding board filtering/search.

## Decisions

### 1. Home view stays script-free and is re-rendered from a state model

`buildHomeHtml(state)` receives a serializable `HomeViewState` (folder label, board state, skill state, trust, workspace availability) and renders only applicable actions. `HomeViewProvider` owns detection and calls `webview.html = ...` again whenever state may have changed.

- Triggers: initial resolve, visibility change to visible, workspace-folder changes, debounced filesystem watcher events for `.ikanban/board.yaml` and `skills/ikanban/SKILL.md`, explicit refresh, and command completion hooks from `initialize`/`installAgentSkill`.
- Actions remain `command:` URIs. A non-contributed internal command `ikanban.home.refresh` backs the Refresh button; another `ikanban.home.selectFolder` backs multi-root selection. Neither appears in the Command Palette.
- Trust: write actions (Initialize, Install/Update skill) render only when `workspace.isTrusted`; otherwise the view explains the requirement.
- **Alternative considered**: enabling scripts and postMessage-based actions. Rejected: it reintroduces a CSP/nonce surface and a second messaging path for a panel that only needs navigation.

### 2. Non-prompting folder lookup for status, explicit selection when ambiguous

Add a `peek()` behavior to `WorkspaceResolver` (single folder or remembered match). Detection never prompts when the home view is merely displayed. With multiple folders and no remembered choice, the state is `needs-selection` and the view offers **Select workspace folder**, which calls `resolve({ alwaysPick: true })`, remembers the choice and refreshes the view.

- **Alternative considered**: reusing `resolve()` during detection. Rejected: the sidebar would prompt every time it becomes visible.
- The selected folder is shared with the existing commands through the same remembered key, so opening the board and reading skill status agree.

### 3. Lightweight detection; no board parsing

Board state comes from `workspace.fs.stat` on `<folder>/.ikanban/board.yaml`, plus a stat of `.ikanban` to distinguish `missing` from `needs-repair` (non-empty `.ikanban` without `board.yaml`). Skill state compares the decoded workspace `skills/ikanban/SKILL.md` with the bundled asset: missing file → `missing`, equal content → `current`, different content → `outdated`, read failure → `error` with an actionable message.

- No version stamp is required; an extension update changes the bundled content and therefore surfaces as `outdated` on the next detection.
- **Alternative considered**: writing a version marker beside the skill. Rejected: extra file and migration for no benefit.
- Detection errors render an error state and never offer a destructive action; retry stays available.

### 4. Skill updates are explicit

The home view's **Update AI skill** action invokes the existing `ikanban.installAgentSkill` flow. That flow already replaces the skill, replaces the managed block, preserves the rest of `AGENTS.md`, and reports paths. No automatic write occurs on activation or view display.

- **Alternative considered**: automatic refresh on activation. Rejected by user decision to preserve control over project files.

### 5. Card density is a webview-local, workspace-scoped preference

`App` owns `cardLayout: 'expanded' | 'compact'`, initialized from a guarded `localStorage` read keyed by workspace name (`ikanban.cardLayout.<workspaceName>`), defaulting to `expanded`. Writing is best-effort; storage failures must not break rendering.

- `BoardHeader` renders a two-button segmented control with `aria-pressed`; `BoardColumn` forwards the layout to `TaskCard`.
- `TaskCard` keeps one content tree but adds `task-card-compact` modifiers that hide the description, tag labels and updated metadata, and switch the priority badge to icon-only with an accessible name. Tag chips keep their icon and gain a label through `title`/`aria-label`; the actions remain available on hover/focus and for keyboard users.
- **Alternative considered**: extension `workspaceState` plus new protocol messages. Rejected: it changes the typed protocol and host surface for a purely visual preference.

### 6. Drag preview model lives in `App`, overlay and placeholder come from dnd-kit

- On `onDragStart`, snapshot the current per-column ordered task IDs into `previewOrder`.
- On `onDragOver`, resolve the target from `over` (column droppable or a task) and move the active ID in `previewOrder`. Use `over.rect` and the translated active rect so the insertion side follows the pointer direction. Update state only when the resolved slot changes.
- Columns render from `previewOrder` while dragging, so the destination column shows the insertion gap immediately and the source column stops showing the card in place. The active card renders as an invisible placeholder in its preview slot (preserving space); the visible card is a `DragOverlay` rendered from extracted presentational card content.
- `onDragEnd` computes the destination column and index from `previewOrder`, then sends `task/move` once. The preview remains visible while the request is pending. Success applies the authoritative snapshot and clears the preview; failure clears the preview (restoring the prior display) and reports the error.
- `onDragCancel` clears the preview.
- DnD configuration: `closestCorners` collision detection, `MeasuringStrategy.Always` for droppables, a short spring-like `dropAnimation`, and `transition` values that stay subtle. Existing `prefers-reduced-motion` rules collapse the animation.
- **Alternative considered**: optimistic snapshot mutation before the host responds. Rejected: it would violate the authoritative-state contract and make rollback ambiguous.

### 7. Priority and checklist visuals are shared, derived components

- A small priority visual map (icon paths, label, existing `--priority-color`) backs card badges. Expanded keeps icon + label; compact shows the icon with `aria-label`/`title`.
- Checklist progress becomes a `ChecklistProgress` presentation used by both densities: icon, `completed/total`, and a bar with `role="progressbar"` and `aria-valuenow`/`aria-valuemin`/`aria-valuemax`. It renders only when total > 0.

## Risks / Trade-offs

- **Webview HTML replacement loses scroll position or focus** → only re-render when the serialized state actually changes; compare previous HTML before assigning, and keep the home document short enough that focus loss is low-impact.
- **Watchers create refresh loops** → watch only board/skill files, debounce events, and ignore events while a state refresh is already running.
- **dnd-kit preview flicker across containers** → keep a single preview order source, skip unchanged updates, use `MeasuringStrategy.Always`, and clear preview state in a `finally` path after the move resolves.
- **Icon-only metadata in compact mode hurts accessibility** → keep accessible names on priority and tag chips, keep action buttons labeled, and verify keyboard hover/focus parity.
- **`localStorage` is unavailable or shared between workspaces** → guard reads/writes, scope keys by workspace name and fall back to `expanded`.
- **Content comparison marks a hand-edited skill as outdated forever** → this is intentional: the update action is explicit and reports what it replaces; no automatic overwrite happens.

## Migration Plan

- No data migration. Existing workspaces keep `expanded` cards and the current skill file.
- The first detection after upgrading may show **Update AI skill** when the bundled skill changed; updating rewrites only the skill file and the managed block.
- Rollback is safe: new UI preferences are additive, board files are untouched, and the home view can fall back to static actions if detection fails.
