import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { SettingsProvider } from './src/SettingsContext';
import CameraScreen from './src/screens/CameraScreen';
import EditPhotoScreen from './src/screens/EditPhotoScreen';
import ToolScreen from './src/screens/ToolScreen';
import VideoScreen from './src/screens/VideoScreen';

type TabKey = 'edit' | 'video' | 'photo' | 'tool';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'edit',  label: 'SỬA ẢNH' },
  { key: 'video', label: 'VIDEO' },
  { key: 'photo', label: 'ẢNH' },
  { key: 'tool',  label: 'CÔNG CỤ' },
];

export default function App() {
  const [tab, setTab] = useState<TabKey>('photo');

  return (
    <SafeAreaProvider>
      <SettingsProvider>
        <StatusBar style="light" />
        <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
          <View style={styles.screen}>
            {tab === 'edit'  && <EditPhotoScreen />}
            {tab === 'video' && <VideoScreen />}
            {tab === 'photo' && <CameraScreen />}
            {tab === 'tool'  && <ToolScreen />}
          </View>

          <View style={styles.tabBar}>
            {TABS.map((t) => {
              const active = t.key === tab;
              return (
                <Pressable
                  key={t.key}
                  style={styles.tabItem}
                  onPress={() => setTab(t.key)}
                >
                  <Text style={[styles.tabText, active && styles.tabTextActive]}>
                    {t.label}
                  </Text>
                  {active && <View style={styles.dot} />}
                </Pressable>
              );
            })}
          </View>
        </SafeAreaView>
      </SettingsProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  screen: { flex: 1 },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#0a0a0a',
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#2a2a2a',
  },
  tabItem: { flex: 1, alignItems: 'center', paddingVertical: 2 },
  tabText: { color: '#555', fontSize: 12, fontWeight: '700', letterSpacing: 0.8 },
  tabTextActive: { color: '#fff' },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#F5A623',
    marginTop: 3,
  },
});
