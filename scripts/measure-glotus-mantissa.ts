#!/usr/bin/env tsx
/**
 * Compile GLotus MooreTip variants and report redeem size / non-push ops.
 *
 * Limits: P2SH redeem ≤520, eCash MAX_OPS_PER_SCRIPT = 201 (opcode > OP_16).
 * Does not broadcast. Table bytes are code literals (econHead stays 85).
 */
import { readFileSync } from 'node:fs';
import { Spedn } from '@spedn/sdk';
import { ModuleFactory } from '@spedn/rts';
import { BchJsRts } from '@spedn/rts-bchjs';
import { fromHexRev } from 'ecash-lib';

const MAX_OPS = 201;
const MAX_REDEEM = 520;

const POW_WHOLE_BYTE = `        [byte] solhash = hash256(sha256(preimage) . nonce);
        ([byte] zpref, _) = solhash @ (bits / 8);
        verify bin2num(zpref) == 0;`;

const POW_REM_BITS = `        [byte] solhash = hash256(sha256(preimage) . nonce);
        int zeroBytes = bits / 8;
        int remBits = bits % 8;

        ([byte] prefix, [byte] rest) = solhash @ zeroBytes;
        verify bin2num(prefix) == 0;

        if (remBits == 1) {
            ([byte] nextByte, _) = rest @ 1;
            verify bin2num(nextByte) < 128;
        } else {
            if (remBits != 0) {
                ([byte] nextByte, _) = rest @ 1;
                [byte] limits = 0x402010080402;
                (_, [byte] limTail) = limits @ (remBits - 2);
                ([byte] limB, _) = limTail @ 1;
                verify bin2num(nextByte) < bin2num(limB);
            }
        }`;

/** 8×2-byte LE thresholds (MSB-safe) spanning one doubling; slot 0..7. */
/** Felt +1 bit via 8×2-byte LE thresholds (no IF, no Mul). remBits=0 limit is 256. */
const POW_REM_BITS_FLAT = `        [byte] solhash = hash256(sha256(preimage) . nonce);
        int remBits = bits % 8;
        ([byte] prefix, [byte] rest) = solhash @ (bits / 8);
        verify bin2num(prefix) == 0;
        ([byte] nextByte, _) = rest @ 1;
        [byte] next2 = nextByte . 0x00;
        [byte] limits = 0x00018000400020001000080004000200;
        int limOff = remBits + remBits;
        (_, [byte] limTail) = limits @ limOff;
        ([byte] limB, _) = limTail @ 2;
        verify bin2num(next2) < bin2num(limB);`;

/** remBitsFlat + half-era (2-slot) using leftover ops if any. */
const POW_REM_BITS_FLAT_SLOT2 = `        [byte] solhash = hash256(sha256(preimage) . nonce);
        int remBits = bits % 8;
        ([byte] prefix, [byte] rest) = solhash @ (bits / 8);
        verify bin2num(prefix) == 0;
        ([byte] nextByte, _) = rest @ 1;
        [byte] next2 = nextByte . 0x00;
        [byte] limits = 0x00018000400020001000080004000200;
        int limOff = remBits + remBits;
        (_, [byte] limTail) = limits @ limOff;
        ([byte] limB, _) = limTail @ 2;
        verify bin2num(next2) < bin2num(limB);
        int within = (locktime - genesisUnix) % secondsPerExtraBit;
        int half = secondsPerExtraBit / 2;
        if (within >= half) {
            verify bin2num(next2) < 181;
        }`;

const POW_REM_BITS_PLUS_SLOT8X2 = `        [byte] solhash = hash256(sha256(preimage) . nonce);
        int remBits = bits % 8;
        int within = (locktime - genesisUnix) % secondsPerExtraBit;
        int w2 = within + within;
        int w4 = w2 + w2;
        int w8 = w4 + w4;
        int slotOff = w8 / secondsPerExtraBit;
        verify slotOff >= 0;
        verify slotOff <= 7;

        ([byte] prefix, [byte] rest) = solhash @ (bits / 8);
        verify bin2num(prefix) == 0;
        ([byte] nextByte, _) = rest @ 1;
        [byte] next2 = nextByte . 0x00;
        [byte] limits = 0x00018000400020001000080004000200;
        int limOff = remBits + remBits;
        (_, [byte] limTail) = limits @ limOff;
        ([byte] limB, _) = limTail @ 2;
        verify bin2num(next2) < bin2num(limB);

        int mantOff = slotOff + slotOff;
        [byte] mant = 0xea00d600c400b400a60099008d008000;
        (_, [byte] mantTail) = mant @ mantOff;
        ([byte] mantB, _) = mantTail @ 2;
        verify bin2num(next2) < bin2num(mantB);`;

