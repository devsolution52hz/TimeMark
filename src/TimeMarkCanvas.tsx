import React, { forwardRef } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import TimeMarkOverlay, { OverlayProps } from './TimeMarkOverlay';

type Props = {
  imageUri: string;
  overlay: OverlayProps;
  /** aspectRatio của khung (mặc định 3:4 dọc) */
  aspectRatio?: number;
};

/**
 * Khung ghép ảnh: ảnh nền + dấu TimeMark phủ lên.
 * Bọc trong View có ref để react-native-view-shot chụp lại thành ảnh đã đóng dấu.
 */
const TimeMarkCanvas = forwardRef<View, Props>(
  ({ imageUri, overlay, aspectRatio = 3 / 4 }, ref) => {
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
