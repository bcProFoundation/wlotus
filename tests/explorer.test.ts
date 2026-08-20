import {
  DEFAULT_DANA_EXPLORER_ORIGIN,
  danaExplorerOrigin,
  explorerTx,
} from '../src/explorer.js';

describe('explorerTx', () => {
  const id =
    'd0efd170f98973f03c7bb0ad7457192c8e6a9f63eeca37f162ad4417de77f23b';

  it('points user-facing links at Temple on danaverse.org, not explorer.e.cash', () => {
    expect(DEFAULT_DANA_EXPLORER_ORIGIN).toBe('https://danaverse.org');
    expect(explorerTx(id)).toBe(`https://danaverse.org/offering/${id}`);
    expect(explorerTx(id)).not.toContain('explorer.e.cash');
    expect(explorerTx(id)).not.toContain('/tx/');
  });

  it('accepts a custom origin and lowercases the txid', () => {
    expect(explorerTx(id.toUpperCase(), 'https://danaverse.org/')).toBe(
      `https://danaverse.org/offering/${id}`,
    );
    expect(danaExplorerOrigin(' https://temple.example ')).toBe(
      'https://temple.example',
    );
  });

  it('forwards the W Lotus locale so Temple can honor it', () => {
    expect(explorerTx(id, undefined, 'vi')).toBe(
      `https://danaverse.org/offering/${id}?lang=vi`,
    );
    expect(explorerTx(id, 'https://danaverse.org/', 'en-US')).toBe(
      `https://danaverse.org/offering/${id}?lang=en`,
    );
    expect(explorerTx(id, undefined, 'fr')).toBe(
      `https://danaverse.org/offering/${id}`,
    );
  });
});
