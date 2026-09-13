#!/usr/bin/env tsx
/**
 * Consensus-level gate for the hand-assembled single-shard δ (ULOTUS)
 * remint: builds the EXACT tx the miner builds (fake outpoints/keys,
 * real PoW + sigs) and evaluates it with libauth's XEC VM (full P2SH +
 * CODESEPARATOR + Schnorr), plus manual schnorr verification of the
 * covenant sig and successor-attack demos. Offline. No network, no sats.
 *
 * Known libauth gap (documented, covered by parity — same as twoshard):
 * libauth slices coveredBytecode at the wrong offset for CODESEPARATOR
 * inputs, so the trailing CHECKSIG NULLFAILs in-VM even for
 * mainnet-proven ergon (identical sighash construction). The covenant
 * input must sail through everything else and stop ONLY at the trailing
 * sig — asserted by trace position + the ergon parity control — while
 * the sig itself is verified manually over the witness preimage.
 *
 * The v2 payoff, proven here: successor attacks (state reset, day jump,
 * code tamper, econ tamper) must fail BEFORE the separator, proving the
 * Moore-style successor verification is load-bearing — the hole the
 * two-shard research posture left open.
 *
 *   npm run verify-singleshard-vm          # synthetic params (pure gate)
 *   npm run verify-singleshard-vm -- --live # live deployment params (pre-flight)
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
  buildUdeltaScriptSig,
  createSingleShardDeltaContract,
  type SingleShardDeltaParams,
} from '../src/covenant/singleShardDeltaScript.js';
import { buildMinedUdeltaRemintTx } from '../src/miner/remintSingleShard.js';
import { createPowRemintErgonContract } from '../src/covenant/powRemintErgonScript.js';
import { buildMinedErgonRemintTx } from '../src/miner/remintErgon.js';

const sha256 = (b: Uint8Array): Buffer => createHash('sha256').update(b).digest();
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
  let base: SingleShardDeltaParams;
  if (live) {
    const depPath = resolve(process.cwd(), 'deployments/mainnet-ulotus.json');
    if (!existsSync(depPath)) {
      throw new Error('Missing deployments/mainnet-ulotus.json');
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
    const contract = createSingleShardDeltaContract({ ...base });
    const built = await buildMinedUdeltaRemintTx({
      contract,
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
      locktime,
    });
    const decoded = decodeTransaction(hexToBin(built.txHex));
    if (typeof decoded === 'string') throw new Error(decoded);
    const sourceOutputs = [
      {
        lockingBytecode: new Uint8Array(contract.p2shScript.bytecode),
        valueSatoshis: 546n,
      },
      {
        lockingBytecode: new Uint8Array(Script.p2pkh(pkh).bytecode),
        valueSatoshis: 10_000n,
      },
    ];
    const sigs = parseScriptSigs(built.txHex);
    const pushes = splitPushes(sigs[0]!);
    check(
      `k=${dayOff} scriptSig has 6 pushes (nr|pk|s|nonce|pre|redeem)`,
      pushes.length === 6,
      `got ${pushes.length}`,
    );
    const redeemPush = pushes[5]!;
    check(
      `k=${dayOff} P2SH redeem matches UTXO`,
      Buffer.from(shaRmd160(new Uint8Array(redeemPush))).equals(
        Buffer.from(contract.scriptHash),
      ),
    );
    check(
      `k=${dayOff} nextRedeem push matches derived successor`,
      Buffer.from(pushes[0]!).equals(Buffer.from(built.nextContract.redeem)),
    );
    const program = { transaction: decoded, sourceOutputs, inputIndex: 0 };
    const st = vm.evaluate(program);
    const trace = vm.debug(program);
    const firstErr = trace.findIndex(s => s.error !== undefined);
    check(
      `k=${dayOff} covenant reaches trailing sig (step ${firstErr}/${trace.length})`,
      /signature verification/.test(st.error ?? '') &&
        firstErr >= trace.length - 3,
      st.error ?? 'fully passed?!',
    );
    const fuel = vm.evaluate({
      transaction: decoded,
      sourceOutputs,
      inputIndex: 1,
    });
    check(
      `k=${dayOff} fuel P2PKH fully passes`,
      fuel.error === undefined,
      fuel.error ?? '',
    );

    // Manual CHECKSIG closure over the exact witness preimage.
    const pre = pushes[4]!;
    const s = pushes[2]!;
    try {
      ecc.schnorrVerify(s.subarray(0, 64), new Uint8Array(sha256d(pre)), pk);
      check(`k=${dayOff} sig valid over witness preimage`, true);
    } catch (e) {
      check(`k=${dayOff} sig valid over witness preimage`, false, String(e));
    }

    // Successor attacks must fail BEFORE the separator (lastCodeSeparator
    // stays -1): the state/code/econ pins are load-bearing.
    if (dayOff === 0) {
      const [honestNr, minerPk, sig65, nonce, preimage, redeem] = pushes as [
        Buffer,
        Buffer,
        Buffer,
        Buffer,
        Buffer,
        Buffer,
      ];
      const rebuildPoison = (badNr: Buffer): string => {
        const sigBuf = buildUdeltaScriptSig({
          nextRedeem: new Uint8Array(badNr),
          minerPk: new Uint8Array(minerPk),
          sig65: new Uint8Array(sig65),
          nonce: new Uint8Array(nonce),
          preimage: new Uint8Array(preimage),
          redeem: new Uint8Array(redeem),
        });
        const tx2 = structuredClone(decoded) as typeof decoded & {
          inputs: { unlockingBytecode: Uint8Array }[];
        };
        tx2.inputs[0]!.unlockingBytecode = new Uint8Array(sigBuf.bytecode);
        const enc = encodeTransaction(tx2);
        if (typeof enc === 'string') throw new Error(enc);
        return binToHex(enc);
      };
      const flip = (b: Buffer, off: number): Buffer => {
        const c = Buffer.from(b);
        c[off]! ^= 0x01;
        return c;
      };
      const poisoned: [string, Buffer][] = [
        [
          'target reset (2^30)',
          createSingleShardDeltaContract({
            ...base,
            tipDay: built.derived.newDay,
            tipTarget: 2 ** 30,
          }).redeem,
        ],
        [
          'day jump (tip+2)',
          createSingleShardDeltaContract({
            ...base,
            tipDay: base.tipDay + 2,
            tipTarget: base.tipTarget,
          }).redeem,
        ],
        ['code byte flip', flip(honestNr, honestNr.length - 10)],
        ['econ byte flip (tokenId)', flip(honestNr, 5)],
      ];
      for (const [name, badNr] of poisoned) {
        const badDecoded = decodeTransaction(hexToBin(rebuildPoison(badNr)));
        if (typeof badDecoded === 'string') throw new Error(badDecoded);
        const bst = vm.evaluate({
          transaction: badDecoded,
          sourceOutputs,
          inputIndex: 0,
        });
        check(
          `successor attack fails pre-separator: ${name}`,
          bst.error !== undefined &&
            !/signature verification/.test(bst.error) &&
            bst.lastCodeSeparator === -1,
          `${bst.error ?? 'NO ERROR?!'} codesep=${bst.lastCodeSeparator}`,
        );
      }
      const honestDecoded = decodeTransaction(hexToBin(rebuildPoison(honestNr)));
      if (typeof honestDecoded === 'string') throw new Error(honestDecoded);
      const hst = vm.evaluate({
        transaction: honestDecoded,
        sourceOutputs,
        inputIndex: 0,
      });
      check(
        'rebuilt-honest control reaches trailing sig',
        /signature verification/.test(hst.error ?? ''),
        hst.error ?? 'fully passed?!',
      );
    }
  }
  // Ergon parity control: mainnet-proven ergon (identical sighash
  // construction) must stop at the same trailing-sig artifact step.
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
