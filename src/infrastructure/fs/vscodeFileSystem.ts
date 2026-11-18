import {
  FileSystemError,
  FileType,
  Uri,
  workspace,
  type FileStat as VscodeFileStat,
} from 'vscode';
import type {
  DirectoryEntry,
  FileStat,
  FileType as PortFileType,
  UriLike,
  WorkspaceFileSystem,
} from '../../application/ports';

function mapType(type: FileType): PortFileType {
  switch (type) {
    case FileType.File:
      return 'file';
    case FileType.Directory:
      return 'directory';
    default:
      return 'unknown';
  }
}

function mapStat(stat: VscodeFileStat): FileStat {
  return {
    type: mapType(stat.type),
    size: stat.size,
    mtime: stat.mtime,
  };
}

function asUri(uri: UriLike): Uri {
  return uri as Uri;
}

export class VscodeWorkspaceFileSystem implements WorkspaceFileSystem {
  async readFile(uri: UriLike): Promise<Uint8Array> {
    return workspace.fs.readFile(asUri(uri));
  }

  async writeFile(uri: UriLike, content: Uint8Array): Promise<void> {
    await workspace.fs.writeFile(asUri(uri), content);
  }

  async delete(uri: UriLike, options?: { recursive?: boolean }): Promise<void> {
    await workspace.fs.delete(asUri(uri), options);
  }

  async createDirectory(uri: UriLike): Promise<void> {
    await workspace.fs.createDirectory(asUri(uri));
  }

  async readDirectory(uri: UriLike): Promise<DirectoryEntry[]> {
    const entries = await workspace.fs.readDirectory(asUri(uri));
    return entries.map(([name, type]) => ({ name, type: mapType(type) }));
  }

  async stat(uri: UriLike): Promise<FileStat> {
    return mapStat(await workspace.fs.stat(asUri(uri)));
  }

  async exists(uri: UriLike): Promise<boolean> {
    try {
      await workspace.fs.stat(asUri(uri));
      return true;
    } catch (error) {
      if (error instanceof FileSystemError && error.code === 'FileNotFound') {
        return false;
      }
      throw error;
    }
  }

  async rename(
    source: UriLike,
    target: UriLike,
    options?: { overwrite?: boolean },
  ): Promise<void> {
    await workspace.fs.rename(asUri(source), asUri(target), options);
  }

  joinPath(base: UriLike, ...segments: string[]): UriLike {
    return Uri.joinPath(asUri(base), ...segments);
  }

  dirname(uri: UriLike): UriLike {
    const source = asUri(uri);
    const parent = source.path.replace(/\/[^/]*$/, '') || '/';
    return source.with({ path: parent });
  }

  basename(uri: UriLike): string {
    return uri.path.split('/').filter(Boolean).pop() ?? '';
  }
}
