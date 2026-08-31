/**
 * Soft temple sink for felt (no-covenant-tax) WLotus.
 * Leftover miner atoms after the memorial burn are sent here. Listing
 * requires at least {@link WLOTUS_SOFT_TEMPLE_ATOMS} on that output.
 */
import { Address, Script, fromHex, toHex } from 'ecash-lib';
import { WLOTUS_SOFT_TEMPLE_ATOMS } from '../params/wlotusMint.js';

export { WLOTUS_SOFT_TEMPLE_ATOMS };

export interface TempleSink {
  script: Script;
  address: string;
  type: 'p2pkh' | 'p2sh';
}

export function scriptFromCashAddress(raw: string): TempleSink {
  const addr = Address.parse(raw.trim());
  const hashHex =
    typeof addr.hash === 'string' ? addr.hash : toHex(addr.hash);
  if (hashHex.length !== 40 || !/^[0-9a-fA-F]{40}$/.test(hashHex)) {
    throw new Error(`Address hash must be 20 bytes (got ${hashHex.length / 2})`);
  }
  if (addr.type === 'p2pkh') {
    return {
      script: Script.p2pkh(fromHex(hashHex)),
      address: addr.toString(),
      type: 'p2pkh',
    };
  }
  if (addr.type === 'p2sh') {
    return {
      script: Script.p2sh(fromHex(hashHex)),
      address: addr.toString(),
      type: 'p2sh',
    };
  }
  throw new Error(
    `TEMPLE_ADDRESS must be P2PKH or P2SH (got ${addr.type})`,
  );
}

/** `TEMPLE_ADDRESS=ecash:q…|p…`. Null when unset. */
export function resolveTempleSinkFromEnv(
  env: Record<string, string | undefined> = process.env,
): TempleSink | null {
  const raw = env.TEMPLE_ADDRESS?.trim();
  if (!raw) return null;
  return scriptFromCashAddress(raw);
}

export function assertSoftTempleInventory(inventoryAtoms: bigint): void {
  if (inventoryAtoms < WLOTUS_SOFT_TEMPLE_ATOMS) {
    throw new Error(
      `Offering must send ≥ ${WLOTUS_SOFT_TEMPLE_ATOMS} WLOTUS to the temple ` +
        `address with the burn (have leftover ${inventoryAtoms})`,
    );
  }
}
