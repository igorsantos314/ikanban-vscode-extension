import { describe, expect, it } from 'vitest';
import { buildHomeHtml } from './homeHtml';
import type { HomeViewState } from './homeState';

function state(overrides: Partial<HomeViewState> = {}): HomeViewState {
  return {
    status: 'ready',
    trusted: true,
    workspaceName: 'workspace',
    board: 'initialized',
    skill: 'current',
    ...overrides,
  };
}

function html(overrides: Partial<HomeViewState> = {}): string {
  return buildHomeHtml(state(overrides));
}

describe('buildHomeHtml', () => {
  it('blocks scripts and remote resources', () => {
    for (const value of [
      html(),
      buildHomeHtml({ status: 'loading', trusted: false }),
      buildHomeHtml({ status: 'no-workspace', trusted: false }),
    ]) {
      expect(value).toContain("default-src 'none'");
      expect(value).not.toMatch(/<script/i);
      expect(value).not.toContain('acquireVsCodeApi');
    }
  });

  it('offers board actions for an initialized board and never offers initialization', () => {
    const value = html({ board: 'initialized' });
    expect(value).toContain('command:ikanban.open');
    expect(value).toContain('command:ikanban.validate');
    expect(value).not.toContain('command:ikanban.initialize');
    expect(value).toContain('>Open board<');
    expect(value).not.toContain('>Initialize board<');
    expect(value).toContain('data-board-state="initialized"');
  });

  it('offers initialization only when the board is missing', () => {
    const value = html({ board: 'missing', skill: 'missing' });
    expect(value).toContain('command:ikanban.initialize');
    expect(value).toContain('>Initialize board<');
    expect(value).not.toContain('command:ikanban.open');
    expect(value).toContain('command:ikanban.installAgentSkill');
    expect(value).toContain('>Install AI skill<');
  });

  it('offers an update instead of an install when the skill is outdated', () => {
    const value = html({ skill: 'outdated' });
    expect(value).toContain('>Update AI skill<');
    expect(value).not.toContain('>Install AI skill<');
    expect(value).toContain('Update available');
  });

  it('does not offer a skill action when the skill is current', () => {
    const value = html({ skill: 'current' });
    expect(value).toContain('Up to date');
    expect(value).not.toContain('command:ikanban.installAgentSkill');
  });

  it('offers repair actions for an incomplete board without initialization', () => {
    const value = html({ board: 'needs-repair', boardMessage: '.ikanban exists without board.yaml.' });
    expect(value).not.toContain('command:ikanban.initialize');
    expect(value).toContain('command:ikanban.open');
    expect(value).toContain('command:ikanban.validate');
    expect(value).toContain('Incomplete');
    expect(value).toContain('.ikanban exists without board.yaml.');
  });

  it('asks for a workspace folder when none is open', () => {
    const value = buildHomeHtml({ status: 'no-workspace', trusted: false });
    expect(value).toContain('Open a folder to use iKanban');
    expect(value).not.toContain('command:ikanban.initialize');
    expect(value).not.toContain('command:ikanban.installAgentSkill');
    expect(value).not.toContain('command:ikanban.open');
    expect(value).toContain('command:ikanban.home.refresh');
  });

  it('asks to select a folder in an unremembered multi-root workspace', () => {
    const value = buildHomeHtml({ status: 'needs-selection', trusted: true });
    expect(value).toContain('command:ikanban.home.selectFolder');
    expect(value).toContain('Select workspace folder');
    expect(value).not.toContain('command:ikanban.initialize');
  });

  it('hides write actions in an untrusted workspace', () => {
    const value = html({ trusted: false, board: 'missing', skill: 'missing' });
    expect(value).not.toContain('command:ikanban.initialize');
    expect(value).not.toContain('command:ikanban.installAgentSkill');
    expect(value).toContain('Trust this workspace');
  });

  it('renders detection errors and keeps refresh available', () => {
    const value = html({
      board: 'error',
      boardMessage: 'The board state could not be read.',
      skill: 'error',
      skillMessage: 'The AI skill state could not be read.',
    });
    expect(value).toContain('Unavailable');
    expect(value).toContain('The board state could not be read.');
    expect(value).toContain('The AI skill state could not be read.');
    expect(value).toContain('command:ikanban.home.refresh');
  });

  it('renders top-level errors without hiding refresh', () => {
    const value = buildHomeHtml({
      status: 'error',
      trusted: true,
      errorMessage: 'Something failed.',
    });
    expect(value).toContain('Something failed.');
    expect(value).toContain('command:ikanban.home.refresh');
    expect(value).not.toContain('command:ikanban.initialize');
  });

  it('escapes workspace names and messages', () => {
    const value = html({
      workspaceName: '<b>workspace</b>',
      boardMessage: '<script>alert(1)</script>',
    });
    expect(value).not.toContain('<b>workspace</b>');
    expect(value).not.toContain('<script>alert(1)</script>');
    expect(value).toContain('&lt;b&gt;workspace&lt;/b&gt;');
  });

  it('uses theme-aware styles and stays usable in a narrow sidebar', () => {
    const value = html();
    expect(value).toContain('--vscode-foreground');
    expect(value).toContain('--vscode-button-background');
    expect(value).toContain('overflow-wrap: anywhere');
  });

  it('does not load the board React bundle', () => {
    const value = html();
    expect(value).not.toContain('dist/webview');
    expect(value).not.toContain('acquireVsCodeApi');
  });
});
