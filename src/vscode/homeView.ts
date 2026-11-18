import type { Disposable, WebviewView, WebviewViewProvider } from 'vscode';
import { buildHomeHtml } from './homeHtml';

export interface HomeViewProviderOptions {
  redirect: () => Promise<unknown>;
  log?: (message: string, error?: unknown) => void;
}

export class HomeViewProvider implements WebviewViewProvider, Disposable {
  private visibilityListener: Disposable | undefined;
  private redirecting = false;
  private disposed = false;

  constructor(private readonly options: HomeViewProviderOptions) {}

  resolveWebviewView(view: WebviewView): void {
    if (this.disposed) {
      return;
    }

    view.webview.options = { enableScripts: false, enableCommandUris: true };
    view.webview.html = buildHomeHtml();

    this.visibilityListener?.dispose();
    this.visibilityListener = view.onDidChangeVisibility(() => {
      if (view.visible) {
        void this.redirect();
      }
    });

    if (view.visible) {
      void this.redirect();
    }
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.visibilityListener?.dispose();
    this.visibilityListener = undefined;
  }

  private async redirect(): Promise<void> {
    if (this.disposed || this.redirecting) {
      return;
    }

    this.redirecting = true;
    try {
      await this.options.redirect();
    } catch (error) {
      this.options.log?.('Could not open the iKanban board from the sidebar', error);
    } finally {
      this.redirecting = false;
    }
  }
}
