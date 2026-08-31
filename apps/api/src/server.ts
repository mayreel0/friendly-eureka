import { createHmac, timingSafeEqual } from 'node:crypto';

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
  stores: Map<string, StoreRecord>;
  routes: Map<string, Route>;
  activeQrNonces: Map<string, string>;
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
};

export function health() {
  return { ok: true, service: 'lechigo-api' };
}

export function createApiContext(input: { signingSecret: string }): ApiContext {
  return {
    signingSecret: input.signingSecret,
    stores: new Map(),
    routes: new Map(),
    activeQrNonces: new Map(),
    auditLog: [],
  };
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
) {
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
) {
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
    testedAt: input.result === 'pass' ? input.testedAt : route.testedAt,
    status: input.result === 'pass' ? 'tested' : route.status,
  };

  context.routes.set(routeKey(input.storeId, input.routeId), updated);
  return { ok: true, route: updated };
}

export function activateRoute(
  context: ApiContext,
  input: {
    merchant: MerchantPrincipal;
    storeId: string;
    routeId: string;
  },
) {
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

export function rotatePassword(
  context: ApiContext,
  input: {
    merchant: MerchantPrincipal;
    storeId: string;
    routeId: string;
    password: string;
    updatedAt: string;
  },
) {
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
  });
  const updatedRoute = rotateRoutePassword(route, input.updatedAt);
  context.routes.set(routeKey(input.storeId, input.routeId), updatedRoute);

  return { ok: true, route: updatedRoute };
}

export function createQrSession(
  context: ApiContext,
  input: {
    storeId: string;
    routeId: string;
    issuedAt: string;
    qrNonce: string;
  },
) {
  const route = getRoute(context, input.storeId, input.routeId);

  if (!route) {
    return { ok: false, status: 404, error: 'route-not-found' };
  }

  const exposure = canExposeRoute({
    route,
    source: 'qr',
    at: input.issuedAt,
  });

  if (!exposure.ok) {
    return { ok: false, status: 403, error: exposure.reason };
  }

  const session = createGuestSession({
    route,
    source: 'qr',
    issuedAt: input.issuedAt,
  });
  const payload = {
    audience: 'guest-route',
    storeId: route.storeId,
    routeId: route.id,
    routeVersion: route.version,
    source: 'qr',
    expiresAt: session.expiresAt,
    canViewPassword: session.canViewPassword,
    qrNonce: input.qrNonce,
  } satisfies TokenPayload;

  context.activeQrNonces.set(routeKey(input.storeId, input.routeId), input.qrNonce);

  return {
    ok: true,
    token: signToken(context, payload),
    expiresAt: session.expiresAt,
  };
}

export function createWifiSession(
  context: ApiContext,
  input: {
    storeId: string;
    routeId: string;
    issuedAt: string;
    wifiProof: WifiProof;
  },
) {
  const route = getRoute(context, input.storeId, input.routeId);

  if (!route) {
    return { ok: false, status: 404, error: 'route-not-found' };
  }

  const exposure = canExposeRoute({
    route,
    source: 'wifi',
    at: input.issuedAt,
    wifiProof: input.wifiProof,
  });

  if (!exposure.ok) {
    return { ok: false, status: 403, error: exposure.reason };
  }

  const session = createGuestSession({
    route,
    source: 'wifi',
    issuedAt: input.issuedAt,
    wifiProof: input.wifiProof,
  });
  const payload = {
    audience: 'guest-route',
    storeId: route.storeId,
    routeId: route.id,
    routeVersion: route.version,
    source: 'wifi',
    expiresAt: session.expiresAt,
    canViewPassword: session.canViewPassword,
  } satisfies TokenPayload;

  return {
    ok: true,
    token: signToken(context, payload),
    expiresAt: session.expiresAt,
    proofExpiresAt: session.proofExpiresAt,
  };
}

export function fetchGuestRoute(
  context: ApiContext,
  input: { token: string; at: string },
) {
  const token = verifyGuestToken(context, input.token, input.at);

  if (!token.ok) {
    return token;
  }

  const route = getRoute(context, token.payload.storeId, token.payload.routeId);

  if (!route || route.version !== token.payload.routeVersion) {
    return { ok: false, status: 404, error: 'route-not-found' };
  }

  return { ok: true, route: serializeRoute(route) };
}

export function fetchPassword(
  context: ApiContext,
  input: { token: string; at: string },
) {
  const token = verifyGuestToken(context, input.token, input.at);

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
) {
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

function signToken(context: ApiContext, payload: TokenPayload): string {
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = signatureFor(context, encodedPayload);

  return `${encodedPayload}.${signature}`;
}

function parseToken(
  context: ApiContext,
  token: string,
): TokenPayload | undefined {
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
