import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { after, describe, it } from 'node:test';

import { createGuestWebxrDevServer } from '../dev-server.ts';

const chromeCandidates = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
];

describe('guest fallback real browser visual smoke', () => {
  const cleanup: (() => Promise<void>)[] = [];

  after(async () => {
    const errors: unknown[] = [];
    for (const dispose of cleanup.reverse()) {
      try { await dispose(); } catch (error) { errors.push(error); }
    }
    if (errors.length) throw new AggregateError(errors, 'visual-smoke-cleanup-failed');
  });

  it('renders fallback guidance in a headless browser with visible layout', async (t) => {
    const browserPath = await findBrowserPath();

    if (!browserPath) {
      t.skip('Chromium-family browser not available for visual smoke');
      return;
    }

    const server = createGuestWebxrDevServer();
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', resolve);
    });
    cleanup.push(
      () =>
        new Promise<void>((resolve, reject) => {
          server.close((error: Error | undefined) => {
            if (error) {
              reject(error);
              return;
            }

            resolve();
          });
        }),
    );

    const address = server.address();
    assert.ok(isAddressInfo(address));

    const userDataDir = await mkdtemp(join(tmpdir(), 'lechigo-guest-visual-smoke-'));
    cleanup.push(() => rm(userDataDir, { force: true, recursive: true, maxRetries: 5, retryDelay: 100 }));

    const browser = await launchChrome(browserPath, userDataDir);
    cleanup.push(async () => {
      if (browser.process.exitCode !== null || browser.process.signalCode !== null) return;
      const closed = once(browser.process, 'close');
      const forceStop = setTimeout(() => browser.process.kill('SIGKILL'), 2000);
      browser.process.kill();
      try { await closed; } finally { clearTimeout(forceStop); }
    });

    const page = await openPage(
      browser.devtoolsUrl,
      `http://127.0.0.1:${address.port}/visual-smoke.html`,
    );
    cleanup.push(async () => {
      page.close();
    });

    await page.send('Page.enable');
    await page.send('Runtime.enable');
    await page.send('Page.navigate', {
      url: `http://127.0.0.1:${address.port}/visual-smoke.html`,
    });
    await page.waitForVisualSmokePass();

    const state = await page.evaluate<{
      result: string | null;
      caseCount: number;
      manualText: string;
      readyText: string;
      manualBox: { width: number; height: number } | null;
      readyBox: { width: number; height: number } | null;
    }>(`
      (() => {
        const result = document.querySelector('[data-visual-smoke-result]');
        const manual = document
          .querySelector('[data-visual-smoke-case="manual-fallback"] lechigo-guest-entry')
          ?.shadowRoot
          ?.querySelector('[data-screen="manual-fallback"]');
        const ready = document
          .querySelector('[data-visual-smoke-case="webxr-ready"] lechigo-guest-entry')
          ?.shadowRoot
          ?.querySelector('[data-screen="ready"]');
        const box = manual?.getBoundingClientRect();
        const readyBox = ready?.getBoundingClientRect();

        return {
          result: result?.getAttribute('data-visual-smoke-result') ?? null,
          caseCount: document.querySelectorAll('[data-visual-smoke-case]').length,
          manualText: manual?.textContent ?? '',
          readyText: ready?.textContent ?? '',
          manualBox: box ? { width: box.width, height: box.height } : null,
          readyBox: readyBox ? { width: readyBox.width, height: readyBox.height } : null,
        };
      })()
    `);

    assert.equal(state.result, 'pass');
    assert.equal(state.caseCount, 4);
    assert.match(state.manualText, /Manual route guidance/);
    assert.match(state.manualText, /Follow the hallway to the restroom/);
    assert.match(state.manualText, /8 meters/);
    assert.match(state.readyText, /Route ready/);
    assert.match(state.readyText, /Destination: Restroom/);
    assert.match(state.readyText, /First step: Follow the hallway to the restroom/);
    assert.ok(state.manualBox);
    assert.ok(state.manualBox.width > 0);
    assert.ok(state.manualBox.height > 0);
    assert.ok(state.readyBox);
    assert.ok(state.readyBox.width > 0);
    assert.ok(state.readyBox.height > 0);

    const screenshot = await page.send<{ data: string }>('Page.captureScreenshot', {
      format: 'png',
    });
    assert.ok(Buffer.from(screenshot.data, 'base64').byteLength > 1024);
  });
});

