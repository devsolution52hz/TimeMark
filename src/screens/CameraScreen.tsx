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

  // Ref giữ giá trị mediaPerm mới nhất để dùng trong effect mà không cần đưa vào deps
  const mediaPermRef = useRef(mediaPerm);
  const reqMediaPermRef = useRef(requestMediaPerm);

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

  // ─── Đồng bộ mediaPerm refs ───
  useEffect(() => { mediaPermRef.current = mediaPerm; }, [mediaPerm]);
  useEffect(() => { reqMediaPermRef.current = requestMediaPerm; }, [requestMediaPerm]);

  // ─── Đồng hồ realtime ───
  useEffect(() => {
    if (settings.useCustomTime) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [settings.useCustomTime]);

  // ─── GPS reverse geocode ───
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

  // ─── AUTO-SAVE: phải đặt TRƯỚC mọi early return ───
  useEffect(() => {
    if (!shotUri) return;
    let active = true;

    const doSave = async () => {
      if (!active || !canvasRef.current) {
        if (active) { setShotUri(null); setBusy(false); }
        return;
      }
      try {
        if (!mediaPermRef.current?.granted) {
          const res = await reqMediaPermRef.current();
          if (!res.granted) {
            Alert.alert('Thiếu quyền', 'Cần quyền truy cập thư viện để lưu ảnh.');
            if (active) { setShotUri(null); setBusy(false); }
            return;
          }
        }
        const uri = await captureRef(canvasRef, { format: 'jpg', quality: 0.95 });
        if (!active) return;
        await MediaLibrary.saveToLibraryAsync(uri);
        if (active) setThumbUri(uri);
      } catch {
        Alert.alert('Lỗi', 'Không lưu được ảnh.');
      } finally {
        if (active) { setShotUri(null); setBusy(false); }
      }
    };

    // 200ms để canvas render xong trước khi captureRef
    const t = setTimeout(doSave, 200);
    return () => { active = false; clearTimeout(t); };
  }, [shotUri]);

  // ─── Pinch-to-zoom ───
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
            setZoomPreset(-1);
          }
          lastDist.current = dist;
        }
      },
      onPanResponderRelease: () => { lastDist.current = null; },
    })
  ).current;

  // ─── Early returns (sau tất cả hooks) ───
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

  const applyPreset = (idx: number) => {
    const z = ZOOM_PRESETS[idx].value;
    zoomRef.current = z;
    setZoom(z);
    setZoomPreset(idx);
  };

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
      // busy giữ true — auto-save effect sẽ reset sau khi lưu xong
    } catch {
      Alert.alert('Lỗi', 'Không chụp được ảnh.');
      setBusy(false);
    }
  }

  // ─── Màn hình tạm: render canvas để captureRef chụp, hiện "Đang lưu…" ───
  if (shotUri) {
    return (
      <View style={styles.container}>
        <View style={styles.reviewArea}>
          <TimeMarkCanvas
            ref={canvasRef}
            imageUri={shotUri}
            overlay={{ ...overlayProps, scale: 1.4 }}
          />
          {/* Overlay này nằm ngoài canvasRef nên không bị chụp vào ảnh */}
          <View style={styles.savingOverlay} pointerEvents="none">
            <View style={styles.savingBadge}>
              <ActivityIndicator color="#F5A623" size="small" />
              <Text style={styles.savingText}>Đang lưu…</Text>
            </View>
          </View>
        </View>
      </View>
    );
  }

  // ─── Camera live ───
  return (
    <View style={styles.container}>
      <View style={styles.cameraWrap} {...panResponder.panHandlers}>
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing={facing}
          zoom={zoom}
          flash={flash === 'torch' ? 'off' : flash}
          enableTorch={flash === 'torch'}
        />

        <View style={styles.bottomScrim} pointerEvents="none" />
        <TimeMarkOverlay {...overlayProps} verifyCode="" />

        {/* Top bar */}
        <View style={styles.topBar}>
          <Pressable
            style={styles.topBtn}
            onPress={() => setFlash((f) => FLASH_CYCLE[(FLASH_CYCLE.indexOf(f) + 1) % FLASH_CYCLE.length])}
          >
            <Text style={styles.topBtnText}>{FLASH_ICON[flash]}</Text>
          </Pressable>
          <Pressable
            style={styles.topBtn}
            onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
          >
            <Text style={styles.topBtnText}>⟲</Text>
          </Pressable>
        </View>

        {/* Preset zoom bên phải */}
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

      {/* Thanh dưới */}
      <View style={styles.shutterBar}>
        <View style={styles.thumbWrap}>
          {thumbUri
            ? <Image source={{ uri: thumbUri }} style={styles.thumbImg} />
            : <View style={styles.thumbEmpty} />}
        </View>

        <Pressable style={styles.shutterOuter} onPress={takePhoto} disabled={busy}>
          <View style={styles.shutterInner} />
        </Pressable>

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

  bottomScrim: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    height: '46%',
    backgroundColor: 'rgba(0,0,0,0.28)',
  },

  topBar: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
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

  zoomPresets: {
    position: 'absolute',
    right: 12,
    top: '34%',
    gap: 10,
    alignItems: 'center',
  },
  zoomBtn: {
    width: 46, height: 46, borderRadius: 23,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.55)',
    backgroundColor: 'rgba(0,0,0,0.38)',
    alignItems: 'center', justifyContent: 'center',
  },
  zoomBtnActive: {
    borderColor: '#fff',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  zoomBtnText: { color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '600' },
  zoomBtnTextActive: { color: '#fff', fontWeight: '800' },

  shutterBar: {
    height: 90,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 32,
    backgroundColor: '#000',
  },
  thumbWrap: { width: 56, height: 56 },
  thumbImg: {
    width: 56, height: 56, borderRadius: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  thumbEmpty: {
    width: 56, height: 56, borderRadius: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  shutterOuter: {
    width: 72, height: 72, borderRadius: 36,
    borderWidth: 4, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  shutterInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#fff' },

  savingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  savingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
  },
  savingText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  permText: { color: '#fff', fontSize: 16, textAlign: 'center', marginBottom: 16 },
  permBtn: { backgroundColor: '#F5A623', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  permBtnText: { color: '#fff', fontWeight: '700' },
});
