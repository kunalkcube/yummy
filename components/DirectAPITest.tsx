import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import axios from 'axios';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export const DirectAPITest = () => {
  const [result, setResult] = useState<string>('');

  const testWithBearerToken = async () => {
    const bearerToken = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI1NDhjOTZiMDdhMGIwMjhiNThhOGI1YTM5ODYwZDljZSIsIm5iZiI6MTc2OTU0Mzg4MS45NjMsInN1YiI6IjY5NzkxOGM5ZTE4YTE0NzI1NjVhZTRkYyIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.HKtCjhpy0GwtcPp3997FulRu8ey1igUrLOpBfRgHxXo';
    
    try {
      console.log('Testing with Bearer token...');
      const response = await axios.get(
        'https://api.themoviedb.org/3/trending/all/week',
        {
          headers: {
            accept: 'application/json',
            Authorization: `Bearer ${bearerToken}`,
          },
        }
      );
      const msg = `✅ SUCCESS!\nGot ${response.data.results.length} results\nFirst movie: ${response.data.results[0].title || response.data.results[0].name}`;
      console.log(msg);
      setResult(msg);
    } catch (error: any) {
      const msg = `❌ FAILED\nStatus: ${error.response?.status}\nMessage: ${error.response?.data?.status_message || error.message}`;
      console.error(msg);
      setResult(msg);
    }
  };

  const testWithAPIKey = async () => {
    const apiKey = '548c96b07a0b028b58a8b5a39860d9ce';
    
    try {
      console.log('Testing with API key...');
      const response = await axios.get(
        'https://api.themoviedb.org/3/trending/all/week',
        {
          params: { api_key: apiKey },
        }
      );
      const msg = `✅ SUCCESS!\nGot ${response.data.results.length} results\nFirst movie: ${response.data.results[0].title || response.data.results[0].name}`;
      console.log(msg);
      setResult(msg);
    } catch (error: any) {
      const msg = `❌ FAILED\nStatus: ${error.response?.status}\nMessage: ${error.response?.data?.status_message || error.message}`;
      console.error(msg);
      setResult(msg);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Direct API Test</Text>
      
      <TouchableOpacity style={styles.button} onPress={testWithBearerToken}>
        <Text style={styles.buttonText}>Test Bearer Token</Text>
      </TouchableOpacity>
      
      <TouchableOpacity style={[styles.button, styles.buttonSecondary]} onPress={testWithAPIKey}>
        <Text style={styles.buttonText}>Test API Key</Text>
      </TouchableOpacity>
      
      {result ? (
        <ScrollView style={styles.resultContainer}>
          <Text style={styles.resultText}>{result}</Text>
        </ScrollView>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 15,
    backgroundColor: Colors.surface,
    margin: 15,
    borderRadius: 10,
  },
  title: {
    color: Colors.accent,
    fontSize: 18,
    fontFamily: Fonts.GeistMono.Bold,
    marginBottom: 15,
  },
  button: {
    backgroundColor: Colors.accent,
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
  },
  buttonSecondary: {
    backgroundColor: Colors.card,
  },
  buttonText: {
    color: Colors.text,
    textAlign: 'center',
    fontFamily: Fonts.GeistMono.Bold,
  },
  resultContainer: {
    marginTop: 15,
    maxHeight: 200,
  },
  resultText: {
    color: Colors.text,
    fontSize: 12,
    fontFamily: Fonts.GeistMono.Regular,
  },
});
