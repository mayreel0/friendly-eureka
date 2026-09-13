import { registerMerchantAdminElement } from './index.ts';

registerMerchantAdminElement({
  customElements: customElements as never,
  HTMLElement: HTMLElement as never,
  document: document as never,
});
