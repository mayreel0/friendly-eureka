import { html, nothing } from 'lit';
import { defaultPilotDirections, maxPilotSteps, parsePilotDirections, type PilotDirections } from '../pilot-directions.ts';

export function createDirectionsDraft(directions: PilotDirections = defaultPilotDirections) {
  let floor = directions.find((step) => step.floorTransition)?.floorTransition?.fromFloor ?? 1;
  return directions.map((step) => {
    const draft = { instruction: step.instruction, distanceMeters: String(step.distanceMeters), landmarkLabel: step.landmarkLabel ?? '',
      movement: step.floorTransition?.type ?? 'level', fromFloor: String(floor), toFloor: String(step.floorTransition?.toFloor ?? floor + 1) };
    floor = step.floorTransition?.toFloor ?? floor;
    return draft;
  });
}

export type DirectionsDraft = ReturnType<typeof createDirectionsDraft>;

export function parseDirectionsDraft(draft: DirectionsDraft) {
  return parsePilotDirections(draft.map((step) => ({ instruction: step.instruction, distanceMeters: Number(step.distanceMeters),
    landmarkLabel: step.landmarkLabel, ...(step.movement !== 'level' ? { floorTransition: {
      type: step.movement, fromFloor: step.fromFloor.trim() ? Number(step.fromFloor) : NaN,
      toFloor: step.toFloor.trim() ? Number(step.toFloor) : NaN,
    } } : {}) })));
}

export function renderDirectionsEditor(options: {
  draft: DirectionsDraft;
  disabled: boolean;
  onChange: (index: number, field: keyof DirectionsDraft[number], value: string) => void;
  onSave: () => void;
  onAdd?: () => void;
  onRemove?: (index: number) => void;
  onMove?: (index: number, offset: -1 | 1) => void;
}) {
  return html`<section aria-label="Route directions">
    <h2>Route directions</h2>
    <form @submit=${(event: SubmitEvent) => { event.preventDefault(); options.onSave(); }}>
      <fieldset ?disabled=${options.disabled}>
        ${options.draft.map((step, index) => html`<div>
          <h3>Step ${index + 1}${index === options.draft.length - 1 ? ': Destination' : ''}</h3>
          <label>Step ${index + 1} landmark name<input maxlength="80" .value=${step.landmarkLabel}
            @input=${(event: Event) => options.onChange(index, 'landmarkLabel', (event.target as HTMLInputElement).value)}></label>
          <label>Step ${index + 1} instruction<textarea required maxlength="500" .value=${step.instruction}
            @input=${(event: Event) => options.onChange(index, 'instruction', (event.target as HTMLTextAreaElement).value)}></textarea></label>
          <label>Step ${index + 1} distance (meters)<input type="number" required min="0.01" max="1000" step="any" .value=${step.distanceMeters}
            @input=${(event: Event) => options.onChange(index, 'distanceMeters', (event.target as HTMLInputElement).value)}></label>
          <label>Step ${index + 1} movement<select aria-label=${`Step ${index + 1} movement`} .value=${step.movement}
            @change=${(event: Event) => options.onChange(index, 'movement', (event.target as HTMLSelectElement).value)}>
            <option value="level">Same floor</option><option value="stairs">Stairs</option>
            <option value="elevator">Elevator</option><option value="ramp">Ramp</option>
          </select></label>
          ${step.movement !== 'level' ? html`
            <label>Step ${index + 1} from floor<input type="number" required min="-10" max="200" step="1" .value=${step.fromFloor}
              @input=${(event: Event) => options.onChange(index, 'fromFloor', (event.target as HTMLInputElement).value)}></label>
            <label>Step ${index + 1} to floor<input type="number" required min="-10" max="200" step="1" .value=${step.toFloor}
              @input=${(event: Event) => options.onChange(index, 'toFloor', (event.target as HTMLInputElement).value)}></label>
          ` : nothing}
          <button type="button" aria-label=${`Move step ${index + 1} up`} title=${`Move step ${index + 1} up`}
            ?disabled=${index === 0} @click=${() => options.onMove?.(index, -1)}>&uarr;</button>
          <button type="button" aria-label=${`Move step ${index + 1} down`} title=${`Move step ${index + 1} down`}
            ?disabled=${index === options.draft.length - 1} @click=${() => options.onMove?.(index, 1)}>&darr;</button>
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
