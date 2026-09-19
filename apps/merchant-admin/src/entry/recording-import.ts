import { html, nothing } from 'lit';
import { InvalidRecordingError, maxRecordingBytes, parseRecording, type AndroidRecording } from '../../../../packages/route-core/src/recording.ts';
import { GuestSessionError, PilotStateConflictError } from './api.ts';
import type { ImportedRecording } from '../recording-import.ts';
import type { PilotDevStateApiState } from './types.ts';
import { renderRecordingPath } from './recording-path.ts';

export async function readRecordingFile(file: File) {
  if (file.size > maxRecordingBytes) throw new GuestSessionError('Recording exceeds the 1 MB limit.');
  try { return parseRecording(JSON.parse(await file.text())); }
  catch (error) {
    if (error instanceof SyntaxError || error instanceof InvalidRecordingError) throw new GuestSessionError('Invalid Android route recording.');
    throw new GuestSessionError('Could not read this recording file.');
  }
}

export async function importRecording(recording: AndroidRecording, revision?: string) {
  const response = await fetch('/api/dev/pilot-route-import', {
    method: 'POST', headers: { 'content-type': 'application/json', ...(revision ? { 'x-pilot-revision': revision } : {}) },
    body: JSON.stringify(recording),
  });
  if (response.status === 409 || response.status === 428) throw new PilotStateConflictError('Saved state changed. Load the latest state before importing.');
  if (!response.ok) throw new GuestSessionError(response.status === 413 ? 'Recording exceeds the 1 MB limit.' :
    response.status === 422 ? 'Invalid Android route recording.' : 'Could not import this recording. Please try again.');
  return await response.json() as PilotDevStateApiState;
}

export function renderRecordingImport(options: {
  busy: boolean; pending?: AndroidRecording; saved?: ImportedRecording; routeVersion?: number;
  onFile: (file: File | undefined) => void; onImport: () => void;
}) {
  const recording = options.pending;
  return html`<section aria-label="Recorded route">
    <h2>Recorded route</h2>
    <label>Android recording JSON<input type="file" accept=".json,application/json" ?disabled=${options.busy}
      @change=${(event: Event) => {
        const input = event.target as HTMLInputElement;
        options.onFile(input.files?.[0]); input.value = '';
      }}></label>
    ${recording ? html`<div data-recording-preview aria-live="polite">
      <p>${recording.landmarks.length - 1} steps · ${recording.distanceMeters.toFixed(2)} m · ${recording.samples.length} samples</p>
      ${renderRecordingPath(recording)}
      <ol>${recording.landmarks.slice(1).map((point) => html`<li>${point.label}: ${point.instruction}</li>`)}</ol>
      <button type="button" ?disabled=${options.busy} @click=${options.onImport}>Import as new draft</button>
    </div>` : nothing}
    ${options.saved ? html`<p data-recording-source>Manual guidance · Android recording
      <time datetime=${options.saved.recordedAt}>${new Date(options.saved.recordedAt).toLocaleString()}</time>
      · imported as v${options.saved.routeVersion}${options.saved.routeVersion !== options.routeVersion ? ' · edited since import' : ''}</p>` : nothing}
    ${options.saved?.original ? html`
      ${recording ? nothing : html`<h3>Original recorded path · v${options.saved.routeVersion}</h3>
        ${renderRecordingPath(options.saved.original)}
        <ol>${options.saved.original.landmarks.slice(1).map((point) => html`<li>${point.label}: ${point.instruction}</li>`)}</ol>`}
      <a data-original-download href=${`/api/dev/pilot-route-source?version=${options.saved.routeVersion}`} download>Download original JSON</a>
    ` : options.saved ? html`<p>Original JSON was not retained for this import.</p>` : nothing}
  </section>`;
}
