export type RouteTestResult = {
  result: 'pass' | 'fail';
  note: string;
  routeVersion: number;
  recordedAt: string;
};

export class InvalidRouteTestError extends Error {}

export function parseRouteTestInput(value: unknown) {
  if (!value || typeof value !== 'object') throw new InvalidRouteTestError('Invalid test result.');
  const input = value as Partial<RouteTestResult>;
  if (!['pass', 'fail'].includes(input.result ?? '') || typeof input.note !== 'string' ||
    !input.note.trim() || input.note.trim().length > 500 || !Number.isSafeInteger(input.routeVersion) || (input.routeVersion ?? 0) < 1) {
    throw new InvalidRouteTestError('Record a result, a note of 1-500 characters, and the current route version.');
  }
  return { result: input.result as 'pass' | 'fail', note: input.note.trim(), routeVersion: input.routeVersion! };
}

export function parseSavedRouteTest(value: unknown): RouteTestResult | undefined {
  if (value === undefined) return undefined;
  const input = parseRouteTestInput(value);
  const recordedAt = (value as RouteTestResult).recordedAt;
  if (typeof recordedAt !== 'string' || !Number.isFinite(Date.parse(recordedAt))) throw new InvalidRouteTestError('Invalid test timestamp.');
  return { ...input, recordedAt };
}

export function hasCurrentPassingTest(recording: { routeVersion?: number; testResult?: RouteTestResult }) {
  return recording.testResult?.result === 'pass' && recording.testResult.routeVersion === (recording.routeVersion ?? 1);
}
