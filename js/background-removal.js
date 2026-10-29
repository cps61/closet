// Background removal that runs entirely on the device, for free.
//
// Uses IMG.LY's open-source @imgly/background-removal (AGPL; free for this use),
// which runs an ISNet segmentation model through ONNX Runtime in the browser:
// WebGPU when available (Safari 26+), otherwise WebAssembly on the CPU.
// The model (~80 MB) downloads once on first use and is cached afterwards.

const LIBRARY_URL =
  'https://esm.sh/@imgly/background-removal@1.7.0?deps=onnxruntime-web@1.21.0';

export class BackgroundRemovalError extends Error {
  constructor(message) {
    super(message);
    this.name = 'BackgroundRemovalError';
  }
}

let libraryPromise;

function loadLibrary() {
  libraryPromise ??= import(LIBRARY_URL).catch((error) => {
    libraryPromise = undefined; // allow a retry, e.g. after reconnecting
    throw error;
  });
  return libraryPromise;
}

const supportsWebGPU = typeof navigator !== 'undefined' && 'gpu' in navigator;

/**
 * Returns a PNG Blob, same size as `image`, with everything but the main subject
 * transparent. `onDownload({ file, loaded, total })` reports first-run downloads.
 */
export async function removeBackground(image, { onDownload } = {}) {
  const library = await loadLibrary();
  const remove = library.removeBackground ?? library.default;

  const config = {
    output: { format: 'image/png' },
    progress: (key, current, total) => {
      if (key.startsWith('fetch') && total > 0) onDownload?.({ file: key, loaded: current, total });
    },
  };

  if (supportsWebGPU) {
    try {
      return await remove(image, { ...config, device: 'gpu' });
    } catch (error) {
      console.warn('WebGPU background removal failed, retrying on CPU', error);
    }
  }
  return remove(image, { ...config, device: 'cpu' });
}
