import type { HomeViewState } from './homeState';

const DESCRIPTION =
  'Local Kanban with portable YAML files in <code>.ikanban</code> and an AI-ready skill.';

const PLACEMENT_NOTE =
  'The board opens in the editor area. This panel never opens it automatically.';

interface HomeAction {
  command: string;
  label: string;
  primary?: boolean;
}

type StatusTone = 'ok' | 'warn' | 'neutral' | 'danger';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderAction(action: HomeAction): string {
  const className = action.primary ? 'action' : 'action secondary';
  return `<li><a class="${className}" href="${escapeHtml(`command:${action.command}`)}">${escapeHtml(action.label)}</a></li>`;
}

function renderActions(actions: readonly HomeAction[]): string {
  if (actions.length === 0) {
    return '';
  }
  return `<ul class="actions">\n    ${actions.map(renderAction).join('\n    ')}\n  </ul>`;
}

function statusClass(tone: StatusTone): string {
  return `status status-${tone}`;
}

function boardStatus(state: HomeViewState): { label: string; tone: StatusTone } {
  switch (state.board) {
    case 'initialized':
      return { label: 'Ready', tone: 'ok' };
    case 'missing':
      return { label: 'Not initialized', tone: 'warn' };
    case 'needs-repair':
      return { label: 'Incomplete', tone: 'danger' };
    case 'error':
      return { label: 'Unavailable', tone: 'danger' };
    default:
      return { label: 'Unknown', tone: 'neutral' };
  }
}

function skillStatus(state: HomeViewState): { label: string; tone: StatusTone } {
  switch (state.skill) {
    case 'current':
      return { label: 'Up to date', tone: 'ok' };
    case 'missing':
      return { label: 'Not installed', tone: 'warn' };
    case 'outdated':
      return { label: 'Update available', tone: 'warn' };
    case 'error':
      return { label: 'Unavailable', tone: 'danger' };
    default:
      return { label: 'Unknown', tone: 'neutral' };
  }
}

function renderStatusRow(label: string, status: { label: string; tone: StatusTone }): string {
  return `<div class="status-row">
      <dt>${escapeHtml(label)}</dt>
      <dd><span class="${statusClass(status.tone)}">${escapeHtml(status.label)}</span></dd>
    </div>`;
}

function actionsFor(state: HomeViewState): HomeAction[] {
  const refresh: HomeAction = { command: 'ikanban.home.refresh', label: 'Refresh' };
  if (state.status === 'no-workspace' || state.status === 'needs-selection' || state.status === 'error') {
    return [refresh];
  }
  if (state.status !== 'ready') {
    return [];
  }

  const actions: HomeAction[] = [];
  switch (state.board) {
    case 'initialized':
      actions.push({ command: 'ikanban.open', label: 'Open board', primary: true });
      actions.push({ command: 'ikanban.validate', label: 'Validate board' });
      break;
    case 'missing':
      if (state.trusted) {
        actions.push({ command: 'ikanban.initialize', label: 'Initialize board', primary: true });
      }
      break;
    case 'needs-repair':
      actions.push({ command: 'ikanban.open', label: 'Open board' });
      actions.push({ command: 'ikanban.validate', label: 'Validate board' });
      break;
    default:
      break;
  }

  if (state.trusted) {
    if (state.skill === 'missing') {
      actions.push({ command: 'ikanban.installAgentSkill', label: 'Install AI skill' });
    } else if (state.skill === 'outdated') {
      actions.push({ command: 'ikanban.installAgentSkill', label: 'Update AI skill' });
    }
  }

  actions.push(refresh);
  return actions;
}

function renderWorkspace(state: HomeViewState): string {
  if (state.status === 'no-workspace') {
    return '<p class="notice">Open a folder to use iKanban. A workspace folder is required for the board and the AI skill.</p>';
  }
  if (state.status === 'needs-selection') {
    return `<p class="notice">Select the workspace folder iKanban should use.</p>
  <ul class="actions">
    <li><a class="action" href="${escapeHtml('command:ikanban.home.selectFolder')}">Select workspace folder</a></li>
  </ul>`;
  }
  if (state.status === 'loading') {
    return '<p class="notice" role="status">Checking workspace…</p>';
  }
  if (state.status === 'error') {
    return `<p class="notice error">${escapeHtml(state.errorMessage ?? 'The iKanban state could not be read.')}</p>`;
  }
  return `<p class="workspace">Workspace: <strong>${escapeHtml(state.workspaceName ?? '')}</strong></p>`;
}

