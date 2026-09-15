export const uiPackage = '@lechigo/ui';

export function resolvePasswordPanelState(input: {
  canViewPassword: boolean;
  expiresAt?: string;
  password: string | undefined;
  source: 'qr' | 'wifi';
}) {
  const expiryLabel = input.expiresAt ? ` Session expires at ${input.expiresAt}.` : '';

  if (!input.canViewPassword || input.source !== 'wifi') {
    return {
      state: 'locked',
      message: `Connect to verified store Wi-Fi to view the restroom code.${expiryLabel}`,
      visiblePassword: undefined,
    };
  }

  if (!input.password) {
    return {
      state: 'unavailable',
      message: 'Ask staff for the current restroom code.',
      visiblePassword: undefined,
    };
  }

  return {
    state: 'revealed',
    message: `Restroom code available.${expiryLabel}`,
    visiblePassword: input.password,
  };
}
