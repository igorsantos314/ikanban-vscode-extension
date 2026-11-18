import { describe, expect, it, vi } from 'vitest';
import type { WebviewView } from 'vscode';
import { HomeViewProvider } from './homeView';

function createFakeView(visible: boolean) {
  let listener: (() => void) | undefined;
  const listenerDispose = vi.fn();
  const webview = {
    options: undefined as unknown,
    html: '',
  };
  const view = {
    visible,
    webview,
    onDidChangeVisibility: (callback: () => void) => {
      listener = callback;
      return { dispose: listenerDispose };
    },
  };

  return {
    view: view as unknown as WebviewView,
    webview,
    listenerDispose,
    setVisible(next: boolean): void {
      view.visible = next;
      listener?.();
    },
  };
}

describe('HomeViewProvider', () => {
  it('renders the home view and redirects when resolved visible', () => {
    const redirect = vi.fn(async () => undefined);
    const provider = new HomeViewProvider({ redirect });
    const fake = createFakeView(true);

    provider.resolveWebviewView(fake.view);

    expect(fake.webview.options).toEqual({
      enableScripts: false,
      enableCommandUris: true,
    });
    expect(fake.webview.html).toContain('command:ikanban.open');
    expect(redirect).toHaveBeenCalledOnce();

    provider.dispose();
  });

  it('redirects on a visibility transition to visible', () => {
    const redirect = vi.fn(async () => undefined);
    const provider = new HomeViewProvider({ redirect });
    const fake = createFakeView(false);

    provider.resolveWebviewView(fake.view);
    expect(redirect).not.toHaveBeenCalled();

    fake.setVisible(true);
    expect(redirect).toHaveBeenCalledOnce();

    fake.setVisible(false);
    expect(redirect).toHaveBeenCalledOnce();

    provider.dispose();
  });

  it('guards overlapping redirects until the current one finishes', async () => {
    let release: (() => void) | undefined;
    const redirect = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const provider = new HomeViewProvider({ redirect });
    const fake = createFakeView(true);

    provider.resolveWebviewView(fake.view);
    fake.setVisible(true);
    fake.setVisible(true);
    expect(redirect).toHaveBeenCalledOnce();

    release?.();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fake.setVisible(true);
    expect(redirect).toHaveBeenCalledTimes(2);

    provider.dispose();
  });

  it('disposes the visibility listener and stops redirecting', () => {
    const redirect = vi.fn(async () => undefined);
    const provider = new HomeViewProvider({ redirect });
    const fake = createFakeView(true);

    provider.resolveWebviewView(fake.view);
    provider.dispose();

    expect(fake.listenerDispose).toHaveBeenCalledOnce();
    fake.setVisible(true);
    expect(redirect).toHaveBeenCalledOnce();
  });

  it('logs redirect failures without breaking the view', async () => {
    const redirect = vi.fn(async () => {
      throw new Error('boom');
    });
    const log = vi.fn();
    const provider = new HomeViewProvider({ redirect, log });
    const fake = createFakeView(true);

    provider.resolveWebviewView(fake.view);

    await vi.waitFor(() => expect(log).toHaveBeenCalledOnce());
    expect(fake.webview.html).toContain('command:ikanban.open');

    provider.dispose();
  });
});
