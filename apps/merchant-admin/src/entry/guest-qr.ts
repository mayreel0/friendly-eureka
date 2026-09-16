import { LitElement, css, html, type PropertyValues } from 'lit';
import QRCode from 'qrcode';

class GuestQr extends LitElement {
  static properties = { url: { type: String } };
  static styles = css`
    :host { display: block; margin: 16px 0; }
    img { display: block; width: 320px; max-width: 100%; height: auto; aspect-ratio: 1; }
    a { display: inline-flex; align-items: center; min-height: 44px; color: #0f766e; font-weight: 700; }
    p { color: #46515f; }
  `;

  declare url: string;
  private image = '';
  private failed = false;

  constructor() {
    super();
    this.url = '';
  }

  protected willUpdate(changed: PropertyValues) {
    if (changed.has('url')) {
      this.image = '';
      this.failed = false;
      if (this.url) void this.generate(this.url);
    }
  }

  private async generate(url: string) {
    try {
      const image = await QRCode.toDataURL(url, {
        errorCorrectionLevel: 'M', margin: 4, scale: 6,
      });
      if (url !== this.url) return;
      this.image = image;
    } catch {
      if (url !== this.url) return;
      this.failed = true;
    }
    this.requestUpdate();
  }

  protected render() {
    if (this.failed) return html`<p role="alert">QR image unavailable. Use the guest link instead.</p>`;
    if (!this.image) return html`<p role="status">Preparing QR...</p>`;
    return html`
      <img src=${this.image} alt="Guest route QR code" width="320" height="320">
      <a href=${this.image} download="lechigo-pilot-guest-qr.png">Download QR image</a>
    `;
  }
}

if (typeof customElements !== 'undefined' && !customElements.get('lechigo-guest-qr')) {
  customElements.define('lechigo-guest-qr', GuestQr);
}
