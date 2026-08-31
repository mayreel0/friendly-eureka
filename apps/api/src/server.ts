import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

import {
  canActivateRoute,
  canExposeRoute,
  createGuestSession,
  rotateRoutePassword,
  serializeRoute,
  type Anchor,
  type EntrySource,
  type Route,
  type Segment,
  type SerializedRoute,
  type WifiProof,
} from '../../../packages/route-core/src/index.ts';

export type MerchantPrincipal = {
  id: string;
  storeIds: readonly string[];
  role: 'merchant';
};

export type StoreRecord = {
  id: string;
  merchantId: string;
  name: string;
  restroomPassword: string;
  passwordGeneration?: number;
};

export type RouteDraftInput = {
  id: string;
  version: number;
  recordedAt: string;
  anchors: readonly Anchor[];
  segments: readonly Segment[];
};

export type ApiContext = {
  signingSecret: string;
  now: () => string;
  stores: Map<string, StoreRecord>;
  routes: Map<string, Route>;
  qrCredentials: Map<string, QrCredential>;
  activeQrNonces: Map<string, string>;
  qrRateLimits: Map<string, RateLimitBucket>;
  wifiProofs: Map<string, WifiProofRecord>;
  usedWifiProofIds: Set<string>;
  auditLog: Record<string, unknown>[];
};

type TokenPayload = {
  audience: 'guest-route';
  storeId: string;
  routeId: string;
  routeVersion: number;
  source: EntrySource;
  expiresAt: string;
  canViewPassword: boolean;
  qrNonce?: string;
  passwordGeneration?: number;
};

type QrCredential = {
  qrKey: string;
  routeVersion: number;
  passwordGeneration: number;
};

type RateLimitBucket = {
  windowStartedAt: string;
  count: number;
};

type WifiProofRecord = WifiProof & {
  id: string;
  expiresAt: string;
};

type WifiProofPayload = {
  audience: 'wifi-proof';
  proofId: string;
  storeId: string;
  verifiedAt: string;
  expiresAt: string;
};

type ApiFailure = {
  ok: false;
  status: number;
  error: string;
};

type ApiResult<T extends object = object> =
  | ({ ok: true } & T)
  | ApiFailure;

const QR_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const QR_RATE_LIMIT_MAX = 5;

export function health() {
  return { ok: true, service: 'lechigo-api' };
}

export function createApiContext(input: {
  signingSecret: string;
  now?: () => string;
}): ApiContext {
  return {
    signingSecret: input.signingSecret,
    now: input.now ?? (() => new Date().toISOString()),
    stores: new Map(),
    routes: new Map(),
    qrCredentials: new Map(),
    activeQrNonces: new Map(),
    qrRateLimits: new Map(),
    wifiProofs: new Map(),
    usedWifiProofIds: new Set(),
    auditLog: [],
  };
}

export function setApiNow(context: ApiContext, now: string): void {
  context.now = () => now;
}

export function registerStore(
  context: ApiContext,
  store: StoreRecord,
): StoreRecord {
  context.stores.set(store.id, store);
  return store;
}

export function saveRouteDraft(
  context: ApiContext,
  input: {
    merchant: MerchantPrincipal;
    storeId: string;
    route: RouteDraftInput;
  },
): ApiResult<{ route: Route }> {
  const ownership = authorizeStore(context, input.merchant, input.storeId);

  if (!ownership.ok) {
    return ownership;
  }

  const route: Route = {
    ...input.route,
    storeId: input.storeId,
    status: 'recorded',
    passwordUpdatedAt: undefined,
    passwordRetestRequired: false,
  };

  context.routes.set(routeKey(input.storeId, route.id), route);
  context.qrCredentials.delete(routeKey(input.storeId, route.id));
  context.activeQrNonces.delete(routeKey(input.storeId, route.id));
  return { ok: true, route };
}

export function recordTestRun(
  context: ApiContext,
  input: {
    merchant: MerchantPrincipal;
    storeId: string;
    routeId: string;
    testedAt: string;
    result: 'pass' | 'fail';
  },
): ApiResult<{ route: Route }> {
  const ownership = authorizeStore(context, input.merchant, input.storeId);

  if (!ownership.ok) {
    return ownership;
  }

  const route = getRoute(context, input.storeId, input.routeId);

  if (!route) {
    return { ok: false, status: 404, error: 'route-not-found' };
  }

  const updated: Route = {
    ...route,
    testedAt: input.result === 'pass' ? input.testedAt : undefined,
    status: input.result === 'pass' ? 'tested' : 'test_failed',
  };

  context.routes.set(routeKey(input.storeId, input.routeId), updated);

  if (input.result === 'fail') {
    context.qrCredentials.delete(routeKey(input.storeId, input.routeId));
    context.activeQrNonces.delete(routeKey(input.storeId, input.routeId));
    context.qrRateLimits.delete(routeKey(input.storeId, input.routeId));
  }

  return { ok: true, route: updated };
}

