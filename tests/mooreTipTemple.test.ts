import { toHex } from 'ecash-lib';
import { expectedMooreTipTempleMintOpReturnScript } from '../src/covenant/powRemintMooreTipTempleOutputs.js';
import type { MooreTipState } from '../src/covenant/mooreTip.js';
import { mooreTipTempleMinerBanner } from '../src/miner/remintMooreTipTemple.js';
import {
  WLOTUS_DESK_KEEP_AFTER_BURN,
  WLOTUS_MINT_ATOMS,
  WLOTUS_MINER_ATOMS,
  WLOTUS_TEMPLE_ATOMS,
} from '../src/params/wlotusMint.js';

/** ALP LE6 atom encodings hardcoded in WlotusPowRemintMooreTipTemple.spedn. */
const LE6_102 = Buffer.from('660000000000', 'hex');
const LE6_6 = Buffer.from('060000000000', 'hex');

describe('wLotus mint split (MooreTipTemple)', () => {
  it('constants: 108 = 102 miner + 6 temple; desk keeps 101 after burn-1', () => {
    expect(WLOTUS_MINER_ATOMS).toBe(102n);
    expect(WLOTUS_TEMPLE_ATOMS).toBe(6n);
    expect(WLOTUS_MINT_ATOMS).toBe(108n);
    expect(WLOTUS_MINER_ATOMS + WLOTUS_TEMPLE_ATOMS).toBe(WLOTUS_MINT_ATOMS);
    expect(WLOTUS_DESK_KEEP_AFTER_BURN).toBe(101n);
    expect(WLOTUS_DESK_KEEP_AFTER_BURN).toBe(WLOTUS_MINER_ATOMS - 1n);
  });

  it('output builder encodes ALP MINT [102, 6] + 1 baton (matches Spedn LE6)', () => {
    const tip: MooreTipState = {
      locktime: 1_700_000_000,
      tipLocktime: 1_700_000_000,
      extraBits: 0,
      bits: 0,
    };
    const tokenId =
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const script = expectedMooreTipTempleMintOpReturnScript(tokenId, tip);
    const hex = toHex(script.bytecode);

    // Spedn mintSection: … 0x02 | LE6(102) | LE6(6) | 0x01 (baton count)
    expect(hex.includes(LE6_102.toString('hex'))).toBe(true);
    expect(hex.includes(LE6_6.toString('hex'))).toBe(true);
    // Exactly one occurrence of each amount encoding
    expect(hex.split(LE6_102.toString('hex')).length - 1).toBe(1);
    expect(hex.split(LE6_6.toString('hex')).length - 1).toBe(1);
  });

  it('miner banner reports 108 = 102 miner + 6 temple', () => {
    const banner = mooreTipTempleMinerBanner({
      params: {
        baseZeroBits: 0,
        tipLocktime: 1_700_000_000,
      },
    } as Parameters<typeof mooreTipTempleMinerBanner>[0]);
    expect(banner).toContain('mint=108 (102 miner + 6 temple)');
    expect(banner).toContain('baseZeroBits=0');
  });
});
