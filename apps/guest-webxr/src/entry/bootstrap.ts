import {
  type GuestEntryElementConfig,
  type GuestEntryElementEnvironment,
  registerGuestEntryElement,
} from './index.ts';

export type GuestBrowserHostElement = {
  configure(config: GuestEntryElementConfig): void;
};

export type GuestBrowserDocument = GuestEntryElementEnvironment['document'] & {
  querySelector(selector: string): GuestBrowserHostElement | null;
};

export type GuestBrowserEnvironment = Omit<GuestEntryElementEnvironment, 'document'> & {
  document: GuestBrowserDocument;
};

export function bootstrapGuestEntry(
  environment: GuestBrowserEnvironment,
  config = createDemoGuestEntryConfig(),
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

  host.configure(config);

  return {
    configured: true,
    elementConstructor,
  };
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
  });
}
