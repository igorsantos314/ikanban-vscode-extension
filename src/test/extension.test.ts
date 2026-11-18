import * as assert from 'assert';
import { randomUUID } from 'node:crypto';
import * as vscode from 'vscode';
import type { IkanbanApi } from '../extension';
import type { BoardSnapshot, TaskView } from '../shared/board';
import type { ProtocolResponse, ProtocolRequestType } from '../shared/protocol';

const TASK_ID = '550e8400-e29b-41d4-a716-446655440000';

suite('iKanban extension', () => {
  let api: IkanbanApi;
  let root: vscode.Uri;

  suiteSetup(async () => {
    const extension = vscode.extensions.all.find(
      (candidate) => candidate.packageJSON.name === 'ikanban',
    );
    assert.ok(extension, 'iKanban extension should be installed');
    api = (await extension.activate()) as IkanbanApi;
    const folder = vscode.workspace.workspaceFolders?.[0];
    assert.ok(folder, 'The test workspace folder should be open');
    root = folder.uri;
  });

  suiteTeardown(async () => {
    await removeBoard();
  });

  setup(async () => {
    await removeBoard();
    await removeInstalledSkill();
  });

  teardown(async () => {
    await removeBoard();
    await removeInstalledSkill();
  });

  async function removeBoard(): Promise<void> {
    const directory = vscode.Uri.joinPath(root, '.ikanban');
    try {
      await vscode.workspace.fs.delete(directory, { recursive: true });
    } catch {
      // The board may not exist in this test.
    }
  }

  async function removeInstalledSkill(): Promise<void> {
    for (const name of ['skills', 'AGENTS.md']) {
      try {
        await vscode.workspace.fs.delete(vscode.Uri.joinPath(root, name), {
          recursive: true,
        });
      } catch {
        // The skill may not have been installed in this test.
      }
    }
  }

  async function read(uri: vscode.Uri): Promise<string> {
    return Buffer.from(await vscode.workspace.fs.readFile(uri)).toString('utf8');
  }

  async function request<T>(
    type: ProtocolRequestType,
    payload: unknown,
  ): Promise<T> {
    const response = (await api.dispatch({
      type,
      requestId: randomUUID(),
      payload,
    })) as ProtocolResponse;
    assert.strictEqual(response.ok, true, JSON.stringify(response));
    return (response as { ok: true; data: T }).data;
  }

  test('activates and registers all commands without Hello World', async () => {
    const commands = await vscode.commands.getCommands(true);
    for (const command of [
      'ikanban.initialize',
      'ikanban.open',
      'ikanban.createTask',
      'ikanban.validate',
      'ikanban.refresh',
      'ikanban.installAgentSkill',
    ]) {
      assert.ok(commands.includes(command), `${command} should be registered`);
    }
    assert.ok(!commands.includes('ikanban.helloWorld'));
  });

  test('contributes the Activity Bar home view, icon and VS Code baseline', async () => {
    interface Manifest {
      engines?: { vscode?: string };
      contributes?: {
        viewsContainers?: {
          activitybar?: Array<{ id: string; icon?: string }>;
        };
        views?: Record<string, Array<{ id: string; type?: string }>>;
      };
    }

    const extension = vscode.extensions.all.find(
      (candidate) => candidate.packageJSON.name === 'ikanban',
    );
    assert.ok(extension, 'iKanban extension should be installed');
    const manifest = extension.packageJSON as Manifest;

    assert.strictEqual(manifest.engines?.vscode, '^1.147.0');
    const container = manifest.contributes?.viewsContainers?.activitybar?.find(
      (candidate) => candidate.id === 'ikanban',
    );
    assert.ok(container, 'the iKanban Activity Bar container should be contributed');
    assert.strictEqual(container.icon, 'resources/ikanban.svg');
    assert.ok(
      manifest.contributes?.views?.ikanban?.some(
        (view) => view.id === 'ikanban.home' && view.type === 'webview',
      ),
      'the iKanban webview home view should be contributed',
    );
    await vscode.workspace.fs.stat(
      vscode.Uri.joinPath(extension.extensionUri, 'resources', 'ikanban.svg'),
    );
  });

  test('installs the portable agent skill and managed AGENTS pointer', async () => {
    await vscode.commands.executeCommand('ikanban.installAgentSkill');

    const skillUri = vscode.Uri.joinPath(root, 'skills', 'ikanban', 'SKILL.md');
    const agentsUri = vscode.Uri.joinPath(root, 'AGENTS.md');
    const skill = await read(skillUri);
    assert.match(skill, /^---\nname: ikanban\n/);
    const installedAgents = await read(agentsUri);
    assert.ok(installedAgents.includes('<!-- ikanban-skill:start -->'));
    assert.ok(installedAgents.includes('skills/ikanban/SKILL.md'));

    await vscode.commands.executeCommand('ikanban.installAgentSkill');
    assert.strictEqual(await read(agentsUri), installedAgents);
    assert.strictEqual((installedAgents.match(/ikanban-skill:start/g) ?? []).length, 1);
  });

  test('preserves existing AGENTS content when installing the skill', async () => {
    const agentsUri = vscode.Uri.joinPath(root, 'AGENTS.md');
    const existing = '# Existing instructions\n\nKeep this.\n';
    await vscode.workspace.fs.writeFile(agentsUri, new TextEncoder().encode(existing));

    await vscode.commands.executeCommand('ikanban.installAgentSkill');

    const content = await read(agentsUri);
    assert.ok(content.startsWith(existing));
    assert.ok(content.includes('<!-- ikanban-skill:start -->'));
  });

  test('does not install the agent skill in an untrusted workspace', async () => {
    const descriptor = Object.getOwnPropertyDescriptor(vscode.workspace, 'isTrusted');
    assert.ok(descriptor);
    Object.defineProperty(vscode.workspace, 'isTrusted', {
      configurable: true,
      value: false,
    });
    try {
      await vscode.commands.executeCommand('ikanban.installAgentSkill');
    } finally {
      Object.defineProperty(vscode.workspace, 'isTrusted', descriptor);
    }

    await assert.rejects(async () => {
      await vscode.workspace.fs.stat(
        vscode.Uri.joinPath(root, 'skills', 'ikanban', 'SKILL.md'),
      );
    });
  });

  test('initializes a board from the command', async () => {
    await vscode.commands.executeCommand('ikanban.initialize');
    const boardUri = vscode.Uri.joinPath(root, '.ikanban', 'board.yaml');
    const board = await read(boardUri);
    assert.match(board, /version: 1/);
    assert.match(board, /backlog/);
    assert.match(board, /in-progress/);
    assert.match(board, /done/);
    await vscode.workspace.fs.stat(vscode.Uri.joinPath(root, '.ikanban', 'backlog', 'column.yaml'));
  });

  test('reuses a single board panel when opened repeatedly', async () => {
    await request<BoardSnapshot>('board/initialize', {});
    await vscode.commands.executeCommand('ikanban.open');
    await vscode.commands.executeCommand('ikanban.open');
    assert.strictEqual(api.getOpenPanelCount(), 1);
  });

  test('sidebar entry redirects to exactly one board panel', async () => {
    await request<BoardSnapshot>('board/initialize', {});
    await vscode.commands.executeCommand('workbench.view.extension.ikanban');
    await waitFor(
      () => api.getOpenPanelCount(),
      (count) => count === 1,
    );
    await vscode.commands.executeCommand('workbench.view.extension.ikanban');
    await new Promise((resolve) => setTimeout(resolve, 300));
    assert.strictEqual(api.getOpenPanelCount(), 1);
  });

  test('creates a task from the command with default fields', async () => {
    await request<BoardSnapshot>('board/initialize', {});
    await withTaskPrompts(
      'Command task',
      (items) => items.find((item) => item.columnId === 'backlog'),
      () => vscode.commands.executeCommand('ikanban.createTask'),
    );

    const snapshot = await request<BoardSnapshot>('board/load', {});
    const task = snapshot.tasks.find((entry) => entry.title === 'Command task');
    assert.ok(task);
    assert.strictEqual(task.columnId, 'backlog');
    assert.strictEqual(task.description, '');
    assert.strictEqual(task.priority, 'medium');
    assert.deepStrictEqual(task.tags, []);
    assert.deepStrictEqual(task.checklists, []);
    assert.strictEqual(task.createdAt, task.updatedAt);
  });

  test('skips the column picker when the board has one column', async () => {
    let snapshot = await request<BoardSnapshot>('board/initialize', {});
    for (const id of ['in-progress', 'done']) {
      snapshot = await request<BoardSnapshot>('column/delete', {
        id,
        expectedBoardRevision: snapshot.board!.revision,
      });
    }

    await withTaskPrompts(
      'Single column task',
      () => {
        throw new Error('The column picker should not be shown.');
      },
      () => vscode.commands.executeCommand('ikanban.createTask'),
    );

    const loaded = await request<BoardSnapshot>('board/load', {});
    const task = loaded.tasks.find((entry) => entry.title === 'Single column task');
    assert.ok(task);
    assert.strictEqual(task.columnId, 'backlog');
  });

  test('cancelling the create-task prompt writes nothing', async () => {
    await request<BoardSnapshot>('board/initialize', {});
    const before = await request<BoardSnapshot>('board/load', {});
    await withTaskPrompts(undefined, (items) => items[0], () =>
      vscode.commands.executeCommand('ikanban.createTask'),
    );
    const after = await request<BoardSnapshot>('board/load', {});
    assert.strictEqual(after.tasks.length, before.tasks.length);
  });

  test('create task reports an error when the board is not initialized', async () => {
    await withTaskPrompts('No board', (items) => items[0], () =>
      vscode.commands.executeCommand('ikanban.createTask'),
    );

    await assert.rejects(async () => {
      await vscode.workspace.fs.stat(vscode.Uri.joinPath(root, '.ikanban'));
    });
  });

  test('initialization is idempotent and keeps tasks', async () => {
    const first = await request<BoardSnapshot>('board/initialize', {});
    const created = await request<TaskView>('task/create', {
      columnId: 'backlog',
      title: 'Keep this task',
      description: '',
      priority: 'medium',
      tags: [],
      checklists: [],
    });
    await vscode.commands.executeCommand('ikanban.initialize');
    const reloaded = await request<BoardSnapshot>('board/load', {});
    assert.ok(reloaded.board);
    assert.strictEqual(reloaded.board?.revision, first.board?.revision);
    assert.ok(reloaded.tasks.some((task) => task.id === created.id));
  });

  test('publishes diagnostics for invalid files and clears them after correction', async () => {
    await request<BoardSnapshot>('board/initialize', {});
    const uri = vscode.Uri.joinPath(
      root,
      '.ikanban',
      'backlog',
      `${TASK_ID}.yaml`,
    );
    const encoder = new TextEncoder();
    await vscode.workspace.fs.writeFile(
      uri,
      encoder.encode(`id: "${TASK_ID}"\ntitle: Missing fields\n`),
    );

    await vscode.commands.executeCommand('ikanban.validate');
    const diagnostics = vscode.languages.getDiagnostics(uri);
    assert.ok(
      diagnostics.some((diagnostic) => diagnostic.source === 'iKanban'),
      'Expected an iKanban diagnostic',
    );

    await vscode.workspace.fs.writeFile(
      uri,
      encoder.encode(
        [
          `id: "${TASK_ID}"`,
          'title: Corrected',
          'description: ""',
          'tags: []',
          'priority: medium',
          'position: 1024',
          'checklists: []',
          'createdAt: "2026-11-18T10:00:00.000Z"',
          'updatedAt: "2026-11-18T10:00:00.000Z"',
          '',
        ].join('\n'),
      ),
    );
    await vscode.commands.executeCommand('ikanban.validate');
    assert.deepStrictEqual(vscode.languages.getDiagnostics(uri), []);
  });

  test('blocks board creation in an untrusted workspace', async () => {
    const descriptor = Object.getOwnPropertyDescriptor(vscode.workspace, 'isTrusted');
    assert.ok(descriptor, 'workspace.isTrusted should be inspectable');
    Object.defineProperty(vscode.workspace, 'isTrusted', {
      configurable: true,
      value: false,
    });
    try {
      await assert.rejects(api.initialize(), /trusted workspace/);
    } finally {
      Object.defineProperty(vscode.workspace, 'isTrusted', descriptor);
    }
    await assert.rejects(async () => {
      await vscode.workspace.fs.stat(vscode.Uri.joinPath(root, '.ikanban'));
    });
  });

  test('refreshes diagnostics after an external YAML change', async () => {
    await request<BoardSnapshot>('board/initialize', {});
    await vscode.commands.executeCommand('ikanban.open');
    const uri = vscode.Uri.joinPath(root, '.ikanban', 'backlog', 'external.yaml');
    await vscode.workspace.fs.writeFile(
      uri,
      new TextEncoder().encode('title: [unclosed\n'),
    );

    const diagnostics = await waitFor(
      () => vscode.languages.getDiagnostics(uri),
      (entries) => entries.some((diagnostic) => diagnostic.source === 'iKanban'),
    );
    assert.ok(diagnostics.some((diagnostic) => diagnostic.source === 'iKanban'));

    await vscode.workspace.fs.delete(uri);
    await waitFor(
      () => vscode.languages.getDiagnostics(uri),
      (entries) => entries.length === 0,
    );
  });

  test('rejects malformed and unknown protocol messages', async () => {
    await request<BoardSnapshot>('board/initialize', {});
    const malformed = (await api.dispatch({
      type: 'task/move',
      requestId: randomUUID(),
      payload: { taskId: 'x' },
    })) as ProtocolResponse;
    assert.strictEqual(malformed.ok, false);
    const unknown = (await api.dispatch({
      type: 'task/archive',
      requestId: randomUUID(),
      payload: {},
    })) as ProtocolResponse;
    assert.strictEqual(unknown.ok, false);
    if (!unknown.ok) {
      assert.strictEqual(unknown.error.code, 'InvalidRequest');
    }
  });

  test('end-to-end: column, task, checklists, items, move, reload, delete', async () => {
    let snapshot = await request<BoardSnapshot>('board/initialize', {});
    assert.ok(snapshot.board);

    snapshot = await request<BoardSnapshot>('column/create', {
      title: 'Review',
      color: '#8b5cf6',
      expectedBoardRevision: snapshot.board.revision,
    });
    assert.ok(snapshot.columns.some((column) => column.id === 'review'));

    let task = await request<TaskView>('task/create', {
      columnId: 'review',
      title: 'End-to-end task',
      description: 'Persisted description',
      priority: 'high',
      tags: ['feat', 'spec'],
      checklists: [],
    });

    task = await request<TaskView>('checklist/create', {
      taskId: task.id,
      columnId: 'review',
      expectedRevision: task.revision,
      title: 'Steps',
    });
    const checklistId = task.checklists[0]?.id;
    assert.ok(checklistId);

    task = await request<TaskView>('checklistItem/create', {
      taskId: task.id,
      columnId: 'review',
      expectedRevision: task.revision,
      checklistId,
      text: 'First item',
    });
    task = await request<TaskView>('checklistItem/create', {
      taskId: task.id,
      columnId: 'review',
      expectedRevision: task.revision,
      checklistId,
      text: 'Second item',
    });
    const firstItemId = task.checklists[0]?.items[0]?.id;
    assert.ok(firstItemId);

    task = await request<TaskView>('checklistItem/toggle', {
      taskId: task.id,
      columnId: 'review',
      expectedRevision: task.revision,
      checklistId,
      itemId: firstItemId,
    });
    assert.strictEqual(task.checklists[0]?.items[0]?.completed, true);

    snapshot = await request<BoardSnapshot>('task/move', {
      taskId: task.id,
      fromColumnId: 'review',
      toColumnId: 'done',
      targetIndex: 0,
      expectedRevision: task.revision,
    });
    snapshot = await request<BoardSnapshot>('board/load', {});
    const reloaded = snapshot.tasks.find((entry) => entry.id === task.id);
    assert.ok(reloaded);
    assert.strictEqual(reloaded.columnId, 'done');
    assert.strictEqual(reloaded.checklists[0]?.items[0]?.completed, true);

    const taskUri = vscode.Uri.joinPath(
      root,
      '.ikanban',
      'done',
      `${task.id}.yaml`,
    );
    const yaml = await read(taskUri);
    assert.match(yaml, /End-to-end task/);
    assert.match(yaml, /completed: true/);

    await request('task/delete', {
      taskId: task.id,
      columnId: 'done',
      expectedRevision: reloaded.revision,
    });
    await assert.rejects(async () => {
      await vscode.workspace.fs.stat(taskUri);
    });

    snapshot = await request<BoardSnapshot>('board/load', {});
    assert.ok(snapshot.board);
    snapshot = await request<BoardSnapshot>('column/delete', {
      id: 'review',
      expectedBoardRevision: snapshot.board.revision,
    });
    assert.ok(!snapshot.columns.some((column) => column.id === 'review'));
    await assert.rejects(async () => {
      await vscode.workspace.fs.stat(vscode.Uri.joinPath(root, '.ikanban', 'review'));
    });
  });
});

