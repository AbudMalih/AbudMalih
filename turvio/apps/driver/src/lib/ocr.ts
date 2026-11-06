import { orderOcrLines, type OcrLine } from "@turvio/shared";
import { TurvioOcr } from "../../modules/turvio-ocr";

/**
 * Text recognition (OCR) for parcel labels – on the device only, no cloud service:
 * - Android: Google ML Kit text recognition (bundled Latin model)
 * - iOS: Apple Vision (VNRecognizeTextRequest)
 * Provided by the local native module `modules/turvio-ocr`. It exists only in development
 * and production builds; in Expo Go, on web and in unit tests `ocrEngine()` is null and the
 * label screen says that text recognition is unavailable.
 */
export interface OcrEngine {
  name: string;
  recognize(imageUri: string): Promise<OcrLine[]>;
}

const native = TurvioOcr;
let engine: OcrEngine | null = native
  ? {
      name: "on-device",
      recognize: async (uri) => {
        const r = await native.recognizeAsync(uri);
        return orderOcrLines(r.lines);
      },
    }
  : null;

/** Replace the engine (tests, or an alternative engine). */
export function registerOcrEngine(e: OcrEngine | null) {
  engine = e;
}

export function ocrEngine(): OcrEngine | null {
  return engine;
}
