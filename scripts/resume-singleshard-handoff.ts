#!/usr/bin/env tsx
/**
 * Resume the single-shard handoff after an interrupted
 * `create-singleshard-token` run. Reads the PARTIAL dep record, funds the
 * shard if it still lacks its baton, completes the record. Idempotent.
 */
import { resolve } from 'node:path';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { config as loadEnv } from 'dotenv';
import { Wallet } from 'ecash-wallet';
import {
  ALP_TOKEN_TYPE_STANDARD,
  DEFAULT_DUST_SATS,
  fromHex,
  toHex,
  type payment,
} from 'ecash-lib';
import { createChronik } from '../src/network/createChronik.js';
import { createSingleShardDeltaContract } from '../src/covenant/singleShardDeltaScript.js';

loadEnv({ path: resolve(process.cwd(), '.env') });

async function main(): Promise<void> {
  const skHex = process.env.GENESIS_SK_HEX?.trim();
  if (!skHex || !/^[0-9a-fA-F]{64}$/.test(skHex)) {
    throw new Error('GENESIS_SK_HEX missing');
  }
  const depPath = resolve(process.cwd(), 'deployments/mainnet-ulotus.json');
  if (!existsSync(depPath)) {
    throw new Error('Missing deployments/mainnet-ulotus.json (nothing to resume)');
  }
  const dep = JSON.parse(readFileSync(depPath, 'utf8'));
  if (dep.mode !== 'single-shard-delta' || !dep.tokenId) {
    throw new Error('Live dep record is not a single-shard partial (aborting)');
  }
  const shard = createSingleShardDeltaContract({
    tokenId: dep.tokenId,
    mintAtoms: BigInt(dep.mintAtomsPerRemint),
    genesisUnix: dep.genesisUnix,
    daySeconds: dep.daySeconds,
    genesisTarget: dep.genesisTarget,
    tipDay: dep.tipDay,
    tipTarget: dep.tipTarget,
  });
  if (dep.powAddress !== shard.address) {
    throw new Error('Recomputed shard address differs from dep record');
  }

  const chronik = await createChronik('closest');
  const wallet = Wallet.fromSk(fromHex(skHex), chronik);
  await wallet.sync();
  console.log(
    JSON.stringify(
      { tokenId: dep.tokenId, balanceSats: wallet.balanceSats.toString() },
      null,
      2,
    ),
  );

  const handoffTxids: string[] = dep.handoffTxids ?? [];
  const res = await chronik.script('p2sh', toHex(shard.scriptHash)).utxos();
  const list = Array.isArray(res)
    ? res
    : ((res as { utxos?: unknown[] }).utxos ?? []);
  const hasBaton = (
    list as { token?: { tokenId?: string; isMintBaton?: boolean } }[]
  ).some(u => u.token?.tokenId === dep.tokenId && u.token?.isMintBaton);
  if (hasBaton) {
    console.log('Shard already holds its baton — skipping');
  } else {
    const action: payment.Action = {
      outputs: [
        { sats: 0n },
        {
          sats: DEFAULT_DUST_SATS,
          script: shard.p2shScript,
          tokenId: dep.tokenId,
          atoms: 0n,
          isMintBaton: true,
        },
      ],
      tokenActions: [
        {
          type: 'MINT',
          tokenId: dep.tokenId,
          tokenType: ALP_TOKEN_TYPE_STANDARD,
        },
      ],
    };
    const resp = await wallet.action(action).build().broadcast();
    if (!resp.success || !resp.broadcasted?.length) {
      writeFileSync(
        depPath,
        `${JSON.stringify({ ...dep, handoffTxids }, null, 2)}\n`,
      );
      throw new Error(`Handoff failed: ${JSON.stringify(resp)}`);
    }
    handoffTxids.push(resp.broadcasted[0]);
    console.log(`Handoff: ${resp.broadcasted[0]}`);
  }

  const record = {
    ...dep,
    powAddress: shard.address,
    redeemScriptHex: shard.redeemHex,
    handoffTxids,
    pendingHandoffs: false,
    authPubkey: toHex(wallet.pk),
    genesisAddress: wallet.address,
    completedAt: new Date().toISOString(),
  };
  delete record.partial;
  writeFileSync(depPath, `${JSON.stringify(record, null, 2)}\n`);
  console.log('\nULOTUS ready');
}

main().catch(err => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
