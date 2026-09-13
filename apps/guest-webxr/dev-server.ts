import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { stripTypeScriptTypes } from 'node:module';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  activateRoute,
  createApiContext,
  createQrSession,
  fetchGuestRoute,
  issueQrCredential,
  recordTestRun,
  registerStore,
  saveRouteDraft,
  type ApiContext,
  type MerchantPrincipal,
} from '../api/src/server.ts';

const currentFile = fileURLToPath(import.meta.url);
const appRoot = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = resolve(appRoot, '../..');
const pilotStoreId = 'pilot-store';
const pilotRouteId = 'pilot-restroom-route';

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
    writeJson(input.response, 200, {
      ok: true,
      token: input.api.token,
      expiresAt: input.api.expiresAt,
      url: `/?token=${encodeURIComponent(input.api.token)}`,
    });
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
  const merchant: MerchantPrincipal = {
    id: 'pilot-merchant',
    storeIds: [pilotStoreId],
    role: 'merchant',
  };

  registerStore(context, {
    id: pilotStoreId,
    merchantId: merchant.id,
    name: 'Pilot Store',
    restroomPassword: '2468',
  });
  requireApiOk(
    saveRouteDraft(context, {
      merchant,
      storeId: pilotStoreId,
      route: {
        id: pilotRouteId,
        version: 1,
        recordedAt: '2026-09-01T09:00:00.000Z',
        anchors: [
          {
            id: 'entrance',
            label: 'Entrance',
            floor: 1,
            position: { x: 0, y: 0, z: 0 },
            type: 'start',
          },
          {
            id: 'hallway',
            label: 'Main Hallway',
            floor: 1,
            position: { x: 4, y: 0, z: 1 },
            type: 'landmark',
          },
          {
            id: 'restroom',
            label: 'Restroom',
            floor: 1,
            position: { x: 8, y: 0, z: 1 },
            type: 'destination',
          },
        ],
        segments: [
          {
            id: 'segment-1',
            fromAnchorId: 'entrance',
            toAnchorId: 'hallway',
            instruction: 'Walk toward the main hallway.',
            distanceMeters: 4,
          },
          {
            id: 'segment-2',
            fromAnchorId: 'hallway',
            toAnchorId: 'restroom',
            instruction: 'Turn right at Main Hallway and continue to the restroom.',
            distanceMeters: 4.2,
          },
        ],
      },
    }),
  );
  requireApiOk(
    recordTestRun(context, {
      merchant,
      storeId: pilotStoreId,
      routeId: pilotRouteId,
      testedAt: '2026-09-01T09:10:00.000Z',
      result: 'pass',
    }),
  );
  requireApiOk(
    activateRoute(context, {
      merchant,
      storeId: pilotStoreId,
      routeId: pilotRouteId,
    }),
  );
  const qr = requireApiOk(
    issueQrCredential(context, {
      merchant,
      storeId: pilotStoreId,
      routeId: pilotRouteId,
    }),
  );
  const session = requireApiOk(
    createQrSession(context, {
      storeId: pilotStoreId,
      routeId: pilotRouteId,
      qrKey: qr.qrKey,
      clientKey: 'local-dev-browser',
    }),
  );

  return {
    context,
    token: session.token,
    expiresAt: session.expiresAt,
  };
}

function requireApiOk<T extends object>(
  result: ({ ok: true } & T) | { ok: false; status: number; error: string },
): { ok: true } & T {
  if (!result.ok) {
    throw new Error(`Failed to seed pilot guest API: ${result.error}`);
  }

  return result;
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
