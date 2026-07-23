import {
  burnTxidFromLocation,
  clearDedicationPath,
  dedicationShareUrl,
  extractBurnTxid,
  looksLikeShareInput,
  normalizeBurnTxid,
} from '../apps/web/src/lib/shareLink.js';

describe('shareLink', () => {
  it('extracts txid from path and site URL', () => {
    const id =
      'a38825a5afae52895126a77287a1f2480f0a8813699b824a5cbfc390cc0d2838';
    expect(extractBurnTxid(`/${id}`)).toBe(id);
    expect(extractBurnTxid(`https://wlotus.org/${id}`)).toBe(id);
    expect(extractBurnTxid(`https://test.wlotus.org/${id}`)).toBe(id);
    expect(extractBurnTxid(id.toUpperCase())).toBe(id);
    expect(burnTxidFromLocation(`/${id}`)).toBe(id);
  });

  it('builds share URL and detects share-shaped input', () => {
    const id =
      'a38825a5afae52895126a77287a1f2480f0a8813699b824a5cbfc390cc0d2838';
    expect(dedicationShareUrl(id, 'https://wlotus.org')).toBe(
      `https://wlotus.org/${id}`,
    );
    expect(looksLikeShareInput(`https://wlotus.org/${id}`)).toBe(true);
    expect(looksLikeShareInput(`http://localhost:5173/${id}`)).toBe(true);
    expect(looksLikeShareInput(id)).toBe(true);
    expect(looksLikeShareInput('Cao Lâm Quả')).toBe(false);
    expect(normalizeBurnTxid(`  ${id.toUpperCase()}  `)).toBe(id);
  });

  it('clearDedicationPath is a no-op without matching path', () => {
    expect(() => clearDedicationPath()).not.toThrow();
  });
});
