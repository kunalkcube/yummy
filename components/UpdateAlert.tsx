import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Linking,
} from 'react-native';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { ArrowUpRight, Download, X } from 'lucide-react-native';

interface UpdateAlertProps {
  visible: boolean;
  latestVersion: string;
  currentVersion: string;
  releaseNotes: string;
  downloadUrl: string;
  onDismiss: () => void;
}

export default function UpdateAlert({
  visible,
  latestVersion,
  currentVersion,
  releaseNotes,
  downloadUrl,
  onDismiss,
}: UpdateAlertProps) {
  const handleUpdate = () => {
    Linking.openURL(downloadUrl);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <TouchableOpacity style={styles.closeButton} onPress={onDismiss}>
            <X size={18} color={Colors.textSecondary} />
          </TouchableOpacity>

          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <ArrowUpRight size={28} color={Colors.accent} />
            </View>
            <Text style={styles.title}>Update Available</Text>
            <Text style={styles.subtitle}>
              Version {latestVersion} is ready
            </Text>
          </View>

          <View style={styles.versionInfo}>
            <View style={styles.versionBadge}>
              <Text style={styles.versionLabel}>Current</Text>
              <Text style={styles.versionText}>{currentVersion}</Text>
            </View>
            <Text style={styles.arrow}>→</Text>
            <View style={[styles.versionBadge, styles.versionBadgeNew]}>
              <Text style={styles.versionLabelNew}>New</Text>
              <Text style={styles.versionText}>{latestVersion}</Text>
            </View>
          </View>

          <View style={styles.notesContainer}>
            <Text style={styles.notesTitle}>Release Notes</Text>
            <ScrollView style={styles.notesScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.notesText}>{releaseNotes}</Text>
            </ScrollView>
          </View>

          <TouchableOpacity style={styles.updateButton} onPress={handleUpdate} activeOpacity={0.85}>
            <Download size={18} color="#fff" />
            <Text style={styles.updateButtonText}>Download Update</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.dismissButton} onPress={onDismiss} activeOpacity={0.7}>
            <Text style={styles.dismissButtonText}>Maybe Later</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
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
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 360,
    position: 'relative',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 4,
    zIndex: 1,
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
  },
  iconContainer: {
    marginBottom: 10,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: `${Colors.accent}15`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontFamily: Fonts.GeistMono.Bold,
    color: Colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: Fonts.GeistMono.Regular,
    color: Colors.textSecondary,
  },
  versionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 16,
  },
  versionBadge: {
    backgroundColor: Colors.card,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    minWidth: 80,
  },
  versionBadgeNew: {
    backgroundColor: `${Colors.accent}20`,
  },
  versionLabel: {
    fontSize: 10,
    fontFamily: Fonts.GeistMono.Regular,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  versionLabelNew: {
    fontSize: 10,
    fontFamily: Fonts.GeistMono.Regular,
    color: Colors.accent,
    marginBottom: 2,
  },
  versionText: {
    fontSize: 15,
    fontFamily: Fonts.GeistMono.SemiBold,
    color: Colors.text,
  },
  arrow: {
    fontSize: 18,
    color: Colors.textSecondary,
  },
  notesContainer: {
    backgroundColor: Colors.background,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    maxHeight: 140,
  },
  notesTitle: {
    fontSize: 11,
    fontFamily: Fonts.GeistMono.SemiBold,
    color: Colors.textSecondary,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  notesScroll: {},
  notesText: {
    fontSize: 13,
    fontFamily: Fonts.GeistMono.Regular,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  updateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent,
    borderRadius: 30,
    paddingVertical: 14,
    gap: 8,
    marginBottom: 10,
  },
  updateButtonText: {
    fontSize: 15,
    fontFamily: Fonts.GeistMono.Bold,
    color: '#fff',
  },
  dismissButton: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  dismissButtonText: {
    fontSize: 13,
    fontFamily: Fonts.GeistMono.Regular,
    color: Colors.textSecondary,
  },
});
