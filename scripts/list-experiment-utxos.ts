import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';
import { Wallet } from 'ecash-wallet';
import { fromHex } from 'ecash-lib';
import { createChronik } from '../src/network/createChronik.js';

loadEnv({ path: resolve(process.cwd(), '.env') });

async function main(): Promise<void> {
  const skHex = process.env.GENESIS_SK_HEX?.trim();
  if (!skHex) throw new Error('GENESIS_SK_HEX missing');
  const chronik = await createChronik('closest');
  const wallet = Wallet.fromSk(fromHex(skHex), chronik);
  await wallet.sync();
  for (const u of wallet.utxos) {
    console.log(
      JSON.stringify({
        outpoint: `${u.outpoint.txid.slice(0, 12)}:${u.outpoint.outIdx}`,
        sats: u.sats.toString(),
        token: u.token
          ? `${u.token.tokenId.slice(0, 12)} atoms=${u.token.atoms} baton=${u.token.isMintBaton}`
          : null,
      }),
    );
  }
  console.log(`TOTAL=${wallet.balanceSats.toString()}`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
