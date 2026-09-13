import { ChronikClient } from 'chronik-client';
import { MAINNET_CHRONIK_URLS } from '../src/network/chronikUrls.js';

async function main(): Promise<void> {
  const c = new ChronikClient([...MAINNET_CHRONIK_URLS]);
  const txid =
    'a0fe1941aaa5a4e590140956ea4a890489e10a5d0cfd1d65712063401d9e9fe6';
  const tx = await c.tx(txid);
  const outs = (tx.outputs ?? []).map((o, i) => ({
    i,
    sats: String(o.value ?? (o as { sats?: unknown }).sats ?? '?'),
    scriptHex: Buffer.from(
      (o.outputScript ?? (o as { script?: unknown }).script ?? []) as Uint8Array,
    ).toString('hex'),
    token: JSON.parse(
      JSON.stringify(o.token ?? null, (_, v) =>
        typeof v === 'bigint' ? v.toString() : v,
      ),
    ),
  }));
  console.log(
    JSON.stringify(
      { txid, outCount: outs.length, locktime: tx.locktime, outs },
      null,
      2,
    ),
  );
}

main().catch(e => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
