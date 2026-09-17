import QRCode from 'qrcode';

export async function renderEntranceSign(entryUrl: string | undefined, routeVersion: number) {
  const image = entryUrl ? await QRCode.toDataURL(entryUrl, { errorCorrectionLevel: 'M', margin: 4, width: 640 }) : undefined;
  const origin = entryUrl ? new URL(entryUrl).origin : '';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${image ? 'Restroom directions' : 'Entrance QR unavailable'}</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; color: #182523; background: #f5f7f6; font: 18px/1.5 system-ui, sans-serif; }
  main { max-width: 640px; margin: 32px auto; padding: 24px; text-align: center; overflow-wrap: anywhere; }
  h1 { font-size: 32px; line-height: 1.2; margin: 0 0 16px; }
  img { display: block; width: min(100%, 400px); height: auto; aspect-ratio: 1; margin: 24px auto; }
  small { display: block; color: #46564e; }
  nav { display: flex; justify-content: center; gap: 24px; flex-wrap: wrap; margin: 32px 0; }
  button, a { font: inherit; min-height: 44px; padding: 10px 16px; color: #12674f; }
  button { cursor: pointer; border: 1px solid #12674f; border-radius: 6px; background: white; }
  :focus-visible { outline: 3px solid #946c14; outline-offset: 3px; }
  @page { size: A4 portrait; margin: 15mm; }
  @media print { body { background: white; } main { margin: 0 auto; padding: 10mm 0; break-inside: avoid; } nav { display: none; } img { width: 90mm; max-width: 100%; } }
</style></head><body><main>
${image ? `<h1>Restroom directions</h1><p>Scan for directions</p>
<img src="${image}" alt="Entrance route QR code" width="640" height="640">
<p>Need help? Ask a staff member.</p><small>Route v${routeVersion}</small><small>${escapeHtml(origin)}</small>
<nav><button type="button" onclick="window.print()">Print sign</button><a href="/">Back to dashboard</a></nav>`
    : '<h1>Entrance QR unavailable</h1><p>No active route.</p><nav><a href="/">Back to dashboard</a></nav>'}
</main></body></html>`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
}
