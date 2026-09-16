import { describeRouteSteps, type SerializedRoute } from '../../../../packages/route-core/src/index.ts';

export function getLandmarkSteps(route: SerializedRoute) {
  if (!Array.isArray(route.anchors) || !Array.isArray(route.segments) || !route.segments.length) return undefined;
  if (route.anchors.some((anchor) => !anchor || typeof anchor.id !== 'string' || typeof anchor.label !== 'string') ||
    route.segments.some((segment) => !segment || typeof segment.instruction !== 'string')) return undefined;
  const anchors = new Map(route.anchors.map((anchor) => [anchor.id, anchor]));
  if (anchors.size !== route.anchors.length) return undefined;
  const seen = new Set<string>();
  let current = route.segments[0].fromAnchorId;
  if (anchors.get(current)?.type !== 'start') return undefined;
  seen.add(current);
  for (const segment of route.segments) {
    if (segment.fromAnchorId !== current || !anchors.has(segment.toAnchorId) ||
      seen.has(segment.toAnchorId) || !Number.isFinite(segment.distanceMeters) || segment.distanceMeters < 0) return undefined;
    seen.add(segment.toAnchorId);
    current = segment.toAnchorId;
  }
  if (anchors.get(current)?.type !== 'destination') return undefined;
  return describeRouteSteps(route);
}