async function findBrowserPath() {
  for (const candidate of chromeCandidates) {
    try {
      await import('node:fs/promises').then(({ access }) => access(candidate));
      return candidate;
    } catch {
      continue;
    }
  }

  return undefined;
}

async function launchChrome(browserPath: string, userDataDir: string) {
  const chrome = spawn(browserPath, [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--remote-debugging-port=0',
    `--user-data-dir=${userDataDir}`,
    'about:blank',
  ]);

  const devtoolsUrl = await waitForDevtoolsUrl(chrome);
  return {
    process: chrome,
    devtoolsUrl,
  };
}

async function waitForDevtoolsUrl(chrome: ChildProcessWithoutNullStreams) {
  return new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('chrome-devtools-timeout'));
    }, 10_000);

    chrome.stderr.on('data', (chunk: Buffer) => {
      const match = chunk.toString('utf8').match(/DevTools listening on (ws:\/\/\S+)/);

      if (match) {
        clearTimeout(timeout);
        resolve(match[1]);
      }
    });

    chrome.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    chrome.once('exit', (code) => {
      clearTimeout(timeout);
      reject(new Error(`chrome-exited-${code ?? 'signal'}`));
    });
  });
}

async function openPage(devtoolsUrl: string, url: string) {
  const browserEndpoint = new URL(devtoolsUrl);
  const response = await fetch(
    `http://${browserEndpoint.host}/json/new?${encodeURIComponent(url)}`,
    { method: 'PUT' },
  );
  assert.equal(response.status, 200);

  const target = (await response.json()) as { webSocketDebuggerUrl: string };
  return new ChromePage(target.webSocketDebuggerUrl);
}

class ChromePage {
  private nextMessageId = 1;
  private readonly pending = new Map<
    number,
    {
      resolve(value: unknown): void;
      reject(error: Error): void;
    }
  >();
  private readonly socket: WebSocket;

  constructor(url: string) {
    this.socket = new WebSocket(url);
    this.socket.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data)) as {
        id?: number;
        result?: unknown;
        error?: { message: string };
      };

      if (!message.id) {
        return;
      }

      const pending = this.pending.get(message.id);
      this.pending.delete(message.id);

      if (message.error) {
        pending?.reject(new Error(message.error.message));
        return;
      }

      pending?.resolve(message.result);
    });
  }

  async send<T = unknown>(method: string, params: Record<string, unknown> = {}) {
    await this.whenOpen();
    const id = this.nextMessageId++;

    const result = new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: (value) => resolve(value as T),
        reject,
      });
    });

    this.socket.send(
      JSON.stringify({
        id,
        method,
        params,
      }),
    );

    return result;
  }

  async evaluate<T>(expression: string) {
    const response = await this.send<{
      result: {
        value?: T;
      };
    }>('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });

    return response.result.value as T;
  }

  async waitForVisualSmokePass() {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const result = await this.evaluate<string | null>(`
        document
          .querySelector('[data-visual-smoke-result]')
          ?.getAttribute('data-visual-smoke-result') ?? null
      `);

      if (result === 'pass') {
        return;
      }

      if (result === 'fail') {
        const message = await this.evaluate<string>(`
          document.querySelector('[data-visual-smoke-result]')?.textContent ?? ''
        `);
        throw new Error(message);
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    throw new Error('visual-smoke-did-not-complete');
  }

  close() {
    this.socket.close();
  }

  private whenOpen() {
    if (this.socket.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve, reject) => {
      this.socket.addEventListener('open', () => resolve(), { once: true });
      this.socket.addEventListener('error', () => reject(new Error('cdp-socket-error')), {
        once: true,
      });
    });
  }
}

function isAddressInfo(address: string | AddressInfo | null): address is AddressInfo {
  return address !== null && typeof address !== 'string';
}
