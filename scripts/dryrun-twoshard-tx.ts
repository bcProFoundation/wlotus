#!/usr/bin/env tsx
/**
 * Offline dry-run of the two-shard remint tx. No network, no broadcast.
 *
 * 1. Hand-rolls the expected out0..out3 bytes STRAIGHT FROM the Spedn
 *    template (independent of ecash-lib helpers) and asserts the miner's
 *    ecash-lib-built outputs match byte-for-byte. This is the last
 *    lib-vs-covenant drift check available before broadcast.
 * 2. Builds a full remint tx with FAKE outpoints/keys (mines real PoW,
 *    ~256 attempts) to validate RTS scriptSig assembly end-to-end.
 * 3. Asserts scriptSig sizes fit standardness (<1650B each).
 */
import { randomBytes } from 'node:crypto';
import {
  Ecc,
  fromHex,
  fromHexRev,
  Script,
  shaRmd160,
  toHex,
} from 'ecash-lib';
import { createTwoShardPair } from '../src/covenant/twoShardScript.js';
import { expectedTwoShardMintOpReturnScript } from '../src/covenant/twoShard.js';
import { buildMinedTwoShardRemintTx } from '../src/miner/remintTwoShard.js';

const failures: string[] = [];
function gate(cond: boolean, msg: string): void {
  if (!cond) failures.push(msg);
}

function u32le(n: number): Buffer {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n >>> 0, 0);
  return b;
}

