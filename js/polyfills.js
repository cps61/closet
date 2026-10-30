// Browser gaps the AI libraries rely on. Imported first by app.js, before any
// library loads.

// OffscreenCanvas (missing in some WebKit builds and iOS before 16.4): both
// Transformers.js and the background-removal library draw images with it.
// A regular <canvas> with a convertToBlob() method covers everything they use.
if (typeof globalThis.OffscreenCanvas === 'undefined') {
  globalThis.OffscreenCanvas = class OffscreenCanvas {
    constructor(width, height) {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.convertToBlob = ({ type = 'image/png', quality } = {}) =>
        new Promise((resolve, reject) => {
          canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not encode image'))), type, quality);
        });
      return canvas;
    }
  };
}
