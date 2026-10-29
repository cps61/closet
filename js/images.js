import { BackgroundRemovalError } from './background-removal.js';

async function withImage(blob, use) {
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return await use(image);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not encode image'))), type, quality);
  });
}

/**
 * Draws the photo upright (browsers apply EXIF orientation) and caps its longest
 * side, so a 48 MP camera photo doesn't exhaust memory or slow the model down.
 */
export function prepareImage(file, maxDimension = 1600) {
  return withImage(file, (image) => {
    const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(image.naturalWidth * scale);
    canvas.height = Math.round(image.naturalHeight * scale);
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvasToBlob(canvas, 'image/jpeg', 0.92);
  });
}

/**
 * Crops away fully transparent margins around a cutout (keeping a little
 * breathing room), so items line up consistently in the grid and on the canvas.
 */
export function trimTransparent(blob, { padding = 12, alphaThreshold = 12 } = {}) {
  return withImage(blob, (image) => {
    const width = image.naturalWidth;
    const height = image.naturalHeight;
    const source = document.createElement('canvas');
    source.width = width;
    source.height = height;
    const context = source.getContext('2d', { willReadFrequently: true });
    context.drawImage(image, 0, 0);
    const { data } = context.getImageData(0, 0, width, height);

    let minX = width, minY = height, maxX = -1, maxY = -1;
    for (let y = 0; y < height; y++) {
      const row = y * width * 4;
      for (let x = 0; x < width; x++) {
        if (data[row + x * 4 + 3] > alphaThreshold) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    const area = (maxX - minX + 1) * (maxY - minY + 1);
    if (maxX < 0 || area < width * height * 0.01) {
      throw new BackgroundRemovalError(
        "Couldn't find a clothing item in this photo. Try a plainer background or brighter light.",
      );
    }

    const left = Math.max(0, minX - padding);
    const top = Math.max(0, minY - padding);
    const cropWidth = Math.min(width, maxX + padding + 1) - left;
    const cropHeight = Math.min(height, maxY + padding + 1) - top;

    const output = document.createElement('canvas');
    output.width = cropWidth;
    output.height = cropHeight;
    output.getContext('2d').drawImage(source, left, top, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
    return canvasToBlob(output, 'image/png');
  });
}

export function imageSize(blob) {
  return withImage(blob, (image) => ({ width: image.naturalWidth, height: image.naturalHeight }));
}