interface ColumnPick extends vscode.QuickPickItem {
  columnId: string;
}

async function withTaskPrompts<T>(
  title: string | undefined,
  pick: ((items: readonly ColumnPick[]) => ColumnPick | undefined) | undefined,
  run: () => PromiseLike<T>,
): Promise<T> {
  const input = Object.getOwnPropertyDescriptor(vscode.window, 'showInputBox');
  const quickPick = Object.getOwnPropertyDescriptor(vscode.window, 'showQuickPick');
  Object.defineProperty(vscode.window, 'showInputBox', {
    configurable: true,
    value: async () => title,
  });
  Object.defineProperty(vscode.window, 'showQuickPick', {
    configurable: true,
    value: async (items: readonly ColumnPick[]) => pick?.(items),
  });

  try {
    return await run();
  } finally {
    restoreWindowProperty('showInputBox', input);
    restoreWindowProperty('showQuickPick', quickPick);
  }
}

function restoreWindowProperty(key: string, descriptor: PropertyDescriptor | undefined): void {
  if (descriptor) {
    Object.defineProperty(vscode.window, key, descriptor);
  } else {
    Reflect.deleteProperty(vscode.window, key);
  }
}

async function waitFor<T>(
  read: () => T,
  predicate: (value: T) => boolean,
  timeoutMs = 5000,
): Promise<T> {
  const started = Date.now();
  for (;;) {
    const value = read();
    if (predicate(value)) {
      return value;
    }
    if (Date.now() - started > timeoutMs) {
      throw new Error('Timed out waiting for a filesystem watcher update.');
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}
