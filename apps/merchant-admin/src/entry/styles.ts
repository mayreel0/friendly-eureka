import { css } from "lit";

export const merchantStyles = css`
    :host {
      display: block;
      min-height: 100vh;
      background: #f6f7f9;
      color: #17202a;
    }

    section {
      box-sizing: border-box;
      width: min(100%, 1040px);
      margin: 0 auto;
      padding: 32px 20px;
    }

    h1 {
      margin: 0 0 12px;
      font-size: 1.75rem;
      line-height: 1.2;
    }

    section[aria-label="Route directions"] { padding: 0; }
    section[aria-label="Route directions"] fieldset { border: 0; padding: 0; margin: 0; min-width: 0; }
    section[aria-label="Route directions"] h3 { font-size: .9375rem; margin: 16px 0 8px; }

    h2 {
      margin: 28px 0 12px;
      font-size: 1rem;
      line-height: 1.3;
    }

    p {
      margin: 0 0 16px;
      color: #46515f;
    }

    [data-progress-summary] {
      margin: 0 0 8px;
      color: #17202a;
      font-size: 1.125rem;
      font-weight: 700;
    }

    [data-progress-next-target] {
      margin-bottom: 24px;
    }

    [data-dashboard-grid] {
      display: grid;
      grid-template-columns: minmax(0, 1.2fr) minmax(280px, 0.8fr);
      gap: 16px;
      align-items: start;
    }

    [data-dashboard-column] {
      display: grid;
      min-width: 0;
      gap: 16px;
    }

    [data-dashboard-panel] {
      box-sizing: border-box;
      min-width: 0;
      overflow-wrap: anywhere;
      border: 1px solid #d7deea;
      border-radius: 8px;
      background: #ffffff;
      padding: 16px;
    }

    [data-dashboard-panel] h2 {
      margin-top: 0;
    }

    [data-status] {
      color: #17202a;
      font-weight: 700;
    }

    [data-actions] {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 24px 0;
    }

    button {
      min-height: 44px;
      padding: 0 14px;
      border: 1px solid #b9c0ca;
      border-radius: 6px;
      background: #ffffff;
      color: #17202a;
      font: inherit;
      font-weight: 700;
      cursor: pointer;
    }

    button:disabled {
      color: #8b95a1;
      cursor: not-allowed;
      background: #eceff3;
    }

    input,
    select,
    textarea {
      box-sizing: border-box;
      width: 100%;
      min-height: 40px;
      margin: 4px 0 12px;
      padding: 8px 10px;
      border: 1px solid #b9c0ca;
      border-radius: 6px;
      color: #17202a;
      font: inherit;
    }

    textarea {
      min-height: 72px;
      resize: vertical;
    }

    ol {
      display: grid;
      gap: 8px;
      margin: 20px 0 0;
      padding-left: 22px;
    }

    li[data-complete="true"] {
      color: #0f766e;
      font-weight: 700;
    }

    li[data-complete="false"] {
      color: #6b7280;
    }

    [data-qa-note] {
      display: block;
      margin-top: 4px;
      color: #46515f;
      font-size: 0.875rem;
      font-weight: 400;
    }

    a {
      overflow-wrap: anywhere;
      color: #0f766e;
      font-weight: 700;
    }

    @media (max-width: 760px) {
      [data-dashboard-grid] {
        grid-template-columns: 1fr;
      }
    }
  `;
