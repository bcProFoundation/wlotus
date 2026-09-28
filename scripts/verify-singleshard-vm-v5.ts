#!/usr/bin/env tsx
/**
 * Consensus-level gate for the hand-assembled single-shard δ v5 (durable
 * generation: nBits difficulty, DIV-δ 12%/yr, 64-bit PoW) remint: builds
 * the EXACT tx the miner builds (fake outpoints/keys, real PoW + sigs)
 * and evaluates it with libauth's XEC VM (full P2SH + CODESEPARATOR +
 * Schnorr), plus manual schnorr verification and successor-attack demos.
 * Offline.
 *
 * Known libauth gap (documented, covered by parity — same as v4/twoshard):
 * libauth slices coveredBytecode at the wrong offset for CODESEPARATOR
 * inputs, so the trailing CHECKSIG NULLFAILs in-VM even for
 * mainnet-proven ergon (identical sighash construction). The covenant
 * input must sail through everything else and stop ONLY at the trailing
 * sig — asserted by trace position + the ergon parity control — while
 * the sig itself is verified manually over the witness preimage.
 *
 * The v5 payoff, proven here: honest k=1 AND honest k=7 jumps pass with
 * the SAME single DIV step; honest RENORM passes (m×256, e−1 arm in-VM);
 * honest e=3 passes (offset-head + top-verify lanes); the q=1 boundary
 * mines (m=500000) while the q=0 tip FAILS in-script (terminal HALT —
 * no successor exists); successor attacks (k=0, m reset, off-by-one,
 * wrong-e, slot smuggling, 7-step claiming, code/econ tamper) fail
 * BEFORE the separator.
 *
 *   npm run verify-singleshard-vm-v5          # synthetic (pure gate)
 *   npm run verify-singleshard-vm-v5 -- --live # live pre-flight
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
import { buildUdeltaScriptSig } from '../src/covenant/singleShardDeltaScript.js';
import {
  createSingleShardDeltaContractV5,
  type SingleShardDeltaV5Params,
} from '../src/covenant/singleShardDeltaScriptV5.js';
import { UDELTA_V5_DELTA_K } from '../src/covenant/singleShardDeltaMathV5.js';
import { buildMinedUdeltaV5RemintTx } from '../src/miner/remintSingleShardV5.js';
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

const divStep = (m: number): number =>
  m - Math.floor(m / UDELTA_V5_DELTA_K);
const divSteps = (m: number, n: number): number => {
  let x = m;
  for (let i = 0; i < n; i++) x = divStep(x);
  return x;
};

type DecodedTx = Exclude<ReturnType<typeof decodeTransaction>, string>;

async function main(): Promise<void> {
  const live = process.argv.includes('--live');
  let base: SingleShardDeltaV5Params;
  if (live) {
    const depName = process.env.UDELTA_DEP?.trim() || 'mainnet-v5base.json';
    const depPath = resolve(process.cwd(), 'deployments', depName);
    if (!existsSync(depPath)) {
      throw new Error(`Missing deployments/${depName}`);
    }
    const dep = JSON.parse(readFileSync(depPath, 'utf8'));
    base = {
      tokenId: dep.tokenId,
      mintAtoms: BigInt(dep.mintAtomsPerRemint),
      genesisUnix: dep.genesisUnix,
      daySeconds: dep.daySeconds,
      tipDay: dep.tipDay,
      m: dep.tipM,
      e: dep.tipE,
    };
    console.log(`live pre-flight: tipDay=${base.tipDay} m=${base.m} e=${base.e}`);
  } else {
    base = {
      tokenId:
        'd9004b411d4cbcd2ec16235d506efd6e266186153bd1a2b1db3a1d5118c2ca5b',
      mintAtoms: 100n,
      genesisUnix: 1_784_300_000,
      daySeconds: 600,
      tipDay: 0,
      m: 2 ** 24,
      e: 4,
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

  const flip = (b: Buffer, off: number): Buffer => {
    const c = Buffer.from(b);
    c[off]! ^= 0x01;
    return c;
  };

  /**
   * Run one honest case (build exact miner tx, VM-evaluate, manual sig
   * closure) plus its poison battery. Returns the pushes for custom
   * follow-ups (HALT redeem-swap).
   */
  async function runCase(opts: {
    label: string;
    tip: SingleShardDeltaV5Params;
    dayOff: number;
    poisons: Array<(ctx: {
      honestNr: Buffer;
      derived: { newDay: number; newM: number; newE: number };
    }) => [string, Buffer]>;
  }): Promise<{ pushes: Buffer[]; decoded: DecodedTx }> {
    const { label, tip, dayOff } = opts;
    const locktime = tip.genesisUnix + (tip.tipDay + dayOff) * tip.daySeconds;
    const contract = createSingleShardDeltaContractV5({ ...tip });
    const built = await buildMinedUdeltaV5RemintTx({
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
      `${label} scriptSig has 6 pushes (nr|pk|s|nonce|pre|redeem)`,
      pushes.length === 6,
      `got ${pushes.length}`,
    );
    const redeemPush = pushes[5]!;
    check(
      `${label} P2SH redeem matches UTXO`,
      Buffer.from(shaRmd160(new Uint8Array(redeemPush))).equals(
        Buffer.from(contract.scriptHash),
      ),
    );
    check(
      `${label} nextRedeem push matches derived successor`,
      Buffer.from(pushes[0]!).equals(Buffer.from(built.nextContract.redeem)),
    );
    check(
      `${label} successor ratchets address`,
      built.nextContract.address !== contract.address,
      `${contract.address.slice(0, 20)}… → ${built.nextContract.address.slice(0, 20)}…`,
    );
    const program = { transaction: decoded, sourceOutputs, inputIndex: 0 };
    const st = vm.evaluate(program);
    const trace = vm.debug(program);
    const firstErr = trace.findIndex(s => s.error !== undefined);
    check(
      `${label} covenant reaches trailing sig (step ${firstErr}/${trace.length})`,
      /signature verification/.test(st.error ?? '') &&
        firstErr >= trace.length - 3,
      st.error ?? 'fully passed?!',
    );
    const fuel = vm.evaluate({
      transaction: decoded,
      sourceOutputs,
      inputIndex: 1,
    });
    check(`${label} fuel P2PKH fully passes`, fuel.error === undefined, fuel.error ?? '');

    const pre = pushes[4]!;
    const s = pushes[2]!;
    try {
      ecc.schnorrVerify(s.subarray(0, 64), new Uint8Array(sha256d(pre)), pk);
      check(`${label} sig valid over witness preimage`, true);
    } catch (e) {
      check(`${label} sig valid over witness preimage`, false, String(e));
    }

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
    const derived = {
      newDay: built.derived.newDay,
      newM: built.derived.newM,
      newE: built.derived.newE,
    };
    for (const mk of opts.poisons) {
      const [name, badNr] = mk({ honestNr, derived });
      const badDecoded = decodeTransaction(hexToBin(rebuildPoison(badNr)));
      if (typeof badDecoded === 'string') throw new Error(badDecoded);
      const bst = vm.evaluate({
        transaction: badDecoded,
        sourceOutputs,
        inputIndex: 0,
      });
      check(
        `successor attack fails pre-separator: ${label} / ${name}`,
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
      `rebuilt-honest control reaches trailing sig (${label})`,
      /signature verification/.test(hst.error ?? ''),
      hst.error ?? 'fully passed?!',
    );
    return { pushes, decoded };
  }

  const mkRedeem = (
    tip: SingleShardDeltaV5Params,
    over: Partial<SingleShardDeltaV5Params>,
  ): Buffer =>
    createSingleShardDeltaContractV5({ ...tip, ...over }).redeem as Buffer;

  // Case 1+2: base honest k=1 AND k=7 (skip path, same single DIV step).
  for (const dayOff of [1, 7]) {
    await runCase({
      label: `k=${dayOff}`,
      tip: base,
      dayOff,
      poisons:
        dayOff === 1
          ? [
              () => [
                'k=0 same-state re-mint (now forbidden)',
                mkRedeem(base, {}),
              ],
              ({ derived }) => [
                'm reset (2^30)',
                mkRedeem(base, { tipDay: derived.newDay, m: 2 ** 30, e: 4 }),
              ],
              ({ derived }) => [
                'off-by-one m (exact-step enforcement)',
                mkRedeem(base, {
                  tipDay: derived.newDay,
                  m: derived.newM + 1,
                  e: derived.newE,
                }),
              ],
              ({ derived }) => [
                'wrong-e (e=3, exact-e enforcement)',
                mkRedeem(base, {
                  tipDay: derived.newDay,
                  m: derived.newM,
                  e: 3,
                }),
              ],
              () => [
                'slot jump (tip+2 state, k=1 locktime)',
                mkRedeem(base, { tipDay: base.tipDay + 2, m: base.m, e: base.e }),
              ],
              ({ honestNr }) => ['code byte flip', flip(honestNr, honestNr.length - 10)],
              ({ honestNr }) => ['econ byte flip (tokenId)', flip(honestNr, 5)],
            ]
          : [
              () => [
                'k=7 claiming 7 DIV steps (one-step-per-block)',
                mkRedeem(base, {
                  tipDay: base.tipDay + 7,
                  m: divSteps(base.m, 7),
                  e: base.e,
                }),
              ],
              ({ derived }) => [
                'k=7 smuggling k=1 state (slot-commitment)',
                mkRedeem(base, {
                  tipDay: base.tipDay + 1,
                  m: derived.newM,
                  e: derived.newE,
                }),
              ],
            ],
    });
  }

  if (!live) {
    // Case 3: renorm honest (crossing tip exercises the IF arm in-VM).
    const mCross = 2 ** 23 + 10;
    const qCross = Math.floor(mCross / UDELTA_V5_DELTA_K);
    const mRenorm = (mCross - qCross) * 256;
    await runCase({
      label: 'renorm',
      tip: { ...base, tipDay: 50, m: mCross, e: 4 },
      dayOff: 1,
      poisons: [
        () => [
          'non-renorm successor (m1, e=4 — arm enforcement)',
          mkRedeem(base, { tipDay: 51, m: mCross - qCross, e: 4 }),
        ],
        () => [
          'renorm off-by-one (m×256+1)',
          mkRedeem(base, { tipDay: 51, m: mRenorm + 1, e: 3 }),
        ],
      ],
    });

    // Case 4: e=3 honest (offset head + top-verify lanes at 2^-10, fast).
    await runCase({
      label: 'e=3',
      tip: { ...base, tipDay: 20, m: 2 ** 30, e: 3 },
      dayOff: 1,
      poisons: [
        ({ derived }) => [
          'wrong-e at e<4 (e=4, exact-e enforcement)',
          mkRedeem(base, { tipDay: 21, m: derived.newM, e: 4 }),
        ],
        ({ derived }) => [
          'off-by-one m at e=3',
          mkRedeem(base, { tipDay: 21, m: derived.newM + 1, e: 3 }),
        ],
      ],
    });

    // Case 5: q=1 boundary mines; q=0 tip HALTS in-script (terminal proof).
    const b5 = await runCase({
      label: 'q=1-boundary',
      tip: { ...base, tipDay: 30, m: 500_000, e: 4 },
      dayOff: 1,
      poisons: [],
    });
    {
      // Redeem-swap: same CODE (preimage-compatible), halt-tip state
      // (m=K−1, e=0 → q=0). Script must VERIFY-fail in phase 3, long
      // before the separator — no successor exists, whatever the nonce.
      const haltTip: SingleShardDeltaV5Params = {
        ...base,
        tipDay: 30,
        m: UDELTA_V5_DELTA_K - 1,
        e: 0,
      };
      const haltContract = createSingleShardDeltaContractV5(haltTip);
      const [hNr, hPk, hSig, hNonce, hPre] = b5.pushes as [
        Buffer,
        Buffer,
        Buffer,
        Buffer,
        Buffer,
      ];
      const sigBuf = buildUdeltaScriptSig({
        nextRedeem: new Uint8Array(hNr),
        minerPk: new Uint8Array(hPk),
        sig65: new Uint8Array(hSig),
        nonce: new Uint8Array(hNonce),
        preimage: new Uint8Array(hPre),
        redeem: new Uint8Array(haltContract.redeem),
      });
      const txHalt = structuredClone(b5.decoded) as typeof b5.decoded & {
        inputs: { unlockingBytecode: Uint8Array }[];
      };
      txHalt.inputs[0]!.unlockingBytecode = new Uint8Array(sigBuf.bytecode);
      const encHalt = encodeTransaction(txHalt);
      if (typeof encHalt === 'string') throw new Error(encHalt);
      const haltDecoded = decodeTransaction(hexToBin(binToHex(encHalt)));
      if (typeof haltDecoded === 'string') throw new Error(haltDecoded);
      const haltSrc = [
        {
          lockingBytecode: new Uint8Array(haltContract.p2shScript.bytecode),
          valueSatoshis: 546n,
        },
        {
          lockingBytecode: new Uint8Array(Script.p2pkh(pkh).bytecode),
          valueSatoshis: 10_000n,
        },
      ];
      const hst = vm.evaluate({
        transaction: haltDecoded,
        sourceOutputs: haltSrc,
        inputIndex: 0,
      });
      check(
        'HALT-terminal: q=0 tip fails pre-separator (no successor exists)',
        hst.error !== undefined &&
          !/signature verification/.test(hst.error) &&
          hst.lastCodeSeparator === -1,
        `${hst.error ?? 'NO ERROR?!'} codesep=${hst.lastCodeSeparator}`,
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
