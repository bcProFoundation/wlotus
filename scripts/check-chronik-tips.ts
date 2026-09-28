import { ChronikClient } from 'chronik-client';
import { MAINNET_CHRONIK_URLS } from '../src/network/chronikUrls.js';
import { getMedianTimePast } from '../src/network/medianTimePast.js';

async function main(): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  for (const url of MAINNET_CHRONIK_URLS) {
    try {
      const c = new ChronikClient([url]);
      const { tipHeight, tipUnix, mtp } = await getMedianTimePast(c);
      console.log(
        JSON.stringify({ url, tipHeight, tipUnix, mtp, wallLag: now - tipUnix, mtpLag: now - mtp }),
      );
    } catch (e) {
      console.log(JSON.stringify({ url, error: String(e).slice(0, 120) }));
    }
  }
  console.log(JSON.stringify({ wall: now }));
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
