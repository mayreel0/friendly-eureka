import { bootstrapGuestEntry, type GuestBrowserEnvironment } from './bootstrap.ts';
import { registerGuestLitElement } from './guest-element.ts';

registerGuestLitElement();
bootstrapGuestEntry(globalThis as unknown as GuestBrowserEnvironment);
