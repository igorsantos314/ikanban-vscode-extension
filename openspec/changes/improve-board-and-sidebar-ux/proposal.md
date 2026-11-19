# Proposal

## Why

The sidebar always redirects to the board and advertises actions that do not match the project state: it offers "Initialize board" even after the board exists, and it never surfaces that the AI skill is missing or outdated. On the board itself, task cards only have one density, priority is text-only, checklist progress is reduced to "1/2", and cross-column drags show no movement until the persisted snapshot arrives, which makes reordering feel abrupt and unreliable.

## What Changes

- Turn the Activity Bar home view into a state-aware launcher/status panel. It SHALL stop redirecting automatically and SHALL show only the actions that apply: **Open board** when `.ikanban` exists, **Initialize board** only when it does not, and skill actions based on installation status.
- Detect the agent skill state by comparing `<workspace>/skills/ikanban/SKILL.md` with the bundled asset. The home view SHALL show **Install AI skill** when missing and **Update AI skill** when the installed copy differs from the current extension bundle. Updating remains an explicit user action; no workspace file is rewritten automatically on activation.
- Re-check skill status after extension updates and when the view is refreshed or becomes visible, so a new bundled skill surfaces as an update.
- Add a task-card density preference with two layouts: `expanded` (current card) and `compact` (title, priority icon, checklist progress and tag icons only; no description, tags text or timestamps). The choice SHALL be persisted per workspace and default to `expanded`.
- Add priority icons for low, medium and high priority. Expanded cards keep icon + text label; compact cards use the icon with an accessible name.
- Render checklist progress in a Trello-like form: checklist icon, `completed/total` and a proportional progress bar on the card.
- Make drag-and-drop fluid: show a drag overlay that follows the pointer, preview the destination column and insertion point while dragging, reserve space at the drop position, animate the drop, and restore the previous layout with an error if persistence fails.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `kanban-ui`: task-card presentation gains expanded/compact density, priority icons and progress-bar checklist progress; drag-and-drop gains a transient cross-column preview and drop animation.
- `vscode-integration`: the Activity Bar home view becomes a conditional launcher/status panel with board and skill state; the skill install command reports install/update state and remains explicitly triggered.

## Impact

- **Extension host**: `src/vscode/homeHtml.ts`, `src/vscode/homeView.ts`, `src/vscode/agentSkillInstaller.ts`, `src/vscode/extension.ts` (renamed to `src/extension.ts` in this repo), plus new skill-status helpers and tests.
- **Webview**: `src/webview/App.tsx`, `src/webview/components/BoardHeader.tsx`, `BoardColumn.tsx`, `TaskCard.tsx`, `src/webview/styles.css`, new card-layout state/controls and tests.
- **Persistence**: card density is a UI preference only; board YAML and the protocol payloads do not change.
- **Docs**: README and CHANGELOG updates for the panel behavior, card layouts and skill updates.
- **No breaking changes** to the stored board format or the typed messaging contract.
