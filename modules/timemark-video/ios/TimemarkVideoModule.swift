import ExpoModulesCore
import AVFoundation
import UIKit

// iOS: ghi cứng overlay bằng AVFoundation (AVVideoCompositionCoreAnimationTool + CALayer).
// LƯU Ý: phần iOS chưa được kiểm thử trên thiết bị thật (dự án hiện chạy Android).
public class TimemarkVideoModule: Module {
  public func definition() -> ModuleDefinition {
    Name("TimemarkVideo")

    AsyncFunction("getVideoSize") { (uri: String, promise: Promise) in
      guard let url = self.fileURL(uri),
            let track = AVURLAsset(url: url).tracks(withMediaType: .video).first else {
        promise.reject("ERR_VIDEO_SIZE", "Không đọc được kích thước video")
        return
      }
      let size = track.naturalSize.applying(track.preferredTransform)
      promise.resolve(["width": Int(abs(size.width)), "height": Int(abs(size.height))])
    }

    AsyncFunction("burnOverlay") { (videoUri: String, overlayPngUri: String, promise: Promise) in
      self.burn(videoUri: videoUri, overlayPngUri: overlayPngUri, promise: promise)
    }
  }

  private func fileURL(_ uri: String) -> URL? {
    if uri.hasPrefix("file://") { return URL(string: uri) }
    return URL(fileURLWithPath: uri)
  }

  private func burn(videoUri: String, overlayPngUri: String, promise: Promise) {
    guard let videoURL = fileURL(videoUri),
          let overlayURL = fileURL(overlayPngUri),
          let overlayImage = UIImage(contentsOfFile: overlayURL.path)?.cgImage else {
      promise.reject("ERR_BURN", "Tham số không hợp lệ")
      return
    }

    let asset = AVURLAsset(url: videoURL)
    guard let videoTrack = asset.tracks(withMediaType: .video).first else {
      promise.reject("ERR_BURN", "Không có video track")
      return
    }

    let composition = AVMutableComposition()
    guard let compVideoTrack = composition.addMutableTrack(
      withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid) else {
      promise.reject("ERR_BURN", "Không tạo được track")
      return
    }

    let timeRange = CMTimeRange(start: .zero, duration: asset.duration)
    do {
      try compVideoTrack.insertTimeRange(timeRange, of: videoTrack, at: .zero)
      if let audioTrack = asset.tracks(withMediaType: .audio).first,
         let compAudioTrack = composition.addMutableTrack(
          withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid) {
        try compAudioTrack.insertTimeRange(timeRange, of: audioTrack, at: .zero)
      }
    } catch {
      promise.reject("ERR_BURN", "Lỗi ghép track: \(error.localizedDescription)")
      return
    }

    let natural = videoTrack.naturalSize.applying(videoTrack.preferredTransform)
    let renderSize = CGSize(width: abs(natural.width), height: abs(natural.height))

    let parentLayer = CALayer()
    let videoLayer = CALayer()
    parentLayer.frame = CGRect(origin: .zero, size: renderSize)
    videoLayer.frame = CGRect(origin: .zero, size: renderSize)
    parentLayer.addSublayer(videoLayer)

    let overlayLayer = CALayer()
    overlayLayer.frame = CGRect(origin: .zero, size: renderSize)
    overlayLayer.contents = overlayImage
    // CALayer gốc toạ độ y dưới → ảnh có thể bị lật dọc; nếu lật thì bật dòng dưới.
    // overlayLayer.isGeometryFlipped = true
    parentLayer.addSublayer(overlayLayer)

    let videoComposition = AVMutableVideoComposition()
    videoComposition.renderSize = renderSize
    videoComposition.frameDuration = CMTime(value: 1, timescale: 30)
    videoComposition.animationTool = AVVideoCompositionCoreAnimationTool(
      postProcessingAsVideoLayer: videoLayer, in: parentLayer)

    let instruction = AVMutableVideoCompositionInstruction()
    instruction.timeRange = timeRange
    let layerInstruction = AVMutableVideoCompositionLayerInstruction(assetTrack: compVideoTrack)
    layerInstruction.setTransform(videoTrack.preferredTransform, at: .zero)
    instruction.layerInstructions = [layerInstruction]
    videoComposition.instructions = [instruction]

    let outputURL = FileManager.default.temporaryDirectory
      .appendingPathComponent("timemark_\(Int(Date().timeIntervalSince1970 * 1000)).mp4")
    guard let export = AVAssetExportSession(
      asset: composition, presetName: AVAssetExportPresetHighestQuality) else {
      promise.reject("ERR_BURN", "Không tạo được export session")
      return
    }
    export.videoComposition = videoComposition
    export.outputURL = outputURL
    export.outputFileType = .mp4
    export.exportAsynchronously {
      if export.status == .completed {
        promise.resolve(outputURL.absoluteString)
      } else {
        promise.reject("ERR_EXPORT", export.error?.localizedDescription ?? "Xuất video thất bại")
      }
    }
  }
}
