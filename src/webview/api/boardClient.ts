import type { BoardPushMessage, ProtocolRequestType, ProtocolResponse } from '../../shared/protocol';

export interface VsCodeApiLike {
  postMessage(message: unknown): void;
}

export interface BoardClientLike {
  request<T = unknown>(type: ProtocolRequestType, payload: unknown): Promise<T>;
  subscribe(listener: (message: BoardPushMessage) => void): () => void;
  dispose(): void;
}

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface PendingRequest {
  resolve(value: unknown): void;
  reject(error: Error): void;
}

export class BoardClient implements BoardClientLike {
  private readonly pending = new Map<string, PendingRequest>();
  private readonly listeners = new Set<(message: BoardPushMessage) => void>();
  private readonly onMessage: (event: Event) => void;
  private lastPushVersion = -1;
  private disposed = false;

  constructor(
    private readonly api: VsCodeApiLike,
    private readonly target: EventTarget = window,
  ) {
    this.onMessage = (event) => this.handleMessage(event as MessageEvent);
    this.target.addEventListener('message', this.onMessage);
  }

  request<T = unknown>(type: ProtocolRequestType, payload: unknown): Promise<T> {
    if (this.disposed) {
      return Promise.reject(new ApiError('Disposed', 'The board client is closed.'));
    }
    const requestId = createRequestId();
    return new Promise<T>((resolve, reject) => {
      this.pending.set(requestId, {
        resolve: (value) => resolve(value as T),
        reject,
      });
      this.api.postMessage({ type, requestId, payload });
    });
  }

  subscribe(listener: (message: BoardPushMessage) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  dispose(): void {
    this.disposed = true;
    this.target.removeEventListener('message', this.onMessage);
    this.pending.clear();
    this.listeners.clear();
  }

  private handleMessage(event: MessageEvent): void {
    const message = event.data as ProtocolResponse | BoardPushMessage | undefined;
    if (!message || typeof message !== 'object') {
      return;
    }

    if (message.type === 'response') {
      const pending = this.pending.get(message.requestId);
      if (!pending) {
        return;
      }
      this.pending.delete(message.requestId);
      if (message.ok) {
        pending.resolve(message.data);
      } else {
        pending.reject(new ApiError(message.error.code, message.error.message));
      }
      return;
    }

    if (message.type === 'board/updated' || message.type === 'board/error') {
      if (message.version <= this.lastPushVersion) {
        return;
      }
      this.lastPushVersion = message.version;
      for (const listener of this.listeners) {
        listener(message);
      }
    }
  }
}

export function createWebviewBoardClient(): BoardClient {
  const acquire = (
    globalThis as typeof globalThis & {
      acquireVsCodeApi?: () => VsCodeApiLike;
    }
  ).acquireVsCodeApi;
  if (!acquire) {
    throw new Error('The VS Code webview API is unavailable.');
  }
  return new BoardClient(acquire());
}

function createRequestId(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && 'randomUUID' in cryptoApi) {
    return cryptoApi.randomUUID();
  }
  return `req-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
