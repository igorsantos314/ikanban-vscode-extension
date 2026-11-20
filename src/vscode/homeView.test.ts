import { describe, expect, it, vi } from 'vitest';
import type { WebviewView } from 'vscode';
import type { HomeViewState } from './homeState';
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

function state(overrides: Partial<HomeViewState> = {}): HomeViewState {
  return {
    status: 'ready',
    trusted: true,
    workspaceName: 'workspace',
    board: 'missing',
    skill: 'missing',
    ...overrides,
  };
}

describe('HomeViewProvider', () => {
  it('renders the detected state and never opens the board by itself', async () => {
    const detectState = vi.fn(async () => state());
    const provider = new HomeViewProvider({ detectState });
    const fake = createFakeView(true);

    provider.resolveWebviewView(fake.view);

    expect(fake.webview.options).toEqual({
      enableScripts: false,
      enableCommandUris: true,
    });
    await vi.waitFor(() =>
      expect(fake.webview.html).toContain('data-board-state="missing"'),
    );
    expect(fake.webview.html).toContain('command:ikanban.initialize');
    expect(fake.webview.html).not.toContain('command:ikanban.open');
    expect(detectState).toHaveBeenCalledOnce();

    provider.dispose();
  });

  it('shows a loading state until detection finishes', async () => {
    let resolve: ((value: HomeViewState) => void) | undefined;
    const detectState = vi.fn(
      () =>
        new Promise<HomeViewState>((next) => {
          resolve = next;
        }),
    );
    const provider = new HomeViewProvider({ detectState });
    const fake = createFakeView(true);

    provider.resolveWebviewView(fake.view);
    expect(fake.webview.html).toContain('data-home-state="loading"');

    resolve?.(state());
    await vi.waitFor(() =>
      expect(fake.webview.html).toContain('data-home-state="ready"'),
    );

    provider.dispose();
  });

  it('re-detects the state when the view becomes visible', async () => {
    const detectState = vi
      .fn<() => Promise<HomeViewState>>()
      .mockResolvedValueOnce(state({ board: 'missing' }))
      .mockResolvedValueOnce(state({ board: 'initialized', skill: 'current' }));
    const provider = new HomeViewProvider({ detectState });
    const fake = createFakeView(false);

    provider.resolveWebviewView(fake.view);
    await vi.waitFor(() =>
      expect(fake.webview.html).toContain('data-board-state="missing"'),
    );

    fake.setVisible(true);
    await vi.waitFor(() =>
      expect(fake.webview.html).toContain('data-board-state="initialized"'),
    );
    expect(fake.webview.html).toContain('command:ikanban.open');
    expect(fake.webview.html).not.toContain('command:ikanban.initialize');

    provider.dispose();
  });

  it('refreshes when the subscribed sources change', async () => {
    let notify: (() => void) | undefined;
    const subscriptionDispose = vi.fn();
    const detectState = vi.fn(async () => state({ skill: 'current' }));
    const provider = new HomeViewProvider({
      detectState,
      subscribe: (onChange) => {
        notify = onChange;
        return { dispose: subscriptionDispose };
      },
    });
    const fake = createFakeView(true);

    provider.resolveWebviewView(fake.view);
    await vi.waitFor(() => expect(detectState).toHaveBeenCalledOnce());

    notify?.();
    await vi.waitFor(() => expect(detectState).toHaveBeenCalledTimes(2));

    provider.dispose();
    expect(subscriptionDispose).toHaveBeenCalledOnce();
  });

  it('queues one refresh while detection is running', async () => {
    let release: ((value: HomeViewState) => void) | undefined;
    const detectState = vi
      .fn<() => Promise<HomeViewState>>()
      .mockImplementationOnce(
        () =>
          new Promise<HomeViewState>((resolve) => {
            release = resolve;
          }),
      )
      .mockResolvedValue(state());
    const provider = new HomeViewProvider({ detectState });
    const fake = createFakeView(true);

    provider.resolveWebviewView(fake.view);
    void provider.refresh();
    void provider.refresh();
    expect(detectState).toHaveBeenCalledOnce();

    release?.(state());
    await vi.waitFor(() => expect(detectState).toHaveBeenCalledTimes(2));

    provider.dispose();
  });

  it('disposes the visibility listener and subscription and stops refreshing', async () => {
    const detectState = vi.fn(async () => state());
    const provider = new HomeViewProvider({ detectState });
    const fake = createFakeView(true);

    provider.resolveWebviewView(fake.view);
    await vi.waitFor(() => expect(detectState).toHaveBeenCalledOnce());
    provider.dispose();

    expect(fake.listenerDispose).toHaveBeenCalledOnce();
    fake.setVisible(true);
    await Promise.resolve();
    expect(detectState).toHaveBeenCalledOnce();
  });

  it('reports detection failures without breaking the view', async () => {
    const detectState = vi.fn(async () => {
      throw new Error('boom');
    });
    const log = vi.fn();
    const provider = new HomeViewProvider({ detectState, log });
    const fake = createFakeView(true);

    provider.resolveWebviewView(fake.view);

    await vi.waitFor(() => expect(log).toHaveBeenCalledOnce());
    expect(fake.webview.html).toContain('data-home-state="error"');
    expect(fake.webview.html).toContain('command:ikanban.home.refresh');

    provider.dispose();
  });
});
