import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadMintApiEnv } from '../apps/mint-api/src/loadMintEnv.js';
import { parseServingTipIndex } from '../src/mint/servingTips.js';

describe('loadMintApiEnv', () => {
  it('loads MINT_SERVING_TIP_INDEX before the desk pins a baton', () => {
    const dir = mkdtempSync(join(tmpdir(), 'wlotus-mint-env-'));
    const path = join(dir, 'mint.env');
    writeFileSync(
      path,
      'MINT_SERVING_TIP_INDEX=27\nMINT_SERVING_TIP_COUNT=1\n',
    );
    const prevIndex = process.env.MINT_SERVING_TIP_INDEX;
    const prevCount = process.env.MINT_SERVING_TIP_COUNT;
    delete process.env.MINT_SERVING_TIP_INDEX;
    delete process.env.MINT_SERVING_TIP_COUNT;
    try {
      expect(parseServingTipIndex()).toBe(0);
      loadMintApiEnv({ mintEnvPath: path });
      expect(parseServingTipIndex()).toBe(27);
    } finally {
      if (prevIndex === undefined) delete process.env.MINT_SERVING_TIP_INDEX;
      else process.env.MINT_SERVING_TIP_INDEX = prevIndex;
      if (prevCount === undefined) delete process.env.MINT_SERVING_TIP_COUNT;
      else process.env.MINT_SERVING_TIP_COUNT = prevCount;
    }
  });
});
