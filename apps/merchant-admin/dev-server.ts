import { readFile } from 'node:fs/promises';
import { createServer, type IncomingMessage } from 'node:http';
import { stripTypeScriptTypes } from 'node:module';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { createApiContext } from '../api/src/server.ts';
import { recordPilotRestroomRoute } from './src/index.ts';
import { deriveNextPilotImplementationTarget } from './src/entry/state.ts';
import type {
  PilotFollowUpAction,
  PilotQaResultNote,
  PilotQrPlacementEvidence,
  PilotReadinessChecklistId,
  PilotRouteRecordingScreenState,
  PilotRouteRecordingScreenStage,
} from './src/entry/index.ts';

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

export function createMerchantAdminDevServer(
  options: { appRoot?: string; repoRoot?: string; guestOrigin?: string } = {},
) {
  const resolvedAppRoot = resolve(options.appRoot ?? appRoot);
  const resolvedRepoRoot = resolve(options.repoRoot ?? repoRoot);
  const guestOrigin = resolveGuestOrigin(options.guestOrigin ?? process.env.GUEST_ORIGIN ?? 'http://127.0.0.1:4173');
  let pilotState = createInitialPilotState();

  return createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url ?? '/', 'http://localhost');

      if (requestUrl.pathname === '/src/entry/bootstrap.ts') {
        const bundle = await build({
          entryPoints: [join(resolvedAppRoot, 'src/entry/bootstrap.ts')],
          bundle: true,
          write: false,
          format: 'esm',
          platform: 'browser',
          target: 'es2022',
        });
        response.writeHead(200, { 'content-type': 'application/javascript; charset=utf-8' });
        response.end(bundle.outputFiles[0].text);
        return;
      }

      if (requestUrl.pathname === '/api/dev/pilot-state') {
        if (request.method === 'GET') {
          writeJson(response, 200, {
            ok: true,
            ...pilotState,
            nextTarget: deriveNextPilotImplementationTarget(
              toPilotRouteRecordingScreenState(pilotState),
            ),
          });
          return;
        }

        if (request.method === 'POST') {
          pilotState = parsePilotStateUpdate(await readJson(request));
          writeJson(response, 200, {
            ok: true,
            ...pilotState,
            nextTarget: deriveNextPilotImplementationTarget(
              toPilotRouteRecordingScreenState(pilotState),
            ),
          });
          return;
        }

        writeJson(response, 405, {
          ok: false,
          status: 405,
          error: 'method-not-allowed',
        });
        return;
      }

      if (requestUrl.pathname === '/api/dev/pilot-route-recording') {
        if (request.method === 'GET') {
          writeJson(response, 200, {
            ok: true,
            ...pilotState.recording,
          });
          return;
        }

        if (request.method === 'POST') {
          pilotState = {
            ...pilotState,
            recording: parsePilotRouteRecordingUpdate(await readJson(request)),
          };
          writeJson(response, 200, {
            ok: true,
            ...pilotState.recording,
          });
          return;
        }

        writeJson(response, 405, {
          ok: false,
          status: 405,
          error: 'method-not-allowed',
        });
        return;
      }

      if (requestUrl.pathname === '/api/dev/pilot-readiness') {
        if (request.method === 'GET') {
          writeJson(response, 200, {
            ok: true,
            ...pilotState.readiness,
          });
          return;
        }

        if (request.method === 'POST') {
          pilotState = {
            ...pilotState,
            readiness: parsePilotReadinessUpdate(await readJson(request)),
          };
          writeJson(response, 200, {
            ok: true,
            ...pilotState.readiness,
          });
          return;
        }

        writeJson(response, 405, {
          ok: false,
          status: 405,
          error: 'method-not-allowed',
        });
        return;
      }

      if (requestUrl.pathname === '/api/dev/pilot-route-session') {
        const session = createPilotRouteSessionPayload(guestOrigin);

        writeJson(response, 200, {
          ok: true,
          ...session,
        });
        return;
      }

      if (requestUrl.pathname === '/api/dev/pilot-route-session-url') {
        writeText(
          response,
          200,
          createPilotRouteSessionPayload(guestOrigin).launchUrl,
        );
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

export function resolveGuestOrigin(value: string) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
    url.pathname !== '/' || url.search || url.hash) {
    throw new Error('GUEST_ORIGIN must be an HTTP(S) origin without credentials, path, query, or fragment');
  }
  return url.origin;
}

function createPilotRouteSessionPayload(guestOrigin: string) {
  const recording = recordPilotRestroomRoute(
    createApiContext({
      signingSecret: 'local-dev-pilot-secret',
      now: () => '2026-09-01T10:00:00.000Z',
    }),
  );

  return {
    token: recording.token,
    expiresAt: recording.expiresAt,
    launchUrl: new URL(recording.launchUrl, guestOrigin).toString(),
  };
}

type PilotReadinessState = {
  hasQrPlacement: boolean;
  hasStaffFallbackNote: boolean;
  qaResults: Partial<Record<PilotReadinessChecklistId, PilotQaResultNote>>;
  qrPlacementEvidence?: PilotQrPlacementEvidence;
};

type PilotRouteRecordingState = {
  stage: PilotRouteRecordingScreenStage;
  routeId?: string;
  launchUrl?: string;
};