export function activateRoute(
  context: ApiContext,
  input: {
    merchant: MerchantPrincipal;
    storeId: string;
    routeId: string;
  },
): ApiResult<{ route: Route }> {
  const ownership = authorizeStore(context, input.merchant, input.storeId);

  if (!ownership.ok) {
    return ownership;
  }

  const route = getRoute(context, input.storeId, input.routeId);

  if (!route) {
    return { ok: false, status: 404, error: 'route-not-found' };
  }

  const activation = canActivateRoute(route);

  if (!activation.ok) {
    return { ok: false, status: 409, error: activation.reason };
  }

  const activeRoute: Route = { ...route, status: 'active' };
  context.routes.set(routeKey(input.storeId, input.routeId), activeRoute);
  return { ok: true, route: activeRoute };
}

export function issueQrCredential(
  context: ApiContext,
  input: {
    merchant: MerchantPrincipal;
    storeId: string;
    routeId: string;
  },
): ApiResult<{ qrKey: string }> {
  const ownership = authorizeStore(context, input.merchant, input.storeId);

  if (!ownership.ok) {
    return ownership;
  }

  const route = getRoute(context, input.storeId, input.routeId);
  const store = context.stores.get(input.storeId);

  if (!route || !store) {
    return { ok: false, status: 404, error: 'route-not-found' };
  }

  if (route.status !== 'active') {
    return { ok: false, status: 409, error: 'route-not-active' };
  }

  const qrKey = randomUUID();
  context.qrCredentials.set(routeKey(input.storeId, input.routeId), {
    qrKey,
    routeVersion: route.version,
    passwordGeneration: currentPasswordGeneration(store),
  });
  context.activeQrNonces.delete(routeKey(input.storeId, input.routeId));
  context.qrRateLimits.delete(routeKey(input.storeId, input.routeId));

  return { ok: true, qrKey };
}

export function rotatePassword(
  context: ApiContext,
  input: {
    merchant: MerchantPrincipal;
    storeId: string;
    routeId: string;
    password: string;
    updatedAt: string;
  },
): ApiResult<{ route: Route }> {
  const ownership = authorizeStore(context, input.merchant, input.storeId);

  if (!ownership.ok) {
    return ownership;
  }

  const store = context.stores.get(input.storeId);
  const route = getRoute(context, input.storeId, input.routeId);

  if (!store || !route) {
    return { ok: false, status: 404, error: 'route-not-found' };
  }

  context.stores.set(input.storeId, {
    ...store,
    restroomPassword: input.password,
    passwordGeneration: currentPasswordGeneration(store) + 1,
  });
  const updatedRoute = rotateRoutePassword(route, input.updatedAt);
  context.routes.set(routeKey(input.storeId, input.routeId), updatedRoute);
  context.qrCredentials.delete(routeKey(input.storeId, input.routeId));
  context.activeQrNonces.delete(routeKey(input.storeId, input.routeId));
  context.qrRateLimits.delete(routeKey(input.storeId, input.routeId));

  return { ok: true, route: updatedRoute };
}

export function createQrSession(
  context: ApiContext,
  input: {
    storeId: string;
    routeId: string;
    qrKey: string;
  },
): ApiResult<{ token: string; expiresAt: string }> {
  const route = getRoute(context, input.storeId, input.routeId);

  if (!route) {
    return { ok: false, status: 404, error: 'route-not-found' };
  }

  const qrCredential = context.qrCredentials.get(
    routeKey(input.storeId, input.routeId),
  );

  if (
    !qrCredential ||
    qrCredential.qrKey !== input.qrKey ||
    qrCredential.routeVersion !== route.version
  ) {
    return { ok: false, status: 401, error: 'invalid-qr-key' };
  }

  const exposure = canExposeRoute({
    route,
    source: 'qr',
    at: context.now(),
  });

  if (!exposure.ok) {
    return { ok: false, status: 403, error: exposure.reason };
  }

  const rateLimit = consumeQrRateLimit(context, input.storeId, input.routeId);

  if (!rateLimit.ok) {
    return rateLimit;
  }

  const session = createGuestSession({
    route,
    source: 'qr',
    issuedAt: context.now(),
  });
  const qrNonce = randomUUID();
  const payload = {
    audience: 'guest-route',
    storeId: route.storeId,
    routeId: route.id,
    routeVersion: route.version,
    source: 'qr',
    expiresAt: session.expiresAt,
    canViewPassword: session.canViewPassword,
    qrNonce,
    passwordGeneration: qrCredential.passwordGeneration,
  } satisfies TokenPayload;

  context.activeQrNonces.set(routeKey(input.storeId, input.routeId), qrNonce);

  return {
    ok: true,
    token: signToken(context, payload),
    expiresAt: session.expiresAt,
  };
}

