export function moveColumnInPreview(
  order: readonly string[],
  activeColumnId: string,
  targetColumnId: string,
): string[] | null {
  const from = order.indexOf(activeColumnId);
  const to = order.indexOf(targetColumnId);
  if (from < 0 || to < 0 || from === to) {
    return null;
  }
  const next = [...order];
  next.splice(from, 1);
  next.splice(to, 0, activeColumnId);
  return next;
}

export function resolveColumnTargetId(
  overId: string,
  tasks: readonly { id: string; columnId: string }[],
): string | null {
  if (overId.startsWith('column:')) {
    return overId.slice('column:'.length);
  }
  return tasks.find((task) => task.id === overId)?.columnId ?? null;
}

export function columnOrdersEqual(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}
