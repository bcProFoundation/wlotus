#!/usr/bin/env tsx
/**
 * Consensus-level gate for the two-shard (C+M) remint: builds the EXACT tx
 * the miner builds (fake outpoints/keys, real PoW + sigs) and evaluates it
 * with libauth's XEC VM (full P2SH + CODESEPARATOR + Schnorr), plus manual
 * schnorr verification of the covenant sigs. Offline. No network, no sats.
 *
 * Genesis 1–3 postmortem: static gates (measure/dryrun) check BYTES, not
 * consensus — they missed a bare-0x00 OP_0 mistranslation (outputs pin
 * could never pass) and a P2SH redeem mismatch (RTS body vs full redeem).
 * This gate executes the scripts, so both bug classes fail loudly here.
 *
 * Known libauth gap (documented, covered by parity): libauth slices
 * coveredBytecode at the wrong offset for CODESEPARATOR inputs, so the
 * trailing CHECKSIG NULLFAILs in-VM even for mainnet-proven ergon (which
 * uses the identical sighash construction). Covenant inputs are therefore
 * required to sail through everything else and stop ONLY at the trailing
 * sig — asserted by trace position + the ergon parity control — while the
 * sigs themselves are verified manually over the exact witness preimages
 * (whose outputs/locktime fields the pins already proved, scriptCode via
 * the single-separator assert, remainder via the P2PKH pass).
 *
 *   npm run verify-twoshard-vm          # synthetic params (pure gate)
 *   npm run verify-twoshard-vm -- --live # live deployment params (pre-flight)
 */
import { randomBytes, createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  binToHex,
  createVirtualMachineXEC,
  decodeTransaction,
  encodeTransaction,
  hexToBin,
} from '@bitauth/libauth';
import { Ecc, Script, shaRmd160 } from 'ecash-lib';
import {
  createTwoShardPair,
  type TwoShardShardParams,
} from '../src/covenant/twoShardScript.js';
import { buildMinedTwoShardRemintTx } from '../src/miner/remintTwoShard.js';
import { createPowRemintErgonContract } from '../src/covenant/powRemintErgonScript.js';
import { buildMinedErgonRemintTx } from '../src/miner/remintErgon.js';

const sha256 = (b: Uint8Array): Buffer =>
  createHash('sha256').update(b).digest();
const sha256d = (b: Uint8Array): Buffer => sha256(sha256(b));

let failures = 0;
function check(name: string, cond: boolean, extra = ''): void {
  if (!cond) failures++;
  console.log(`${cond ? 'PASS' : 'FAIL'}: ${name}${extra ? ` — ${extra}` : ''}`);
}

function parseScriptSigs(hex: string): Buffer[] {
  const tx = Buffer.from(hex, 'hex');
  let off = 4;
  const rv = (): number => {
    const b = tx[off++]!;
    if (b < 0xfd) return b;
    if (b === 0xfd) {
      const v = tx.readUInt16LE(off);
      off += 2;
      return v;
    }
    const v = Number(tx.readBigUInt64LE(off));
    off += 8;
    return v;
  };
  const nIn = rv();
  const out: Buffer[] = [];
  for (let i = 0; i < nIn; i++) {
    off += 36;
    const l = rv();
    out.push(tx.subarray(off, off + l));
    off += l + 4;
  }
  return out;
}

/** Split a push-only scriptSig (incl. OP_0..OP_16 small-int pushes). */
function splitPushes(scriptSig: Buffer): Buffer[] {
  const out: Buffer[] = [];
  let i = 0;
  while (i < scriptSig.length) {
    const op = scriptSig[i++]!;
    if (op === 0) {
      out.push(Buffer.alloc(0));
      continue;
    }
    if (op >= 0x51 && op <= 0x60) {
      out.push(Buffer.from([op - 0x50]));
      continue;
    }
    if (op >= 1 && op <= 75) {
      out.push(scriptSig.subarray(i, i + op));
      i += op;
      continue;
    }
    if (op === 0x4c) {
      const l = scriptSig[i++]!;
      out.push(scriptSig.subarray(i, i + l));
      i += l;
      continue;
    }
    if (op === 0x4d) {
      const l = scriptSig.readUInt16LE(i);
      i += 2;
      out.push(scriptSig.subarray(i, i + l));
      i += l;
      continue;
    }
    throw new Error(`non-push opcode 0x${op.toString(16)} in scriptSig`);
  }
  return out;
}

