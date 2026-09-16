import { LitElement, css, html, nothing } from 'lit';
import { resolveEntryState, type GuestEntryElementConfig } from './index.ts';
import { getLandmarkSteps } from './landmarks.ts';

export class GuestEntryElement extends LitElement {
  static styles = css`
    :host { display: block; min-height: 100vh; color: #182523; background: #f5f7f6;
      font-family: system-ui, sans-serif; line-height: 1.5; }
    * { box-sizing: border-box; }
    main { max-width: 640px; padding: 32px 24px; margin: auto; overflow-wrap: anywhere; }
    header { border-bottom: 1px solid #cdd8d2; padding-bottom: 20px; }
    h1 { font-size: 1.8rem; line-height: 1.2; margin: 12px 0; }
    h2 { font-size: 1.125rem; }
    p { margin: 12px 0; }
    [data-progress] { color: #46564e; }
    progress { width: 100%; height: 10px; accent-color: #12705a; }
    [data-current-instruction] { font-size: 1.25rem; }
    [data-floor-transition] { border-left: 4px solid #946c14; padding-left: 12px; }
    nav { display: flex; gap: 12px; flex-wrap: wrap; margin: 28px 0; }
    button { font: inherit; min-height: 48px; padding: 12px 18px; border-radius: 6px;
      border: 1px solid #7c9187; color: #182523; background: #fff; cursor: pointer; }
    button.primary { color: white; background: #12674f; border-color: #12674f; font-weight: 650; }
    button:disabled { opacity: .5; cursor: default; }
    button:focus-visible, summary:focus-visible { outline: 3px solid #946c14; outline-offset: 3px; }
    ol { padding-left: 24px; }
    li { padding: 10px 0; }
    li[aria-current='step'] { font-weight: 700; }
    summary { cursor: pointer; min-height: 44px; padding: 10px 0; }
    footer { margin-top: 32px; border-top: 1px solid #cdd8d2; padding-top: 12px; color: #46564e; }
  `;

  private config?: GuestEntryElementConfig;
  private stepIndex = 0;

  configure(config: GuestEntryElementConfig) {
    if (this.config?.token !== config.token || this.config?.route?.id !== config.route?.id ||
      this.config?.route?.version !== config.route?.version) this.stepIndex = 0;
    this.config = config;
    this.requestUpdate();
  }

  protected render() {
    if (!this.config) return nothing;
    const state = resolveEntryState(this.config);
    if (!this.config.route || !['ready', 'manual-fallback'].includes(state.screen)) {
      const message = state.screen === 'scan-required'
        ? ['Scan the venue QR', 'Scan the QR at the entrance to open restroom directions.']
        : state.screen === 'loading'
          ? ['Loading directions', 'Please wait.']
          : state.screen === 'offline'
            ? ['No connection', 'Reconnect to load restroom directions.']
            : ['Route unavailable', 'Scan the venue QR again or ask staff for directions.'];
      return html`<main data-screen=${state.screen}><h1>${message[0]}</h1><p role="status">${message[1]}</p></main>`;
    }
    const steps = getLandmarkSteps(this.config.route);
    if (!steps) return html`<main data-screen="error"><h1>Route unavailable</h1><p>Ask staff for restroom directions.</p></main>`;
    const arrived = this.stepIndex === steps.length;
    const step = steps[this.stepIndex];
    const destination = steps[steps.length - 1].toLabel;
    const remaining = steps.slice(this.stepIndex).reduce((sum, item) => sum + item.distanceMeters, 0);
    const recovery = this.config.trackingConfidence !== 'normal' || this.config.driftMeters > 1.5;
    return html`
      <main data-screen=${arrived ? 'arrived' : 'manual-fallback'}>
        <header><p>Directions to ${destination}</p>
          <p data-progress>${arrived ? 'Route complete' : `Step ${this.stepIndex + 1} of ${steps.length}`}</p>
          <progress max=${steps.length} value=${this.stepIndex} aria-label="Completed route steps"></progress>
        </header>
        <div aria-live="polite" aria-atomic="true">
          <h1>${arrived ? 'You have arrived' : step.toLabel}</h1>
          ${arrived ? html`<p>${destination}</p>` : html`
            <p data-current-instruction>${step.instruction}</p>
            <p>${step.distanceMeters} meters to this landmark · ${Number(remaining.toFixed(1))} meters remaining</p>
            ${step.floorTransition ? html`<p data-floor-transition>
              Floor ${step.floorTransition.fromFloor} to ${step.floorTransition.toFloor} · ${step.floorTransition.type}
            </p>` : nothing}
            ${recovery ? html`<p>Use the landmarks below to continue. Ask staff if the route does not match your surroundings.</p>` : nothing}
          `}
        </div>
        <nav aria-label="Route progress">
          <button ?disabled=${this.stepIndex === 0} @click=${() => this.move(-1)}>Previous landmark</button>
          ${arrived ? nothing : html`<button class="primary" @click=${() => this.move(1)}>
            ${this.stepIndex === steps.length - 1 ? 'I have arrived' : 'Reached this landmark'}
          </button>`}
        </nav>
        <details><summary>All directions</summary><ol>${steps.map((item, index) => html`
          <li aria-current=${index === this.stepIndex ? 'step' : 'false'}>
            ${item.instruction} ${item.distanceMeters} meters. ${item.toLabel}.
          </li>`)}</ol></details>
        ${this.config.session?.canViewPassword === false ? html`<footer>For the restroom door code, ask staff.</footer>` : nothing}
      </main>`;
  }

  private move(direction: -1 | 1) {
    if (!this.config?.route) return;
    const count = getLandmarkSteps(this.config.route)?.length ?? 0;
    this.stepIndex = Math.max(0, Math.min(count, this.stepIndex + direction));
    this.requestUpdate();
  }
}

export function registerGuestLitElement() {
  if (!customElements.get('lechigo-guest-entry')) customElements.define('lechigo-guest-entry', GuestEntryElement);
}
