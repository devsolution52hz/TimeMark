import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as MediaLibrary from 'expo-media-library';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  PanResponder,
  PixelRatio,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { burnOverlay, getVideoSize, VideoSize } from '../../modules/timemark-video';
import { makeVerifyCode } from '../datetime';
import { useSettings } from '../SettingsContext';
import TimeMarkOverlay from '../TimeMarkOverlay';

// Bề rộng (px) mong muốn cho ảnh overlay khi capture — native sẽ scale khớp video.
const OVERLAY_TARGET_PX = 1080;

// Zoom giống màn chụp ảnh: 1x..10x ↔ giá trị zoom expo-camera (0..1)
const MAX_ZOOM_X = 10;
const xToZoom = (x: number) => (x - 1) / (MAX_ZOOM_X - 1);
const zoomToX = (z: number) => 1 + z * (MAX_ZOOM_X - 1);
const ZOOM_PRESETS = [
  { label: '10x', value: 1 },
  { label: '5x',  value: xToZoom(5) },
  { label: '2x',  value: xToZoom(2) },
  { label: '1x',  value: 0 },
];
const INIT_ZOOM = ZOOM_PRESETS.length - 1; // 1x

type Mode = 'record' | 'review';

function fmt(sec: number) {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function VideoScreen() {
  const settings = useSettings();
  const [camPerm, requestCamPerm] = useCameraPermissions();
  const [micPerm, requestMicPerm] = useMicrophonePermissions();
  const [mediaPerm, requestMediaPerm] = MediaLibrary.usePermissions();

  const cameraRef = useRef<CameraView>(null);
  const overlayCaptureRef = useRef<View>(null);

  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [mode, setMode] = useState<Mode>('record');
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [videoSize, setVideoSize] = useState<VideoSize | null>(null);
  const [busy, setBusy] = useState(false);

  // Zoom (pinch + preset)
  const [zoom, setZoom] = useState(ZOOM_PRESETS[INIT_ZOOM].value);
  const [zoomPreset, setZoomPreset] = useState(INIT_ZOOM);
  const zoomRef = useRef(ZOOM_PRESETS[INIT_ZOOM].value);
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
            setZoomPreset(-1);
          }
          lastDist.current = dist;
        }
      },
      onPanResponderRelease: () => { lastDist.current = null; },
    })
  ).current;

  // Player xem lại video gốc (chưa đóng dấu) ở chế độ review.
  const player = useVideoPlayer(null, (p) => { p.loop = true; });

  useEffect(() => {
    if (mode === 'review' && videoUri) {
      player.replace(videoUri);
      player.play();
    } else {
      player.pause();
    }
  }, [mode, videoUri]);

  // Đồng hồ đếm thời gian quay.
  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [recording]);

  const overlayProps = {
    name: settings.name,
    date: settings.getDisplayDate(),
    address: settings.getDisplayAddress(),
    verifyCode: settings.showVerifyCode ? settings.verifyCode : '',
    nameTextColor: settings.getNameStyle().text,
    nameOutlineColor: settings.getNameStyle().outline,
  };

  if (!camPerm) {
    return <Center><ActivityIndicator color="#fff" /></Center>;
  }
  if (!camPerm.granted) {
    return (
      <Center>
        <Text style={styles.permText}>Ứng dụng cần quyền camera để quay video.</Text>
        <Pressable style={styles.permBtn} onPress={requestCamPerm}>
          <Text style={styles.permBtnText}>Cấp quyền camera</Text>
        </Pressable>
      </Center>
    );
  }

  async function startRec() {
    if (!cameraRef.current || recording) return;
    if (!micPerm?.granted) {
      const res = await requestMicPerm();
      if (!res.granted) {
        Alert.alert('Thiếu quyền micro', 'Video sẽ được quay không có âm thanh.');
      }
    }
    try {
      settings.setVerifyCode(makeVerifyCode());
      setElapsed(0);
      setRecording(true);
      const result = await cameraRef.current.recordAsync({ maxDuration: 120 });
      setRecording(false);
      if (result?.uri) {
        try {
          const size = await getVideoSize(result.uri);
          setVideoSize(size);
        } catch {
          setVideoSize(null);
        }
        setVideoUri(result.uri);
        setMode('review');
      }
    } catch {
      setRecording(false);
      Alert.alert('Lỗi', 'Không quay được video.');
    }
  }

  function stopRec() {
    cameraRef.current?.stopRecording();
  }

  function discard() {
    player.pause();
    setVideoUri(null);
    setVideoSize(null);
    setMode('record');
  }

  async function saveStamped() {
    if (!videoUri || busy) return;
    try {
      setBusy(true);
      if (!mediaPerm?.granted) {
        const res = await requestMediaPerm();
        if (!res.granted) {
          Alert.alert('Thiếu quyền', 'Cần quyền thư viện để lưu video.');
          return;
        }
      }
      // 1) Chụp overlay (nền trong suốt) thành PNG đúng tỉ lệ khung video.
      const pngUri = await captureRef(overlayCaptureRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });
      // 2) Ghi cứng overlay vào video bằng native module.
      const stampedUri = await burnOverlay(videoUri, pngUri);
      // 3) Lưu vào thư viện.
      await MediaLibrary.saveToLibraryAsync(stampedUri);
      Alert.alert('Đã lưu', 'Video đã được đóng dấu TimeMark và lưu vào thư viện.');
      discard();
    } catch (e: any) {
      Alert.alert('Lỗi', `Không lưu được video.\n${e?.message ?? ''}`);
    } finally {
      setBusy(false);
    }
  }

  const applyPreset = (idx: number) => {
    const z = ZOOM_PRESETS[idx].value;
    zoomRef.current = z;
    setZoom(z);
    setZoomPreset(idx);
  };

  // Kích thước (dp) khung capture overlay: giữ đúng tỉ lệ video, xuất ~OVERLAY_TARGET_PX px.
  const aspect = videoSize && videoSize.height > 0 ? videoSize.width / videoSize.height : 9 / 16;
  const capW = OVERLAY_TARGET_PX / PixelRatio.get();
  const capH = capW / aspect;

  return (
    <View style={styles.container}>
      {mode === 'record' ? (
        <View style={styles.fill} {...panResponder.panHandlers}>
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            mode="video"
            facing={facing}
            zoom={zoom}
          />
          <View style={styles.bottomScrim} pointerEvents="none" />
          <TimeMarkOverlay {...overlayProps} />

          {/* Nút xoay cam — góc phải trên */}
          {!recording && (
            <Pressable
              style={styles.flipTopRight}
              hitSlop={8}
              onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
            >
              <Text style={styles.flipGlyph}>🔄</Text>
            </Pressable>
          )}

          {recording && (
            <View style={styles.timerPill}>
              <View style={styles.recDot} />
              <Text style={styles.timerText}>{fmt(elapsed)}</Text>
            </View>
          )}

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

          <View style={styles.controls}>
            <Pressable
              style={styles.recOuter}
              onPress={recording ? stopRec : startRec}
            >
              {recording
                ? <View style={styles.recStop} />
                : <View style={styles.recInner} />}
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.fill}>
          <View style={styles.reviewArea}>
            <VideoView
              player={player}
              style={StyleSheet.absoluteFill}
              contentFit="contain"
              nativeControls={false}
            />
            {/* Overlay xem trước (chưa burn) — để người dùng thấy vị trí dấu */}
            <TimeMarkOverlay {...overlayProps} />
          </View>

          <View style={styles.reviewBar}>
            <Pressable style={styles.secondaryBtn} onPress={discard} disabled={busy}>
              <Text style={styles.secondaryBtnText}>Quay lại</Text>
            </Pressable>
            <Pressable
              style={[styles.primaryBtn, busy && { opacity: 0.6 }]}
              onPress={saveStamped}
              disabled={busy}
            >
              <Text style={styles.primaryBtnText}>
                {busy ? 'Đang đóng dấu…' : 'Đóng dấu & lưu'}
              </Text>
            </Pressable>
          </View>

          {busy && (
            <View style={styles.processingOverlay} pointerEvents="none">
              <View style={styles.processingBadge}>
                <ActivityIndicator color="#F5A623" />
                <Text style={styles.processingText}>Đang ghi watermark vào video…</Text>
              </View>
            </View>
          )}
        </View>
      )}

      {/* Khung capture overlay (off-screen, nền trong suốt) — chỉ render khi review */}
      {mode === 'review' && (
        <View
          ref={overlayCaptureRef}
          collapsable={false}
          style={[styles.captureBox, { width: capW, height: capH }]}
        >
          <TimeMarkOverlay {...overlayProps} />
        </View>
      )}
    </View>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <View style={[styles.container, styles.center]}>{children}</View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  fill: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  reviewArea: { flex: 1, backgroundColor: '#000' },

  bottomScrim: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    height: '46%',
    backgroundColor: 'rgba(0,0,0,0.28)',
  },

  timerPill: {
    position: 'absolute',
    top: 16,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#ff3b30' },
  timerText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  controls: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    height: 130,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  flipTopRight: {
    position: 'absolute',
    top: 14, right: 14,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center', justifyContent: 'center',
  },
  flipGlyph: { fontSize: 22 },

  zoomPresets: {
    position: 'absolute',
    right: 16,
    top: '34%',
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
  recOuter: {
    width: 78, height: 78, borderRadius: 39,
    borderWidth: 5, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  recInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#ff3b30' },
  recStop: { width: 30, height: 30, borderRadius: 6, backgroundColor: '#ff3b30' },

  reviewBar: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    backgroundColor: '#0a0a0a',
  },
  secondaryBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#2a2a2a',
    alignItems: 'center',
  },
  secondaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  primaryBtn: {
    flex: 2,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#F5A623',
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  processingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 24,
  },
  processingText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  // Off-screen, không che UI; nền trong suốt để PNG có alpha.
  captureBox: {
    position: 'absolute',
    left: -100000,
    top: 0,
    backgroundColor: 'transparent',
  },

  permText: { color: '#fff', fontSize: 16, textAlign: 'center', marginBottom: 16 },
  permBtn: { backgroundColor: '#F5A623', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  permBtnText: { color: '#fff', fontWeight: '700' },
});