function renderReadyDetails(state: HomeViewState): string {
  if (state.status !== 'ready') {
    return '';
  }
  const board = boardStatus(state);
  const skill = skillStatus(state);
  const messages = [state.boardMessage, state.skillMessage]
    .filter((message): message is string => Boolean(message))
    .map((message) => `<p class="notice error">${escapeHtml(message)}</p>`)
    .join('\n  ');
  const trustNotice = state.trusted
    ? ''
    : '\n  <p class="notice">Trust this workspace to initialize the board or install the AI skill.</p>';

  return `<dl class="status-list">
    ${renderStatusRow('Board', board)}
    ${renderStatusRow('AI skill', skill)}
  </dl>
  ${messages}${trustNotice}`;
}

export function buildHomeHtml(state: HomeViewState): string {
  const actions = actionsFor(state);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>iKanban</title>
  <style>
    :root { color-scheme: light dark; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 16px;
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: transparent;
    }
    h1 {
      margin: 0 0 8px;
      font-size: 1.1em;
      font-weight: 600;
    }
    p {
      margin: 0 0 12px;
      color: var(--vscode-descriptionForeground);
      line-height: 1.4;
      overflow-wrap: anywhere;
    }
    code {
      font-family: var(--vscode-editor-font-family);
      background: var(--vscode-textCodeBlock-background);
      padding: 1px 4px;
      border-radius: 2px;
    }
    .workspace {
      color: var(--vscode-foreground);
      font-size: 0.95em;
    }
    .workspace strong { overflow-wrap: anywhere; }
    .notice.error { color: var(--vscode-errorForeground, var(--vscode-foreground)); }
    .status-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin: 14px 0;
      padding: 0;
    }
    .status-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      border: 1px solid var(--vscode-widget-border, var(--vscode-contrastBorder, transparent));
      border-radius: 4px;
      background: var(--vscode-sideBar-background, transparent);
      padding: 6px 8px;
    }
    .status-row dt {
      color: var(--vscode-descriptionForeground);
      font-size: 0.85em;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .status-row dd { margin: 0; }
    .status {
      display: inline-flex;
      align-items: center;
      border: 1px solid currentColor;
      border-radius: 999px;
      padding: 1px 7px;
      font-size: 0.8em;
      font-weight: 600;
      white-space: nowrap;
    }
    .status-ok { color: var(--vscode-testing-iconPassed, var(--vscode-charts-green, #4ade80)); }
    .status-warn { color: var(--vscode-editorWarning-foreground, #cca700); }
    .status-danger { color: var(--vscode-errorForeground, #f14c4c); }
    .status-neutral { color: var(--vscode-descriptionForeground); }
    .actions {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin: 16px 0;
      padding: 0;
      list-style: none;
    }
    a.action {
      display: block;
      padding: 8px 12px;
      border: 1px solid transparent;
      border-radius: 2px;
      font-weight: 500;
      text-align: center;
      text-decoration: none;
      color: var(--vscode-button-foreground);
      background: var(--vscode-button-background);
    }
    a.action:hover {
      background: var(--vscode-button-hoverBackground);
    }
    a.action.secondary {
      color: var(--vscode-secondaryButton-foreground);
      background: var(--vscode-secondaryButton-background);
    }
    a.action.secondary:hover {
      background: var(--vscode-secondaryButton-hoverBackground);
    }
    a.action:focus-visible {
      outline: 2px solid var(--vscode-focusBorder);
      outline-offset: 2px;
    }
    .hint {
      margin: 16px 0 0;
      font-size: 0.9em;
    }
  </style>
</head>
<body data-home-state="${escapeHtml(state.status)}" data-board-state="${escapeHtml(state.board ?? '')}" data-skill-state="${escapeHtml(state.skill ?? '')}">
  <h1>iKanban</h1>
  <p>${DESCRIPTION}</p>
  ${renderWorkspace(state)}
  ${renderReadyDetails(state)}
  ${renderActions(actions)}
  <p class="hint">${PLACEMENT_NOTE}</p>
</body>
</html>`;
}
