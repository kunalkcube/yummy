import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { useSettings } from '@/contexts/SettingsContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export const DebugInfo = () => {
  const { tmdbApiKey, streamUrl } = useSettings();
  const [visible, setVisible] = React.useState(false);

  const checkStorage = async () => {
    const key = await AsyncStorage.getItem('@tmdb_api_key');
    const url = await AsyncStorage.getItem('@stream_url');
    console.log('=== DIRECT ASYNCSTORAGE CHECK ===');
    console.log('API Key:', key ? key.substring(0, 20) + '... (length: ' + key.length + ')' : 'NOT FOUND');
    console.log('Stream URL:', url || 'NOT FOUND');
    console.log('================================');
    Alert.alert(
      'AsyncStorage Check',
      `API Key: ${key ? 'Found (' + key.length + ' chars)' : 'NOT FOUND'}\nStream URL: ${url || 'NOT FOUND'}`
    );
  };

  if (!visible) {
    return (
      <TouchableOpacity 
        style={styles.toggleButton} 
        onPress={() => setVisible(true)}
      >
        <Text style={styles.toggleText}>Show Debug</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => setVisible(false)}>
        <Text style={styles.title}>Debug Info (tap to hide)</Text>
      </TouchableOpacity>
      <Text style={styles.text}>
        API Key: {tmdbApiKey ? tmdbApiKey.substring(0, 8) + '...' : 'NOT SET'}
      </Text>
      <Text style={styles.text}>
        Stream URL: {streamUrl || 'NOT SET'}
      </Text>
      <TouchableOpacity style={styles.button} onPress={checkStorage}>
        <Text style={styles.buttonText}>Check AsyncStorage</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    padding: 10,
    margin: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  toggleButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: Colors.accent,
    padding: 8,
    borderRadius: 5,
    zIndex: 1000,
  },
  toggleText: {
    color: Colors.text,
    fontSize: 12,
    fontFamily: Fonts.GeistMono.Regular,
  },
  title: {
    color: Colors.accent,
    fontSize: 14,
    fontFamily: Fonts.GeistMono.Bold,
    marginBottom: 5,
  },
  text: {
    color: Colors.text,
    fontSize: 12,
    fontFamily: Fonts.GeistMono.Regular,
    marginBottom: 3,
  },
  button: {
    backgroundColor: Colors.accent,
    padding: 8,
    borderRadius: 5,
    marginTop: 5,
  },
  buttonText: {
    color: Colors.text,
    fontSize: 12,
    fontFamily: Fonts.GeistMono.Regular,
    textAlign: 'center',
  },
});
