import {
  FileType,
  Selection,
  Uri,
  commands,
  window,
  workspace,
  type Disposable,
  type ExtensionContext,
  type OutputChannel,
  type WebviewPanel,
} from 'vscode';
import type { BoardSnapshot } from './shared/board';
import type { ProtocolResponse } from './shared/protocol';
import {
  IkanbanError,
  ValidationError,
  WorkspaceNotAvailableError,
  WorkspaceNotTrustedError,
} from './domain/errors';
import { BoardPanel } from './vscode/boardPanel';
import { installAgentSkill, type InstallAgentSkillResult } from './vscode/agentSkillInstaller';
import { DiagnosticsManager } from './vscode/diagnosticsManager';
import { Debouncer } from './vscode/debounce';
import { buildHomeHtml } from './vscode/homeHtml';
import {
  detectHomeState,
  type HomeStateDependencies,
  type HomeViewState,
  type StatKind,
} from './vscode/homeState';
import { HomeViewProvider } from './vscode/homeView';
import { MessageRouter } from './vscode/messageRouter';
import { createBoardSession, type BoardSession } from './vscode/session';
import {
  WorkspaceResolver,
  type WorkspaceFolderLike,
} from './vscode/workspaceResolver';

const REMEMBERED_FOLDER_KEY = 'ikanban.workspaceFolderUri';
const HOME_DEBOUNCE_MS = 250;

export interface IkanbanApi {
  initialize(): Promise<BoardSnapshot>;
  open(): Promise<BoardSnapshot>;
  validate(): Promise<BoardSnapshot>;
  refresh(): Promise<BoardSnapshot>;
  dispatch(raw: unknown): Promise<ProtocolResponse>;
  getOpenPanelCount(): number;
  getHomeState(): Promise<HomeViewState>;
  getHomeHtml(): Promise<string>;
}

interface Controller {
  context: ExtensionContext;
  resolver: WorkspaceResolver;
  diagnostics: DiagnosticsManager;
  output: OutputChannel;
  sessions: Map<string, BoardSession>;
}

