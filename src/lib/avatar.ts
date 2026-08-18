import { firestore } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { postJSON } from "@/lib/api";

export const MAX_SIZE_MB = 1;
const ANIMATED_TYPES = ["image/gif", "image/webp"];

/** Shared with the server-side re-validation in /api/updateAvatar. */
export function isDataUrlImage(dataUrl: string): boolean {
  return /^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(dataUrl);
}

function resizeAndEncode(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 256;
      const scale = Math.min(MAX / img.width, MAX / img.height, 1);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
            canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
            URL.revokeObjectURL(url);
            resolve(canvas.toDataURL("image/jpeg", 0.8));
    };
    img.onerror = reject;
    img.src = url;
  });
}

function encodeRaw(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function uploadAvatar(file: File): Promise<string> {
  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    throw new Error(`Image must be under ${MAX_SIZE_MB}MB.`);
  }
  if (!file.type.startsWith("image/")) {
    throw new Error("File must be an image.");
  }

  // Preserve animated formats as-is; resize static images
  const base64 = ANIMATED_TYPES.includes(file.type)
    ? await encodeRaw(file)
    : await resizeAndEncode(file);

  // Written server-side (not a direct client Firestore write) so the
  // Premium gate and size/type checks are actually enforced, not just UI.
  await postJSON("/api/updateAvatar", { base64 });
  return base64;
}

export async function getAvatarUrl(uid: string): Promise<string | null> {
  try {
    const snap = await getDoc(doc(firestore, "avatars", uid));
    return snap.exists() ? snap.data().base64 : null;
  } catch {
    return null;
  }
}