import {
  Selection,
  Uri,
  commands,
  window,
  workspace,
  type ExtensionContext,
  type OutputChannel,
  type WebviewPanel,
} from 'vscode';
import type { BoardSnapshot } from './shared/board';
import type { ProtocolResponse } from './shared/protocol';
import {
  IkanbanError,
  WorkspaceNotAvailableError,
  WorkspaceNotTrustedError,
} from './domain/errors';
import { BoardPanel } from './vscode/boardPanel';
import { DiagnosticsManager } from './vscode/diagnosticsManager';
import { MessageRouter } from './vscode/messageRouter';
import { createBoardSession, type BoardSession } from './vscode/session';
import {
  WorkspaceResolver,
  type WorkspaceFolderLike,
} from './vscode/workspaceResolver';

const REMEMBERED_FOLDER_KEY = 'ikanban.workspaceFolderUri';

export interface IkanbanApi {
  initialize(): Promise<BoardSnapshot>;
  open(): Promise<BoardSnapshot>;
  validate(): Promise<BoardSnapshot>;
  refresh(): Promise<BoardSnapshot>;
  dispatch(raw: unknown): Promise<ProtocolResponse>;
  getOpenPanelCount(): number;
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

  const api: IkanbanApi = {
    initialize,
    open,
    validate,
    refresh,
    getOpenPanelCount: () => (BoardPanel.currentPanel ? 1 : 0),
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
