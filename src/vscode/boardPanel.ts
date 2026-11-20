import { randomBytes } from 'node:crypto';
import {
  Range,
  Selection,
  Uri,
  ViewColumn,
  window,
  workspace,
  type Disposable,
  type OutputChannel,
  type Webview,
  type WebviewPanel,
} from 'vscode';
import type { BoardSnapshot } from '../shared/board';
import type { BoardPushMessage, ProtocolResponse } from '../shared/protocol';
import type { BoardSession } from './session';
import { BoardWatcher } from './boardWatcher';
import type { DiagnosticsManager } from './diagnosticsManager';
import { toProtocolError } from './errorMapper';
import {
  MessageRouter,
  type ProtocolFileRange,
  type RouterHost,
} from './messageRouter';
import { buildMissingAssetsHtml, buildWebviewHtml } from './webviewHtml';

export interface BoardPanelDependencies {
  extensionUri: Uri;
  session: BoardSession;
  diagnostics: DiagnosticsManager;
  output: OutputChannel;
}

export class BoardPanel {
  private static current: BoardPanel | undefined;

  static get currentPanel(): BoardPanel | undefined {
    return BoardPanel.current;
  }

  static async show(dependencies: BoardPanelDependencies): Promise<BoardPanel> {
    const rootKey = dependencies.session.rootUri.toString();
    if (BoardPanel.current) {
      if (BoardPanel.current.rootKey === rootKey) {
        BoardPanel.current.panel.reveal();
        await BoardPanel.current.refresh();
        return BoardPanel.current;
      }
      BoardPanel.current.dispose();
    }

    const panel = window.createWebviewPanel(
      'ikanban.board',
      'iKanban',
      ViewColumn.Active,
      {
        enableScripts: true,
        retainContextWhenHidden: false,
        localResourceRoots: [distRoot(dependencies.extensionUri)],
      },
    );
    const instance = new BoardPanel(panel, dependencies);
    BoardPanel.current = instance;
    await instance.initialize();
    return instance;
  }

  static async restore(
    panel: WebviewPanel,
    dependencies: BoardPanelDependencies,
  ): Promise<BoardPanel> {
    BoardPanel.current?.dispose();
    const instance = new BoardPanel(panel, dependencies);
    BoardPanel.current = instance;
    await instance.initialize();
    return instance;
  }

  private readonly disposables: Disposable[] = [];
  private watcher: BoardWatcher | undefined;
  private router: MessageRouter | undefined;
  private readonly rootKey: string;
  private version = 0;
  private disposed = false;

  private constructor(
    private readonly panel: WebviewPanel,
    private readonly dependencies: BoardPanelDependencies,
  ) {
    this.rootKey = dependencies.session.rootUri.toString();
  }

  get session(): BoardSession {
    return this.dependencies.session;
  }

  get rootUriKey(): string {
    return this.rootKey;
  }

  get webview(): Webview {
    return this.panel.webview;
  }

  async initialize(): Promise<void> {
    this.panel.webview.html = await this.html();

    this.router = new MessageRouter(this.dependencies.session.service, this.routerHost());
    this.watcher = new BoardWatcher(
      this.dependencies.session.rootUri,
      this.dependencies.session.store,
      async () => {
        await this.refresh();
      },
      (message, error) => this.log(message, error),
      async (uris) => {
        const service = this.dependencies.session.service;
        for (const raw of uris) {
          const uri = Uri.parse(raw);
          const parts = uri.path.split('/').filter((part) => part.length > 0);
          const index = parts.lastIndexOf('.ikanban');
          const columnId = index >= 0 ? parts[index + 1] : undefined;
          const fileName = parts[parts.length - 1] ?? '';
          if (
            columnId &&
            fileName !== 'board.yaml' &&
            fileName !== 'column.yaml' &&
            fileName.endsWith('.yaml')
          ) {
            await service.invalidateColumnIndex(columnId);
          } else {
            await service.invalidateAllIndexes();
          }
        }
      },
    );

    this.disposables.push(
      this.panel.webview.onDidReceiveMessage((message: unknown) => {
        void this.router?.handle(message);
      }),
      this.panel.onDidChangeViewState((event) => {
        if (event.webviewPanel.visible) {
          void this.refresh();
        }
      }),
      this.panel.onDidDispose(() => this.cleanup()),
    );
  }

  async refresh(): Promise<BoardSnapshot | undefined> {
    if (this.disposed) {
      return undefined;
    }
    try {
      const snapshot = await this.dependencies.session.service.loadBoard();
      this.dependencies.diagnostics.publish(snapshot.issues);
      await this.pushSnapshot(snapshot);
      return snapshot;
    } catch (error) {
      this.log('Could not refresh the board', error);
      const mapped = toProtocolError(error);
      await this.push({ type: 'board/error', error: mapped, version: ++this.version });
      return undefined;
    }
  }

  async pushSnapshot(snapshot: BoardSnapshot): Promise<void> {
    this.dependencies.diagnostics.publish(snapshot.issues);
    await this.push({ type: 'board/updated', snapshot, version: ++this.version });
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.panel.dispose();
    this.cleanup();
  }

  private cleanup(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.watcher?.dispose();
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    if (BoardPanel.current === this) {
      BoardPanel.current = undefined;
    }
  }

  private async html(): Promise<string> {
    const root = distRoot(this.dependencies.extensionUri);
    const script = Uri.joinPath(root, 'assets', 'index.js');
    const style = Uri.joinPath(root, 'assets', 'index.css');
    try {
      await workspace.fs.stat(script);
      await workspace.fs.stat(style);
    } catch {
      return buildMissingAssetsHtml('iKanban');
    }

    return buildWebviewHtml({
      cspSource: this.panel.webview.cspSource,
      nonce: randomBytes(16).toString('hex'),
      scriptUri: this.panel.webview.asWebviewUri(script).toString(),
      styleUri: this.panel.webview.asWebviewUri(style).toString(),
      title: 'iKanban',
    });
  }

  private routerHost(): RouterHost {
    return {
      post: async (message: ProtocolResponse) => {
        await this.panel.webview.postMessage(message);
      },
      publishSnapshot: (snapshot) => this.dependencies.diagnostics.publish(snapshot.issues),
      openFile: (uri, range) => this.openFile(uri, range),
      canMutate: () => workspace.isTrusted,
      log: (message, error) => this.log(message, error),
    };
  }

  private async openFile(uriString: string, range?: ProtocolFileRange): Promise<void> {
    const uri = Uri.parse(uriString);
    const document = await workspace.openTextDocument(uri);
    const editor = await window.showTextDocument(document, { preview: false });
    if (range) {
      const selection = new Selection(
        range.startLine,
        range.startColumn,
        range.endLine,
        range.endColumn,
      );
      editor.selection = selection;
      editor.revealRange(
        new Range(range.startLine, range.startColumn, range.endLine, range.endColumn),
      );
    }
  }

  private async push(message: BoardPushMessage): Promise<void> {
    try {
      await this.panel.webview.postMessage(message);
    } catch (error) {
      this.log('Could not post a message to the board webview', error);
    }
  }

  private log(message: string, error?: unknown): void {
    this.dependencies.output.appendLine(
      `[${new Date().toISOString()}] ${message}${error ? `: ${String(error)}` : ''}`,
    );
    if (error instanceof Error && error.stack) {
      this.dependencies.output.appendLine(error.stack);
    }
  }
}

function distRoot(extensionUri: Uri): Uri {
  return Uri.joinPath(extensionUri, 'dist', 'webview');
}
