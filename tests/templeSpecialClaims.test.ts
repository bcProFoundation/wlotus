import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  claimSpecialRoot,
  loadSpecialClaims,
} from '../src/params/templeSpecialClaims.js';
import { loadTempleSpecialsFromEnv } from '../src/params/templeSpecials.js';

const A = 'ab'.repeat(32);
const B = 'cd'.repeat(32);

describe('temple special first-burn claims', () => {
  it('first writer wins; same txid is idempotent', () => {
    const dir = mkdtempSync(join(tmpdir(), 'wlotus-claims-'));
    const file = join(dir, 'claims.json');
    const env = { TEMPLE_SPECIAL_CLAIMS_FILE: file };

    const first = claimSpecialRoot('vu-lan', A, env);
    expect(first).toEqual({ ok: true, profileId: A, created: true });

    const again = claimSpecialRoot('vu-lan', A, env);
    expect(again).toEqual({ ok: true, profileId: A, created: false });

    const clash = claimSpecialRoot('vu-lan', B, env);
    expect(clash.ok).toBe(false);
    if (!clash.ok) {
      expect(clash.error).toBe('already claimed');
      expect(clash.profileId).toBe(A);
    }

    expect(loadSpecialClaims(env)).toEqual({ 'vu-lan': A });
    const raw = JSON.parse(readFileSync(file, 'utf8')) as Record<string, string>;
    expect(raw['vu-lan']).toBe(A);
  });

  it('binds catalog profileId from the claims file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'wlotus-claims-'));
    const file = join(dir, 'claims.json');
    claimSpecialRoot('qingming', A, { TEMPLE_SPECIAL_CLAIMS_FILE: file });
    const loaded = loadTempleSpecialsFromEnv({
      TEMPLE_SPECIAL_CLAIMS_FILE: file,
    });
    expect(loaded.find(s => s.id === 'qingming')?.profileId).toBe(A);
    expect(loaded.find(s => s.id === 'vu-lan')?.profileId).toBe('');
  });
});
