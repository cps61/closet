import { BackgroundRemovalError } from './background-removal.js';

async function withImage(blob, use) {
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    // The load event rather than image.decode(): decode() can stall while the
    // page isn't being rendered (e.g. backgrounded), load always fires.
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('Could not read image'));
      image.src = url;
    });
    return await use(image);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function createCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not encode image'))), type, quality);
  });
}

/**
 * Draws the photo upright (browsers apply EXIF orientation) and caps its longest
 * side, so a 48 MP camera photo doesn't exhaust memory or slow the models down.
 */
export function prepareImage(file, maxDimension = 1600) {
  return withImage(file, (image) => {
    const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = createCanvas(Math.round(image.naturalWidth * scale), Math.round(image.naturalHeight * scale));
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvasToBlob(canvas, 'image/jpeg', 0.92);
  });
}

/** Decodes an image Blob into raw RGBA pixels. */
export function loadImageData(blob) {
  return withImage(blob, (image) => {
    const canvas = createCanvas(image.naturalWidth, image.naturalHeight);
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(image, 0, 0);
    return context.getImageData(0, 0, canvas.width, canvas.height);
  });
}

export function imageDataToBlob(imageData, type = 'image/png', quality) {
  const canvas = createCanvas(imageData.width, imageData.height);
  canvas.getContext('2d').putImageData(imageData, 0, 0);
  return canvasToBlob(canvas, type, quality);
}

/**
 * Crops fully transparent margins (keeping a little breathing room).
 * Returns null when nothing meaningful is left.
 */
export function trimImageData(imageData, { padding = 12, alphaThreshold = 12, minFraction = 0.01 } = {}) {
  const { width, height, data } = imageData;
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
  if (maxX < 0 || (maxX - minX + 1) * (maxY - minY + 1) < width * height * minFraction) return null;

  const left = Math.max(0, minX - padding);
  const top = Math.max(0, minY - padding);
  const cropWidth = Math.min(width, maxX + padding + 1) - left;
  const cropHeight = Math.min(height, maxY + padding + 1) - top;
  const cropped = new ImageData(cropWidth, cropHeight);
  for (let y = 0; y < cropHeight; y++) {
    const from = ((top + y) * width + left) * 4;
    cropped.data.set(data.subarray(from, from + cropWidth * 4), y * cropWidth * 4);
  }
  return cropped;
}

/**
 * JPEG of the region of `imageData` covered by `alpha` (values > 12), padded by
 * `padShare` of its size on each side, so a model can see the item in context.
 */
export function cropAroundMask(imageData, alpha, padShare = 0.1) {
  const { width, height } = imageData;
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let i = 0; i < alpha.length; i++) {
    if (alpha[i] <= 12) continue;
    const x = i % width;
    const y = (i - x) / width;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  if (maxX < 0) return null;
  const padX = Math.round((maxX - minX) * padShare);
  const padY = Math.round((maxY - minY) * padShare);
  const left = Math.max(0, minX - padX);
  const top = Math.max(0, minY - padY);
  const cropWidth = Math.min(width, maxX + padX + 1) - left;
  const cropHeight = Math.min(height, maxY + padY + 1) - top;
  const cropped = new ImageData(cropWidth, cropHeight);
  for (let y = 0; y < cropHeight; y++) {
    const from = ((top + y) * width + left) * 4;
    cropped.data.set(imageData.data.subarray(from, from + cropWidth * 4), y * cropWidth * 4);
  }
  return imageDataToBlob(cropped, 'image/jpeg', 0.9);
}

/** Trims a cutout Blob; throws when it contains no subject. */
export async function trimTransparent(blob) {
  const trimmed = trimImageData(await loadImageData(blob));
  if (!trimmed) {
    throw new BackgroundRemovalError(
      "Couldn't find a clothing item in this photo. Try a plainer background or brighter light.",
    );
  }
  return imageDataToBlob(trimmed);
}

export function imageSize(blob) {
  return withImage(blob, (image) => ({ width: image.naturalWidth, height: image.naturalHeight }));
}

