export type PilotDirection = { instruction: string; distanceMeters: number };
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
  return value.map((item: unknown) => {
    if (!item || typeof item !== 'object') throw new InvalidPilotDirectionsError('Invalid route segment.');
    const { instruction, distanceMeters } = item as Partial<PilotDirection>;
    if (typeof instruction !== 'string' || !instruction.trim() || instruction.trim().length > 500 ||
      typeof distanceMeters !== 'number' || !Number.isFinite(distanceMeters) || distanceMeters <= 0 || distanceMeters > 1000) {
      throw new InvalidPilotDirectionsError('Each instruction must contain 1-500 characters and each distance must be greater than 0 and at most 1000 meters.');
    }
    return { instruction: instruction.trim(), distanceMeters };
  });
}

export function samePilotDirections(left = defaultPilotDirections, right = defaultPilotDirections) {
  return left.length === right.length && left.every((step, index) => step.instruction === right[index].instruction && step.distanceMeters === right[index].distanceMeters);
}