export function issueWifiProof(
  context: ApiContext,
  input: {
    storeId: string;
    verifiedAt: string;
  },
): ApiResult<{ wifiProofToken: string; expiresAt: string }> {
  if (!context.stores.has(input.storeId)) {
    return { ok: false, status: 404, error: 'store-not-found' };
  }

  const proofId = randomUUID();
  const expiresAt = new Date(Date.parse(input.verifiedAt) + 5 * 60 * 1000)
    .toISOString();
  const proof = {
    id: proofId,
    storeId: input.storeId,
    verifiedAt: input.verifiedAt,
    expiresAt,
  };

  context.wifiProofs.set(proofId, proof);

  return {
    ok: true,
    wifiProofToken: signToken(context, {
      audience: 'wifi-proof',
      proofId,
      storeId: input.storeId,
      verifiedAt: input.verifiedAt,
      expiresAt,
    }),
    expiresAt,
  };
}

export function createWifiSession(
  context: ApiContext,
  input: {
    storeId: string;
    routeId: string;
    wifiProofToken: string;
  },
): ApiResult<{ token: string; expiresAt: string; proofExpiresAt?: string }> {
  const route = getRoute(context, input.storeId, input.routeId);

  if (!route) {
    return { ok: false, status: 404, error: 'route-not-found' };
  }

  const wifiProof = verifyWifiProof(context, input.wifiProofToken);

  if (!wifiProof.ok) {
    return wifiProof;
  }

  const exposure = canExposeRoute({
    route,
    source: 'wifi',
    at: context.now(),
    wifiProof: wifiProof.proof,
  });

  if (!exposure.ok) {
    return { ok: false, status: 403, error: exposure.reason };
  }

  const session = createGuestSession({
    route,
    source: 'wifi',
    issuedAt: context.now(),
    wifiProof: wifiProof.proof,
  });
  const store = context.stores.get(route.storeId);
  const payload = {
    audience: 'guest-route',
    storeId: route.storeId,
    routeId: route.id,
    routeVersion: route.version,
    source: 'wifi',
    expiresAt: session.expiresAt,
    canViewPassword: session.canViewPassword,
    passwordGeneration: store ? currentPasswordGeneration(store) : 0,
  } satisfies TokenPayload;
  context.usedWifiProofIds.add(wifiProof.proof.id);

  return {
    ok: true,
    token: signToken(context, payload),
    expiresAt: session.expiresAt,
    proofExpiresAt: session.proofExpiresAt,
  };
}

export function fetchGuestRoute(
  context: ApiContext,
  input: { token: string; at?: string },
): ApiResult<{ route: SerializedRoute }> {
  const token = verifyGuestToken(context, input.token, input.at ?? context.now());

  if (!token.ok) {
    return token;
  }

  const route = getRoute(context, token.payload.storeId, token.payload.routeId);

  if (
    !route ||
    route.version !== token.payload.routeVersion ||
    route.status !== 'active'
  ) {
    return { ok: false, status: 404, error: 'route-not-found' };
  }

  return { ok: true, route: serializeRoute(route) };
}

export function fetchPassword(
  context: ApiContext,
  input: { token: string; at?: string },
): ApiResult<{ password: string }> {
  const token = verifyGuestToken(context, input.token, input.at ?? context.now());

  if (!token.ok) {
    return token;
  }

  if (!token.payload.canViewPassword || token.payload.source !== 'wifi') {
    return { ok: false, status: 403, error: 'password-forbidden' };
  }

  const store = context.stores.get(token.payload.storeId);

  if (!store) {
    return { ok: false, status: 404, error: 'store-not-found' };
  }

  const route = getRoute(context, token.payload.storeId, token.payload.routeId);

  if (
    !route ||
    route.version !== token.payload.routeVersion ||
    route.status !== 'active'
  ) {
    return { ok: false, status: 404, error: 'route-not-found' };
  }

  if (token.payload.passwordGeneration !== currentPasswordGeneration(store)) {
    return { ok: false, status: 401, error: 'session-rotated' };
  }

  context.auditLog.push({
    event: 'password.read',
    storeId: token.payload.storeId,
    routeId: token.payload.routeId,
    source: token.payload.source,
    password: '[redacted]',
  });

  return { ok: true, password: store.restroomPassword };
}

