#!/usr/bin/env tsx
/**
 * Mine one PoW remint against WLPOW batons in the Spedn covenant.
 */
import { resolve } from 'node:path';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { config as loadEnv } from 'dotenv';
import { Wallet } from 'ecash-wallet';
import { fromHex, toHex } from 'ecash-lib';
import { createChronik } from '../src/network/createChronik.js';
import {
  buildMinedRemintTx,
  contractForToken,
  minerBanner,
} from '../src/miner/remint.js';

loadEnv({ path: resolve(process.cwd(), '.env') });

async function main(): Promise<void> {
  console.log(minerBanner());
  const skHex = process.env.GENESIS_SK_HEX?.trim();
  if (!skHex || !/^[0-9a-fA-F]{64}$/.test(skHex)) {
    throw new Error('GENESIS_SK_HEX missing');
  }

  const depPath = resolve(process.cwd(), 'deployments/mainnet-pow-token.json');
  if (!existsSync(depPath)) {
    throw new Error('Missing deployments/mainnet-pow-token.json — run npm run create-pow-token');
  }
  const dep = JSON.parse(readFileSync(depPath, 'utf8'));
  const tokenId = process.env.TOKEN_ID?.trim() || dep.tokenId;

  const chronik = await createChronik('closest');
  const wallet = Wallet.fromSk(fromHex(skHex), chronik);
  await wallet.sync();
  const contract = await contractForToken(tokenId);

  if (dep.powAddress && dep.powAddress !== contract.address) {
    throw new Error(
      `Address mismatch: dep=${dep.powAddress} computed=${contract.address}`,
    );
  }

  const scriptHex = toHex(contract.scriptHash);
  const scriptUtxos = await chronik.script('p2sh', scriptHex).utxos();
  const list = Array.isArray(scriptUtxos)
    ? scriptUtxos
    : (scriptUtxos.utxos ?? []);
  const batonUtxos = list.filter(
    (u: { token?: { tokenId?: string; isMintBaton?: boolean } }) =>
      u.token?.tokenId === tokenId && u.token?.isMintBaton,
  );
  if (batonUtxos.length === 0) {
    throw new Error(`No PoW batons at ${contract.address}`);
  }

  const b = batonUtxos[0];
  const baton = {
    outpoint: { txid: b.outpoint.txid, outIdx: b.outpoint.outIdx },
    sats: BigInt(b.sats),
    txid: b.outpoint.txid as string,
    vout: b.outpoint.outIdx as number,
  };

  const fuelUtxo = wallet.utxos.find(u => !u.token && u.sats >= 2_000n);
  if (!fuelUtxo) {
    throw new Error('Need a ≥20 XEC pure XEC UTXO for fees');
  }

  console.log(
    JSON.stringify(
      {
        tokenId,
        powAddress: contract.address,
        baton: `${baton.txid}:${baton.vout}`,
        fuelSats: fuelUtxo.sats.toString(),
      },
      null,
      2,
    ),
  );

  const built = await buildMinedRemintTx({
    contract,
    baton,
    fuel: {
      outpoint: {
        txid: fuelUtxo.outpoint.txid,
        outIdx: fuelUtxo.outpoint.outIdx,
      },
      sats: fuelUtxo.sats,
      outputScript: wallet.script,
    },
    miner: { sk: fromHex(skHex), pk: wallet.pk },
  });

  console.log(
    JSON.stringify(
      {
        powAttempts: built.powAttempts,
        nonceHex: built.nonceHex,
        mintAtoms: built.mintAtoms,
        txSize: built.txHex.length / 2,
      },
      null,
      2,
    ),
  );

  const broadcast = await chronik.broadcastTx(built.txHex);
  console.log('\nRemint OK', broadcast.txid);
  writeFileSync(
    resolve(process.cwd(), 'deployments/mainnet-last-remint.json'),
    `${JSON.stringify(
      {
        tokenId,
        txid: broadcast.txid,
        powAttempts: built.powAttempts,
        nonceHex: built.nonceHex,
        mintAtoms: built.mintAtoms,
        minedAt: new Date().toISOString(),
        explorer: `https://explorer.e.cash/tx/${broadcast.txid}`,
      },
      null,
      2,
    )}\n`,
  );
}

main().catch(err => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
