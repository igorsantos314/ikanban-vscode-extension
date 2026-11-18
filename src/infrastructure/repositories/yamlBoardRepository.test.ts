import { describe, expect, it, afterEach } from 'vitest';
import { ValidationError } from '../../domain/errors';
import { createTestWorkspace, type TestWorkspace } from '../../test/helpers/workspace';

const workspaces: TestWorkspace[] = [];

afterEach(async () => {
  while (workspaces.length > 0) {
    await workspaces.pop()?.cleanup();
  }
});

async function workspace(): Promise<TestWorkspace> {
  const created = await createTestWorkspace();
  workspaces.push(created);
  return created;
}

describe('YamlBoardRepository', () => {
  it('creates and reads a board', async () => {
    const { board } = await workspace();
    expect(await board.boardExists()).toBe(false);
    const written = await board.createBoard({
      version: 1,
      name: 'Project',
      columnIds: ['backlog', 'done'],
    });
    expect(written.revision).toHaveLength(64);

    const read = await board.readBoard();
    expect(read?.ok).toBe(true);
    if (read?.ok) {
      expect(read.document.value.name).toBe('Project');
      expect(read.document.value.columnIds).toEqual(['backlog', 'done']);
      expect(read.document.revision).toBe(written.revision);
    }
  });

  it('writes board updates with revision checks', async () => {
    const { board } = await workspace();
    const written = await board.createBoard({
      version: 1,
      name: 'Project',
      columnIds: ['backlog'],
    });
    await board.writeBoard(
      { version: 1, name: 'Renamed', columnIds: ['backlog'] },
      written.revision,
    );
    const read = await board.readBoard();
    expect(read?.ok && read.document.value.name).toBe('Renamed');
  });

  it('creates, reads, lists and deletes column directories', async () => {
    const { board } = await workspace();
    await board.createBoard({ version: 1, name: 'Project', columnIds: ['backlog'] });
    await board.createColumn({ id: 'backlog', title: 'Backlog', color: '#64748b' });
    await board.createColumn({ id: 'done', title: 'Done', color: '#22c55e' });

    expect(await board.listColumnDirectories()).toEqual(['backlog', 'done']);
    expect(await board.columnExists('backlog')).toBe(true);
    const column = await board.readColumn('backlog');
    expect(column?.ok && column.document.value.title).toBe('Backlog');

    await board.deleteColumn('done');
    expect(await board.columnExists('done')).toBe(false);
  });

  it('rejects unsafe column identifiers', async () => {
    const { board } = await workspace();
    await expect(board.readColumn('../outside')).rejects.toBeInstanceOf(ValidationError);
    await expect(board.deleteColumn('a/b')).rejects.toBeInstanceOf(ValidationError);
  });

  it('lists only task YAML files', async () => {
    const { board, fs, ikanbanUri } = await workspace();
    await board.createColumn({ id: 'backlog', title: 'Backlog', color: '#64748b' });
    const directory = fs.joinPath(ikanbanUri, 'backlog');
    await fs.writeFile(fs.joinPath(directory, 'column.yaml'), new TextEncoder().encode('id: backlog\n'));
    await fs.writeFile(fs.joinPath(directory, 'task.yaml'), new TextEncoder().encode('id: x\n'));
    await fs.writeFile(fs.joinPath(directory, '.task.yaml.1.tmp'), new TextEncoder().encode('x'));
    await fs.writeFile(fs.joinPath(directory, 'notes.txt'), new TextEncoder().encode('x'));

    const files = await board.listTaskFiles('backlog');
    expect(files.map((file) => file.fileName)).toEqual(['task.yaml']);
  });
});
