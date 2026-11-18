const DESCRIPTION =
  'Local-first Kanban stored as portable YAML files in <code>.ikanban</code>.';

const REDIRECT_NOTE =
  'Opening this view redirects to the board in the editor area. The sidebar stays available as an entry point.';

const PLACEMENT_NOTE =
  'The board opens as an editor panel. The Activity Bar position follows your VS Code layout settings.';

interface HomeAction {
  command: string;
  label: string;
  primary: boolean;
}

const ACTIONS: HomeAction[] = [
  { command: 'ikanban.open', label: 'Open board', primary: true },
  { command: 'ikanban.initialize', label: 'Initialize board', primary: false },
  { command: 'ikanban.validate', label: 'Validate board', primary: false },
];

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderAction(action: HomeAction): string {
  const className = action.primary ? 'action' : 'action secondary';
  return `<li><a class="${className}" href="${escapeAttribute(`command:${action.command}`)}">${escapeAttribute(action.label)}</a></li>`;
}

export function buildHomeHtml(): string {
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
<body>
  <h1>iKanban</h1>
  <p>${DESCRIPTION}</p>
  <p>${REDIRECT_NOTE}</p>
  <ul class="actions">
    ${ACTIONS.map(renderAction).join('\n    ')}
  </ul>
  <p class="hint">${PLACEMENT_NOTE}</p>
</body>
</html>`;
}
