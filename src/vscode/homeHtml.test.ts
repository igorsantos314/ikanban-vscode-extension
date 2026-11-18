import { describe, expect, it } from 'vitest';
import { buildHomeHtml } from './homeHtml';

describe('buildHomeHtml', () => {
  const html = buildHomeHtml();

  it('blocks scripts and remote resources', () => {
    expect(html).toContain("default-src 'none'");
    expect(html).not.toMatch(/<script/i);
  });

  it('offers the existing commands as actions', () => {
    for (const command of ['ikanban.open', 'ikanban.initialize', 'ikanban.validate']) {
      expect(html).toContain(`command:${command}`);
    }
  });

  it('uses theme-aware styles and stays usable in a narrow sidebar', () => {
    expect(html).toContain('--vscode-foreground');
    expect(html).toContain('--vscode-button-background');
    expect(html).toContain('overflow-wrap: anywhere');
  });

  it('does not load the board React bundle', () => {
    expect(html).not.toContain('dist/webview');
    expect(html).not.toContain('acquireVsCodeApi');
  });
});
