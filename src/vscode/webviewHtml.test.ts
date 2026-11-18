import { describe, expect, it } from 'vitest';
import { buildMissingAssetsHtml, buildWebviewHtml } from './webviewHtml';

const options = {
  cspSource: 'vscode-webview://abc',
  nonce: 'nonce-123',
  scriptUri: 'vscode-webview://abc/assets/index.js',
  styleUri: 'vscode-webview://abc/assets/index.css',
  title: 'iKanban',
};

describe('webview HTML', () => {
  it('includes a restrictive CSP with the script nonce', () => {
    const html = buildWebviewHtml(options);
    expect(html).toContain("default-src 'none'");
    expect(html).toContain("script-src 'nonce-nonce-123'");
    expect(html).toContain("style-src vscode-webview://abc 'unsafe-inline'");
    expect(html).not.toContain('unsafe-eval');
  });

  it('loads bundled assets through the provided URIs', () => {
    const html = buildWebviewHtml(options);
    expect(html).toContain('<link rel="stylesheet" href="vscode-webview://abc/assets/index.css" />');
    expect(html).toContain('nonce="nonce-123" src="vscode-webview://abc/assets/index.js"');
    expect(html).toContain('<div id="root"></div>');
  });

  it('shows build instructions when assets are missing', () => {
    const html = buildMissingAssetsHtml('iKanban');
    expect(html).toContain('npm run build:webview');
    expect(html).not.toContain('<script');
  });
});
