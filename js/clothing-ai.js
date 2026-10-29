// On-device clothing AI, free and private (nothing leaves the phone):
//
//  - Segmentation: SegFormer fine-tuned on clothing (Xenova/segformer_b2_clothes)
//    labels every pixel of a photo of a person: upper clothes, pants, shoes, hat…
//  - Recognition: Marqo-FashionSigLIP's image encoder. The matching text
//    embeddings for our label list are precomputed in models/label-embeddings.json,
//    so the phone never downloads the text encoder.
//
// Both run through Transformers.js on WebGPU when available, otherwise WebAssembly.
// Model files download once (~110 MB together) and are cached by the browser.

const TRANSFORMERS_URL = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.2';
export const MODEL_ID = 'Marqo/marqo-fashionSigLIP';
const SEGMENTER_ID = 'Xenova/segformer_b2_clothes';

let progressListener = null;

/** Receives model download progress: ({ file, loaded, total }). */
export function setDownloadListener(listener) {
  progressListener = listener;
}

function forwardProgress(event) {
  if (event.status === 'progress' && event.total) {
    progressListener?.({ file: `${event.name}/${event.file}`, loaded: event.loaded, total: event.total });
  }
}

let transformersPromise;
function loadTransformers() {
  transformersPromise ??= import(TRANSFORMERS_URL)
    .then((transformers) => {
      transformers.env.allowLocalModels = false;
      return transformers;
    })
    .catch((error) => {
      transformersPromise = undefined;
      throw error;
    });
  return transformersPromise;
}

let backendPromise;
function pickBackend() {
  backendPromise ??= (async () => {
    try {
      const adapter = await navigator.gpu?.requestAdapter();
      if (adapter) return { device: 'webgpu', fp16: adapter.features.has('shader-f16') };
    } catch {
      // fall through to WebAssembly
    }
    return { device: 'wasm', fp16: false };
  })();
  return backendPromise;
}

/** Loads on WebGPU when possible, falling back to WebAssembly if that fails. */
async function loadOnBestDevice(load, { gpuFp16, gpu, wasm }) {
  const backend = await pickBackend();
  if (backend.device === 'webgpu') {
    try {
      return await load({ device: 'webgpu', dtype: backend.fp16 ? gpuFp16 : gpu });
    } catch (error) {
      console.warn('WebGPU model load failed, using WebAssembly', error);
    }
  }
  return load({ device: 'wasm', dtype: wasm });
}

function memoize(factory) {
  let promise;
  return () => {
    promise ??= factory().catch((error) => {
      promise = undefined;
      throw error;
    });
    return promise;
  };
}

const loadSegmenter = memoize(async () => {
  const { pipeline } = await loadTransformers();
  return loadOnBestDevice(
    (options) => pipeline('image-segmentation', SEGMENTER_ID, { ...options, progress_callback: forwardProgress }),
    { gpuFp16: 'fp16', gpu: 'q8', wasm: 'q8' },
  );
});

const loadRecognizer = memoize(async () => {
  const transformers = await loadTransformers();
  const [processor, model, embeddings] = await Promise.all([
    transformers.AutoProcessor.from_pretrained(MODEL_ID, { progress_callback: forwardProgress }),
    loadOnBestDevice(
      (options) =>
        transformers.SiglipVisionModel.from_pretrained(MODEL_ID, { ...options, progress_callback: forwardProgress }),
      { gpuFp16: 'q4f16', gpu: 'q4', wasm: 'q4' },
    ),
    fetch(new URL('../models/label-embeddings.json', import.meta.url)).then((response) => {
      if (!response.ok) throw new Error(`Label embeddings missing (${response.status})`);
      return response.json();
    }),
  ]);
  const labelVectors = new Map(Object.entries(embeddings.labels).map(([id, base64]) => [id, decodeFloat32(base64)]));
  return { transformers, processor, model, labelVectors };
});

function decodeFloat32(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Float32Array(bytes.buffer);
}

/** Starts downloading/initializing all clothing models without running them. */
export function preloadClothingModels() {
  return Promise.all([loadSegmenter(), loadRecognizer()]);
}

/**
 * Labels every pixel of the image. Returns the image size and a Map from class
 * name ("Upper-clothes", "Pants", "Left-shoe", "Face", …) to a 0/255 mask.
 */
export async function segmentClothing(imageBlob) {
  const [{ RawImage }, segmenter] = await Promise.all([loadTransformers(), loadSegmenter()]);
  const image = await RawImage.fromBlob(imageBlob);
  const results = await segmenter(image);
  const masks = new Map();
  for (const { label, mask } of results) {
    if (mask.width !== image.width || mask.height !== image.height) {
      masks.set(label, (await mask.resize(image.width, image.height)).data);
    } else {
      masks.set(label, mask.data);
    }
  }
  return { width: image.width, height: image.height, masks };
}

async function embedImage({ transformers, processor, model }, imageBlob) {
  const image = await transformers.RawImage.fromBlob(imageBlob);
  const { image_embeds } = await model(await processor(image));
  return image_embeds.normalize().data;
}

/**
 * Picks the best matching label among `candidateIds` for one clothing item.
 * Several views of the same item (e.g. the cutout and the area of the original
 * photo around it) are averaged, which is steadier than either view alone.
 * Returns { id, confidence, ranking } or null.
 */
export async function recognizeItem(imageBlobs, candidateIds) {
  const recognizer = await loadRecognizer();
  const embeddings = [];
  for (const blob of [].concat(imageBlobs)) embeddings.push(await embedImage(recognizer, blob));
  const embedding = new Float32Array(embeddings[0].length);
  for (const e of embeddings) for (let i = 0; i < e.length; i++) embedding[i] += e[i] / embeddings.length;

  const scored = candidateIds
    .filter((id) => recognizer.labelVectors.has(id))
    .map((id) => {
      const vector = recognizer.labelVectors.get(id);
      let similarity = 0;
      for (let i = 0; i < vector.length; i++) similarity += vector[i] * embedding[i];
      return { id, similarity };
    })
    .sort((a, b) => b.similarity - a.similarity);
  if (scored.length === 0) return null;

  // Softmax over scaled similarities (as in the model card) for a confidence value.
  const weights = scored.map((s) => Math.exp(100 * (s.similarity - scored[0].similarity)));
  const total = weights.reduce((a, b) => a + b, 0);
  return {
    id: scored[0].id,
    confidence: weights[0] / total,
    ranking: scored.map((s, i) => ({ id: s.id, confidence: weights[i] / total })),
  };
}
