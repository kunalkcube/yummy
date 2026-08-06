import { useWindowDimensions } from 'react-native';

/** Width at which desktop shell, card clamps, and row chevrons apply. */
export const DESKTOP_MIN_WIDTH = 768;

export function useIsDesktop() {
  const { width } = useWindowDimensions();
  return width >= DESKTOP_MIN_WIDTH;
}
