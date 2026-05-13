import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, StatusBar } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { Ionicons } from '@expo/vector-icons'; 
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function App() {
  const [videoUrl, setVideoUrl] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [sound, setSound] = useState();
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSongTitle, setCurrentSongTitle] = useState('');

  const BASE_URL = 'http://192.168.1.4:5000'; 

  useEffect(() => {
    return sound ? () => { sound.unloadAsync(); } : undefined;
  }, [sound]);

  const handlePlayPause = async () => {
    if (!sound) return;
    if (isPlaying) {
      await sound.pauseAsync();
      setIsPlaying(false);
    } else {
      await sound.playAsync();
      setIsPlaying(true);
    }
  };

  // Extracts the specific YouTube ID to get the official thumbnail image
  const getYouTubeThumbnail = (url) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    const videoId = (match && match[2].length === 11) ? match[2] : null;
    return videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : 'https://via.placeholder.com/150/121212/1DB954?text=Audio';
  };

  const handleDownload = async () => {
    if (!videoUrl) {
      Alert.alert('Empty Link', 'Please paste a song link.');
      return;
    }
    setIsDownloading(true);

    try {
      const infoUrl = `${BASE_URL}/info?url=${encodeURIComponent(videoUrl)}`;
      const infoResponse = await fetch(infoUrl);
      const infoData = await infoResponse.json();
      
      const cleanTitle = infoData.title ? infoData.title.replace(/[^a-zA-Z0-9 ]/g, "") : `Audio_${Date.now()}`;
      const finalFileName = `${cleanTitle}.mp3`;
      const tempUri = FileSystem.documentDirectory + finalFileName;
      const downloadUrl = `${BASE_URL}/download?url=${encodeURIComponent(videoUrl)}`;
      
      const downloadResumable = FileSystem.createDownloadResumable(downloadUrl, tempUri);
      const result = await downloadResumable.downloadAsync();
      
      if (result && result.uri) {
        // --- NEW: Save to Library History ---
        const thumbnailUrl = getYouTubeThumbnail(videoUrl);
        const newSong = { id: Date.now().toString(), title: cleanTitle, uri: result.uri, thumbnail: thumbnailUrl };
        
        const existingHistory = await AsyncStorage.getItem('okmusi_library');
        const historyArray = existingHistory ? JSON.parse(existingHistory) : [];
        await AsyncStorage.setItem('okmusi_library', JSON.stringify([newSong, ...historyArray]));
        // ------------------------------------

        const { sound: newSound } = await Audio.Sound.createAsync({ uri: result.uri });
        setSound(newSound);
        setCurrentSongTitle(cleanTitle);
        setIsPlaying(false);

        const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (permissions.granted) {
          const base64 = await FileSystem.readAsStringAsync(result.uri, { encoding: FileSystem.EncodingType.Base64 });
          const savedUri = await FileSystem.StorageAccessFramework.createFileAsync(permissions.directoryUri, finalFileName, 'audio/mpeg');
          await FileSystem.writeAsStringAsync(savedUri, base64, { encoding: FileSystem.EncodingType.Base64 });
          Alert.alert('Success!', 'Song added to your Library!');
        }
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Download Error', 'Could not connect. Check your Node server.');
    } finally {
      setIsDownloading(false);
      setVideoUrl('');
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <StatusBar barStyle="light-content" />
      <View style={styles.headerContainer}>
        <View style={styles.iconWrapper}>
          <Ionicons name="musical-notes" size={42} color="#1DB954" />
        </View>
        <Text style={styles.title}>OKmusi <Text style={styles.titlePro}>Pro</Text></Text>
        <Text style={styles.subtitle}>Studio Quality Extraction</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>YOUTUBE LINK</Text>
        <View style={styles.inputContainer}>
          <Ionicons name="link-outline" size={20} color="#888" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Paste your URL here..."
            placeholderTextColor="#666"
            value={videoUrl}
            onChangeText={setVideoUrl}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <TouchableOpacity style={[styles.button, isDownloading && styles.buttonDisabled]} onPress={handleDownload} disabled={isDownloading}>
          {isDownloading ? (
             <ActivityIndicator color="#fff" />
          ) : (
             <Text style={styles.buttonText}>Download MP3</Text>
          )}
        </TouchableOpacity>
      </View>

      {currentSongTitle ? (
        <View style={styles.playerCard}>
          <View style={styles.playerInfo}>
            <Ionicons name="disc" size={24} color="#1DB954" style={{ marginRight: 12 }} />
            <Text style={styles.playerTitle} numberOfLines={1}>{currentSongTitle}</Text>
          </View>
          <TouchableOpacity onPress={handlePlayPause} style={styles.playButton}>
            <Ionicons name={isPlaying ? "pause" : "play"} size={26} color="#000" />
          </TouchableOpacity>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000', justifyContent: 'center', padding: 24 },
  headerContainer: { alignItems: 'center', marginBottom: 40 },
  iconWrapper: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(29, 185, 84, 0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title: { fontSize: 34, fontWeight: '800', color: '#ffffff' },
  titlePro: { color: '#1DB954' },
  subtitle: { fontSize: 15, color: '#A0A0A0', marginTop: 6, fontWeight: '500' },
  card: { backgroundColor: '#121212', borderRadius: 20, padding: 24, borderWidth: 1, borderColor: '#222222' },
  cardLabel: { color: '#888888', fontSize: 12, fontWeight: '700', marginBottom: 12 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E1E1E', borderRadius: 12, borderWidth: 1, borderColor: '#333', marginBottom: 24, height: 56 },
  inputIcon: { paddingLeft: 16, paddingRight: 8 },
  input: { flex: 1, height: '100%', color: '#ffffff', fontSize: 16 },
  button: { height: 56, backgroundColor: '#1DB954', borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  buttonDisabled: { backgroundColor: '#14833B' },
  buttonText: { color: '#ffffff', fontSize: 18, fontWeight: '700' },
  playerCard: { position: 'absolute', bottom: 20, alignSelf: 'center', width: '100%', backgroundColor: '#181818', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#333' },
  playerInfo: { flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 16 },
  playerTitle: { color: '#ffffff', fontSize: 14, fontWeight: '600', flexShrink: 1 },
  playButton: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#1DB954', alignItems: 'center', justifyContent: 'center', paddingLeft: 4 }
});