export const SKILL_DIRECTORY = ['skills', 'ikanban'] as const;
export const SKILL_FILE_NAME = 'SKILL.md';
export const AGENTS_FILE_NAME = 'AGENTS.md';
export const MANAGED_BLOCK_START = '<!-- ikanban-skill:start -->';
export const MANAGED_BLOCK_END = '<!-- ikanban-skill:end -->';

export const MANAGED_BLOCK = [
  MANAGED_BLOCK_START,
  '## iKanban board skill',
  '',
  'This project uses iKanban. AI agents can manage the board directly by following the portable skill in `skills/ikanban/SKILL.md`. The skill explains how to create, update, move, reorder and remove tasks while preserving timestamps and YAML validity.',
  '',
  'Run `iKanban: Install AI Skill` to refresh the skill.',
  MANAGED_BLOCK_END,
].join('\n');

const BLOCK_PATTERN = /<!-- ikanban-skill:start -->[\s\S]*?<!-- ikanban-skill:end -->/;

export function mergeAgentsContent(existing: string | undefined): string {
  if (!existing || existing.trim().length === 0) {
    return `${MANAGED_BLOCK}\n`;
  }

  if (BLOCK_PATTERN.test(existing)) {
    return existing.replace(BLOCK_PATTERN, MANAGED_BLOCK);
  }

  const separator = existing.endsWith('\n') ? '\n' : '\n\n';
  return `${existing}${separator}${MANAGED_BLOCK}\n`;
}
