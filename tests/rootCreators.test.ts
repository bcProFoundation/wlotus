import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  isKnownRootCreator,
  rememberRootCreator,
  rootCreatorMatch,
} from '../apps/mint-api/src/rootCreators.js';

describe('rootCreators', () => {
  const prev = process.env.MINT_ROOT_CREATORS_PATH;
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'wlotus-root-creators-'));
    process.env.MINT_ROOT_CREATORS_PATH = join(dir, 'root-creators.json');
  });

  afterEach(() => {
    if (prev === undefined) delete process.env.MINT_ROOT_CREATORS_PATH;
    else process.env.MINT_ROOT_CREATORS_PATH = prev;
    rmSync(dir, { recursive: true, force: true });
  });

  it('remembers first creator and matches installId', () => {
    const root = 'a'.repeat(64);
    const installA = 'install-aaaa-bbbb-cccc';
    const installB = 'install-dddd-eeee-ffff';
    expect(rootCreatorMatch(root, installA)).toBeNull();
    rememberRootCreator(root, installA);
    expect(rootCreatorMatch(root, installA)).toBe(true);
    expect(isKnownRootCreator(root, installA)).toBe(true);
    expect(rootCreatorMatch(root, installB)).toBe(false);
    // First writer wins
    rememberRootCreator(root, installB);
    expect(rootCreatorMatch(root, installA)).toBe(true);
  });
});