function authorizeStore(
  context: ApiContext,
  merchant: MerchantPrincipal,
  storeId: string,
): ApiResult {
  const store = context.stores.get(storeId);

  if (!store || store.merchantId !== merchant.id) {
    return { ok: false, status: 403, error: 'store-forbidden' };
  }

  if (!merchant.storeIds.includes(storeId)) {
    return { ok: false, status: 403, error: 'store-forbidden' };
  }

  return { ok: true };
}

function verifyGuestToken(
  context: ApiContext,
  token: string,
  at: string,
):
  | { ok: true; payload: TokenPayload }
  | { ok: false; status: 401; error: string } {
  const payload = parseToken(context, token);

  if (!payload || payload.audience !== 'guest-route') {
    return { ok: false, status: 401, error: 'invalid-token' };
  }

  if (Date.parse(at) > Date.parse(payload.expiresAt)) {
    return { ok: false, status: 401, error: 'token-expired' };
  }

  if (payload.source === 'qr') {
    const currentNonce = context.activeQrNonces.get(
      routeKey(payload.storeId, payload.routeId),
    );

    if (currentNonce !== payload.qrNonce) {
      return { ok: false, status: 401, error: 'qr-session-rotated' };
    }
  }

  return { ok: true, payload };
}

function verifyWifiProof(
  context: ApiContext,
  token: string,
):
  | { ok: true; proof: WifiProofRecord }
  | { ok: false; status: 401; error: string } {
  const payload = parseToken(context, token);

  if (!isWifiProofPayload(payload)) {
    return { ok: false, status: 401, error: 'invalid-wifi-proof' };
  }

  if (Date.parse(context.now()) > Date.parse(payload.expiresAt)) {
    return { ok: false, status: 401, error: 'wifi-proof-expired' };
  }

  if (context.usedWifiProofIds.has(payload.proofId)) {
    return { ok: false, status: 401, error: 'wifi-proof-replayed' };
  }

  const proof = context.wifiProofs.get(payload.proofId);

  if (!proof || proof.storeId !== payload.storeId) {
    return { ok: false, status: 401, error: 'invalid-wifi-proof' };
  }

  return { ok: true, proof };
}

function signToken(
  context: ApiContext,
  payload: TokenPayload | WifiProofPayload,
): string {
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = signatureFor(context, encodedPayload);

  return `${encodedPayload}.${signature}`;
}

function parseToken(
  context: ApiContext,
  token: string,
): TokenPayload | WifiProofPayload | undefined {
  const [encodedPayload, signature] = token.split('.');

  if (!encodedPayload || !signature) {
    return undefined;
  }

  const expected = signatureFor(context, encodedPayload);
  const providedSignature = Buffer.from(signature);
  const expectedSignature = Buffer.from(expected);

  if (
    providedSignature.length !== expectedSignature.length ||
    !timingSafeEqual(providedSignature, expectedSignature)
  ) {
    return undefined;
  }

  try {
    return JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
  } catch {
    return undefined;
  }
}

function signatureFor(context: ApiContext, encodedPayload: string): string {
  return createHmac('sha256', context.signingSecret)
    .update(encodedPayload)
    .digest('base64url');
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function getRoute(
  context: ApiContext,
  storeId: string,
  routeId: string,
): Route | undefined {
  return context.routes.get(routeKey(storeId, routeId));
}

function routeKey(storeId: string, routeId: string): string {
  return `${storeId}:${routeId}`;
}

function consumeQrRateLimit(
  context: ApiContext,
  storeId: string,
  routeId: string,
): ApiResult {
  const key = routeKey(storeId, routeId);
  const nowMs = Date.parse(context.now());
  const current = context.qrRateLimits.get(key);

  if (
    !current ||
    nowMs - Date.parse(current.windowStartedAt) > QR_RATE_LIMIT_WINDOW_MS
  ) {
    context.qrRateLimits.set(key, {
      windowStartedAt: context.now(),
      count: 1,
    });
    return { ok: true };
  }

  if (current.count >= QR_RATE_LIMIT_MAX) {
    return { ok: false, status: 429, error: 'qr-rate-limited' };
  }

  current.count += 1;
  return { ok: true };
}

function currentPasswordGeneration(store: StoreRecord): number {
  return store.passwordGeneration ?? 0;
}

function isWifiProofPayload(
  payload: TokenPayload | WifiProofPayload | undefined,
): payload is WifiProofPayload {
  return payload?.audience === 'wifi-proof';
}
