/**
 * Shrinks a photo in the browser before upload. Phone cameras produce 5-15MB files;
 * 2000px on the long edge is plenty to judge a guitar's condition and lands well
 * under 1MB, so uploads are fast and never hit the server's size limit.
 *
 * Returns the original file untouched if the browser can't decode it or the result
 * wouldn't be smaller, so this can never make an upload worse.
 */
export async function resizeImage(file: File, maxEdge = 2000, quality = 0.85): Promise<File> {
  // Animated GIFs would be flattened to one frame; leave them alone.
  if (file.type === 'image/gif') return file;

  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    // JPEG has no alpha; paint white so transparent PNGs don't turn black.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', quality),
    );
    if (!blob || blob.size >= file.size) return file;

    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], name, { type: 'image/jpeg', lastModified: file.lastModified });
  } catch {
    return file;
  }
}
