import { requireNativeModule } from 'expo';

export type VideoSize = { width: number; height: number };

const TimemarkVideo = requireNativeModule('TimemarkVideo');

/** Kích thước hiển thị (đã tính rotation) của video, đơn vị px. */
export function getVideoSize(uri: string): Promise<VideoSize> {
  return TimemarkVideo.getVideoSize(uri);
}

/**
 * Ghi cứng (burn) ảnh overlay PNG trong suốt lên toàn khung video.
 * @param videoUri  file:// tới video gốc
 * @param overlayPngUri file:// tới ảnh PNG overlay (nền trong suốt, cùng tỉ lệ khung video)
 * @returns file:// tới video mới đã đóng dấu (nằm trong cache)
 */
export function burnOverlay(videoUri: string, overlayPngUri: string): Promise<string> {
  return TimemarkVideo.burnOverlay(videoUri, overlayPngUri);
}
