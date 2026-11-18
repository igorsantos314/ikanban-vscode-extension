import { RelativePattern, Uri, workspace, type Disposable } from 'vscode';
import type { UriLike } from '../application/ports';
import type { YamlFileStore } from '../infrastructure/fs/yamlFileStore';
import { Debouncer } from './debounce';

export class BoardWatcher {
  private readonly watcher: ReturnType<typeof workspace.createFileSystemWatcher>;
  private readonly disposables: Disposable[] = [];
  private readonly debouncer: Debouncer;
  private readonly pendingUris = new Set<string>();
  private disposed = false;

  constructor(
    rootUri: UriLike,
    private readonly store: YamlFileStore,
    private readonly onReload: () => Promise<void>,
    private readonly log?: (message: string, error?: unknown) => void,
  ) {
    this.watcher = workspace.createFileSystemWatcher(
      new RelativePattern(rootUri as Uri, '.ikanban/**/*.yaml'),
    );
    const collect = (uri: Uri) => {
      this.pendingUris.add(uri.toString());
      this.debouncer.schedule();
    };
    this.disposables.push(
      this.watcher.onDidCreate(collect),
      this.watcher.onDidChange(collect),
      this.watcher.onDidDelete(collect),
    );
    this.debouncer = new Debouncer(200, () => this.fire());
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.debouncer.dispose();
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.watcher.dispose();
  }

  private async fire(): Promise<void> {
    if (this.disposed) {
      return;
    }
    const uris = [...this.pendingUris];
    this.pendingUris.clear();

    let external = uris.length === 0;
    for (const uriString of uris) {
      const uri = Uri.parse(uriString);
      try {
        const read = await this.store.read(uri);
        if (!read || !this.store.isSelfWrite(uri, read.revision)) {
          external = true;
          break;
        }
      } catch {
        external = true;
        break;
      }
    }

    if (!external) {
      return;
    }

    try {
      await this.onReload();
    } catch (error) {
      this.log?.('Watcher reload failed', error);
    }
  }
}
