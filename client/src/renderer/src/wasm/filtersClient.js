let wasmReadyPromise = null;

async function getWasmModule() {
  if (!wasmReadyPromise) {
    wasmReadyPromise = (async () => {
      // import wasm-pack generated wrapper module
      const mod = await import('./pkg/wasm_filters.js');

      if (typeof mod.default === 'function') {
        await mod.default();
      }
      return mod;
    })();
  }
  return wasmReadyPromise;
}

/**
 * use wasm to apply grayscale filter
 * @param {Uint8ClampedArray} rgba original pixels (ImageData.data)
 * @returns {Promise<Uint8ClampedArray>} grayscale pixels
 */
export async function applyGrayscaleWasm(pixelData) {
  const mod = await getWasmModule();

  const view =
    pixelData instanceof Uint8Array
      ? pixelData
      : new Uint8Array(pixelData.buffer);

  // call Rust exported grayscale_rgba
  mod.grayscale_rgba(view);
}
