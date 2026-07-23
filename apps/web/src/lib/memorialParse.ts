/**
 * Parse DANA memorial EMPP from output scripts (pure — no Chronik / Vite env).
 */

import { fromHex, parseEmppScript, Script } from 'ecash-lib';
import {
  parseMemorialPushdata,
  type MemorialFields,
} from '../../../../src/offering/wlbrMemorial.js';

/** Find DANA memorial (v1/v2) among EMPP pushes; skip tip ads (v4). */
export function memorialFromEmppPushes(
  pushes: Uint8Array[],
): MemorialFields | null {
  for (const push of pushes) {
    if (push.length < 5) continue;
    // DANA tip v4 is fixed 15 bytes — skip; memorials use ver 1/2.
    if (push.length === 15 && push[4] === 4) continue;
    try {
      const parsed = parseMemorialPushdata(push);
      if (parsed.version === 1 || parsed.version === 2) return parsed;
    } catch {
      /* not a memorial push */
    }
  }
  return null;
}

export function memorialFromOutputScriptHex(
  outputScriptHex: string,
): MemorialFields | null {
  try {
    const script = new Script(fromHex(outputScriptHex));
    const pushes = parseEmppScript(script);
    if (!pushes?.length) return null;
    return memorialFromEmppPushes(pushes);
  } catch {
    return null;
  }
}
