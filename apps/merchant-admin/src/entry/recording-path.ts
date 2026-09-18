import { html, svg } from 'lit';
import type { AndroidRecording } from '../../../../packages/route-core/src/recording.ts';
import { projectRecordingPath } from '../recording-path.ts';

export function renderRecordingPath(recording: AndroidRecording) {
  const map = projectRecordingPath(recording);
  const first = map.points[0];
  return html`<figure data-recording-path>
    <svg viewBox="0 0 480 320" role="img" aria-label="Recorded path, top view">
      <title>Recorded path, top view</title>
      <desc>Entrance-relative path with ${recording.landmarks.length} numbered locations. Initial facing direction is up. Height is not shown in this projection.</desc>
      <polyline data-route-line points=${map.points.map((p) => `${p.x},${p.y}`).join(' ')}
        fill="none" stroke="#17776b" stroke-width="4" stroke-linejoin="round" stroke-linecap="round" />
      <path d=${`M ${first.x} ${first.y - 13} v -16 m -5 5 l 5 -5 l 5 5`}
        fill="none" stroke="#17202a" stroke-width="2" />
      ${map.markers.map(({ index, point, landmark }) => svg`<g data-landmark-marker>
        <title>${index}. ${landmark.label}</title>
        <circle cx=${point.x} cy=${point.y} r="12" fill=${index === 0 ? '#17202a' : '#ffffff'} stroke="#17202a" stroke-width="2" />
        <text x=${point.x} y=${point.y} text-anchor="middle" dominant-baseline="central"
          fill=${index === 0 ? '#ffffff' : '#17202a'} font-size="13" font-weight="700">${index}</text>
      </g>`)}
    </svg>
    <figcaption>Entrance-relative · Height range ${map.heightRange.toFixed(2)} m</figcaption>
    <p>0. ${recording.landmarks[0].label}</p>
  </figure>`;
}
