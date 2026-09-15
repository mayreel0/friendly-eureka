import {
  type ArSupport,
  detectArSupport,
  type GuestEntryElementConfig,
  type GuestEntryElementEnvironment,
  type NetworkState,
  registerGuestEntryElement,
} from './index.ts';
import type { SerializedRoute } from '../../../../packages/route-core/src/index.ts';

export type GuestBrowserHostElement = {
  configure(config: GuestEntryElementConfig): void;
};

export type GuestBrowserLocation = {
  search: string;
  hash: string;
};

export type GuestBrowserDocument = GuestEntryElementEnvironment['document'] & {
  querySelector(selector: string): GuestBrowserHostElement | null;
};

export type GuestBrowserRouteLoadResult =
  | { ok: true; route: SerializedRoute }
  | { ok: false; status?: number; error: string };

export type GuestBrowserRouteLoader = (input: {
  token: string;
}) => Promise<GuestBrowserRouteLoadResult>;

export type GuestBrowserNavigator = {
  platform?: string;
  userAgent?: string;
  xr?: {
    isSessionSupported(mode: 'immersive-ar'): Promise<boolean>;
  };
};

export type GuestBrowserArSupportDetector = () => ArSupport | Promise<ArSupport>;

export type GuestBrowserEnvironment = Omit<
  GuestEntryElementEnvironment,
  'document'
> & {
  document: GuestBrowserDocument;
  fetch?: typeof fetch;
  location?: GuestBrowserLocation;
  navigator?: GuestBrowserNavigator;
};

export type GuestBrowserBootstrapOptions = {
  arSupport?: ArSupport;
  arSupportDetector?: GuestBrowserArSupportDetector;
  currentAnchorId?: string;
  driftMeters?: number;
  endpoint?: string;
  initialConfig?: GuestEntryElementConfig;
  location?: GuestBrowserLocation;
  network?: NetworkState;
  routeLoader?: GuestBrowserRouteLoader;
  trackingConfidence?: GuestEntryElementConfig['trackingConfidence'];
};

export function bootstrapGuestEntry(
  environment: GuestBrowserEnvironment,
  options: GuestEntryElementConfig | GuestBrowserBootstrapOptions = {},
) {
  const elementConstructor = registerGuestEntryElement(environment);
  const host =
    environment.document.querySelector('lechigo-guest-entry') ??
    environment.document.querySelector('[data-guest-entry]');

  if (!host) {
    return {
      configured: false,
      elementConstructor,
    };
  }

  const config = isGuestEntryElementConfig(options)
    ? options
    : options.initialConfig;

  if (config) {
    host.configure(config);
    return {
      configured: true,
      elementConstructor,
      routeLoad: undefined,
    };
  }

  const bootstrapOptions = isGuestEntryElementConfig(options) ? {} : options;
  const location = bootstrapOptions.location ?? environment.location;
  const token = location ? parseGuestSessionToken(location) : undefined;
  const pendingConfig = createPendingGuestEntryConfig(token, bootstrapOptions);

  host.configure(pendingConfig);

  if (!token) {
    return {
      configured: true,
      elementConstructor,
      routeLoad: undefined,
    };
  }

  const routeLoader =
    bootstrapOptions.routeLoader ??
    createHttpGuestRouteLoader({
      endpoint: bootstrapOptions.endpoint,
      fetch: environment.fetch,
    });
  const arSupportLoad = resolveBrowserArSupport(environment, bootstrapOptions);
  const routeLoad = Promise.all([routeLoader({ token }), arSupportLoad])
    .then(([result, arSupport]) => {
      const detectedConfig = { ...pendingConfig, arSupport };
      host.configure(
        result.ok
          ? { ...detectedConfig, route: result.route }
          : { ...detectedConfig, routeLoadError: result.error },
      );
      return result;
    })
    .catch((error: unknown) => {
      const result = {
        ok: false,
        error: error instanceof Error ? error.message : 'route-load-failed',
      } satisfies GuestBrowserRouteLoadResult;
      host.configure({ ...pendingConfig, routeLoadError: result.error });
      return result;
    });

  return {
    configured: true,
    elementConstructor,
    routeLoad,
  };
}

