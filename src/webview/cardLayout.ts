export type CardLayout = 'expanded' | 'compact';

export const DEFAULT_CARD_LAYOUT: CardLayout = 'expanded';

export interface CardLayoutStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function cardLayoutStorageKey(workspaceName: string): string {
  return `ikanban.cardLayout.${workspaceName}`;
}

function defaultStorage(): CardLayoutStorage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

export function readCardLayout(
  workspaceName: string,
  storage: CardLayoutStorage | undefined = defaultStorage(),
): CardLayout {
  if (!storage) {
    return DEFAULT_CARD_LAYOUT;
  }
  try {
    const value = storage.getItem(cardLayoutStorageKey(workspaceName));
    return value === 'compact' || value === 'expanded' ? value : DEFAULT_CARD_LAYOUT;
  } catch {
    return DEFAULT_CARD_LAYOUT;
  }
}

export function writeCardLayout(
  workspaceName: string,
  layout: CardLayout,
  storage: CardLayoutStorage | undefined = defaultStorage(),
): void {
  if (!storage) {
    return;
  }
  try {
    storage.setItem(cardLayoutStorageKey(workspaceName), layout);
  } catch {
    // A failed preference write must never break the board.
  }
}
