import { createGuestWebxrDevServer } from '../apps/guest-webxr/dev-server.ts';
import { createMerchantAdminDevServer } from '../apps/merchant-admin/dev-server.ts';

const host = process.env.HOST ?? '127.0.0.1';
const guestPort = Number(process.env.GUEST_PORT ?? 4173);
const merchantPort = Number(process.env.MERCHANT_PORT ?? 4174);
const guestOrigin = `http://${host}:${guestPort}`;

const guestServer = createGuestWebxrDevServer();
const merchantServer = createMerchantAdminDevServer({ guestOrigin });

await Promise.all([
  listen(guestServer, guestPort, host),
  listen(merchantServer, merchantPort, host),
]);

console.log(`Guest WebXR dev shell: ${guestOrigin}/`);
console.log(`Merchant admin dev shell: http://${host}:${merchantPort}/`);
console.log('Pilot flow: open merchant admin, generate the guest URL, then open it.');

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    void closeAll().finally(() => {
      process.exit(0);
    });
  });
}

function listen(server, port, hostname) {
  return new Promise((resolve) => {
    server.listen(port, hostname, resolve);
  });
}

async function closeAll() {
  await Promise.all([close(merchantServer), close(guestServer)]);
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
