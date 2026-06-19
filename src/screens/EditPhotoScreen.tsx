import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import React, { useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { makeVerifyCode } from '../datetime';
import { useSettings } from '../SettingsContext';
import TimeMarkCanvas from '../TimeMarkCanvas';

export default function EditPhotoScreen() {
  const settings = useSettings();
  const [mediaPerm, requestMediaPerm] = MediaLibrary.usePermissions();
  const canvasRef = useRef<View>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
    });
    if (!result.canceled && result.assets.length > 0) {
      settings.setVerifyCode(makeVerifyCode());
      setImageUri(result.assets[0].uri);
    }
  }

  async function save() {
    if (!canvasRef.current || busy) return;
    try {
      setBusy(true);
      if (!mediaPerm?.granted) {
        const res = await requestMediaPerm();
        if (!res.granted) {
          Alert.alert('Thiếu quyền', 'Cần quyền thư viện để lưu ảnh.');
          return;
        }
      }
      const uri = await captureRef(canvasRef, { format: 'jpg', quality: 0.95 });
      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert('Đã lưu', 'Ảnh đã được đóng dấu TimeMark và lưu vào thư viện.');
    } catch {
      Alert.alert('Lỗi', 'Không lưu được ảnh.');
    } finally {
      setBusy(false);
    }
  }

  const overlayProps = {
    name: settings.name,
    date: settings.getDisplayDate(),
    address: settings.getDisplayAddress(),
    verifyCode: settings.showVerifyCode ? settings.verifyCode : '',
    nameTextColor: settings.getNameStyle().text,
    nameOutlineColor: settings.getNameStyle().outline,
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      <Text style={styles.title}>Đóng dấu ảnh có sẵn</Text>
      <Text style={styles.hint}>
        Chọn 1 ảnh chưa có TimeMark, app sẽ đóng dấu giờ/ngày/địa chỉ hiện tại
        (chỉnh ở tab Công cụ) rồi lưu lại.
      </Text>

      <Pressable style={styles.pickBtn} onPress={pickImage}>
        <Text style={styles.pickBtnText}>
          {imageUri ? 'Chọn ảnh khác' : 'Chọn ảnh từ thư viện'}
        </Text>
      </Pressable>

      {imageUri ? (
        <>
          <View style={styles.canvasWrap}>
            <TimeMarkCanvas
              ref={canvasRef}
              imageUri={imageUri}
              overlay={overlayProps}
            />
          </View>
          <Pressable
            style={[styles.saveBtn, busy && { opacity: 0.6 }]}
            onPress={save}
            disabled={busy}
          >
            <Text style={styles.saveBtnText}>
              {busy ? 'Đang lưu…' : 'Lưu ảnh đã đóng dấu'}
            </Text>
          </Pressable>
        </>
      ) : (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>Chưa chọn ảnh</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111' },
  content: { padding: 16, paddingBottom: 40 },
  title: { color: '#fff', fontSize: 20, fontWeight: '800', marginBottom: 6 },
  hint: { color: '#aaa', fontSize: 13, marginBottom: 16, lineHeight: 18 },
  pickBtn: {
    backgroundColor: '#2a2a2a',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  pickBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  canvasWrap: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  saveBtn: {
    backgroundColor: '#F5A623',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  placeholder: {
    height: 220,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: { color: '#555' },
});
