import { requireOptionalNativeModule } from "expo-modules-core";

/** A recognised text line. Frame is in pixels of the (possibly rotated) analysed image. */
export interface NativeOcrLine {
  text: string;
  /** 0..1 when the engine reports it (ML Kit ≥16, Apple Vision). */
  confidence?: number;
  frame?: { x: number; y: number; width: number; height: number };
  /** Index of the text block the line belongs to. */
  block: number;
}

export interface NativeOcrResult {
  engine: "mlkit" | "vision";
  /** Rotation (degrees) that produced the best result – labels are often photographed sideways. */
  rotation: 0 | 90 | 180 | 270;
  lines: NativeOcrLine[];
}

interface TurvioOcrNative {
  recognizeAsync(uri: string): Promise<NativeOcrResult>;
}

/** null in Expo Go, on web and in tests: the module only exists in a development/production build. */
export const TurvioOcr = requireOptionalNativeModule<TurvioOcrNative>("TurvioOcr");
