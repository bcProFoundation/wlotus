import { readFileSync } from 'node:fs';
import { Spedn } from '@spedn/sdk';
import { ModuleFactory } from '@spedn/rts';
import { BchJsRts } from '@spedn/rts-bchjs';
import { fromHexRev } from 'ecash-lib';

async function compile(
  spedn: Spedn,
  file: string,
  name: string,
  args: Record<string, Buffer>,
): Promise<Buffer> {
  const code = readFileSync(`contracts/${file}`, 'utf8');
  const portable = await spedn.compileCode('xec', code);
  const factory = new ModuleFactory(new BchJsRts('mainnet'));
  const Ctor = factory.make(portable)[name];
  const inst = new Ctor(args);
  return Buffer.from(inst.redeemScript as Buffer);
}

async function main(): Promise<void> {
  const spedn = new Spedn();
  try {
    const tokenIdRev = Buffer.from(
      fromHexRev(
        'd9004b411d4cbcd2ec16235d506efd6e266186153bd1a2b1db3a1d5118c2ca5b',
      ),
    );
    const u32 = (n: number): Buffer => {
      const b = Buffer.alloc(4);
      b.writeUInt32LE(n >>> 0, 0);
      return b;
    };
    // Live ergon (proven on mainnet)
    const ergon = await compile(spedn, 'WlotusPowRemintErgon.spedn', 'WlotusPowRemintErgon', {
      tokenIdRev,
      mintAtomsLe: Buffer.alloc(6, 0),
      genesisUnix: 1000,
      daySeconds: 86400,
      targetTable: Buffer.alloc(8, 0),
    });
    console.log('ergon tail:', ergon.subarray(-30).toString('hex'));
    // C shard
    const c = await compile(spedn, 'GlotusComputeShard.spedn', 'GlotusComputeShard', {
      tokenIdRev,
      mintAtomsLe: Buffer.alloc(6, 0),
      genesisUnixLe: u32(1000),
      daySecondsLe: u32(86400),
      tipDayLe: u32(0),
      tipTargetLe: u32(2 ** 24),
    });
    console.log('C tail:    ', c.subarray(-30).toString('hex'));
    // M shard
    const m = await compile(spedn, 'GlotusMintShard.spedn', 'GlotusMintShard', {
      tokenIdRev,
      mintAtomsLe: Buffer.alloc(6, 0),
    });
    console.log('M tail:    ', m.subarray(-30).toString('hex'));
  } finally {
    spedn.dispose();
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