const POW_SLOT8X2_KEEP_WHOLE_BYTE = `        int within = (locktime - genesisUnix) % secondsPerExtraBit;
        int w2 = within + within;
        int w4 = w2 + w2;
        int w8 = w4 + w4;
        int slotOff = w8 / secondsPerExtraBit;
        verify slotOff >= 0;
        verify slotOff <= 7;

        [byte] solhash = hash256(sha256(preimage) . nonce);
        ([byte] zpref, [byte] rest) = solhash @ (bits / 8);
        verify bin2num(zpref) == 0;
        ([byte] nextByte, _) = rest @ 1;
        [byte] next2 = nextByte . 0x00;
        int mantOff = slotOff + slotOff;
        [byte] mant = 0xea00d600c400b400a60099008d008000;
        (_, [byte] mantTail) = mant @ mantOff;
        ([byte] mantB, _) = mantTail @ 2;
        verify bin2num(next2) < bin2num(mantB);`;

const DANA_OPRETURN = `        [byte] danaTip =
            0x44414e41 .
            0x04 .
            num2bin(bits, 2) .
            num2bin(extraBits, 4) .
            num2bin(locktime, 4);

        [byte] mintSection =
            0x534c503200044d494e54 .
            tokenIdRev .
            0x01 .
            mintAtomsLe .
            0x01;

        [byte] opReturnScript =
            0x6a50 .
            num2bin(size(danaTip), 1) .
            danaTip .
            num2bin(size(mintSection), 1) .
            mintSection;`;

const ALP_ONLY_OPRETURN = `        [byte] mintSection =
            0x534c503200044d494e54 .
            tokenIdRev .
            0x01 .
            mintAtomsLe .
            0x01;

        [byte] opReturnScript =
            0x6a50 .
            num2bin(size(mintSection), 1) .
            mintSection;`;

function countOps(script: Buffer) {
  let ops = 0;
  let i = 0;
  while (i < script.length) {
    const op = script[i]!;
    if (op > 0x60) ops++;
    if (op > 0 && op < 0x4c) i += 1 + op;
    else if (op === 0x4c) i += 2 + script[i + 1]!;
    else if (op === 0x4d) i += 3 + (script[i + 1]! | (script[i + 2]! << 8));
    else i += 1;
  }
  return ops;
}

function u32(n: number) {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n >>> 0, 0);
  return b;
}

function applyPow(src: string, pow: string): string {
  const start = src.indexOf('        [byte] solhash = hash256');
  const end = src.indexOf('        // Hard-bind nextRedeem');
  if (start < 0 || end < 0 || end <= start) {
    throw new Error('could not locate PoW block in MooreTip source');
  }
  return src.slice(0, start) + pow + '\n\n' + src.slice(end);
}

function applyOpReturn(src: string, opReturn: string): string {
  const start = src.indexOf('        [byte] danaTip =');
  const end = src.indexOf('        [byte] out0 =');
  if (start < 0 || end < 0 || end <= start) {
    throw new Error('could not locate OP_RETURN block in MooreTip source');
  }
  return src.slice(0, start) + opReturn + '\n\n' + src.slice(end);
}

function dropWholeByteGuard(src: string): string {
  return src.replace(/\s*verify bits % 8 == 0;\n/, '\n');
}

type Variant = {
  id: string;
  note: string;
  pow: string;
  opReturn: string;
  dropByteGuard: boolean;
};

