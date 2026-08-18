import { Image as RNImage } from "react-native";
import * as ImageManipulator from "expo-image-manipulator";

const MAX_DIM = 1024;

export async function imageToBase64(uri: string): Promise<{ base64: string; width: number; height: number }> {
  const info = await RNImage.getSize(uri);
  const scale = Math.min(1, MAX_DIM / Math.max(info.width, info.height));
  const resized = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: Math.round(info.width * scale), height: Math.round(info.height * scale) } }],
    { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG, base64: true },
  );
  return {
    base64: resized.base64 ?? "",
    width: resized.width,
    height: resized.height,
  };
}
