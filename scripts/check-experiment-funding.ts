import { ChronikClient } from 'chronik-client';
import { MAINNET_CHRONIK_URLS } from '../src/network/chronikUrls.js';

async function main(): Promise<void> {
  const c = new ChronikClient([...MAINNET_CHRONIK_URLS]);
  const addr =
    'ecash:qztglkp40zjpfk0km9zndgy54gc53xz4h5d2lypd6p';
  const res = await c.address(addr).utxos();
  const list: Array<{ value?: number | string; sats?: number | string }> =
    Array.isArray(res) ? res : ((res as { utxos?: unknown[] }).utxos as never[] ?? []);
  let total = 0n;
  for (const u of list) {
    total += BigInt(u.value ?? u.sats ?? 0);
  }
  console.log(
    `UTXOS=${list.length} TOTAL_SATS=${total.toString()} XEC=${Number(total) / 100}`,
  );
}

main().catch(e => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
