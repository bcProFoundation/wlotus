import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const inject = join(
  process.cwd(),
  'deploy/contabo/inject-nginx-hardening-include.py',
);

const SAMPLE = `
server {
    listen 443 ssl;
    server_name test.wlotus.org;
    location /api/ {
        proxy_pass http://127.0.0.1:8787;
    }
}
`;

describe('inject-nginx-hardening-include', () => {
  it('inserts the include before location /api/', () => {
    const dir = mkdtempSync(join(tmpdir(), 'wl-nginx-'));
    const file = join(dir, 'site.conf');
    writeFileSync(file, SAMPLE);
    execFileSync('python3', [inject, file], { stdio: 'pipe' });
    const out = readFileSync(file, 'utf8');
    expect(out).toContain(
      'include /etc/nginx/snippets/wlotus-hardening.conf;',
    );
    expect(out.indexOf('include /etc/nginx/snippets')).toBeLessThan(
      out.indexOf('location /api/'),
    );
  });

  it('is idempotent and skips inlined challenge locations', () => {
    const dir = mkdtempSync(join(tmpdir(), 'wl-nginx-'));
    const file = join(dir, 'site.conf');
    writeFileSync(
      file,
      SAMPLE.replace(
        'location /api/',
        'location = /api/challenge { return 429; }\n    location /api/',
      ),
    );
    execFileSync('python3', [inject, file], { stdio: 'pipe' });
    expect(readFileSync(file, 'utf8')).not.toContain(
      'wlotus-hardening.conf',
    );
  });
});
