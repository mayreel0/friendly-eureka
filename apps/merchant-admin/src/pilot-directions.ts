import type { Segment } from '../../../packages/route-core/src/index.ts';

export type PilotDirection = { instruction: string; distanceMeters: number; landmarkLabel?: string; floorTransition?: Segment['floorTransition'] };
export type PilotDirections = PilotDirection[];
export const maxPilotSteps = 20;

export const defaultPilotDirections: PilotDirections = [
  { instruction: 'Walk toward the main hallway.', distanceMeters: 4 },
  { instruction: 'Turn right at Main Hallway and continue to the restroom.', distanceMeters: 4.2 },
];

export class InvalidPilotDirectionsError extends Error {}

export function parsePilotDirections(value: unknown): PilotDirections {
  if (!Array.isArray(value) || value.length < 1 || value.length > maxPilotSteps) {
    throw new InvalidPilotDirectionsError(`A route must contain 1-${maxPilotSteps} steps.`);
  }
  let currentFloor: number | undefined;
  return value.map((item: unknown, index) => {
    if (!item || typeof item !== 'object') throw new InvalidPilotDirectionsError('Invalid route segment.');
    const { instruction, distanceMeters, landmarkLabel, floorTransition } = item as Partial<PilotDirection>;
    if (typeof instruction !== 'string' || !instruction.trim() || instruction.trim().length > 500 ||
      typeof distanceMeters !== 'number' || !Number.isFinite(distanceMeters) || distanceMeters <= 0 || distanceMeters > 1000) {
      throw new InvalidPilotDirectionsError('Each instruction must contain 1-500 characters and each distance must be greater than 0 and at most 1000 meters.');
    }
    if (landmarkLabel !== undefined && (typeof landmarkLabel !== 'string' || landmarkLabel.trim().length > 80)) {
      throw new InvalidPilotDirectionsError('Landmark names must contain at most 80 characters.');
    }
    const transition = parseFloorTransition(floorTransition);
    if (transition) {
      if (currentFloor !== undefined && transition.fromFloor !== currentFloor) {
        throw new InvalidPilotDirectionsError(`Step ${index + 1} must start on floor ${currentFloor}.`);
      }
      currentFloor = transition.toFloor;
    }
    return { instruction: instruction.trim(), distanceMeters,
      ...(landmarkLabel?.trim() ? { landmarkLabel: landmarkLabel.trim() } : {}),
      ...(transition ? { floorTransition: transition } : {}) };
  });
}

function parseFloorTransition(value: unknown): Segment['floorTransition'] {
  if (value === undefined) return undefined;
  if (!value || typeof value !== 'object') throw new InvalidPilotDirectionsError('Invalid floor transition.');
  const { type, fromFloor, toFloor } = value as NonNullable<Segment['floorTransition']>;
  if (!['stairs', 'elevator', 'ramp'].includes(type) ||
    !Number.isInteger(fromFloor) || !Number.isInteger(toFloor) ||
    fromFloor < -10 || fromFloor > 200 || toFloor < -10 || toFloor > 200 || fromFloor === toFloor) {
    throw new InvalidPilotDirectionsError('Choose stairs, elevator or ramp between different whole-number floors (-10 to 200).');
  }
  return { type, fromFloor, toFloor };
}

export function samePilotDirections(left = defaultPilotDirections, right = defaultPilotDirections) {
  return left.length === right.length && left.every((step, index) => step.instruction === right[index].instruction &&
    step.distanceMeters === right[index].distanceMeters && (step.landmarkLabel ?? '') === (right[index].landmarkLabel ?? '') &&
    step.floorTransition?.type === right[index].floorTransition?.type &&
    step.floorTransition?.fromFloor === right[index].floorTransition?.fromFloor &&
    step.floorTransition?.toFloor === right[index].floorTransition?.toFloor);
}
