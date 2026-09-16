import { bootstrapGuestEntry, type GuestBrowserEnvironment } from './bootstrap.ts';
import { registerGuestLitElement, type GuestEntryElement } from './guest-element.ts';

registerGuestLitElement();
const host = document.querySelector<GuestEntryElement>('lechigo-guest-entry');
let loading = false;
let routeLoaded = false;

async function loadRoute() {
  if (loading) return;
  loading = true;
  try {
    const result = bootstrapGuestEntry(globalThis as unknown as GuestBrowserEnvironment, {
      network: navigator.onLine ? 'online' : 'offline',
    });
    const route = await result.routeLoad;
    routeLoaded = route?.ok === true;
  } finally {
    loading = false;
    host?.setNetwork(navigator.onLine ? 'online' : 'offline');
  }
}

host?.addEventListener('guest-retry', () => { void loadRoute(); });
window.addEventListener('offline', () => host?.setNetwork('offline'));
window.addEventListener('online', () => {
  host?.setNetwork('online');
  if (!routeLoaded) void loadRoute();
});
void loadRoute();
