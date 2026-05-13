import React, { useState, useCallback } from 'react';
import { StyleSheet, Text, View, FlatList, Image, TouchableOpacity, SafeAreaView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';

export default function LibraryScreen() {
  const [songs, setSongs] = useState([]);
  const [sound, setSound] = useState(null);
  const [playingId, setPlayingId] = useState(null);

  // This hook refreshes the library every time you open this tab
  useFocusEffect(
    useCallback(() => {
      loadLibrary();
      return () => {
        if (sound) sound.unloadAsync();
      };
    }, [])
  );

  const loadLibrary = async () => {
    try {
      const existingHistory = await AsyncStorage.getItem('okmusi_library');
      if (existingHistory) {
        setSongs(JSON.parse(existingHistory));
      }
    } catch (error) {
      console.error("Failed to load library", error);
    }
  };

  const playSong = async (song) => {
    try {
      if (sound) {
        await sound.unloadAsync();
      }
      const { sound: newSound } = await Audio.Sound.createAsync({ uri: song.uri });
      setSound(newSound);
      setPlayingId(song.id);
      await newSound.playAsync();

      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) {
          setPlayingId(null);
        }
      });
    } catch (error) {
      console.error("Playback failed", error);
    }
  };

  const renderSong = ({ item }) => (
    <View style={styles.songRow}>
      <Image source={{ uri: item.thumbnail }} style={styles.thumbnail} />
      <View style={styles.songDetails}>
        <Text style={styles.songTitle} numberOfLines={2}>{item.title}</Text>
      </View>
      <TouchableOpacity 
        style={styles.playButton} 
        onPress={() => playSong(item)}
      >
        <Ionicons 
          name={playingId === item.id ? "volume-high" : "play"} 
          size={20} 
          color={playingId === item.id ? "#1DB954" : "#ffffff"} 
        />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.headerTitle}>Your Library</Text>
      {songs.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="albums-outline" size={64} color="#333" />
          <Text style={styles.emptyText}>No songs downloaded yet.</Text>
        </View>
      ) : (
        <FlatList
          data={songs}
          keyExtractor={(item) => item.id}
          renderItem={renderSong}
          contentContainerStyle={{ paddingBottom: 20 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000', paddingHorizontal: 20, paddingTop: 40 },
  headerTitle: { fontSize: 28, fontWeight: '800', color: '#ffffff', marginBottom: 24, letterSpacing: 0.5 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#888', marginTop: 16, fontSize: 16, fontWeight: '500' },
  songRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#121212', borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#222' },
  thumbnail: { width: 70, height: 50, borderRadius: 6, backgroundColor: '#222', marginRight: 16 },
  songDetails: { flex: 1, justifyContent: 'center' },
  songTitle: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
  playButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1E1E1E', alignItems: 'center', justifyContent: 'center', marginLeft: 12 }
});