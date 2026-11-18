export class WriteRegistry {
  private readonly entries = new Map<string, { digest: string; at: number }>();

  constructor(private readonly windowMs = 2000) {}

  mark(uri: string, digest: string, at = Date.now()): void {
    this.entries.set(uri, { digest, at });
  }

  shouldIgnore(uri: string, digest: string, at = Date.now()): boolean {
    const entry = this.entries.get(uri);
    if (!entry) {
      return false;
    }
    if (entry.digest !== digest) {
      return false;
    }
    return at - entry.at <= this.windowMs;
  }

  clear(): void {
    this.entries.clear();
  }
}

export class ParseCache<T> {
  private readonly entries = new Map<string, { digest: string; value: T }>();

  get(uri: string, digest: string): T | undefined {
    const entry = this.entries.get(uri);
    if (!entry || entry.digest !== digest) {
      return undefined;
    }
    return entry.value;
  }

  set(uri: string, digest: string, value: T): void {
    this.entries.set(uri, { digest, value });
  }

  clear(): void {
    this.entries.clear();
  }
}
