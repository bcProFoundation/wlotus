import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const sync = join(process.cwd(), 'scripts/sync-danaverse-wlotus.sh');

describe('sync-danaverse-wlotus', () => {
  it('copies covenant + web and writes a README', () => {
    const dest = mkdtempSync(join(tmpdir(), 'danaverse-wlotus-'));
    mkdirSync(join(dest, '.git'));
    execFileSync('bash', [sync, dest], {
      env: {
        ...process.env,
        STATUS_URL: 'http://127.0.0.1:9',
        WLOTUS_TOKEN_ID:
          '154d229bab3cf228a2d40b507e1fc5f21a09542ec66776d3e797b455ab77a091',
      },
      stdio: 'pipe',
    });
    const spedn = join(
      dest,
      'contracts/WlotusPowRemintMooreTipTemple.spedn',
    );
    expect(existsSync(spedn)).toBe(true);
    expect(readFileSync(spedn, 'utf8')).toContain(
      'WlotusPowRemintMooreTipTemple',
    );
    expect(existsSync(join(dest, 'apps/web/src/App.tsx'))).toBe(true);
    expect(existsSync(join(dest, 'apps/web/README.md'))).toBe(false);
    expect(existsSync(join(dest, 'apps/mint-api'))).toBe(false);
    const readme = readFileSync(join(dest, 'README.md'), 'utf8');
    expect(readme).toContain('102');
    expect(readme).toContain('154d229bab3cf228');
    expect(existsSync(join(dest, 'LICENSE'))).toBe(true);
  });
});
