import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { stripTypeScriptTypes } from 'node:module';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createApiContext,
  fetchGuestRoute,
  type ApiContext,
} from '../api/src/server.ts';
import { recordPilotRestroomRoute } from '../merchant-admin/src/index.ts';

const currentFile = fileURLToPath(import.meta.url);
const appRoot = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = resolve(appRoot, '../..');

const contentTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'application/javascript; charset=utf-8'],
  ['.mjs', 'application/javascript; charset=utf-8'],
  ['.ts', 'application/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
]);

export function createGuestWebxrDevServer(
  options: { appRoot?: string; repoRoot?: string } = {},
) {
  const resolvedAppRoot = resolve(options.appRoot ?? appRoot);
  const resolvedRepoRoot = resolve(options.repoRoot ?? repoRoot);
  const guestApi = createSeededPilotGuestApi();

  return createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url ?? '/', 'http://localhost');

      if (requestUrl.pathname.startsWith('/api/')) {
        handleApiRequest({
          api: guestApi,
          requestUrl,
          response,
        });
        return;
      }

      const pathname = parseRequestPath(request.url);
      const filePath = resolveRequestPath({
        appRoot: resolvedAppRoot,
        repoRoot: resolvedRepoRoot,
        pathname,
      });
      const source = await readFile(filePath, 'utf8');
      const extension = extname(filePath);
      const body =
        extension === '.ts'
          ? stripTypeScriptTypes(source, { mode: 'strip' })
          : source;

      response.writeHead(200, {
        'content-type': contentTypes.get(extension) ?? 'text/plain; charset=utf-8',
      });
      response.end(body);
    } catch {
      response.writeHead(404, {
        'content-type': 'text/plain; charset=utf-8',
      });
      response.end('Not found');
    }
  });
}

function handleApiRequest(input: {
  api: SeededPilotGuestApi;
  requestUrl: URL;
  response: {
    writeHead(statusCode: number, headers?: Record<string, string>): void;
    end(chunk?: string): void;
  };
}) {
  if (input.requestUrl.pathname === '/api/dev/guest-session') {
    const guestUrl = `/?token=${encodeURIComponent(input.api.token)}`;

    writeJson(input.response, 200, {
      ok: true,
      token: input.api.token,
      expiresAt: input.api.expiresAt,
      url: guestUrl,
      copyUrl: guestUrl,
    });
    return;
  }

  if (input.requestUrl.pathname === '/api/dev/guest-session-url') {
    writeText(
      input.response,
      200,
      `/?token=${encodeURIComponent(input.api.token)}`,
    );
    return;
  }

  if (input.requestUrl.pathname === '/api/guest/routes') {
    const token = input.requestUrl.searchParams.get('token');

    if (!token) {
      writeJson(input.response, 400, {
        ok: false,
        status: 400,
        error: 'token-missing',
      });
      return;
    }

    const result = fetchGuestRoute(input.api.context, { token });
    writeJson(input.response, result.ok ? 200 : result.status, result);
    return;
  }

  writeJson(input.response, 404, {
    ok: false,
    status: 404,
    error: 'api-route-not-found',
  });
}

type SeededPilotGuestApi = {
  context: ApiContext;
  token: string;
  expiresAt: string;
};

function createSeededPilotGuestApi(): SeededPilotGuestApi {
  const context = createApiContext({
    signingSecret: 'local-dev-pilot-secret',
    now: () => '2026-09-01T10:00:00.000Z',
  });
  const recording = recordPilotRestroomRoute(context);

  return {
    context,
    token: recording.token,
    expiresAt: recording.expiresAt,
  };
}

function writeJson(
  response: {
    writeHead(statusCode: number, headers?: Record<string, string>): void;
    end(chunk?: string): void;
  },
  status: number,
  body: unknown,
) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
  });
  response.end(JSON.stringify(body));
}

function writeText(
  response: {
    writeHead(statusCode: number, headers?: Record<string, string>): void;
    end(chunk?: string): void;
  },
  status: number,
  body: string,
) {
  response.writeHead(status, {
    'content-type': 'text/plain; charset=utf-8',
  });
  response.end(body);
}

function parseRequestPath(url: string | undefined) {
  const parsed = new URL(url ?? '/', 'http://localhost');
  return parsed.pathname === '/' ? '/index.html' : parsed.pathname;
}

function resolveRequestPath(input: {
  appRoot: string;
  repoRoot: string;
  pathname: string;
}) {
  const root = isRepoImportPath(input.pathname) ? input.repoRoot : input.appRoot;
  const relativePath = normalize(input.pathname).replace(/^(\.\.[/\\])+/, '').replace(/^[/\\]/, '');
  const filePath = resolve(join(root, relativePath));

  if (filePath !== root && !filePath.startsWith(`${root}${sep}`)) {
    throw new Error('Request path escapes the guest WebXR root');
  }

  return filePath;
}

function isRepoImportPath(pathname: string) {
  return pathname.startsWith('/packages/') || pathname.startsWith('/apps/');
}

if (currentFile === process.argv[1]) {
  const port = Number(process.env.PORT ?? 4173);
  const server = createGuestWebxrDevServer();

  server.listen(port, '127.0.0.1', () => {
    console.log(`Guest WebXR dev shell: http://127.0.0.1:${port}/`);
  });
}
