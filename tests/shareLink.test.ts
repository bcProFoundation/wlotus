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
      '7ab478bcfddf6eb5130d33395846012c20b92ac48f19025ef8d53ba3d7d5e359';
    expect(extractBurnTxid(`/${id}`)).toBe(id);
    expect(extractBurnTxid(`https://wlotus.org/${id}`)).toBe(id);
    expect(extractBurnTxid(`https://test.wlotus.org/${id}`)).toBe(id);
    expect(extractBurnTxid(id.toUpperCase())).toBe(id);
    expect(burnTxidFromLocation(`/${id}`)).toBe(id);
  });

  it('builds share URL and detects share-shaped input', () => {
    const id =
      '7ab478bcfddf6eb5130d33395846012c20b92ac48f19025ef8d53ba3d7d5e359';
    expect(dedicationShareUrl(id, 'https://wlotus.org')).toBe(
      `https://wlotus.org/${id}`,
    );
    expect(dedicationShareUrl(id, 'https://wlotus.org', 'vi')).toBe(
      `https://wlotus.org/${id}?lang=vi`,
    );
    expect(dedicationShareUrl(id, 'https://wlotus.org', 'en-US')).toBe(
      `https://wlotus.org/${id}?lang=en`,
    );
    expect(looksLikeShareInput(`https://wlotus.org/${id}`)).toBe(true);
    expect(looksLikeShareInput(`https://wlotus.org/${id}?lang=vi`)).toBe(
      true,
    );
    expect(looksLikeShareInput(`http://localhost:5173/${id}`)).toBe(true);
    expect(looksLikeShareInput(id)).toBe(true);
    expect(looksLikeShareInput('Cao Lâm Quả')).toBe(false);
    expect(normalizeBurnTxid(`  ${id.toUpperCase()}  `)).toBe(id);
  });

  it('accepts future native schemes but shares HTTPS only', () => {
    const id =
      '7ab478bcfddf6eb5130d33395846012c20b92ac48f19025ef8d53ba3d7d5e359';
    expect(extractBurnTxid(`wlotus://${id}`)).toBe(id);
    expect(extractBurnTxid(`wlotus://burn/${id}`)).toBe(id);
    expect(extractBurnTxid(`web+wlotus://${id}`)).toBe(id);
    expect(looksLikeShareInput(`wlotus://burn/${id}`)).toBe(true);
    expect(dedicationShareUrl(id, 'https://wlotus.org')).toBe(
      `https://wlotus.org/${id}`,
    );
  });

  it('clearDedicationPath is a no-op without matching path', () => {
    expect(() => clearDedicationPath()).not.toThrow();
  });
});
