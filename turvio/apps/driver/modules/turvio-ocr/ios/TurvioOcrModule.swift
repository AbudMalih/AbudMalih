import ExpoModulesCore
import UIKit
import Vision

/// Parcel-label text recognition with Apple Vision (on device, no network).
/// Tries the photo's own orientation first, then the other orientations when little text is found.
public class TurvioOcrModule: Module {
  public func definition() -> ModuleDefinition {
    Name("TurvioOcr")

    AsyncFunction("recognizeAsync") { (uri: URL) -> [String: Any] in
      guard let image = UIImage(contentsOfFile: uri.path), let cgImage = image.cgImage else {
        throw Exception(name: "ERR_OCR", description: "Could not read image")
      }
      let base = TurvioOcrModule.orientation(of: image)
      let tries: [(Int, CGImagePropertyOrientation)] = [(0, base), (90, .right), (270, .left), (180, .down)]
      var best: (Int, [VNRecognizedTextObservation])? = nil
      for (rotation, orientation) in tries {
        let request = VNRecognizeTextRequest()
        request.recognitionLevel = .accurate
        request.recognitionLanguages = ["de-DE", "en-US"]
        request.usesLanguageCorrection = false // names and tracking numbers must not be "corrected"
        let handler = VNImageRequestHandler(cgImage: cgImage, orientation: orientation, options: [:])
        try handler.perform([request])
        let observations = request.results ?? []
        let chars = observations.compactMap { $0.topCandidates(1).first?.string }.joined().filter { $0.isLetter || $0.isNumber }.count
        if best == nil || chars > best!.1.compactMap({ $0.topCandidates(1).first?.string }).joined().count {
          best = (rotation, observations)
        }
        if chars >= 40 { break }
      }
      let width = Double(cgImage.width), height = Double(cgImage.height)
      var lines: [[String: Any]] = []
      for (index, obs) in (best?.1 ?? []).enumerated() {
        guard let candidate = obs.topCandidates(1).first else { continue }
        let b = obs.boundingBox // normalised, origin bottom-left
        lines.append([
          "text": candidate.string,
          "confidence": Double(candidate.confidence),
          "block": index,
          "frame": ["x": b.minX * width, "y": (1 - b.maxY) * height, "width": b.width * width, "height": b.height * height],
        ])
      }
      return ["engine": "vision", "rotation": best?.0 ?? 0, "lines": lines]
    }
  }

  static func orientation(of image: UIImage) -> CGImagePropertyOrientation {
    switch image.imageOrientation {
    case .up: return .up
    case .down: return .down
    case .left: return .left
    case .right: return .right
    case .upMirrored: return .upMirrored
    case .downMirrored: return .downMirrored
    case .leftMirrored: return .leftMirrored
    case .rightMirrored: return .rightMirrored
    @unknown default: return .up
    }
  }
}
