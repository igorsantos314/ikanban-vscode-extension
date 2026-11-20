import { Uri, workspace, type OutputChannel } from 'vscode';
import {
  AGENTS_FILE_NAME,
  SKILL_DIRECTORY,
  SKILL_FILE_NAME,
  mergeAgentsContent,
} from '../application/agentSkill';
import type { WorkspaceFolderLike } from './workspaceResolver';

export interface InstallAgentSkillOptions {
  extensionUri: Uri;
  folder: WorkspaceFolderLike;
  output: OutputChannel;
}

export interface InstallAgentSkillResult {
  skillUri: Uri;
  agentsUri: Uri;
}

export async function installAgentSkill(
  options: InstallAgentSkillOptions,
): Promise<InstallAgentSkillResult> {
  const templateUri = Uri.joinPath(
    options.extensionUri,
    'resources',
    'skills',
    'ikanban',
    SKILL_FILE_NAME,
  );
  const skillDirectory = Uri.joinPath(options.folder.uri as Uri, ...SKILL_DIRECTORY);
  const skillUri = Uri.joinPath(skillDirectory, SKILL_FILE_NAME);
  const agentsUri = Uri.joinPath(options.folder.uri as Uri, AGENTS_FILE_NAME);

  const template = decode(await workspace.fs.readFile(templateUri));
  const previousSkill = await readIfExists(skillUri);
  const previousAgents = await readIfExists(agentsUri);
  const nextAgents = mergeAgentsContent(previousAgents);

  await workspace.fs.createDirectory(skillDirectory);
  if (previousSkill !== template) {
    await workspace.fs.writeFile(skillUri, encode(template));
  }
  if (previousAgents !== nextAgents) {
    await workspace.fs.writeFile(agentsUri, encode(nextAgents));
  }

  options.output.appendLine(
    `[${new Date().toISOString()}] Agent skill installed at ${skillUri.toString()} and ${agentsUri.toString()}.`,
  );

  return { skillUri, agentsUri };
}

async function readIfExists(uri: Uri): Promise<string | undefined> {
  try {
    await workspace.fs.stat(uri);
  } catch {
    return undefined;
  }
  return decode(await workspace.fs.readFile(uri));
}

function decode(content: Uint8Array): string {
  return new TextDecoder().decode(content);
}

function encode(content: string): Uint8Array {
  return new TextEncoder().encode(content);
}