export function activate(context: ExtensionContext): IkanbanApi {
  const output = window.createOutputChannel('iKanban');
  const diagnostics = new DiagnosticsManager();
  context.subscriptions.push(output, diagnostics);

  const resolver = new WorkspaceResolver({
    getFolders: () => mapFolders(),
    pickFolder: async (folders) => {
      const picked = await window.showWorkspaceFolderPick({
        placeHolder: 'Select the workspace folder for iKanban',
      });
      if (!picked) {
        return undefined;
      }
      return folders.find((folder) => folder.uri.toString() === picked.uri.toString());
    },
    getRememberedUri: () => context.workspaceState.get<string>(REMEMBERED_FOLDER_KEY),
    rememberUri: (uri) => context.workspaceState.update(REMEMBERED_FOLDER_KEY, uri),
  });

  const controller: Controller = {
    context,
    resolver,
    diagnostics,
    output,
    sessions: new Map(),
  };

  const homeDependencies: HomeStateDependencies = {
    getFolders: () => mapFolders(),
    getRememberedUri: () => context.workspaceState.get<string>(REMEMBERED_FOLDER_KEY),
    isTrusted: () => workspace.isTrusted,
    joinPath: (base, ...segments) => Uri.joinPath(base as Uri, ...segments),
    stat: (uri) => statKind(uri as Uri),
    listDirectory: async (uri) => {
      try {
        return (await workspace.fs.readDirectory(uri as Uri)).map(([name]) => name);
      } catch (error) {
        return isFileNotFound(error) ? [] : 'error';
      }
    },
    readText: (uri) => readTextIfExists(uri as Uri),
    readBundledSkill: async () =>
      decodeUtf8(
        await workspace.fs.readFile(
          Uri.joinPath(
            context.extensionUri,
            'resources',
            'skills',
            'ikanban',
            'SKILL.md',
          ),
        ),
      ),
  };

  const homeView = new HomeViewProvider({
    detectState: () => detectHomeState(homeDependencies),
    subscribe: (onChange) => subscribeHomeStateChanges(onChange),
    log: (message, error) => logTechnical(output, message, error),
  });

  const refreshHome = async (): Promise<void> => {
    await homeView.refresh();
  };

  const selectHomeFolder = async (): Promise<void> => {
    const folder = await resolver.resolve({ alwaysPick: true });
    if (folder) {
      await refreshHome();
    }
  };

  const showPanel = async (session: BoardSession): Promise<BoardPanel> =>
    BoardPanel.show({
      extensionUri: context.extensionUri,
      session,
      diagnostics,
      output,
    });

  const resolveFolder = async (alwaysPick = false): Promise<WorkspaceFolderLike> => {
    const folder = await resolver.resolve({ alwaysPick });
    if (!folder) {
      throw new WorkspaceNotAvailableError();
    }
    return folder;
  };

  const getSession = (folder: WorkspaceFolderLike): BoardSession => {
    const key = folder.uri.toString();
    if (BoardPanel.currentPanel?.rootUriKey === key) {
      return BoardPanel.currentPanel.session;
    }
    const existing = controller.sessions.get(key);
    if (existing) {
      return existing;
    }
    const session = createBoardSession(folder);
    controller.sessions.set(key, session);
    return session;
  };

  const initialize = async (): Promise<BoardSnapshot> => {
    const folder = await resolveFolder(true);
    if (!workspace.isTrusted) {
      throw new WorkspaceNotTrustedError();
    }
    const session = getSession(folder);
    const snapshot = await session.service.initializeBoard();
    diagnostics.publish(snapshot.issues);
    await showPanel(session);
    await refreshHome();
    return snapshot;
  };

  const open = async (): Promise<BoardSnapshot> => {
    const folder = await resolveFolder();
    const session = getSession(folder);
    const snapshot = await session.service.loadBoard();
    diagnostics.publish(snapshot.issues);
    await showPanel(session);
    return snapshot;
  };

  const validate = async (): Promise<BoardSnapshot> => {
    const folder = await resolveFolder();
    const session = getSession(folder);
    const snapshot = await session.service.validateBoard();
    diagnostics.publish(snapshot.issues);
    if (BoardPanel.currentPanel?.rootUriKey === session.rootUri.toString()) {
      await BoardPanel.currentPanel.pushSnapshot(snapshot);
    }
    return snapshot;
  };

  const refresh = async (): Promise<BoardSnapshot> => {
    const folder = await resolveFolder();
    const session = getSession(folder);
    if (BoardPanel.currentPanel?.rootUriKey === session.rootUri.toString()) {
      const snapshot = await BoardPanel.currentPanel.refresh();
      if (snapshot) {
        return snapshot;
      }
    }
    const snapshot = await session.service.loadBoard();
    diagnostics.publish(snapshot.issues);
    await showPanel(session);
    return snapshot;
  };

  const createTask = async (): Promise<void> => {
    const folder = await resolveFolder();
    if (!workspace.isTrusted) {
      throw new WorkspaceNotTrustedError();
    }
    const session = getSession(folder);
    const snapshot = await session.service.loadBoard();
    if (!snapshot.board || snapshot.columns.length === 0) {
      throw new ValidationError('Initialize the board before creating a task.');
    }

    const onlyColumn = snapshot.columns.length === 1 ? snapshot.columns[0] : undefined;
    let column: { id: string; title: string } | undefined;
    if (onlyColumn) {
      column = { id: onlyColumn.id, title: onlyColumn.title };
    } else {
      const picked = await window.showQuickPick(
        snapshot.columns.map((entry) => ({
          label: entry.title,
          description: entry.id,
          columnId: entry.id,
        })),
        { placeHolder: 'Select a column for the new task' },
      );
      column = picked ? { id: picked.columnId, title: picked.label } : undefined;
    }
    if (!column) {
      return;
    }

    const title = await window.showInputBox({
      prompt: 'Task title',
      placeHolder: 'What needs to be done?',
      validateInput: (value) =>
        value.trim().length === 0 ? 'Task title is required.' : undefined,
    });
    const normalizedTitle = title?.trim();
    if (!normalizedTitle) {
      return;
    }

    await session.service.createTask({
      columnId: column.id,
      title: normalizedTitle,
      description: '',
      priority: 'medium',
      tags: [],
      checklists: [],
    });
    await showPanel(session);
    void window.showInformationMessage(`Task created in ${column.title}.`);
  };

  const installSkill = async (): Promise<InstallAgentSkillResult> => {
    const folder = await resolveFolder();
    if (!workspace.isTrusted) {
      throw new WorkspaceNotTrustedError();
    }
    const result = await installAgentSkill({
      extensionUri: context.extensionUri,
      folder,
      output,
    });
    await refreshHome();
    return result;
  };

  const api: IkanbanApi = {
    initialize,
    open,
    validate,
    refresh,
    getOpenPanelCount: () => (BoardPanel.currentPanel ? 1 : 0),
    getHomeState: () => detectHomeState(homeDependencies),
    getHomeHtml: async () => buildHomeHtml(await detectHomeState(homeDependencies)),
    dispatch: async (raw) => {
      const folder = await resolveFolder();
      const session = getSession(folder);
      const router = new MessageRouter(session.service, {
        post: () => undefined,
        openFile: async (uri, range) => {
          const document = await workspace.openTextDocument(Uri.parse(uri));
          const editor = await window.showTextDocument(document, { preview: false });
          if (range) {
            editor.selection = new Selection(
              range.startLine,
              range.startColumn,
              range.endLine,
              range.endColumn,
            );
          }
        },
        publishSnapshot: (snapshot) => diagnostics.publish(snapshot.issues),
        canMutate: () => workspace.isTrusted,
        log: (message, error) => logTechnical(output, message, error),
      });
      return router.handleRequest(raw);
    },
  };

  const command = (
    name: string,
    run: () => Promise<unknown>,
    after?: (result: unknown) => void,
  ) =>
    commands.registerCommand(name, async () => {
      try {
        const result = await run();
        after?.(result);
      } catch (error) {
        reportError(output, error);
      }
    });

  context.subscriptions.push(
    command('ikanban.initialize', initialize, () => {
      void window.showInformationMessage('iKanban board initialized.');
    }),
    command('ikanban.open', open),
    command('ikanban.createTask', createTask),
    command('ikanban.validate', validate, (result) => {
      const snapshot = result as BoardSnapshot;
      const errors = snapshot.issues.filter((issue) => issue.severity === 'error').length;
      const warnings = snapshot.issues.filter((issue) => issue.severity === 'warning').length;
      if (errors === 0 && warnings === 0) {
        void window.showInformationMessage('iKanban board is valid.');
      } else {
        void window.showWarningMessage(
          `iKanban validation found ${errors} error(s) and ${warnings} warning(s). See the Problems panel.`,
        );
      }
    }),
    command('ikanban.refresh', refresh),
    command('ikanban.home.refresh', refreshHome),
    command('ikanban.home.selectFolder', selectHomeFolder),
    command('ikanban.installAgentSkill', installSkill, (result) => {
      const installed = result as InstallAgentSkillResult;
      const skillPath = workspace.asRelativePath(installed.skillUri, false);
      const agentsPath = workspace.asRelativePath(installed.agentsUri, false);
      void window.showInformationMessage(
        `iKanban AI skill installed at ${skillPath} and ${agentsPath}.`,
      );
    }),
    window.registerWebviewPanelSerializer('ikanban.board', {
      deserializeWebviewPanel: async (panel: WebviewPanel) => {
        try {
          const folder = await resolveFolder();
          const session = getSession(folder);
          await BoardPanel.restore(panel, {
            extensionUri: context.extensionUri,
            session,
            diagnostics,
            output,
          });
        } catch (error) {
          reportError(output, error);
          panel.dispose();
        }
      },
    }),
    {
      dispose: () => {
        BoardPanel.currentPanel?.dispose();
        controller.sessions.clear();
      },
    },
  );

  context.subscriptions.push(
    window.registerWebviewViewProvider('ikanban.home', homeView, {
      webviewOptions: { retainContextWhenHidden: false },
    }),
    homeView,
  );

  output.appendLine(`[${new Date().toISOString()}] iKanban activated.`);
  return api;
}

