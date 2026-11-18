import { describe, expect, it, vi } from 'vitest';
import type { BoardPushMessage, ProtocolResponse } from '../../shared/protocol';
import type { BoardSnapshot } from '../../shared/board';
import { ApiError, BoardClient, type VsCodeApiLike } from './boardClient';

function makeSnapshot(version: number): BoardSnapshot {
  return {
    workspaceName: 'Workspace',
    board: { version: 1, name: 'Board', columnIds: ['backlog'], revision: `rev-${version}` },
    columns: [],
    tasks: [],
    issues: [],
    canInitialize: false,
  };
}

function setup() {
  const target = new EventTarget();
  const posted: Array<{ type: string; requestId: string; payload: unknown }> = [];
  const api: VsCodeApiLike = {
    postMessage: (message) => {
      posted.push(message as { type: string; requestId: string; payload: unknown });
    },
  };
  const client = new BoardClient(api, target);
  const respond = (message: ProtocolResponse) => {
    target.dispatchEvent(new MessageEvent('message', { data: message }));
  };
  return { client, posted, respond, target };
}

describe('BoardClient', () => {
  it('correlates responses by request ID', async () => {
    const { client, posted, respond } = setup();
    const promise = client.request('board/load', {});
    expect(posted[0]?.type).toBe('board/load');
    respond({
      type: 'response',
      requestId: posted[0]!.requestId,
      ok: true,
      data: makeSnapshot(1),
    });
    await expect(promise).resolves.toMatchObject({ workspaceName: 'Workspace' });
  });

  it('rejects failed requests with the host error code', async () => {
    const { client, posted, respond } = setup();
    const promise = client.request('task/update', {});
    respond({
      type: 'response',
      requestId: posted[0]!.requestId,
      ok: false,
      error: { code: 'ConflictError', message: 'Reload before saving.' },
    });
    await expect(promise).rejects.toEqual(
      new ApiError('ConflictError', 'Reload before saving.'),
    );
  });

  it('ignores responses for unknown request IDs', () => {
    const { respond } = setup();
    expect(() =>
      respond({
        type: 'response',
        requestId: 'unknown',
        ok: true,
        data: null,
      }),
    ).not.toThrow();
  });

  it('delivers newer push messages and ignores out-of-order ones', () => {
    const { client, target } = setup();
    const listener = vi.fn();
    const unsubscribe = client.subscribe(listener);

    const push = (version: number): BoardPushMessage => ({
      type: 'board/updated',
      snapshot: makeSnapshot(version),
      version,
    });

    target.dispatchEvent(new MessageEvent('message', { data: push(2) }));
    target.dispatchEvent(new MessageEvent('message', { data: push(1) }));
    target.dispatchEvent(new MessageEvent('message', { data: push(3) }));

    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener.mock.calls[0]?.[0]).toMatchObject({ version: 2 });
    expect(listener.mock.calls[1]?.[0]).toMatchObject({ version: 3 });

    unsubscribe();
    target.dispatchEvent(new MessageEvent('message', { data: push(4) }));
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('rejects new requests after disposal', async () => {
    const { client } = setup();
    client.dispose();
    await expect(client.request('board/load', {})).rejects.toMatchObject({
      code: 'Disposed',
    });
  });
});
