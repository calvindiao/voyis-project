use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn grayscale_rgba(pixels: &mut [u8]) {
    // pixels: RGBA format, 4 bytes per pixel
    let len = pixels.len();

    let mut i = 0;
    while i + 3 < len {
        let r = pixels[i] as u32;
        let g = pixels[i + 1] as u32;
        let b = pixels[i + 2] as u32;

        // Simple average
        let gray = ((r + g + b) / 3) as u8;

        pixels[i] = gray;
        pixels[i + 1] = gray;
        pixels[i + 2] = gray;
        // alpha pixels[i + 3] remains unchanged

        i += 4;
    }
}
