import React, { forwardRef } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import TimeMarkOverlay, { OverlayProps } from './TimeMarkOverlay';

// Mức tăng sáng bù cho ảnh (0 = tắt, càng cao càng sáng). Chỉnh ở đây.
const BRIGHTEN = 0.08;

type Props = {
  imageUri: string;
  overlay: OverlayProps;
  /** aspectRatio của khung (mặc định 3:4 dọc) */
  aspectRatio?: number;
  /** gọi khi ảnh nền đã load xong (để biết lúc nào chụp canvas an toàn) */
  onImageLoad?: () => void;
};

/**
 * Khung ghép ảnh: ảnh nền + dấu TimeMark phủ lên.
 * Bọc trong View có ref để react-native-view-shot chụp lại thành ảnh đã đóng dấu.
 */
const TimeMarkCanvas = forwardRef<View, Props>(
  ({ imageUri, overlay, aspectRatio = 3 / 4, onImageLoad }, ref) => {
    return (
      <View
        ref={ref}
        collapsable={false}
        style={[styles.canvas, { aspectRatio }]}
      >
        <Image
          source={{ uri: imageUri }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          onLoad={onImageLoad}
        />
        {/* Tăng sáng nhẹ để bù việc expo-camera chụp tối hơn camera gốc */}
        <View
          style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(255,255,255,${BRIGHTEN})` }]}
          pointerEvents="none"
        />
        <TimeMarkOverlay {...overlay} />
      </View>
    );
  }
);

export default TimeMarkCanvas;

const styles = StyleSheet.create({
  canvas: {
    width: '100%',
    backgroundColor: '#000',
    overflow: 'hidden',
  },
});
