export async function openQrImage(file: Blob): Promise<{
  source: CanvasImageSource;
  width: number;
  height: number;
  close: () => void;
}> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      return {source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close()};
    } catch {
      // Safari may support ImageBitmap but reject a format its image element can read.
    }
  }

  const url = URL.createObjectURL(file), image = new Image();
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(Error('Không đọc được ảnh QR. Hãy chọn ảnh PNG/JPG rõ nét.'));
      image.src = url;
    });
    if (!image.naturalWidth || !image.naturalHeight) throw Error('Ảnh QR không hợp lệ.');
    return {source: image, width: image.naturalWidth, height: image.naturalHeight, close: () => URL.revokeObjectURL(url)};
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  } finally {
    image.onload = image.onerror = null;
  }
}
