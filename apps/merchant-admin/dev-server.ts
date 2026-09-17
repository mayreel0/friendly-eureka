import { readFile } from 'node:fs/promises';
import { createServer, type IncomingMessage } from 'node:http';
import { stripTypeScriptTypes } from 'node:module';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { createPilotStateStore, PilotStateConflictError, PilotStateSaveError } from './pilot-state-store.ts';
import { createPilotGuestApi } from './pilot-guest-api.ts';
import { InvalidPilotDirectionsError, parsePilotDirections, samePilotDirections, type PilotDirections } from './src/pilot-directions.ts';
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
export const defaultPilotStateFile = join(repoRoot, '.lechigo', 'pilot-state.json');

const contentTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'application/javascript; charset=utf-8'],
  ['.mjs', 'application/javascript; charset=utf-8'],
  ['.ts', 'application/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
]);

export function createMerchantAdminDevServer(
  options: { appRoot?: string; repoRoot?: string; guestOrigin?: string; stateFile?: string } = {},
) {
  const resolvedAppRoot = resolve(options.appRoot ?? appRoot);
  const resolvedRepoRoot = resolve(options.repoRoot ?? repoRoot);
  const guestOrigin = resolveGuestOrigin(options.guestOrigin ?? process.env.GUEST_ORIGIN ?? 'http://127.0.0.1:4173');
  const stateStore = createPilotStateStore({
    file: options.stateFile,
    initial: createInitialPilotState(),
    parse: parseSavedPilotState,
    forDisk: toPersistedPilotState,
  });
  const guestApi = createPilotGuestApi();
  guestApi.setRecording(stateStore.read().recording);

  const server = createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url ?? '/', 'http://localhost');
      let pilotState = stateStore.read();
      const revisionHeader = request.headers['x-pilot-revision'];
      const expectedRevision = typeof revisionHeader === 'string' ? revisionHeader : undefined;

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
            revision: stateStore.revision(),
            nextTarget: deriveNextPilotImplementationTarget(
              toPilotRouteRecordingScreenState(pilotState),
            ),
          });
          return;
        }

        if (request.method === 'POST') {
          const update = parsePilotStateUpdate(await readJson(request));
          pilotState = await stateStore.update((previous) => ({
            ...update, recording: applyDirectionChange(previous.recording, update.recording),
          }), expectedRevision);
          guestApi.setRecording(pilotState.recording);
          writeJson(response, 200, {
            ok: true,
            ...pilotState,
            revision: stateStore.revision(),
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
          const recording = parsePilotRouteRecordingUpdate(await readJson(request));
          pilotState = await stateStore.update((previous) => ({
            ...previous, recording: applyDirectionChange(previous.recording, recording),
          }), expectedRevision);
          guestApi.setRecording(pilotState.recording);
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
          const readiness = parsePilotReadinessUpdate(await readJson(request));
          pilotState = await stateStore.update((previous) => ({ ...previous, readiness }), expectedRevision);
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

      if (requestUrl.pathname === '/api/dev/pilot-route-session' ||
        requestUrl.pathname === '/api/dev/pilot-route-session-url') {
        const session = guestApi.issueSession();
        if (!session.ok) {
          writeJson(response, session.status, session);
          return;
        }
        const launchUrl = new URL(`/?token=${encodeURIComponent(session.token)}`, guestOrigin).toString();
        if (requestUrl.pathname.endsWith('-url')) writeText(response, 200, launchUrl);
        else writeJson(response, 200, { ...session, launchUrl });
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
    } catch (error) {
      if (error instanceof InvalidPilotDirectionsError) {
        writeJson(response, 400, { ok: false, error: 'invalid-pilot-directions' });
        return;
      }
      if (error instanceof PilotStateConflictError) {
        writeJson(response, 409, { ok: false, error: 'pilot-state-conflict' });
        return;
      }
      if (error instanceof PilotStateSaveError) {
        writeJson(response, 500, { ok: false, error: 'pilot-state-save-failed' });
        return;
      }
      response.writeHead(404, {
        'content-type': 'text/plain; charset=utf-8',
      });
      response.end('Not found');
    }
  });
  return Object.assign(server, { guestApi });
}

export function resolveGuestOrigin(value: string) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
    url.pathname !== '/' || url.search || url.hash) {
    throw new Error('GUEST_ORIGIN must be an HTTP(S) origin without credentials, path, query, or fragment');
  }
  return url.origin;
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
  expiresAt?: string;
  directions?: PilotDirections;
  routeVersion?: number;
};

function applyDirectionChange(previous: PilotRouteRecordingState, next: PilotRouteRecordingState): PilotRouteRecordingState {
  if (samePilotDirections(previous.directions, next.directions)) {
    return { ...next, routeVersion: previous.routeVersion };
  }
  return { ...next, stage: 'recorded', routeId: 'pilot-restroom-route',
    routeVersion: (previous.routeVersion ?? 1) + 1, launchUrl: undefined, expiresAt: undefined };
}

type PilotState = {
  recording: PilotRouteRecordingState;
  readiness: PilotReadinessState;
  followUps: PilotFollowUpAction[];
};

function toPersistedPilotState(state: PilotState): PilotState {
  const withoutSession = <T extends PilotRouteRecordingState>(recording: T) => {
    const { launchUrl: _launchUrl, expiresAt: _expiresAt, ...saved } = recording;
    return { ...saved, stage: recording.stage === 'launch-ready' ? 'active' as const : recording.stage };
  };
  return {
    ...state,
    recording: withoutSession(state.recording),
    followUps: state.followUps.map((followUp) => ({ ...followUp, snapshot: withoutSession(followUp.snapshot) })),
  };
}

function parseSavedPilotState(value: unknown): PilotState {
  if (!isRecord(value) || !isRecord(value.recording) || !isRecord(value.readiness) ||
    !Array.isArray(value.followUps) || !isRecord(value.readiness.qaResults) ||
    typeof value.readiness.hasQrPlacement !== 'boolean' || typeof value.readiness.hasStaffFallbackNote !== 'boolean' ||
    !['empty', 'recorded', 'tested', 'active', 'launch-ready', 'paused'].includes(String(value.recording.stage))) {
    throw new Error('Invalid saved pilot state');
  }
  return toPersistedPilotState(parsePilotStateUpdate(value));
}

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
    expiresAt: typeof value.expiresAt === 'string' && Number.isFinite(Date.parse(value.expiresAt)) ? value.expiresAt : undefined,
    directions: value.directions === undefined ? undefined : parsePilotDirections(value.directions),
    routeVersion: typeof value.routeVersion === 'number' && Number.isSafeInteger(value.routeVersion) && value.routeVersion > 0 ? value.routeVersion : undefined,
  };
}

function parsePilotRouteRecordingStage(
  value: unknown,
): PilotRouteRecordingScreenStage {
  if (
    value === 'recorded' ||
    value === 'tested' ||
    value === 'paused' ||
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
  const server = createMerchantAdminDevServer({ stateFile: process.env.PILOT_STATE_FILE ?? defaultPilotStateFile });

  server.listen(port, '127.0.0.1', () => {
    console.log(`Merchant admin dev shell: http://127.0.0.1:${port}/`);
  });
}