type PilotState = {
  recording: PilotRouteRecordingState;
  readiness: PilotReadinessState;
  followUps: PilotFollowUpAction[];
};

function toPilotRouteRecordingScreenState(
  state: PilotState,
): PilotRouteRecordingScreenState {
  return {
    ...state.recording,
    ...state.readiness,
    followUps: state.followUps,
  };
}

function createInitialPilotState(): PilotState {
  return {
    recording: createInitialPilotRouteRecording(),
    readiness: createInitialPilotReadiness(),
    followUps: [],
  };
}

function createInitialPilotReadiness(): PilotReadinessState {
  return {
    hasQrPlacement: false,
    hasStaffFallbackNote: false,
    qaResults: {},
    qrPlacementEvidence: undefined,
  };
}

function createInitialPilotRouteRecording(): PilotRouteRecordingState {
  return {
    stage: 'empty',
  };
}

function parsePilotStateUpdate(value: unknown): PilotState {
  if (!isRecord(value)) {
    return createInitialPilotState();
  }

  return {
    recording: parsePilotRouteRecordingUpdate(value.recording),
    readiness: parsePilotReadinessUpdate(value.readiness),
    followUps: parseFollowUps(value.followUps),
  };
}

function parseFollowUps(value: unknown): PilotFollowUpAction[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    const followUp = parseFollowUp(item);
    return followUp ? [followUp] : [];
  });
}

function parseFollowUp(value: unknown): PilotFollowUpAction | undefined {
  if (!isRecord(value) || !isRecord(value.snapshot)) {
    return undefined;
  }

  if (
    typeof value.id !== 'string' ||
    typeof value.targetId !== 'string' ||
    typeof value.targetLabel !== 'string' ||
    typeof value.createdAt !== 'string'
  ) {
    return undefined;
  }

  return {
    id: value.id,
    targetId: value.targetId as PilotFollowUpAction['targetId'],
    targetLabel: value.targetLabel,
    status: value.status === 'completed' ? 'completed' : 'open',
    createdAt: value.createdAt,
    snapshot: {
      ...parsePilotRouteRecordingUpdate(value.snapshot),
      ...parsePilotReadinessUpdate(value.snapshot),
    },
  };
}

function parsePilotReadinessUpdate(value: unknown): PilotReadinessState {
  if (!isRecord(value)) {
    return createInitialPilotReadiness();
  }

  return {
    hasQrPlacement: value.hasQrPlacement === true,
    hasStaffFallbackNote: value.hasStaffFallbackNote === true,
    qaResults: parseQaResults(value.qaResults),
    qrPlacementEvidence: parseQrPlacementEvidence(value.qrPlacementEvidence),
  };
}

function parsePilotRouteRecordingUpdate(value: unknown): PilotRouteRecordingState {
  if (!isRecord(value)) {
    return createInitialPilotRouteRecording();
  }

  const stage = parsePilotRouteRecordingStage(value.stage);

  return {
    stage,
    routeId: typeof value.routeId === 'string' ? value.routeId : undefined,
    launchUrl: typeof value.launchUrl === 'string' ? value.launchUrl : undefined,
  };
}

function parsePilotRouteRecordingStage(
  value: unknown,
): PilotRouteRecordingScreenStage {
  if (
    value === 'recorded' ||
    value === 'tested' ||
    value === 'active' ||
    value === 'launch-ready'
  ) {
    return value;
  }

  return 'empty';
}

function parseQaResults(
  value: unknown,
): Partial<Record<PilotReadinessChecklistId, PilotQaResultNote>> {
  if (!isRecord(value)) {
    return {};
  }

  return {
    'place-qr': parseQaResultNote(value['place-qr']),
    'staff-fallback-note': parseQaResultNote(value['staff-fallback-note']),
  };
}

function parseQaResultNote(value: unknown) {
  if (!isRecord(value)) {
    return undefined;
  }

  if (typeof value.summary !== 'string' || typeof value.recordedAt !== 'string') {
    return undefined;
  }

  return {
    summary: value.summary,
    recordedAt: value.recordedAt,
  };
}

function parseQrPlacementEvidence(value: unknown) {
  if (!isRecord(value)) {
    return undefined;
  }

  if (
    typeof value.location !== 'string' ||
    typeof value.orientation !== 'string' ||
    typeof value.note !== 'string' ||
    typeof value.recordedAt !== 'string'
  ) {
    return undefined;
  }

  return {
    location: value.location,
    orientation: value.orientation,
    note: value.note,
    recordedAt: value.recordedAt,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

async function readJson(request: IncomingMessage) {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const body = Buffer.concat(chunks).toString('utf8');
  return body ? JSON.parse(body) : undefined;
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
    throw new Error('Request path escapes the merchant admin root');
  }

  return filePath;
}

function isRepoImportPath(pathname: string) {
  return pathname.startsWith('/packages/') || pathname.startsWith('/apps/');
}

if (currentFile === process.argv[1]) {
  const port = Number(process.env.PORT ?? 4174);
  const server = createMerchantAdminDevServer();

  server.listen(port, '127.0.0.1', () => {
    console.log(`Merchant admin dev shell: http://127.0.0.1:${port}/`);
  });
}