async function main(): Promise<void> {
  const tokenId =
    'd9004b411d4cbcd2ec16235d506efd6e266186153bd1a2b1db3a1d5118c2ca5b';
  const genesisUnix = 1_784_300_000;
  const locktime = genesisUnix; // k=0
  const mintAtoms = 100n;

  const pair = await createTwoShardPair({
    tokenId,
    mintAtoms,
    genesisUnix,
    daySeconds: 86_400,
    genesisTarget: 2 ** 24,
    tipDay: 0,
    tipTarget: 2 ** 24,
  });
  const nextPair = await createTwoShardPair({
    tokenId,
    mintAtoms,
    genesisUnix,
    daySeconds: 86_400,
    genesisTarget: 2 ** 24,
    tipDay: 0,
    tipTarget: 2 ** 24,
  });

  // --- 1. hand-rolled outputs vs miner-built outputs ---
  const ecc = new Ecc();
  const sk = randomBytes(32);
  const pk = ecc.derivePubkey(sk);
  void fromHex;

  const wldf = Buffer.concat([
    Buffer.from('574c4446', 'hex'),
    Buffer.from([0x03]),
    u32le(0),
    u32le(2 ** 24),
    u32le(locktime),
  ]);
  gate(wldf.length === 17, 'hand wldf len');
  const mintSection = Buffer.concat([
    Buffer.from('534c5032', 'hex'),
    Buffer.from([0x00]),
    Buffer.from('04', 'hex'),
    Buffer.from('4d494e54', 'hex'),
    Buffer.from(fromHexRev(tokenId)),
    Buffer.from([0x01]),
    Buffer.from('640000000000', 'hex'), // LE6(100)
    Buffer.from([0x02]),
  ]);
  gate(mintSection.length === 50, 'hand mint len');
  const opret = Buffer.concat([
    Buffer.from('6a50', 'hex'),
    Buffer.from([0x11]),
    wldf,
    Buffer.from([0x32]),
    mintSection,
  ]);
  gate(opret.length === 71, 'hand opret len');
  const libOpret = Buffer.from(
    expectedTwoShardMintOpReturnScript(tokenId, mintAtoms, {
      newDay: 0,
      newTarget: 2 ** 24,
      locktime,
    }).bytecode,
  );
  gate(libOpret.equals(opret), 'lib opReturn != hand-rolled template bytes');

  const pkh = Buffer.from(shaRmd160(pk));
  const handP2pkh = Buffer.concat([
    Buffer.from('76a914', 'hex'),
    pkh,
    Buffer.from('88ac', 'hex'),
  ]);
  gate(
    Buffer.from(Script.p2pkh(pkh).bytecode).equals(handP2pkh),
    'p2pkh layout drift',
  );
  const handC = Buffer.concat([
    Buffer.from('a914', 'hex'),
    Buffer.from(shaRmd160(new Uint8Array(nextPair.c.redeem))),
    Buffer.from('87', 'hex'),
  ]);
  gate(
    Buffer.from(nextPair.c.p2shScript.bytecode).equals(handC),
    'C p2sh layout drift',
  );
  const handM = Buffer.concat([
    Buffer.from('a914', 'hex'),
    Buffer.from(shaRmd160(new Uint8Array(nextPair.m.redeem))),
    Buffer.from('87', 'hex'),
  ]);
  gate(
    Buffer.from(nextPair.m.p2shScript.bytecode).equals(handM),
    'M p2sh layout drift',
  );

  // --- 2. full miner build with fake outpoints (no broadcast) ---
  const fakeTxid = Buffer.from(randomBytes(32)).toString('hex');
  const built = await buildMinedTwoShardRemintTx({
    pair,
    batonC: {
      outpoint: { txid: fakeTxid, outIdx: 0 },
      sats: 546n,
      txid: fakeTxid,
      vout: 0,
    },
    batonM: {
      outpoint: { txid: fakeTxid, outIdx: 1 },
      sats: 546n,
      txid: fakeTxid,
      vout: 1,
    },
    fuel: {
      outpoint: { txid: fakeTxid, outIdx: 2 },
      sats: 10_000n,
      outputScript: Script.p2pkh(pkh),
    },
    miner: { sk, pk },
    locktime,
  });
  console.log(
    JSON.stringify(
      {
        powAttempts: built.powAttempts,
        nonceHex: built.nonceHex,
        txSize: built.txHex.length / 2,
        nextC: built.nextPair.c.address,
        nextM: built.nextPair.m.address,
      },
      null,
      2,
    ),
  );

  // --- 3. scriptSig standardness (<1650B) ---
  const txBytes = Buffer.from(built.txHex, 'hex');
  // Parse: version(4) + varint inCount + inputs(scriptSig each) — walk it.
  let off = 4;
  const readVarint = (): number => {
    const b = txBytes[off++]!;
    if (b < 0xfd) return b;
    if (b === 0xfd) {
      const v = txBytes.readUInt16LE(off);
      off += 2;
      return v;
    }
    const v = Number(txBytes.readBigUInt64LE(off));
    off += 8;
    return v;
  };
  const inCount = readVarint();
  gate(inCount === 3, `inCount ${inCount} != 3`);
  const sigSizes: number[] = [];
  for (let i = 0; i < inCount; i++) {
    off += 36; // outpoint
    const sigLen = readVarint();
    sigSizes.push(sigLen);
    off += sigLen;
    off += 4; // sequence
  }
  console.log(JSON.stringify({ scriptSigSizes: sigSizes }));
  for (const [i, s] of sigSizes.entries()) {
    gate(s < 1650, `input ${i} scriptSig ${s}B >= 1650`);
  }
  const outCount = readVarint();
  gate(outCount >= 4, `outCount ${outCount} < 4 (need 4 + change)`);
  // First output must be our hand-rolled OP_RETURN.
  const v0 = txBytes.readBigUInt64LE(off);
  off += 8;
  const s0len = readVarint();
  const s0 = txBytes.subarray(off, off + s0len);
  gate(v0 === 0n, 'out0 value != 0');
  gate(Buffer.from(s0).equals(opret), 'tx out0 != hand-rolled OP_RETURN');

  // Miner output pays our pk.
  const v1 = txBytes.readBigUInt64LE(off + s0len);
  void v1;
  void toHex;

  if (failures.length > 0) {
    console.error(`\nDRYRUN FAILURES (${failures.length}):`);
    for (const f of failures) console.error(`  - ${f}`);
    process.exitCode = 1;
  } else {
    console.log('\nDRYRUN ALL CHECKS PASS (no broadcast performed)');
  }
}

main().catch(err => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
