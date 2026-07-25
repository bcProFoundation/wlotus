import { looksLikeHtmlBody } from '../apps/web/src/lib/danaIndexApi.js';

describe('looksLikeHtmlBody', () => {
  it('detects SPA HTML mistaken for JSON', () => {
    expect(looksLikeHtmlBody('<!DOCTYPE html><html>')).toBe(true);
    expect(looksLikeHtmlBody('  <html lang="en">')).toBe(true);
  });

  it('allows JSON payloads', () => {
    expect(looksLikeHtmlBody('{"ok":true}')).toBe(false);
  });
});
