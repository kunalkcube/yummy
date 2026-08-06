import { Colors } from '@/constants/colors';
import { useEffect } from 'react';
import { Platform } from 'react-native';

const STYLE_ID = 'yummy-web-input-reset';

/**
 * Removes the default browser focus outline / autofill glow on inputs
 * when running under Expo web or Tauri.
 */
export function WebInputReset() {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      input, textarea {
        outline: none !important;
        box-shadow: none !important;
      }
      input:focus, textarea:focus {
        outline: none !important;
        box-shadow: none !important;
      }
      input:-webkit-autofill,
      input:-webkit-autofill:hover,
      input:-webkit-autofill:focus,
      textarea:-webkit-autofill,
      textarea:-webkit-autofill:hover,
      textarea:-webkit-autofill:focus {
        -webkit-text-fill-color: ${Colors.text} !important;
        -webkit-box-shadow: 0 0 0px 1000px ${Colors.surface} inset !important;
        box-shadow: 0 0 0px 1000px ${Colors.surface} inset !important;
        transition: background-color 99999s ease-in-out 0s;
      }
    `;
    document.head.appendChild(style);
  }, []);

  return null;
}
