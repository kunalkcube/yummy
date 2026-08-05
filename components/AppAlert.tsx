import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

export type AlertButton = {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
};

export type AlertOptions = {
  title: string;
  message?: string;
  buttons?: AlertButton[];
};

type AlertContextValue = {
  show: (options: AlertOptions) => void;
};

const AlertContext = createContext<AlertContextValue | null>(null);

let imperativeShow: ((options: AlertOptions) => void) | null = null;

/** Drop-in replacement for React Native `Alert.alert` */
export function showAlert(
  title: string,
  message?: string,
  buttons?: AlertButton[]
) {
  if (!imperativeShow) {
    console.warn('AlertProvider is not mounted');
    return;
  }
  imperativeShow({ title, message, buttons });
}

export const AppAlert = {
  alert: showAlert,
};

export function useAppAlert() {
  const ctx = useContext(AlertContext);
  if (!ctx) {
    throw new Error('useAppAlert must be used within AlertProvider');
  }
  return ctx;
}

export function AlertProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [options, setOptions] = useState<AlertOptions | null>(null);

  const show = useCallback((next: AlertOptions) => {
    setOptions(next);
    setVisible(true);
  }, []);

  useEffect(() => {
    imperativeShow = show;
    return () => {
      imperativeShow = null;
    };
  }, [show]);

  const dismiss = () => {
    setVisible(false);
  };

  const buttons =
    options?.buttons && options.buttons.length > 0
      ? options.buttons
      : [{ text: 'OK', style: 'default' as const }];

  const handlePress = (button: AlertButton) => {
    dismiss();
    // Defer so the modal can close before side effects / nested alerts
    requestAnimationFrame(() => {
      button.onPress?.();
    });
  };

  return (
    <AlertContext.Provider value={{ show }}>
      {children}
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={dismiss}
      >
        <View style={styles.overlay}>
          <View style={styles.card}>
            {options?.title ? (
              <Text style={styles.title}>{options.title}</Text>
            ) : null}
            {options?.message ? (
              <Text style={styles.message}>{options.message}</Text>
            ) : null}

            <View
              style={[
                styles.actions,
                buttons.length === 2 && styles.actionsRow,
              ]}
            >
              {buttons.map((button, index) => {
                const variant = button.style ?? 'default';

                return (
                  <TouchableOpacity
                    key={`${button.text}-${index}`}
                    style={[
                      styles.button,
                      buttons.length === 2 && styles.buttonHalf,
                      variant === 'cancel' && styles.buttonCancel,
                      variant === 'destructive' && styles.buttonDestructive,
                      variant === 'default' && styles.buttonPrimary,
                    ]}
                    onPress={() => handlePress(button)}
                    activeOpacity={0.85}
                  >
                    <Text
                      style={[
                        styles.buttonText,
                        variant === 'cancel' && styles.buttonTextCancel,
                        variant === 'destructive' && styles.buttonTextDestructive,
                        variant === 'default' && styles.buttonTextPrimary,
                      ]}
                    >
                      {button.text}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
    </AlertContext.Provider>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 8,
    padding: 20,
    width: '100%',
    maxWidth: 340,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  title: {
    fontSize: 16,
    fontFamily: Fonts.GeistMono.Bold,
    color: Colors.text,
    marginBottom: 8,
  },
  message: {
    fontSize: 13,
    fontFamily: Fonts.GeistMono.Regular,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 4,
  },
  actions: {
    gap: 8,
    marginTop: 16,
  },
  actionsRow: {
    flexDirection: 'row',
  },
  button: {
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonHalf: {
    flex: 1,
  },
  buttonPrimary: {
    backgroundColor: '#fff',
  },
  buttonCancel: {
    backgroundColor: Colors.card,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  buttonDestructive: {
    backgroundColor: `${Colors.accent}18`,
    borderWidth: 1.5,
    borderColor: Colors.accent,
  },
  buttonText: {
    fontSize: 14,
    fontFamily: Fonts.GeistMono.Bold,
  },
  buttonTextPrimary: {
    color: '#000',
  },
  buttonTextCancel: {
    color: Colors.text,
  },
  buttonTextDestructive: {
    color: Colors.accent,
  },
});