export function parseGuestSessionToken(location: GuestBrowserLocation) {
  return (
    readTokenFromParams(location.search) ??
    readTokenFromParams(location.hash.replace(/^#/, '?'))
  );
}

export async function detectBrowserArSupport(
  navigator: GuestBrowserNavigator | undefined,
): Promise<ArSupport> {
  const platform = classifyBrowserPlatform(navigator);
  const xrAvailable = Boolean(navigator?.xr);
  const immersiveArSupported = xrAvailable
    ? await navigator?.xr
        ?.isSessionSupported('immersive-ar')
        .catch(() => false)
    : false;

  return detectArSupport({
    webglAvailable: immersiveArSupported === true,
    xrAvailable,
    immersiveArSupported: immersiveArSupported === true,
    platform,
  });
}

function resolveBrowserArSupport(
  environment: GuestBrowserEnvironment,
  options: GuestBrowserBootstrapOptions,
): Promise<ArSupport> {
  if (options.arSupport) {
    return Promise.resolve(options.arSupport);
  }

  if (options.arSupportDetector) {
    return Promise.resolve(options.arSupportDetector()).catch(() => 'manual');
  }

  return detectBrowserArSupport(environment.navigator);
}

function classifyBrowserPlatform(
  navigator: GuestBrowserNavigator | undefined,
): 'ios' | 'android' | 'desktop' | 'unknown' {
  const fingerprint = `${navigator?.platform ?? ''} ${navigator?.userAgent ?? ''}`.toLowerCase();

  if (fingerprint.includes('android')) {
    return 'android';
  }

  if (
    fingerprint.includes('iphone') ||
    fingerprint.includes('ipad') ||
    fingerprint.includes('ipod')
  ) {
    return 'ios';
  }

  if (fingerprint.includes('mac') || fingerprint.includes('win') || fingerprint.includes('linux')) {
    return 'desktop';
  }

  return 'unknown';
}

export function createHttpGuestRouteLoader(input: {
  endpoint?: string;
  fetch?: typeof fetch;
}): GuestBrowserRouteLoader {
  const fetchRoute = input.fetch ?? globalThis.fetch;
  const endpoint = input.endpoint ?? '/api/guest/routes';

  return async ({ token }) => {
    if (!fetchRoute) {
      return {
        ok: false,
        error: 'fetch-unavailable',
      };
    }

    const url = new URL(endpoint, 'http://localhost');
    url.searchParams.set('token', token);
    const response = await fetchRoute(`${url.pathname}${url.search}`);
    const contentType = response.headers.get('content-type') ?? '';

    if (!contentType.includes('application/json')) {
      return {
        ok: false,
        status: response.status,
        error: 'route-load-failed',
      };
    }

    const payload = (await response.json()) as GuestBrowserRouteLoadResult;

    if (!response.ok && payload.ok) {
      return {
        ok: false,
        status: response.status,
        error: 'route-load-failed',
      };
    }

    return payload;
  };
}

function createPendingGuestEntryConfig(
  token: string | undefined,
  options: GuestBrowserBootstrapOptions,
): GuestEntryElementConfig {
  return {
    route: undefined,
    token,
    network: options.network ?? 'online',
    arSupport: options.arSupport ?? 'manual',
    currentAnchorId: options.currentAnchorId ?? 'entrance',
    trackingConfidence: options.trackingConfidence ?? 'normal',
    driftMeters: options.driftMeters ?? 0,
  };
}

function readTokenFromParams(value: string) {
  const token = new URLSearchParams(value).get('token')?.trim();

  return token ? token : undefined;
}

function isGuestEntryElementConfig(
  value: GuestEntryElementConfig | GuestBrowserBootstrapOptions,
): value is GuestEntryElementConfig {
  return 'route' in value && 'token' in value && 'network' in value;
}

export function createDemoGuestEntryConfig(): GuestEntryElementConfig {
  return {
    route: {
      id: 'demo-route',
      storeId: 'demo-store',
      version: 1,
      anchors: [
        {
          id: 'entrance',
          label: 'Entrance',
          floor: 1,
          position: { x: 0, y: 0, z: 0 },
          type: 'start',
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
          toAnchorId: 'restroom',
          instruction: 'Follow the hallway to the restroom.',
          distanceMeters: 8,
        },
      ],
      totalDistanceMeters: 8,
      floorTransitions: [],
    },
    token: 'demo-guest-token',
    network: 'online',
    arSupport: 'manual',
    currentAnchorId: 'entrance',
    trackingConfidence: 'normal',
    driftMeters: 0.2,
  };
}

const browserGlobal = globalThis as unknown as Partial<GuestBrowserEnvironment>;

if (
  browserGlobal.customElements &&
  browserGlobal.HTMLElement &&
  browserGlobal.document
) {
  bootstrapGuestEntry({
    customElements: browserGlobal.customElements,
    HTMLElement: browserGlobal.HTMLElement,
    document: browserGlobal.document,
    fetch: browserGlobal.fetch,
    location: browserGlobal.location,
    navigator: browserGlobal.navigator,
  });
}
