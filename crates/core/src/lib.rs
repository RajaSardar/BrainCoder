use wasm_bindgen::prelude::*;

#[inline]
fn norm_word(s: &str) -> String {
    let chars: Vec<char> = s.chars().collect();
    let mut start = 0usize;
    let mut end = chars.len();
    while start < end && !chars[start].is_alphanumeric() {
        start += 1;
    }
    while end > start && !chars[end - 1].is_alphanumeric() {
        end -= 1;
    }
    chars[start..end]
        .iter()
        .collect::<String>()
        .to_lowercase()
}

#[wasm_bindgen]
pub fn find_matches(
    xs: Vec<f64>,
    ys: Vec<f64>,
    ws: Vec<f64>,
    hs: Vec<f64>,
    fonts: Vec<f64>,
    texts: Vec<String>,
    page_w: f64,
    page_h: f64,
    query: String,
) -> Vec<f64> {
    let n = xs.len();
    let qwords: Vec<String> = query.split_whitespace().map(|s| s.to_lowercase()).collect();
    let qn = qwords.len();
    let mut out: Vec<f64> = Vec::new();
    if n == 0 || qn == 0 {
        return out;
    }
    let normalized: Vec<String> = texts.iter().map(|t| norm_word(t)).collect();
    let mut i = 0usize;
    while i < n {
        if normalized[i] == qwords[0] {
            let mut k = 0usize;
            let mut j = i;
            while k < qn && j < n && normalized[j] == qwords[k] {
                k += 1;
                j += 1;
            }
            if k == qn {
                let mut min_x = f64::MAX;
                let mut min_y = f64::MAX;
                let mut max_x = f64::MIN;
                let mut max_y = f64::MIN;
                for m in i..j {
                    if xs[m] < min_x {
                        min_x = xs[m];
                    }
                    if ys[m] < min_y {
                        min_y = ys[m];
                    }
                    let right = xs[m] + ws[m];
                    let bottom = ys[m] + hs[m];
                    if right > max_x {
                        max_x = right;
                    }
                    if bottom > max_y {
                        max_y = bottom;
                    }
                }
                let fs = fonts[i];
                let pad_x = (fs * 0.12) / page_w;
                let pad_y = (fs * 0.2) / page_h;
                let x = (min_x / page_w - pad_x).max(0.0);
                let y = (min_y / page_h - pad_y).max(0.0);
                let w = ((max_x - min_x) / page_w + pad_x * 2.0).min(1.0);
                let h = ((max_y - min_y) / page_h + pad_y * 2.0).min(1.0);
                out.extend_from_slice(&[x, y, w, h]);
            }
        }
        i += 1;
    }
    out
}

#[wasm_bindgen]
pub fn add(a: f64, b: f64) -> f64 {
    a + b
}