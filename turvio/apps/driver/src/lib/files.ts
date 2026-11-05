import { Directory, File, Paths } from "expo-file-system";
import { Platform } from "react-native";

/**
 * Proof-of-delivery files waiting for upload live in the app's private
 * document directory (not the photo library, not shared storage) and are
 * deleted as soon as the server confirmed the upload.
 */
const POD_DIR = "turvio-pod";

export async function storePrivateCopy(sourceUri: string, name: string): Promise<string> {
  if (Platform.OS === "web") return sourceUri;
  const dir = new Directory(Paths.document, POD_DIR);
  if (!dir.exists) dir.create({ intermediates: true });
  const target = new File(dir, name);
  if (target.exists) target.delete();
  await new File(sourceUri).copy(target);
  return target.uri;
}

export async function readFileBase64(uri: string): Promise<string> {
  if (uri.startsWith("data:")) return uri.slice(uri.indexOf(",") + 1);
  return new File(uri).base64();
}

export async function deleteFile(uri: string): Promise<void> {
  if (Platform.OS === "web" || uri.startsWith("data:")) return;
  const f = new File(uri);
  if (f.exists) f.delete();
}

/** Temporary label photos are removed right after text/barcode extraction. */
export const deleteTemporary = deleteFile;
