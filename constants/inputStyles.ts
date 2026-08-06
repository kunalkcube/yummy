import { Platform, type TextStyle } from 'react-native';

/** Strip browser focus ring on Expo web / Tauri (no-op on native). */
export const webInputReset: TextStyle =
  Platform.OS === 'web'
    ? ({
        outlineStyle: 'none',
        outlineWidth: 0,
      } as unknown as TextStyle)
    : {};
