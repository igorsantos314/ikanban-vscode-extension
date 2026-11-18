import type { UriLike } from '../application/ports';
import { WorkspaceNotAvailableError } from '../domain/errors';

export interface WorkspaceFolderLike {
  name: string;
  uri: UriLike;
}

export interface WorkspaceResolverDependencies {
  getFolders(): readonly WorkspaceFolderLike[];
  pickFolder(folders: readonly WorkspaceFolderLike[]): Promise<WorkspaceFolderLike | undefined>;
  getRememberedUri(): string | undefined;
  rememberUri(uri: string): void | PromiseLike<void>;
}

export type ResolveFolderOptions = { alwaysPick?: boolean };

export class WorkspaceResolver {
  constructor(private readonly dependencies: WorkspaceResolverDependencies) {}

  async resolve(options: ResolveFolderOptions = {}): Promise<WorkspaceFolderLike | undefined> {
    const folders = this.dependencies.getFolders();
    if (folders.length === 0) {
      throw new WorkspaceNotAvailableError();
    }
    if (folders.length === 1) {
      return folders[0];
    }

    if (!options.alwaysPick) {
      const remembered = this.dependencies.getRememberedUri();
      const match = remembered
        ? folders.find((folder) => folder.uri.toString() === remembered)
        : undefined;
      if (match) {
        return match;
      }
    }

    const picked = await this.dependencies.pickFolder(folders);
    if (!picked) {
      return undefined;
    }
    await this.dependencies.rememberUri(picked.uri.toString());
    return picked;
  }
}