const VARIANTS: Variant[] = [
  {
    id: 'baseline-mooreTip',
    note: 'Live GLotus-shaped MooreTip (whole-byte, DANA tip)',
    pow: POW_WHOLE_BYTE,
    opReturn: DANA_OPRETURN,
    dropByteGuard: false,
  },
  {
    id: 'remBits-dana',
    note: 'Restore felt +1 bit (2×); keep DANA tip + hard next-P2SH',
    pow: POW_REM_BITS,
    opReturn: DANA_OPRETURN,
    dropByteGuard: true,
  },
  {
    id: 'remBits-alpOnly',
    note: 'Felt +1 bit; drop extra EMPP DANA tip (ALP MINT only)',
    pow: POW_REM_BITS,
    opReturn: ALP_ONLY_OPRETURN,
    dropByteGuard: true,
  },
  {
    id: 'slot8x2-wholeByte-dana',
    note: '8×2B mantissa, keep whole-byte guard (control: table cost only)',
    pow: POW_SLOT8X2_KEEP_WHOLE_BYTE,
    opReturn: DANA_OPRETURN,
    dropByteGuard: false,
  },
  {
    id: 'remBitsFlat-dana',
    note: 'Felt +1 bit via 8×2B table (no IF); DANA tip',
    pow: POW_REM_BITS_FLAT,
    opReturn: DANA_OPRETURN,
    dropByteGuard: true,
  },
  {
    id: 'remBitsFlat-alpOnly',
    note: 'Felt +1 bit via 8×2B table (no IF); ALP MINT only',
    pow: POW_REM_BITS_FLAT,
    opReturn: ALP_ONLY_OPRETURN,
    dropByteGuard: true,
  },
  {
    id: 'remBitsFlat-slot2-alpOnly',
    note: 'Felt +1 bit + half-era 2-slot; ALP MINT only',
    pow: POW_REM_BITS_FLAT_SLOT2,
    opReturn: ALP_ONLY_OPRETURN,
    dropByteGuard: true,
  },
  {
    id: 'remBits-slot8x2-dana',
    note: 'Felt +1 bit + 8×2B intra-era mantissa; DANA tip',
    pow: POW_REM_BITS_PLUS_SLOT8X2,
    opReturn: DANA_OPRETURN,
    dropByteGuard: true,
  },
  {
    id: 'remBits-slot8x2-alpOnly',
    note: 'Felt +1 bit + 8×2B mantissa; ALP MINT only',
    pow: POW_REM_BITS_PLUS_SLOT8X2,
    opReturn: ALP_ONLY_OPRETURN,
    dropByteGuard: true,
  },
];

async function measureOne(
  spedn: Spedn,
  baseSrc: string,
  v: Variant,
): Promise<Record<string, unknown>> {
  let src = applyPow(baseSrc, v.pow);
  src = applyOpReturn(src, v.opReturn);
  if (v.dropByteGuard) src = dropWholeByteGuard(src);
  src = src.replace(
    'contract WlotusPowRemintMooreTip(',
    `contract GlotusMeasure(`,
  );

  try {
    const portable = await spedn.compileCode('xec', src);
    const factory = new ModuleFactory(new BchJsRts('mainnet'));
    const Ctor = factory.make(portable).GlotusMeasure;
    const z = Buffer.alloc(32, 0);
    const inst = new Ctor({
      tokenIdRev: Buffer.from(
        fromHexRev(
          'd9004b411d4cbcd2ec16235d506efd6e266186153bd1a2b1db3a1d5118c2ca5b',
        ),
      ),
      mintAtomsLe: Buffer.alloc(6, 0),
      genesisUnixLe: u32(1000),
      baseZeroBitsBin: Buffer.from([0]),
      secondsPerExtraBitLe: u32(845 * 86_400),
      codeHash: z,
      prefixHash: z,
      tipLocktimeLe: u32(1000),
    });
    const redeem = Buffer.from(inst.redeemScript as Buffer);
    const ops = countOps(redeem);
    return {
      id: v.id,
      note: v.note,
      compile: 'ok',
      redeemLen: redeem.length,
      ops,
      under201: ops <= MAX_OPS,
      under520: redeem.length <= MAX_REDEEM,
      headroomOps: MAX_OPS - ops,
      headroomBytes: MAX_REDEEM - redeem.length,
      feasible: ops <= MAX_OPS && redeem.length <= MAX_REDEEM,
    };
  } catch (err) {
    return {
      id: v.id,
      note: v.note,
      compile: 'fail',
      error: err instanceof Error ? err.message : JSON.stringify(err),
      feasible: false,
    };
  }
}

async function main() {
  const baseSrc = readFileSync(
    'contracts/WlotusPowRemintMooreTip.spedn',
    'utf8',
  );
  const spedn = new Spedn();
  try {
    const rows = [];
    for (const v of VARIANTS) {
      rows.push(await measureOne(spedn, baseSrc, v));
    }
    console.log(JSON.stringify({ maxOps: MAX_OPS, maxRedeem: MAX_REDEEM, rows }, null, 2));
  } finally {
    spedn.dispose();
  }
}

main().catch(err => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
