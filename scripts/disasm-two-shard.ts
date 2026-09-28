import {
  createTwoShardPair,
  type TwoShardShardParams,
} from '../src/covenant/twoShardScript.js';

const NAMES: Record<number, string> = {
  0x00: 'OP_0', 0x4c: 'PUSHDATA1', 0x4d: 'PUSHDATA2', 0x51: 'OP_1',
  0x63: 'IF', 0x67: 'ELSE', 0x68: 'ENDIF', 0x69: 'VERIFY',
  0x75: 'DROP', 0x76: 'DUP', 0x77: 'NIP', 0x78: 'OVER',
  0x7c: 'SWAP', 0x7d: 'TUCK', 0x7e: 'CAT', 0x7f: 'SPLIT',
  0x80: 'NUM2BIN', 0x82: 'BIN2NUM', 0x87: 'EQUAL', 0x88: 'EQUALVERIFY',
  0x93: 'ADD', 0x94: 'SUB', 0x96: 'DIV', 0x9c: 'NUMEQUAL',
  0x9d: 'NUMEQUALVERIFY', 0x9f: 'LESSTHAN', 0xa0: 'GREATERTHAN',
  0xa8: 'SHA256', 0xa9: 'HASH160', 0xaa: 'HASH256', 0xab: 'SEPARATOR',
  0xac: 'CHECKSIG', 0xba: 'CHECKDATASIG',
};

function histogram(script: Buffer): Map<string, number> {
  const m = new Map<string, number>();
  let i = 0;
  while (i < script.length) {
    const op = script[i]!;
    if (op > 0 && op < 0x4c) i += 1 + op;
    else if (op === 0x4c) i += 2 + script[i + 1]!;
    else if (op === 0x4d) i += 3 + (script[i + 1]! | (script[i + 2]! << 8));
    else {
      if (op > 0x60) {
        const name = NAMES[op] ?? `0x${op.toString(16)}`;
        m.set(name, (m.get(name) ?? 0) + 1);
      }
      i += 1;
    }
  }
  return m;
}

async function main(): Promise<void> {
  const params: TwoShardShardParams = {
    tokenId:
      'd9004b411d4cbcd2ec16235d506efd6e266186153bd1a2b1db3a1d5118c2ca5b',
    mintAtoms: 100n,
    genesisUnix: 1784300000,
    daySeconds: 86400,
    genesisTarget: 2 ** 24,
    tipDay: 0,
    tipTarget: 2 ** 24,
  };
  const pair = await createTwoShardPair(params);
  for (const shard of [pair.c, pair.m]) {
    console.log(`=== shard ${shard.id} bodyLen=${shard.body.length}`);
    const h = histogram(shard.body);
    const rows = [...h.entries()].sort((a, b) => b[1] - a[1]);
    for (const [k, v] of rows) console.log(`  ${k}: ${v}`);
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
