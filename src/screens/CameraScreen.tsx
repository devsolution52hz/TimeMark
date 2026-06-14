import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import * as MediaLibrary from 'expo-media-library';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { useSettings } from '../SettingsContext';
import TimeMarkCanvas from '../TimeMarkCanvas';
import TimeMarkOverlay from '../TimeMarkOverlay';

type FlashState = 'off' | 'auto' | 'on' | 'torch';
const FLASH_CYCLE: FlashState[] = ['off', 'auto', 'on', 'torch'];
const FLASH_ICON: Record<FlashState, string> = {
  off: '⚡ Tắt',
  auto: '⚡ Auto',
  on: '⚡ Bật',
  torch: '🔦 Đèn',
};

// Nút preset zoom: hiển thị | giá trị expo-camera
const ZOOM_PRESETS = [
  { label: '2×',   value: 0.25 },
  { label: '1×',   value: 0.05 },
  { label: '0.5×', value: 0 },
];


export default function CameraScreen() {
  const settings = useSettings();
  const [camPerm, requestCamPerm] = useCameraPermissions();
  const [mediaPerm, requestMediaPerm] = MediaLibrary.usePermissions();

  const cameraRef = useRef<CameraView>(null);
  const canvasRef = useRef<View>(null);

  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [flash, setFlash] = useState<FlashState>('off');
  const [zoom, setZoom] = useState(ZOOM_PRESETS[1].value);
  const [zoomPreset, setZoomPreset] = useState(1);
  const [, setTick] = useState(0);
  const [shotUri, setShotUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [thumbUri, setThumbUri] = useState<string | null>(null);

  const zoomRef = useRef(ZOOM_PRESETS[1].value);
  const lastDist = useRef<number | null>(null);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (e) => e.nativeEvent.touches.length === 2,
      onPanResponderMove: (e) => {
        const t = e.nativeEvent.touches;
        if (t.length === 2) {
          const dx = t[0].pageX - t[1].pageX;
          const dy = t[0].pageY - t[1].pageY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (lastDist.current != null) {
            const delta = (dist - lastDist.current) / 250;
            const z = Math.min(1, Math.max(0, zoomRef.current + delta));
            zoomRef.current = z;
            setZoom(z);
            setZoomPreset(-1); // pinch tự do → không preset nào active
          }
          lastDist.current = dist;
        }
      },
      onPanResponderRelease: () => { lastDist.current = null; },
    })
  ).current;

  const applyPreset = (idx: number) => {
    const z = ZOOM_PRESETS[idx].value;
    zoomRef.current = z;
    setZoom(z);
    setZoomPreset(idx);
  };

  useEffect(() => {
    if (settings.useCustomTime) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [settings.useCustomTime]);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        const places = await Location.reverseGeocodeAsync(pos.coords);
        if (places.length > 0) {
          const p = places[0];
          const parts = [
            p.street ? `Đ. ${p.street}` : null,
            p.subregion || p.district || null,
            p.city || p.region || null,
          ].filter(Boolean);
          settings.setGpsAddress(parts.join(', '));
        }
      } catch { /* dùng địa chỉ thủ công */ }
    })();
  }, []);

  if (!camPerm) {
    return <Center><ActivityIndicator color="#fff" /></Center>;
  }
  if (!camPerm.granted) {
    return (
      <Center>
        <Text style={styles.permText}>Ứng dụng cần quyền camera để chụp ảnh.</Text>
        <Pressable style={styles.permBtn} onPress={requestCamPerm}>
          <Text style={styles.permBtnText}>Cấp quyền camera</Text>
        </Pressable>
      </Center>
    );
  }

  const overlayProps = {
    name: settings.name,
    date: settings.getDisplayDate(),
    address: settings.getDisplayAddress(),
    verifyCode: settings.verifyCode,
  };

  async function takePhoto() {
    if (!cameraRef.current || busy) return;
    try {
      setBusy(true);
      const photo = await cameraRef.current.takePictureAsync({ quality: 1 });
      setShotUri(photo?.uri ?? null);
    } catch {
      Alert.alert('Lỗi', 'Không chụp được ảnh.');
    } finally {
      setBusy(false);
    }
  }

  async function savePhoto() {
    if (!canvasRef.current || busy) return;
    try {
      setBusy(true);
      if (!mediaPerm?.granted) {
        const res = await requestMediaPerm();
        if (!res.granted) {
          Alert.alert('Thiếu quyền', 'Cần quyền truy cập thư viện để lưu ảnh.');
          return;
        }
      }
      const uri = await captureRef(canvasRef, { format: 'jpg', quality: 0.95 });
      await MediaLibrary.saveToLibraryAsync(uri);
      setThumbUri(uri); // lưu để hiện thumbnail
      Alert.alert('Đã lưu', 'Ảnh có dấu TimeMark đã lưu vào thư viện.');
      setShotUri(null);
    } catch {
      Alert.alert('Lỗi', 'Không lưu được ảnh.');
    } finally {
      setBusy(false);
    }
  }

  // ──────────────────────────────────────────────
  // Màn hình xem lại ảnh vừa chụp
  // ──────────────────────────────────────────────
  if (shotUri) {
    return (
      <View style={styles.container}>
        <View style={styles.reviewArea}>
          <TimeMarkCanvas
            ref={canvasRef}
            imageUri={shotUri}
            overlay={{ ...overlayProps, scale: 1.4 }}
          />
        </View>
        <View style={styles.reviewBar}>
          <Pressable style={[styles.actionBtn, styles.retake]} onPress={() => setShotUri(null)} disabled={busy}>
            <Text style={styles.actionText}>Chụp lại</Text>
          </Pressable>
          <Pressable style={[styles.actionBtn, styles.save]} onPress={savePhoto} disabled={busy}>
            <Text style={styles.actionText}>{busy ? 'Đang lưu…' : 'Lưu ảnh'}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ──────────────────────────────────────────────
  // Màn hình camera live
  // ──────────────────────────────────────────────
  return (
    <View style={styles.container}>

      {/* ── VÙNG CAMERA ── */}
      <View style={styles.cameraWrap} {...panResponder.panHandlers}>
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing={facing}
          zoom={zoom}
          flash={flash === 'torch' ? 'off' : flash}
          enableTorch={flash === 'torch'}
        />

        {/* Scrim tối ở đáy giúp text overlay đọc rõ hơn */}
        <View style={styles.bottomScrim} pointerEvents="none" />

        {/* Overlay preview — KHÔNG hiện verify code ở live view */}
        <TimeMarkOverlay {...overlayProps} verifyCode="" />

        {/* ── THANH CÔNG CỤ TRÊN ── */}
        <View style={styles.topBar}>
          {/* Flash */}
          <Pressable
            style={styles.topBtn}
            onPress={() => setFlash((f) => FLASH_CYCLE[(FLASH_CYCLE.indexOf(f) + 1) % FLASH_CYCLE.length])}
          >
            <Text style={styles.topBtnText}>{FLASH_ICON[flash]}</Text>
          </Pressable>

          {/* Flip camera */}
          <Pressable
            style={styles.topBtn}
            onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
          >
            <Text style={styles.topBtnText}>⟲</Text>
          </Pressable>
        </View>

        {/* ── NÚT PRESET ZOOM (phải) ── */}
        <View style={styles.zoomPresets}>
          {ZOOM_PRESETS.map((p, i) => (
            <Pressable
              key={p.label}
              style={[styles.zoomBtn, zoomPreset === i && styles.zoomBtnActive]}
              onPress={() => applyPreset(i)}
            >
              <Text style={[styles.zoomBtnText, zoomPreset === i && styles.zoomBtnTextActive]}>
                {p.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* ── THANH DƯỚI: thumbnail | nút chụp | khoảng cân bằng ── */}
      <View style={styles.shutterBar}>

        {/* Thumbnail ảnh vừa lưu */}
        <View style={styles.thumbWrap}>
          {thumbUri ? (
            <Image source={{ uri: thumbUri }} style={styles.thumbImg} />
          ) : (
            <View style={styles.thumbEmpty} />
          )}
        </View>

        {/* Nút chụp */}
        <Pressable style={styles.shutterOuter} onPress={takePhoto} disabled={busy}>
          <View style={styles.shutterInner} />
        </Pressable>

        {/* Spacer đối xứng */}
        <View style={styles.thumbWrap} />
      </View>
    </View>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <View style={[styles.container, styles.center]}>{children}</View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  cameraWrap: { flex: 1, overflow: 'hidden' },
  reviewArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Làm tối vùng dưới để overlay text nổi bật
  bottomScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '46%',
    backgroundColor: 'rgba(0,0,0,0.28)',
  },

  // ── Top bar ──
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  topBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.52)',
  },
  topBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  // ── Preset zoom ──
  zoomPresets: {
    position: 'absolute',
    right: 12,
    top: '34%',
    gap: 10,
    alignItems: 'center',
  },
  zoomBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.55)',
    backgroundColor: 'rgba(0,0,0,0.38)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomBtnActive: {
    borderColor: '#fff',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  zoomBtnText: { color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '600' },
  zoomBtnTextActive: { color: '#fff', fontWeight: '800' },

  // ── Shutter bar ──
  shutterBar: {
    height: 90,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 32,
    backgroundColor: '#000',
  },

  thumbWrap: {
    width: 56,
    height: 56,
  },
  thumbImg: {
    width: 56,
    height: 56,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  thumbEmpty: {
    width: 56,
    height: 56,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },

  shutterOuter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#fff' },

  // ── Review screen ──
  reviewBar: { flexDirection: 'row', padding: 16, gap: 12, backgroundColor: '#000' },
  actionBtn: { flex: 1, paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  retake: { backgroundColor: '#333' },
  save: { backgroundColor: '#F5A623' },
  actionText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // ── Permission screen ──
  permText: { color: '#fff', fontSize: 16, textAlign: 'center', marginBottom: 16 },
  permBtn: { backgroundColor: '#F5A623', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  permBtnText: { color: '#fff', fontWeight: '700' },
});
