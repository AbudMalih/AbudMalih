import type { OcrLine } from "@turvio/shared";

/**
 * Text recognition (OCR) integration boundary.
 *
 * This build contains NO OCR engine: on-device text recognition (e.g. Google
 * ML Kit via @react-native-ml-kit/text-recognition, or Apple Vision) needs a
 * native module and a custom development build, which could not be built and
 * verified in this environment. Barcode extraction from the label photo works
 * (expo-camera); address fields are then entered/confirmed by the driver.
 *
 * To enable OCR: install a native engine, register it at app start with
 * `registerOcrEngine({ name, recognize })` – see docs/DRIVER_APP.md.
 */
export interface OcrEngine {
  name: string;
  recognize(imageUri: string): Promise<OcrLine[]>;
}

let engine: OcrEngine | null = null;

export function registerOcrEngine(e: OcrEngine | null) {
  engine = e;
}

export function ocrEngine(): OcrEngine | null {
  return engine;
}
