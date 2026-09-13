import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';

describe('local pilot dev command', () => {
  it('exposes one command for the merchant admin to guest WebXR flow', async () => {
    const packageJson = JSON.parse(
      await readFile(new URL('../../../package.json', import.meta.url), 'utf8'),
    ) as { scripts?: Record<string, string> };

    assert.equal(
      packageJson.scripts?.['dev:pilot'],
      'node scripts/dev-pilot-flow.mjs',
    );
  });
});
