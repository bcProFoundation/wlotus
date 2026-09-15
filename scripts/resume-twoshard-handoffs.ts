#!/usr/bin/env tsx
/**
 * Resume two-shard handoffs after an interrupted `create-twoshard-token`
 * run (e.g. handoff 0 failed on wallet sync lag with genesis already
 * on-chain). Reads the PARTIAL dep record the create script always writes
 * (even on handoff failure), funds any shard missing its baton, completes
 * the record. Idempotent: shards that already hold a baton are skipped.
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
import { createTwoShardPair } from '../src/covenant/twoShardScript.js';

loadEnv({ path: resolve(process.cwd(), '.env') });

async function shardHasBaton(
  chronik: Awaited<ReturnType<typeof createChronik>>,
  scriptHashHex: string,
  tokenId: string,
): Promise<boolean> {
  const res = await chronik.script('p2sh', scriptHashHex).utxos();
  const list = Array.isArray(res) ? res : ((res as { utxos?: unknown[] }).utxos ?? []);
  return (list as { token?: { tokenId?: string; isMintBaton?: boolean } }[]).some(
    u => u.token?.tokenId === tokenId && u.token?.isMintBaton,
  );
}

async function main(): Promise<void> {
  const skHex = process.env.GENESIS_SK_HEX?.trim();
  if (!skHex || !/^[0-9a-fA-F]{64}$/.test(skHex)) {
    throw new Error('GENESIS_SK_HEX missing');
  }
  const depPath = resolve(process.cwd(), 'deployments/mainnet-twoshard-shard.json');
  if (!existsSync(depPath)) {
    throw new Error('Missing deployments/mainnet-twoshard-shard.json (nothing to resume)');
  }
  const dep = JSON.parse(readFileSync(depPath, 'utf8'));
  if (dep.mode !== 'two-shard-c+m' || !dep.tokenId) {
    throw new Error('Live dep record is not a two-shard partial (aborting)');
  }
  const pair = await createTwoShardPair({
    tokenId: dep.tokenId,
    mintAtoms: BigInt(dep.mintAtomsPerRemint),
    genesisUnix: dep.genesisUnix,
    daySeconds: dep.daySeconds,
    genesisTarget: dep.genesisTarget,
    tipDay: dep.tipDay,
    tipTarget: dep.tipTarget,
  });
  if (dep.powAddressC !== pair.c.address || dep.powAddressM !== pair.m.address) {
    throw new Error('Depair: recomputed shard addresses differ from dep record');
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
  const shards = [pair.c, pair.m];
  for (let i = 0; i < shards.length; i++) {
    const shard = shards[i]!;
    if (await shardHasBaton(chronik, toHex(shard.scriptHash), dep.tokenId)) {
      console.log(`Shard ${shard.id} already holds its baton — skipping`);
      continue;
    }
    await wallet.sync();
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
      // Persist progress before failing so the next resume continues.
      writeFileSync(depPath, `${JSON.stringify({ ...dep, handoffTxids }, null, 2)}\n`);
      throw new Error(`Handoff ${shard.id} failed: ${JSON.stringify(resp)}`);
    }
    handoffTxids.push(resp.broadcasted[0]);
    console.log(`Handoff ${shard.id}: ${resp.broadcasted[0]}`);
  }

  const record = {
    ...dep,
    powAddressC: pair.c.address,
    powAddressM: pair.m.address,
    redeemScriptHexC: pair.c.redeemHex,
    redeemScriptHexM: pair.m.redeemHex,
    handoffTxids,
    pendingHandoffs: false,
    authPubkey: toHex(wallet.pk),
    genesisAddress: wallet.address,
    completedAt: new Date().toISOString(),
  };
  delete record.partial;
  writeFileSync(depPath, `${JSON.stringify(record, null, 2)}\n`);
  console.log('\nTwoShard SHARD ready');
}

main().catch(err => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
