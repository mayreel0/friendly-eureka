import { createGuestWebxrDevServer } from '../apps/guest-webxr/dev-server.ts';
import { createMerchantAdminDevServer } from '../apps/merchant-admin/dev-server.ts';
import { pathToFileURL } from 'node:url';

const host = process.env.HOST ?? '127.0.0.1';
const guestPort = Number(process.env.GUEST_PORT ?? 4173);
const merchantPort = Number(process.env.MERCHANT_PORT ?? 4174);
const guestOrigin = `http://${host}:${guestPort}`;
const publicGuestOrigin = process.env.GUEST_ORIGIN ?? guestOrigin;
const merchantOrigin = `http://${host}:${merchantPort}`;

if (isMainModule()) {
  const guestServer = createGuestWebxrDevServer();
  const merchantServer = createMerchantAdminDevServer({ guestOrigin: publicGuestOrigin });

  await Promise.all([
    listen(guestServer, guestPort, host),
    listen(merchantServer, merchantPort, host),
  ]);

  for (const line of createDevPilotInstructions({ guestOrigin, merchantOrigin, publicGuestOrigin })) {
    console.log(line);
  }

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => {
      void closeAll([merchantServer, guestServer]).finally(() => {
        process.exit(0);
      });
    });
  }
}

function listen(server, port, hostname) {
  return new Promise((resolve) => {
    server.listen(port, hostname, resolve);
  });
}

async function closeAll(servers) {
  await Promise.all(servers.map((server) => close(server)));
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

export function createDevPilotInstructions(input) {
  return [
    `Guest WebXR dev shell: ${input.guestOrigin}/`,
    `Merchant admin dev shell: ${input.merchantOrigin}/`,
    `Dev guest session JSON: ${input.guestOrigin}/api/dev/guest-session`,
    `Merchant-generated guest URL text: ${input.merchantOrigin}/api/dev/pilot-route-session-url`,
    `Android tunnel command: cloudflared tunnel --url ${input.guestOrigin}`,
    ...(input.publicGuestOrigin && input.publicGuestOrigin !== input.guestOrigin
      ? [`Guest QR origin: ${input.publicGuestOrigin}`] : []),
    'Pilot flow: open merchant admin, generate the guest URL, then open it on Android Chrome.',
  ];
}

function isMainModule() {
  return import.meta.url === pathToFileURL(process.argv[1]).href;
}
