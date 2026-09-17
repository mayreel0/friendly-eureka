import { html } from 'lit';
import { defaultPilotDirections, maxPilotSteps, type PilotDirections } from '../pilot-directions.ts';

export function createDirectionsDraft(directions: PilotDirections = defaultPilotDirections) {
  return directions.map((step) => ({ instruction: step.instruction, distanceMeters: String(step.distanceMeters) }));
}

export type DirectionsDraft = ReturnType<typeof createDirectionsDraft>;

export function renderDirectionsEditor(options: {
  draft: DirectionsDraft;
  disabled: boolean;
  onChange: (index: number, field: 'instruction' | 'distanceMeters', value: string) => void;
  onSave: () => void;
  onAdd?: () => void;
  onRemove?: (index: number) => void;
}) {
  return html`<section aria-label="Route directions">
    <h2>Route directions</h2>
    <form @submit=${(event: SubmitEvent) => { event.preventDefault(); options.onSave(); }}>
      <fieldset ?disabled=${options.disabled}>
        ${options.draft.map((step, index) => html`<div>
          <h3>Step ${index + 1}${index === options.draft.length - 1 ? ': Restroom' : ''}</h3>
          <label>Step ${index + 1} instruction<textarea required maxlength="500" .value=${step.instruction}
            @input=${(event: Event) => options.onChange(index, 'instruction', (event.target as HTMLTextAreaElement).value)}></textarea></label>
          <label>Step ${index + 1} distance (meters)<input type="number" required min="0.01" max="1000" step="any" .value=${step.distanceMeters}
            @input=${(event: Event) => options.onChange(index, 'distanceMeters', (event.target as HTMLInputElement).value)}></label>
          <button type="button" aria-label=${`Remove step ${index + 1}`} title=${`Remove step ${index + 1}`}
            ?disabled=${options.draft.length <= 1} @click=${() => options.onRemove?.(index)}>&times;</button>
        </div>`)}
        <button type="button" aria-label="Add step" title="Add step" ?disabled=${options.draft.length >= maxPilotSteps}
          @click=${() => options.onAdd?.()}>+</button>
        <button type="submit">Save route directions</button>
      </fieldset>
    </form>
  </section>`;
}
