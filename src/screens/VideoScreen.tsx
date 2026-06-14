import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function VideoScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Video</Text>
      <Text style={styles.sub}>Tính năng quay video sẽ làm sau.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: '#fff', fontSize: 22, fontWeight: '800' },
  sub: { color: '#888', fontSize: 14, marginTop: 8 },
});