async function main(): Promise<void> {
  const live = process.argv.includes('--live');
  let base: TwoShardShardParams;
  if (live) {
    const depPath = resolve(
      process.cwd(),
      'deployments/mainnet-twoshard-shard.json',
    );
    if (!existsSync(depPath)) {
      throw new Error('Missing deployments/mainnet-twoshard-shard.json');
    }
    const dep = JSON.parse(readFileSync(depPath, 'utf8'));
    base = {
      tokenId: dep.tokenId,
      mintAtoms: BigInt(dep.mintAtomsPerRemint),
      genesisUnix: dep.genesisUnix,
      daySeconds: dep.daySeconds,
      genesisTarget: dep.genesisTarget,
      tipDay: dep.tipDay,
      tipTarget: dep.tipTarget,
    };
    console.log(`live pre-flight: tipDay=${base.tipDay} target=${base.tipTarget}`);
  } else {
    base = {
      tokenId:
        'd9004b411d4cbcd2ec16235d506efd6e266186153bd1a2b1db3a1d5118c2ca5b',
      mintAtoms: 100n,
      genesisUnix: 1_784_300_000,
      daySeconds: 86_400,
      genesisTarget: 2 ** 24,
      tipDay: 0,
      tipTarget: 2 ** 24,
    };
  }

  const ecc = new Ecc();
  const sk = new Uint8Array(randomBytes(32));
  const pk = ecc.derivePubkey(sk);
  const pkh = shaRmd160(pk);
  const fakeTxid = Buffer.from(randomBytes(32)).toString('hex');
  const vm = createVirtualMachineXEC() as unknown as {
    evaluate(p: unknown): { error?: string; lastCodeSeparator?: number };
    debug(p: unknown): { error?: string }[];
  };

  for (const dayOff of [0, 1]) {
    const locktime = base.genesisUnix + dayOff * base.daySeconds;
    const pair = await createTwoShardPair({ ...base });
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
    const decoded = decodeTransaction(hexToBin(built.txHex));
    if (typeof decoded === 'string') throw new Error(decoded);
    const sourceOutputs = [
      {
        lockingBytecode: new Uint8Array(pair.c.p2shScript.bytecode),
        valueSatoshis: 546n,
      },
      {
        lockingBytecode: new Uint8Array(pair.m.p2shScript.bytecode),
        valueSatoshis: 546n,
      },
      {
        lockingBytecode: new Uint8Array(Script.p2pkh(pkh).bytecode),
        valueSatoshis: 10_000n,
      },
    ];
    const sigs = parseScriptSigs(built.txHex);
    for (const [idx, shard] of [
      [0, pair.c],
      [1, pair.m],
    ] as const) {
      const pushes = splitPushes(sigs[idx]!);
      const redeemPush = pushes[pushes.length - 1]!;
      check(
        `k=${dayOff} input${idx} P2SH redeem matches UTXO`,
        Buffer.from(shaRmd160(new Uint8Array(redeemPush))).equals(
          Buffer.from(shard.scriptHash),
        ),
      );
    }
    for (const inputIndex of [0, 1]) {
      const program = { transaction: decoded, sourceOutputs, inputIndex };
      const st = vm.evaluate(program);
      const trace = vm.debug(program);
      const firstErr = trace.findIndex(s => s.error !== undefined);
      check(
        `k=${dayOff} input${inputIndex} reaches trailing sig (step ${firstErr}/${trace.length})`,
        /signature verification/.test(st.error ?? '') &&
          firstErr >= trace.length - 3,
        st.error ?? 'fully passed?!',
      );
    }
    const fuel = vm.evaluate({
      transaction: decoded,
      sourceOutputs,
      inputIndex: 2,
    });
    check(
      `k=${dayOff} fuel P2PKH fully passes`,
      fuel.error === undefined,
      fuel.error ?? '',
    );

    // Manual CHECKSIG closure over the exact witness preimages.
    const pushesC = splitPushes(sigs[0]!);
    const preC = pushesC[2]!;
    const sc = pushesC[pushesC.length - 2]!;
    try {
      ecc.schnorrVerify(sc.subarray(0, 64), new Uint8Array(sha256d(preC)), pk);
      check(`k=${dayOff} C sig valid over witness preimage`, true);
    } catch (e) {
      check(`k=${dayOff} C sig valid over witness preimage`, false, String(e));
    }
    const pushesM = splitPushes(sigs[1]!);
    const s = pushesM[1]!;
    const ds = pushesM[2]!;
    const preM = pushesM[6]!;
    try {
      ecc.schnorrVerify(s.subarray(0, 64), new Uint8Array(sha256d(preM)), pk);
      check(`k=${dayOff} M sig valid over witness preimage`, true);
    } catch (e) {
      check(`k=${dayOff} M sig valid over witness preimage`, false, String(e));
    }
    try {
      // OP_CHECKDATASIG hashes its message push once more: the covenant
      // passes sha256(preimage), the op signs sha256d(preimage) — the
      // same digest `s` signs (miner reuses rawSig, like ergon).
      ecc.schnorrVerify(new Uint8Array(ds), new Uint8Array(sha256d(preM)), pk);
      check(`k=${dayOff} M datasig valid over sha256d(preimage)`, true);
    } catch (e) {
      check(
        `k=${dayOff} M datasig valid over sha256d(preimage)`,
        false,
        String(e),
      );
    }

    // M must reject poisoned (newDay, newTarget) witnesses EARLY, before
    // its CODESEPARATOR (proves the window/cap are load-bearing: a lone-M
    // mint cannot smuggle far-future days or reset/inflated targets).
    if (dayOff === 0) {
      const pushes = splitPushes(sigs[1]!);
      const [nonce, ms, mds, mminerPk, , , mpre, mnextC, mnextM] = pushes;
      const rebuildPoison = (
        badDay: number | null,
        badTarget: number | null,
      ): string => {
        const sigBuf = pair.m.instance.challenges.remint({
          nonce,
          s: ms,
          ds: mds,
          minerPk: mminerPk,
          newDay: badDay ?? built.derived.newDay,
          newTarget: badTarget ?? built.derived.newTarget,
          preimage: mpre,
          nextCRedeem: mnextC,
          nextMRedeem: mnextM,
        }) as Buffer;
        const tx2 = structuredClone(decoded) as typeof decoded & {
          inputs: { unlockingBytecode: Uint8Array }[];
        };
        tx2.inputs[1]!.unlockingBytecode = new Uint8Array(sigBuf);
        const enc = encodeTransaction(tx2);
        if (typeof enc === 'string') throw new Error(enc);
        return binToHex(enc);
      };
      for (const [name, bd, bt] of [
        ['day far-future (tip+5)', base.tipDay + 5, null],
        ['day rewind (tip-1)', base.tipDay - 1, null],
        ['target reset huge (2^30)', null, 2 ** 30],
        ['target above tip (tip+1)', null, base.tipTarget + 1],
      ] as const) {
        const badDecoded = decodeTransaction(hexToBin(rebuildPoison(bd, bt)));
        if (typeof badDecoded === 'string') throw new Error(badDecoded);
        const st = vm.evaluate({
          transaction: badDecoded,
          sourceOutputs,
          inputIndex: 1,
        });
        check(
          `M rejects ${name} early`,
          st.error !== undefined &&
            !/signature verification/.test(st.error) &&
            st.lastCodeSeparator === -1,
          `${st.error ?? 'NO ERROR?!'} codesep=${st.lastCodeSeparator}`,
        );
      }
      const honestDecoded = decodeTransaction(
        hexToBin(rebuildPoison(null, null)),
      );
      if (typeof honestDecoded === 'string') throw new Error(honestDecoded);
      const stH = vm.evaluate({
        transaction: honestDecoded,
        sourceOutputs,
        inputIndex: 1,
      });
      check(
        'M rebuilt-honest reaches trailing sig',
        /signature verification/.test(stH.error ?? ''),
        stH.error ?? 'fully passed?!',
      );
    }
  }

  // Ergon parity control: mainnet-proven ergon (identical sighash
  // construction) must stop at the same trailing-sig artifact step,
  // proving the artifact is libauth's, not the shards'.
  const ergon = await createPowRemintErgonContract({
    tokenId: base.tokenId,
    mintAtoms: 100n,
    genesisUnix: base.genesisUnix,
    daySeconds: base.daySeconds,
    genesisTarget: 2 ** 24,
  });
  const ebuilt = await buildMinedErgonRemintTx({
    contract: ergon,
    baton: {
      outpoint: { txid: fakeTxid, outIdx: 0 },
      sats: 546n,
      txid: fakeTxid,
      vout: 0,
    },
    fuel: {
      outpoint: { txid: fakeTxid, outIdx: 1 },
      sats: 10_000n,
      outputScript: Script.p2pkh(pkh),
    },
    miner: { sk, pk },
    locktime: base.genesisUnix,
  });
  const edecoded = decodeTransaction(hexToBin(ebuilt.txHex));
  if (typeof edecoded === 'string') throw new Error(edecoded);
  const esrc = [
    {
      lockingBytecode: new Uint8Array(ergon.p2shScript.bytecode),
      valueSatoshis: 546n,
    },
    {
      lockingBytecode: new Uint8Array(Script.p2pkh(pkh).bytecode),
      valueSatoshis: 10_000n,
    },
  ];
  const est = vm.evaluate({
    transaction: edecoded,
    sourceOutputs: esrc,
    inputIndex: 0,
  });
  const etrace = vm.debug({
    transaction: edecoded,
    sourceOutputs: esrc,
    inputIndex: 0,
  });
  const efirst = etrace.findIndex(s => s.error !== undefined);
  check(
    'ergon stops at trailing sig too (artifact parity)',
    /signature verification/.test(est.error ?? '') &&
      efirst >= etrace.length - 3,
    `${est.error} step ${efirst}/${etrace.length}`,
  );
  const efuel = vm.evaluate({
    transaction: edecoded,
    sourceOutputs: esrc,
    inputIndex: 1,
  });
  check('ergon fuel passes', efuel.error === undefined, efuel.error ?? '');

  if (failures > 0) {
    console.error(`\nVM GATE FAILURES (${failures})`);
    process.exitCode = 1;
  } else {
    console.log('\nVM GATE ALL CHECKS GREEN (no broadcast performed)');
  }
}

main().catch(err => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
