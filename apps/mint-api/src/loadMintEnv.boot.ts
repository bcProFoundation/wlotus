/**
 * Side-effect entry: load /etc/wlotus/mint.env before offer.ts is evaluated.
 * Import this file first from server.ts.
 */
import { loadMintApiEnv } from './loadMintEnv.js';
import {
  parseServingTipCount,
  parseServingTipIndex,
} from '../../../src/mint/servingTips.js';

const mintEnv = loadMintApiEnv();
if (mintEnv.error) {
  console.error(
    'mint-api: failed to load /etc/wlotus/mint.env:',
    mintEnv.error.message,
    '\nFix: sudo chown root:deploy /etc/wlotus/mint.env && sudo chmod 640 /etc/wlotus/mint.env',
  );
} else {
  console.error(
    `mint-api: loaded mint.env servingTipIndex=${parseServingTipIndex()} servingTipCount=${parseServingTipCount()}`,
  );
}
