import { Platform } from 'react-native';

type ShadowOptions = {
  color?: string;
  opacity: number;
  radius: number;
  offsetX?: number;
  offsetY: number;
  elevation: number;
};

// react-native-web warns that shadow*/elevation are deprecated in favor of the
// `boxShadow` CSS shorthand, but native iOS/Android still need shadow*/elevation —
// there's no single prop that works everywhere. This picks the right one per platform.
export function cardShadow({ color = '#000', opacity, radius, offsetX = 0, offsetY, elevation }: ShadowOptions) {
  if (Platform.OS === 'web') {
    return { boxShadow: `${offsetX}px ${offsetY}px ${radius}px rgba(0,0,0,${opacity})` };
  }
  return {
    shadowColor: color,
    shadowOpacity: opacity,
    shadowRadius: radius,
    shadowOffset: { width: offsetX, height: offsetY },
    elevation,
  };
}
