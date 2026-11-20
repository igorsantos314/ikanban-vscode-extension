import type { Disposable, WebviewView, WebviewViewProvider } from 'vscode';
import { buildHomeHtml } from './homeHtml';
import type { HomeViewState } from './homeState';

export interface HomeViewProviderOptions {
  detectState(): Promise<HomeViewState>;
  subscribe?(onChange: () => void): Disposable;
  log?: (message: string, error?: unknown) => void;
}

const LOADING_STATE: HomeViewState = { status: 'loading', trusted: false };
const ERROR_STATE: HomeViewState = {
  status: 'error',
  trusted: false,
  errorMessage: 'The iKanban state could not be read. Refresh to try again.',
};

export class HomeViewProvider implements WebviewViewProvider, Disposable {
  private view: WebviewView | undefined;
  private visibilityListener: Disposable | undefined;
  private subscription: Disposable | undefined;
  private renderedHtml: string | undefined;
  private refreshing = false;
  private refreshQueued = false;
  private disposed = false;

  constructor(private readonly options: HomeViewProviderOptions) {}

  resolveWebviewView(view: WebviewView): void {
    if (this.disposed) {
      return;
    }

    this.view = view;
    view.webview.options = { enableScripts: false, enableCommandUris: true };
    this.render(LOADING_STATE);

    this.visibilityListener?.dispose();
    this.visibilityListener = view.onDidChangeVisibility(() => {
      if (view.visible) {
        void this.refresh();
      }
    });

    this.subscription?.dispose();
    this.subscription = this.options.subscribe?.(() => {
      void this.refresh();
    });

    void this.refresh();
  }

  async refresh(): Promise<void> {
    if (this.disposed || !this.view) {
      return;
    }
    if (this.refreshing) {
      this.refreshQueued = true;
      return;
    }

    this.refreshing = true;
    try {
      const state = await this.options.detectState();
      if (!this.disposed) {
        this.render(state);
      }
    } catch (error) {
      this.options.log?.('Could not read the iKanban home state', error);
      if (!this.disposed) {
        this.render(ERROR_STATE);
      }
    } finally {
      this.refreshing = false;
      if (this.refreshQueued && !this.disposed) {
        this.refreshQueued = false;
        void this.refresh();
      }
    }
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.visibilityListener?.dispose();
    this.visibilityListener = undefined;
    this.subscription?.dispose();
    this.subscription = undefined;
    this.view = undefined;
    this.renderedHtml = undefined;
  }

  private render(state: HomeViewState): void {
    const html = buildHomeHtml(state);
    if (html === this.renderedHtml || !this.view) {
      return;
    }
    this.renderedHtml = html;
    this.view.webview.html = html;
  }
}
