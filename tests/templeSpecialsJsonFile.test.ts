import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  loadTempleSpecialsFromEnv,
  unwrapTempleSpecialsJson,
} from '../src/params/templeSpecials.js';

const PROFILE = 'ab'.repeat(32);

describe('temple specials JSON file', () => {
  it('unwraps create-temple-specials wrapper objects', () => {
    const inner = [{ profileId: PROFILE, kind: 'event', eventDate: '2026-07-15' }];
    expect(unwrapTempleSpecialsJson({ TEMPLE_SPECIALS_JSON: inner })).toEqual(
      inner,
    );
    expect(unwrapTempleSpecialsJson(inner)).toEqual(inner);
  });

  it('loads TEMPLE_SPECIALS_JSON_FILE including the created.json wrapper', () => {
    const dir = mkdtempSync(join(tmpdir(), 'wlotus-specials-'));
    const file = join(dir, 'temple-specials.json');
    writeFileSync(
      file,
      JSON.stringify({
        TEMPLE_SPECIALS_JSON: [
          {
            profileId: PROFILE,
            kind: 'ghost',
            eventDate: '2026-07-15',
            eventCalendar: 'lunar',
            name: 'Cô Hồn',
          },
        ],
      }),
    );
    const loaded = loadTempleSpecialsFromEnv({
      TEMPLE_SPECIALS_JSON_FILE: file,
      TEMPLE_SPECIAL_CLAIMS_FILE: '/tmp/wlotus-no-claims.json',
    });
    const coHon = loaded.find(s => s.id === 'co-hon');
    expect(coHon?.kind).toBe('ghost');
    expect(coHon?.name).toBe('Cô Hồn');
    expect(coHon?.profileId).toBe(PROFILE);
    expect(loaded.length).toBeGreaterThan(1);
  });
});
