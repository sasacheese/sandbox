/**
 * 添付画像を data URL にする。
 *
 * 保存先が IndexedDB しか無いので、元の解像度のまま持つと 1 枚で数 MB になる。
 * 長辺 1200px・JPEG 品質 0.72 まで落とす。投稿の主役は画像ではないので、
 * この粗さで足りる。canvas を使えない環境では、そのまま読み込んで返す。
 */

const MAX_EDGE = 1200;
const QUALITY = 0.72;

export async function toDataUrl(file: File): Promise<string> {
  const raw = await readAsDataUrl(file);
  try {
    return await shrink(raw);
  } catch {
    return raw; // 縮小できなくても投稿はできる方を選ぶ
  }
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('画像を読めない'));
    reader.readAsDataURL(file);
  });
}

function shrink(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, MAX_EDGE / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('canvas が使えない'));
        return;
      }
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', QUALITY));
    };
    image.onerror = () => reject(new Error('画像を復号できない'));
    image.src = dataUrl;
  });
}