export function deactivate(): void {
  // Resources are owned by the extension context subscriptions.
}

function mapFolders(): WorkspaceFolderLike[] {
  return (
    workspace.workspaceFolders?.map((folder) => ({
      name: folder.name,
      uri: folder.uri,
    })) ?? []
  );
}

function subscribeHomeStateChanges(onChange: () => void): Disposable {
  const debouncer = new Debouncer(HOME_DEBOUNCE_MS, onChange);
  const disposables: Disposable[] = [
    debouncer,
    workspace.onDidChangeWorkspaceFolders(() => debouncer.schedule()),
  ];
  for (const pattern of ['**/.ikanban/board.yaml', '**/.agents/skills/ikanban/SKILL.md']) {
    const watcher = workspace.createFileSystemWatcher(pattern);
    disposables.push(
      watcher,
      watcher.onDidCreate(() => debouncer.schedule()),
      watcher.onDidChange(() => debouncer.schedule()),
      watcher.onDidDelete(() => debouncer.schedule()),
    );
  }
  return {
    dispose: () => {
      for (const disposable of disposables) {
        disposable.dispose();
      }
    },
  };
}

async function statKind(uri: Uri): Promise<StatKind> {
  try {
    const stat = await workspace.fs.stat(uri);
    if (stat.type === FileType.File) {
      return 'file';
    }
    if (stat.type === FileType.Directory) {
      return 'directory';
    }
    return 'error';
  } catch (error) {
    return isFileNotFound(error) ? 'missing' : 'error';
  }
}

async function readTextIfExists(uri: Uri): Promise<string | undefined> {
  try {
    return decodeUtf8(await workspace.fs.readFile(uri));
  } catch (error) {
    if (isFileNotFound(error)) {
      return undefined;
    }
    throw error;
  }
}

function isFileNotFound(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const candidate = error as { code?: unknown; name?: unknown };
  return (
    candidate.code === 'FileNotFound' ||
    candidate.code === 'EntryNotFound' ||
    candidate.name === 'EntryNotFound (FileSystemError)'
  );
}

function decodeUtf8(content: Uint8Array): string {
  return new TextDecoder().decode(content);
}

function reportError(output: OutputChannel, error: unknown): void {
  logTechnical(output, 'Command failed', error);
  const message =
    error instanceof IkanbanError
      ? error.userMessage
      : 'An unexpected iKanban error occurred. See the iKanban output channel for details.';
  void window.showErrorMessage(message);
}

function logTechnical(output: OutputChannel, message: string, error?: unknown): void {
  output.appendLine(
    `[${new Date().toISOString()}] ${message}${error ? `: ${String(error)}` : ''}`,
  );
  if (error instanceof Error && error.stack) {
    output.appendLine(error.stack);
  }
}