/** Flattens a transparent cutout onto white, the way product photos look. */
export function compositeOnWhite(blob, maxDimension = 512) {
  return withImage(blob, (image) => {
    const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = createCanvas(Math.round(image.naturalWidth * scale), Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvasToBlob(canvas, 'image/jpeg', 0.92);
  });
}

// ---------- Masks ----------

/**
 * Keeps only the connected regions of a 0/1 mask that are at least `minShare`
 * of the largest region, dropping stray specks (in place).
 */
export function keepMainRegions(mask, width, height, minShare = 0.1) {
  const regionOf = new Int32Array(mask.length);
  const sizes = [0];
  const stack = new Int32Array(mask.length);
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || regionOf[start]) continue;
    const region = sizes.length;
    let size = 0;
    let top = 0;
    stack[top++] = start;
    regionOf[start] = region;
    const visit = (next) => {
      if (mask[next] && !regionOf[next]) {
        regionOf[next] = region;
        stack[top++] = next;
      }
    };
    while (top) {
      const index = stack[--top];
      size++;
      const x = index % width;
      if (x > 0) visit(index - 1);
      if (x < width - 1) visit(index + 1);
      if (index >= width) visit(index - width);
      if (index < mask.length - width) visit(index + width);
    }
    sizes.push(size);
  }
  let largest = 0;
  for (const size of sizes) if (size > largest) largest = size;
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] && sizes[regionOf[i]] < largest * minShare) mask[i] = 0;
  }
  return mask;
}

/** Separable box blur of a 0–255 single-channel image; softens jagged mask edges. */
export function blurMask(values, width, height, radius = 2) {
  const temp = new Float32Array(values.length);
  const out = new Uint8ClampedArray(values.length);
  const size = radius * 2 + 1;
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let k = -radius; k <= radius; k++) sum += values[row + Math.min(width - 1, Math.max(0, x + k))];
      temp[row + x] = sum / size;
    }
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let k = -radius; k <= radius; k++) sum += temp[Math.min(height - 1, Math.max(0, y + k)) * width + x];
      out[y * width + x] = sum / size;
    }
  }
  return out;
}

// ---------- Color ----------

const COLOR_NAMES = [
  ['black', [22, 22, 24]],
  ['charcoal', [60, 60, 64]],
  ['grey', [128, 128, 128]],
  ['light grey', [190, 190, 190]],
  ['white', [242, 242, 240]],
  ['cream', [238, 228, 205]],
  ['beige', [205, 185, 150]],
  ['khaki', [170, 155, 110]],
  ['brown', [110, 72, 45]],
  ['tan', [175, 130, 90]],
  ['navy', [28, 36, 70]],
  ['blue', [45, 90, 175]],
  ['light blue', [150, 185, 220]],
  ['denim blue', [75, 100, 135]],
  ['red', [185, 35, 40]],
  ['burgundy', [105, 25, 40]],
  ['pink', [230, 160, 180]],
  ['orange', [225, 115, 40]],
  ['yellow', [230, 200, 60]],
  ['green', [45, 120, 65]],
  ['olive', [100, 105, 55]],
  ['purple', [105, 65, 135]],
];

function colorDistance([r1, g1, b1], [r2, g2, b2]) {
  // "Redmean" approximation of perceptual distance.
  const rMean = (r1 + r2) / 2;
  const dr = r1 - r2, dg = g1 - g2, db = b1 - b2;
  return (2 + rMean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rMean) / 256) * db * db;
}

/** Names the most common color among the opaque pixels of a cutout. */
export function dominantColorName(blob) {
  return withImage(blob, (image) => {
    const scale = Math.min(1, 96 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = createCanvas(
      Math.max(1, Math.round(image.naturalWidth * scale)),
      Math.max(1, Math.round(image.naturalHeight * scale)),
    );
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);

    const votes = new Map();
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 200) continue;
      const pixel = [data[i], data[i + 1], data[i + 2]];
      let best = null;
      let bestDistance = Infinity;
      for (const [name, rgb] of COLOR_NAMES) {
        const distance = colorDistance(pixel, rgb);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = name;
        }
      }
      votes.set(best, (votes.get(best) ?? 0) + 1);
    }
    let winner = null;
    let most = 0;
    for (const [name, count] of votes) {
      if (count > most) {
        most = count;
        winner = name;
      }
    }
    return winner;
  });
}
