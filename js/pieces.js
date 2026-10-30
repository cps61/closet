// Turns one photo into clothing pieces ready to save.
//
// Photo of a person wearing an outfit → one cutout per garment (top, pants,
// shoes, hat, bag…), each recognized and named. Photo of a single item (laid
// flat, on a hanger…) → one cutout, recognized and named.

import { removeBackground } from './background-removal.js';
import { recognizeItem, segmentClothing, setDownloadListener } from './clothing-ai.js';
import { LABELS, labelById } from './labels.js';
import {
  blurMask,
  compositeOnWhite,
  cropAroundMask,
  dominantColorName,
  imageDataToBlob,
  keepMainRegions,
  loadImageData,
  trimImageData,
  trimTransparent,
} from './images.js';

/** Garment regions the segmenter can find on a person, in display order. */
const WORN_GROUPS = [
  { group: 'upper', classes: ['Upper-clothes'], fallbackCategory: 'tops' },
  { group: 'dress', classes: ['Dress'], fallbackCategory: 'dresses' },
  { group: 'pants', classes: ['Pants'], fallbackCategory: 'bottoms' },
  { group: 'skirt', classes: ['Skirt'], fallbackCategory: 'bottoms' },
  { group: 'shoes', classes: ['Left-shoe', 'Right-shoe'], fallbackCategory: 'shoes' },
  { group: 'hat', classes: ['Hat'], fallbackCategory: 'accessories' },
  { group: 'bag', classes: ['Bag'], fallbackCategory: 'accessories' },
  { group: 'scarf', classes: ['Scarf'], fallbackCategory: 'accessories' },
];
const BODY_CLASSES = ['Hair', 'Face', 'Left-arm', 'Right-arm', 'Left-leg', 'Right-leg'];

/** Share of the photo that must be skin/hair/face to treat it as "being worn". */
const WORN_BODY_SHARE = 0.02;
/** Smallest garment worth extracting, as a share of the photo. */
const MIN_PIECE_SHARE = 0.003;

const ALL_LABEL_IDS = LABELS.map((label) => label.id);

/**
 * @param {Blob} prepared  upright, downscaled JPEG (see prepareImage)
 * @param {object} options
 *   smart                            find pieces on a person and recognize types;
 *                                    when false, only the background is removed
 *   onStage(text)                    what's happening now
 *   onDownload({file, loaded, total}) first-run model download progress
 * @returns {Promise<{ worn: boolean, pieces: Piece[] }>}
 *   Piece: { cutout: Blob, labelId, color, category, name }
 */
export async function analyzePhoto(prepared, { smart = true, onStage = () => {}, onDownload } = {}) {
  setDownloadListener(onDownload);
  try {
    let segmentation = null;
    if (smart) {
      onStage('Finding clothes…');
      try {
        segmentation = await segmentClothing(prepared);
      } catch (error) {
        console.warn('Clothing segmentation unavailable; treating as a single item', error);
      }
    }

    onStage('Removing background…');
    const matte = await removeBackground(prepared, { onDownload });

    if (segmentation && bodyShare(segmentation) >= WORN_BODY_SHARE) {
      onStage('Cutting out each piece…');
      const pieces = await extractWornPieces(prepared, matte, segmentation, onStage);
      if (pieces.length > 0) return { worn: true, pieces };
    }

    const cutout = await trimTransparent(matte);
    if (!smart) return { worn: false, pieces: [{ cutout, labelId: null, color: null, category: 'tops', name: '' }] };
    onStage('Identifying item…');
    return { worn: false, pieces: [await describePiece(cutout, ALL_LABEL_IDS, 'tops', prepared)] };
  } finally {
    setDownloadListener(null);
  }
}

function bodyShare({ width, height, masks }) {
  let count = 0;
  for (const name of BODY_CLASSES) {
    const mask = masks.get(name);
    if (!mask) continue;
    for (let i = 0; i < mask.length; i++) if (mask[i]) count++;
  }
  return count / (width * height);
}

async function extractWornPieces(prepared, matteBlob, { width, height, masks }, onStage) {
  const [photo, matte] = await Promise.all([loadImageData(prepared), loadImageData(matteBlob)]);
  const sameSize = matte.width === width && matte.height === height && photo.width === width;
  const pieces = [];

  for (const { group, classes, fallbackCategory } of WORN_GROUPS) {
    const mask = new Uint8Array(width * height);
    let area = 0;
    for (const name of classes) {
      const classMask = masks.get(name);
      if (!classMask) continue;
      for (let i = 0; i < mask.length; i++) {
        if (classMask[i] && !mask[i]) {
          mask[i] = 1;
          area++;
        }
      }
    }
    if (area < width * height * MIN_PIECE_SHARE) continue;

    keepMainRegions(mask, width, height);
    for (let i = 0; i < mask.length; i++) mask[i] *= 255;
    // Blur, then keep only the inner half of the blurred edge: the edge stays
    // soft but never bleeds outward into skin or background (no halo).
    const soft = blurMask(mask, width, height, 2);
    for (let i = 0; i < soft.length; i++) soft[i] = (soft[i] - 128) * 2;

    // The background matte has much finer outer edges than the segmenter;
    // combine them, unless the matte lost most of this piece (e.g. a bag).
    const alpha = new Uint8ClampedArray(soft.length);
    let softSum = 0, combinedSum = 0;
    for (let i = 0; i < soft.length; i++) {
      const combined = sameSize ? (soft[i] * matte.data[i * 4 + 3]) / 255 : soft[i];
      alpha[i] = combined;
      softSum += soft[i];
      combinedSum += combined;
    }
    const finalAlpha = combinedSum < softSum * 0.4 ? soft : alpha;

    const rgba = new ImageData(width, height);
    for (let i = 0; i < finalAlpha.length; i++) {
      rgba.data[i * 4] = photo.data[i * 4];
      rgba.data[i * 4 + 1] = photo.data[i * 4 + 1];
      rgba.data[i * 4 + 2] = photo.data[i * 4 + 2];
      rgba.data[i * 4 + 3] = finalAlpha[i];
    }
    const trimmed = trimImageData(rgba, { minFraction: 0 });
    if (!trimmed) continue;

    onStage(`Identifying piece ${pieces.length + 1}…`);
    const candidates = LABELS.filter((label) => label.group === group).map((label) => label.id);
    const context = await cropAroundMask(photo, finalAlpha);
    pieces.push(await describePiece(await imageDataToBlob(trimmed), candidates, fallbackCategory, context));
  }
  return pieces;
}

/**
 * Recognizes and names a cutout. `context` (optional) is the area of the
 * original photo around the item; the model looks at both, which is steadier
 * when the cutout has gaps (an arm across a shirt, a bag strap…).
 */
async function describePiece(cutout, candidateIds, fallbackCategory, context = null) {
  let label = null;
  if (candidateIds.length === 1) {
    label = labelById(candidateIds[0]);
  } else {
    try {
      const views = [await compositeOnWhite(cutout), ...(context ? [context] : [])];
      const match = await recognizeItem(views, candidateIds);
      label = match ? labelById(match.id) : null;
    } catch (error) {
      console.warn('Clothing recognition unavailable', error);
    }
  }

  let color = null;
  try {
    color = await dominantColorName(cutout);
  } catch {
    // name without a color
  }

  const name = label ? capitalize(color ? `${color} ${label.name.toLowerCase()}` : label.name) : '';
  return { cutout, labelId: label?.id ?? null, color, category: label?.category ?? fallbackCategory, name };
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
