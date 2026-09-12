import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  type GuestEntryElementConfig,
  type GuestEntryElementConstructor,
  type GuestFallbackDocument,
  type GuestFallbackElement,
} from '../src/entry/index.ts';
import { bootstrapGuestEntry } from '../src/entry/bootstrap.ts';

describe('guest WebXR browser bootstrap', () => {
  it('registers and configures the page custom element host', () => {
    const document = createTestDocument();
    const registry = createTestCustomElementRegistry();

    const result = bootstrapGuestEntry({
      customElements: registry,
      HTMLElement: TestGuestHTMLElement,
      document,
    });

    assert.equal(result.configured, true);
    assert.equal(registry.defineCalls.length, 1);
    assert.equal(registry.defineCalls[0]?.name, 'lechigo-guest-entry');

    const host = document.host;

    assert.equal(host.configurations.length, 1);
    assert.equal(host.configurations[0]?.arSupport, 'manual');
    assert.equal(host.shadowRoot?.getAttribute('data-shadow-root'), 'open');
    assert.equal(
      host.shadowRoot?.querySelectorAll('[data-screen]').at(0)?.getAttribute('data-screen'),
      'manual-fallback',
    );
    assert.match(host.shadowRoot?.textContent ?? '', /Manual route guidance/);
  });
});

function createTestDocument(): GuestFallbackDocument & {
  host: TestGuestHostElement;
  querySelector(selector: string): TestGuestHostElement | null;
} {
  const host = new TestGuestHostElement();

  return {
    host,

    createElement(tagName) {
      return new TestElement(tagName);
    },

    querySelector(selector) {
      return selector === 'lechigo-guest-entry' || selector === '[data-guest-entry]'
        ? host
        : null;
    },
  };
}

class TestElement implements GuestFallbackElement {
  private readonly attributes = new Map<string, string>();
  private readonly children: GuestFallbackElement[] = [];
  private ownTextContent: string | null = null;
  readonly tagName: string;

  constructor(tagName: string) {
    this.tagName = tagName;
  }

  get textContent() {
    const childText = this.children
      .map((child) => child.textContent ?? '')
      .join('');

    return `${this.ownTextContent ?? ''}${childText}`;
  }

  set textContent(value: string | null) {
    this.ownTextContent = value;
  }

  append(...nodes: GuestFallbackElement[]) {
    this.children.push(...nodes);
  }

  appendChild(node: GuestFallbackElement) {
    this.children.push(node);
    return node;
  }

  replaceChildren(...nodes: GuestFallbackElement[]) {
    this.children.splice(0, this.children.length, ...nodes);
  }

  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }

  getAttribute(name: string) {
    return this.attributes.get(name) ?? null;
  }

  querySelectorAll(selector: string) {
    const attributeName = selector.match(/^\[([a-z-]+)\]$/)?.[1];

    if (!attributeName) {
      return [];
    }

    return this.findElementsWithAttribute(attributeName);
  }

  private findElementsWithAttribute(name: string): GuestFallbackElement[] {
    const matches: GuestFallbackElement[] = this.getAttribute(name) ? [this] : [];

    for (const child of this.children) {
      matches.push(...child.querySelectorAll(`[${name}]`));
    }

    return matches;
  }
}

class TestGuestHTMLElement {
  shadowRoot: GuestFallbackElement | null = null;

  attachShadow(init: { mode: 'open' }) {
    const root = new TestElement('shadow-root');
    root.setAttribute('data-shadow-root', init.mode);
    this.shadowRoot = root;
    return root;
  }
}

class TestGuestHostElement {
  readonly configurations: GuestEntryElementConfig[] = [];
  private element: InstanceType<GuestEntryElementConstructor> | undefined;

  get shadowRoot() {
    return this.element?.shadowRoot ?? null;
  }

  configure(config: GuestEntryElementConfig) {
    this.configurations.push(config);
    this.ensureElement().configure(config);
  }

  private ensureElement() {
    if (!this.element) {
      this.element = new registeredGuestEntryElement();
    }

    return this.element;
  }
}

let registeredGuestEntryElement: GuestEntryElementConstructor;

function createTestCustomElementRegistry() {
  return {
    defineCalls: [] as Array<{
      name: string;
      constructor: GuestEntryElementConstructor;
    }>,

    define(name: string, constructor: GuestEntryElementConstructor) {
      registeredGuestEntryElement = constructor;
      this.defineCalls.push({ name, constructor });
    },

    get() {
      return registeredGuestEntryElement;
    },
  };
}
