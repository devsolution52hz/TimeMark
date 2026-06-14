import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
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
import { makeVerifyCode } from '../datetime';
import { useSettings } from '../SettingsContext';
import TimeMarkCanvas from '../TimeMarkCanvas';
import TimeMarkOverlay from '../TimeMarkOverlay';

type FlashState = 'off' | 'auto' | 'on' | 'torch';
const FLASH_CYCLE: FlashState[] = ['off', 'auto', 'on', 'torch'];
const MAX_ZOOM_X = 10;
// đổi hệ số phóng (1x..10x) ↔ giá trị zoom expo-camera (0..1)
const xToZoom = (x: number) => (x - 1) / (MAX_ZOOM_X - 1);
const zoomToX = (z: number) => 1 + z * (MAX_ZOOM_X - 1);

const ZOOM_PRESETS = [
  { label: '10x', value: 1 },
  { label: '5x',  value: xToZoom(5) },
  { label: '2x',  value: xToZoom(2) },
  { label: '1x',  value: 0 },
];
const INIT_ZOOM = ZOOM_PRESETS.length - 1; // 1x

const FLASH_GLYPH: Record<FlashState, string> = {
  off: '⚡',
  auto: 'A⚡',
  on: '⚡',
  torch: '🔦',
};

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
  const [zoom, setZoom] = useState(ZOOM_PRESETS[INIT_ZOOM].value);
  const [zoomPreset, setZoomPreset] = useState(INIT_ZOOM);
  const [, setTick] = useState(0);
  const [shotUri, setShotUri] = useState<string | null>(null);
  const [shotReady, setShotReady] = useState(false); // ảnh nền đã load xong chưa
  const [busy, setBusy] = useState(false);
  const [thumbUri, setThumbUri] = useState<string | null>(null);

  const zoomRef = useRef(ZOOM_PRESETS[INIT_ZOOM].value);
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

    // Chờ ảnh nền load xong (shotReady) rồi mới chụp; nếu onLoad không bắn thì fallback
    const delay = shotReady ? 180 : 2000;
    const t = setTimeout(doSave, delay);
    return () => { active = false; clearTimeout(t); };
  }, [shotUri, shotReady]);

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
    verifyCode: settings.showVerifyCode ? settings.verifyCode : '',
  };

  async function pickFromLibrary() {
    if (busy) return;
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Thiếu quyền', 'Cần quyền truy cập thư viện để chọn ảnh.');
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 1,
      });
      if (!res.canceled && res.assets?.[0]?.uri) {
        settings.setVerifyCode(makeVerifyCode());
        setBusy(true);
        setShotReady(false);
        setShotUri(res.assets[0].uri);
        // auto-save effect sẽ đóng dấu TimeMark + lưu lại
      }
    } catch {
      Alert.alert('Lỗi', 'Không mở được thư viện ảnh.');
    }
  }

  async function takePhoto() {
    if (!cameraRef.current || busy) return;
    try {
      setBusy(true);
      settings.setVerifyCode(makeVerifyCode());
      setShotReady(false);
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
            overlay={overlayProps}
            onImageLoad={() => setShotReady(true)}
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
          <View style={styles.topSide}>
            <Pressable style={styles.iconBtn} hitSlop={8}>
              <Text style={styles.iconGlyph}>☰</Text>
            </Pressable>
            <Pressable
              style={styles.iconBtn}
              hitSlop={8}
              onPress={() => setFlash((f) => FLASH_CYCLE[(FLASH_CYCLE.indexOf(f) + 1) % FLASH_CYCLE.length])}
            >
              <Text style={[styles.iconGlyph, flash !== 'off' && styles.iconGlyphActive]}>
                {FLASH_GLYPH[flash]}
              </Text>
            </Pressable>
          </View>

          <View style={styles.verifyPill}>
            <Text style={styles.verifyPillIcon}>🛡</Text>
            <Text style={styles.verifyPillText}>Xác minh ảnh</Text>
          </View>

          <View style={[styles.topSide, styles.topSideRight]}>
            <Pressable style={styles.iconBtn} hitSlop={8}>
              <Text style={styles.iconGlyph}>🎧</Text>
            </Pressable>
            <Pressable
              style={styles.iconBtn}
              hitSlop={8}
              onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
            >
              <Text style={styles.iconGlyph}>🔄</Text>
            </Pressable>
          </View>
        </View>

        {/* Nút sửa nhanh bên phải watermark */}
        <View style={styles.sideEdit}>
          <Pressable style={styles.sideEditBtn} hitSlop={8}>
            <Text style={styles.sideEditGlyph}>✎</Text>
          </Pressable>
          <Pressable style={styles.sideEditBtn} hitSlop={8}>
            <Text style={styles.sideEditGlyph}>📍</Text>
          </Pressable>
        </View>

        {/* Preset zoom bên phải */}
        <View style={styles.zoomPresets}>
          {zoomPreset === -1 && (
            <View style={[styles.zoomBtn, styles.zoomBtnActive]}>
              <Text style={styles.zoomBtnTextActive}>{zoomToX(zoom).toFixed(1)}x</Text>
            </View>
          )}
          {ZOOM_PRESETS.map((p, i) => {
            const active = zoomPreset === i;
            return (
              <Pressable
                key={p.label}
                style={[styles.zoomBtn, active && styles.zoomBtnActive]}
                onPress={() => applyPreset(i)}
              >
                <Text style={[styles.zoomBtnText, active && styles.zoomBtnTextActive]}>
                  {p.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Thanh dưới */}
      <View style={styles.shutterBar}>
        <Pressable style={styles.barItem} onPress={pickFromLibrary}>
          <View style={styles.thumbWrap}>
            {thumbUri
              ? <Image source={{ uri: thumbUri }} style={styles.thumbImg} />
              : <View style={styles.thumbEmpty} />}
          </View>
          <Text style={styles.barLabel}>Có sẵn</Text>
        </Pressable>

        <Pressable style={styles.barItem}>
          <View style={styles.barIconBox}>
            <Text style={styles.barIconGlyph}>🗂</Text>
          </View>
          <Text style={styles.barLabel}>Tệp</Text>
        </Pressable>

        <Pressable style={styles.shutterOuter} onPress={takePhoto} disabled={busy}>
          <View style={styles.shutterInner} />
        </Pressable>

        <Pressable style={styles.barItem}>
          <View style={styles.barIconBox}>
            <Text style={styles.barIconGlyph}>🗎</Text>
          </View>
          <Text style={styles.barLabel}>Bản mẫu</Text>
        </Pressable>
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
    paddingTop: 10,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  topSide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  topSideRight: { justifyContent: 'flex-end' },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  iconGlyph: { color: '#fff', fontSize: 20, fontWeight: '600' },
  iconGlyphActive: { color: '#F5A623' },

  verifyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  verifyPillIcon: { fontSize: 13 },
  verifyPillText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  sideEdit: {
    position: 'absolute',
    right: 14,
    bottom: '20%',
    gap: 14,
    alignItems: 'center',
  },
  sideEditBtn: {
    width: 44, height: 44, borderRadius: 22,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.85)',
    backgroundColor: 'rgba(0,0,0,0.30)',
    alignItems: 'center', justifyContent: 'center',
  },
  sideEditGlyph: { color: '#fff', fontSize: 18 },

  zoomPresets: {
    position: 'absolute',
    right: 16,
    top: '30%',
    gap: 8,
    alignItems: 'center',
  },
  zoomBtn: {
    width: 38, height: 38, borderRadius: 19,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    backgroundColor: 'rgba(0,0,0,0.40)',
    alignItems: 'center', justifyContent: 'center',
  },
  zoomBtnActive: {
    width: 48, height: 48, borderRadius: 24,
    borderWidth: 2,
    borderColor: '#fff',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  zoomBtnText: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '700' },
  zoomBtnTextActive: { color: '#fff', fontSize: 13, fontWeight: '800' },

  shutterBar: {
    height: 110,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    backgroundColor: '#000',
  },
  barItem: { alignItems: 'center', justifyContent: 'center', width: 60, gap: 5 },
  barLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '600' },
  barIconBox: {
    width: 46, height: 46, borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.45)',
    alignItems: 'center', justifyContent: 'center',
  },
  barIconGlyph: { fontSize: 22 },
  thumbWrap: { width: 46, height: 46 },
  thumbImg: {
    width: 46, height: 46, borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.45)',
  },
  thumbEmpty: {
    width: 46, height: 46, borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  shutterOuter: {
    width: 78, height: 78, borderRadius: 39,
    borderWidth: 5, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  shutterInner: { width: 62, height: 62, borderRadius: 31, backgroundColor: '#fff' },

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
