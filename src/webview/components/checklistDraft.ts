export interface ChecklistItemDraftState {
  id: string;
  text: string;
  completed: boolean;
}

export interface ChecklistDraftState {
  id: string;
  title: string;
  items: ChecklistItemDraftState[];
}

export function newClientId(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && 'randomUUID' in cryptoApi) {
    return cryptoApi.randomUUID();
  }
  return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
