use std::io::Cursor;
use std::sync::Arc;
use js_sys::{Array, Uint8Array};
use wasm_bindgen::prelude::*;
use zpdf_parser::PdfFile;
use zpdf_writer::{extract_pages, IncrementalWriter};

#[inline]
fn js_err(e: impl std::fmt::Display) -> JsValue {
    JsValue::from_str(&e.to_string())
}

fn bytes_of(v: &JsValue) -> Result<Vec<u8>, JsValue> {
    if !v.is_instance_of::<Uint8Array>() {
        return Err(JsValue::from_str("Expected a Uint8Array"));
    }
    Ok(Uint8Array::new(v).to_vec())
}

fn parse_pdf(bytes: &[u8]) -> Result<PdfFile, JsValue> {
    PdfFile::parse(Arc::<[u8]>::from(bytes.to_vec())).map_err(js_err)
}

#[wasm_bindgen]
pub fn merge_pdfs(files: Vec<JsValue>) -> Result<Vec<u8>, JsValue> {
    let mut it = files.into_iter();
    let first = it
        .next()
        .ok_or_else(|| JsValue::from_str("No PDFs to merge"))?;
    let mut writer = IncrementalWriter::new(bytes_of(&first)?).map_err(js_err)?;
    for f in it {
        let bytes = bytes_of(&f)?;
        let src = parse_pdf(&bytes)?;
        writer.append_document(&src).map_err(js_err)?;
    }
    let mut buf: Cursor<Vec<u8>> = Cursor::new(Vec::new());
    writer.write(&mut buf).map_err(js_err)?;
    Ok(buf.into_inner())
}

#[wasm_bindgen]
pub fn extract_pdfs(bytes: Vec<u8>, groups: js_sys::Array) -> Result<JsValue, JsValue> {
    let src = parse_pdf(&bytes)?;
    let out = Array::new();
    for g in groups.iter() {
        let group = Array::from(&g);
        let mut indices: Vec<usize> = Vec::with_capacity(group.length() as usize);
        for item in group.iter() {
            let idx = item.as_f64().map(|v| v as i64).unwrap_or(-1);
            if idx < 0 {
                return Err(JsValue::from_str("Invalid page index in group"));
            }
            indices.push(idx as usize);
        }
        let pdf = extract_pages(&src, &indices).map_err(js_err)?;
        out.push(&Uint8Array::from(pdf.as_slice()).into());
    }
    Ok(out.into())
}

const SPACE_WEIGHT: f64 = 0.45;
const WORD_PAD_EM: f64 = 0.16;
const WORD_RIGHT_EXTRA_EM: f64 = 0.07;
const MAX_WORD_CHARS: usize = 20;
const WORD_SPLIT_MIN_WIDTH: f64 = 3.2;

#[inline]
fn char_weight(ch: char) -> f64 {
    if ch == ' ' || ch == '\t' || ch == '\n' || ch == '\r' || ch == '\u{00a0}' {
        return SPACE_WEIGHT;
    }
    match ch {
        'W' | 'M' | 'O' | 'Q' | 'w' | 'm' | '@' | '#' | '%' | 'A' | 'G' | 'o' | 'g' | 'd'
        | 'b' | 'q' | 'p' | 'u' => 1.16,
        'i' | 'j' | 'l' | 'f' | 't' | 'r' | '.' | ',' | '\'' | '`' | '|' | '!' | 'I' | ':'
        | ';' | ')' | '(' => 0.82,
        _ => 1.0,
    }
}

#[wasm_bindgen]
pub struct WordBatch {
    data: Vec<f64>,
    texts: Vec<String>,
}

#[wasm_bindgen]
impl WordBatch {
    pub fn data(&self) -> Vec<f64> {
        self.data.clone()
    }

    pub fn texts(&self) -> Vec<String> {
        self.texts.clone()
    }
}

#[wasm_bindgen]
pub fn split_words(
    xs: Vec<f64>,
    ys: Vec<f64>,
    ws: Vec<f64>,
    hs: Vec<f64>,
    fs: Vec<f64>,
    bs: Vec<f64>,
    texts: Vec<String>,
) -> WordBatch {
    let n = xs.len();
    let mut data: Vec<f64> = Vec::new();
    let mut batch_texts: Vec<String> = Vec::new();
    for i in 0..n {
        let (run_x, run_y, run_w, run_h) = (xs[i], ys[i], ws[i], hs[i]);
        let (run_fs, run_base) = (fs[i], bs[i]);
        let text = &texts[i];
        let has_space = text.chars().any(|c| c.is_whitespace());
        if run_w < run_fs * WORD_SPLIT_MIN_WIDTH || !has_space {
            data.extend_from_slice(&[run_x, run_y, run_w, run_h, run_fs, run_base]);
            batch_texts.push(text.clone());
            continue;
        }
        let mut tokens: Vec<(char, f64)> = Vec::with_capacity(text.len());
        let mut total_w = 0.0f64;
        for ch in text.chars() {
            let cw = char_weight(ch);
            tokens.push((ch, cw));
            total_w += cw;
        }
        if total_w <= 0.0 {
            data.extend_from_slice(&[run_x, run_y, run_w, run_h, run_fs, run_base]);
            batch_texts.push(text.clone());
            continue;
        }
        let pad = run_fs * WORD_PAD_EM;
        let extra_right = run_fs * WORD_RIGHT_EXTRA_EM;
        let advance_per_unit = run_w / total_w;
        let mut cursor = 0.0f64;
        let mut word: Vec<char> = Vec::new();
        let mut word_weight = 0.0f64;
        let mut word_start = 0.0f64;
        let mut emit = |word: &mut Vec<char>, word_weight: &mut f64, start: f64| {
            let word_chars = word.len();
            let wx = run_x + start * advance_per_unit;
            let ww = ((word_chars as f64) * run_fs * 0.28).max(*word_weight * advance_per_unit);
            let x0 = run_x.max(wx - pad);
            let x1 = (run_x + run_w).min(wx + ww + pad + extra_right);
            data.extend_from_slice(&[
                x0,
                run_y,
                (x1 - x0).max(run_fs * 0.5),
                run_h,
                run_fs,
                run_base,
            ]);
            batch_texts.push(word.iter().collect::<String>());
            word.clear();
            *word_weight = 0.0;
        };
        for (ch, cw) in tokens {
            if cw <= SPACE_WEIGHT + 1e-6 {
                if !word.is_empty() {
                    emit(&mut word, &mut word_weight, word_start);
                }
                cursor += cw;
                continue;
            }
            if word.is_empty() {
                word_start = cursor;
            }
            word.push(ch);
            word_weight += cw;
            cursor += cw;
            if word.len() >= MAX_WORD_CHARS {
                emit(&mut word, &mut word_weight, word_start);
            }
        }
        if !word.is_empty() {
            emit(&mut word, &mut word_weight, word_start);
        }
    }
    WordBatch {
        data,
        texts: {
            let mut t = batch_texts;
            t.shrink_to_fit();
            t
        },
    }
}

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