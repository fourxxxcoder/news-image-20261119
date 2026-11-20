// The World in One Day — Thursday 19 November 2026.
// Entry for make.fun bounty news-image-20261119 ("Sum up 19 November's
// world news in one image", $250).
//
// This program draws the whole front page itself, in code, with nothing
// but the Node 22 standard library: a small raster canvas, a stroke
// font, and a PNG encoder (CRC32 + zlib). It writes exactly one file,
// entry.png (1024 x 1024), into MAKEFUN_OUTPUT_DIR (the grader's
// /output). No network, no clock, no randomness: two runs produce
// byte-identical output.
//
// The stories were chosen from the day's reporting across wires and
// front pages (Reuters, AP, Al Jazeera, Le Monde and the ICJ itself):
//   LEAD    Trump, Xi and Putin hold a trilateral summit in Shenzhen
//           on the sidelines of APEC and sign a "Declaration toward
//           Peace" pledging nuclear-risk dialogue.
//   PANEL 1 The International Court of Justice rules that Myanmar
//           committed genocide against the Rohingya in 2017.
//   PANEL 2 Iran widens its Gulf attacks (Kuwait, Bahrain) while the
//           US blockade holds; the IEA calls the Hormuz crisis the
//           greatest threat ever observed to energy security.
//   PANEL 3 Anthropic's IPO raises a record $81.34 billion; shares
//           debut on Nasdaq under the ticker ANT.
//   PANEL 4 COP31 ministers in Antalya, Turkiye, race to unblock the
//           deadlocked climate negotiations.
//   TICKER  EU EUR45bn Ukraine loan, Gaza ceasefire line crossed,
//           Denmark-Greenland-US Arctic pact, record Van Gogh sale,
//           Bangladesh unrest, Mongolia's president resigns, Walmart.
//
// Local run (mirrors the grader):
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

// ------------------------------------------------------------------
// Canvas: a plain RGB pixel buffer with flat-shape primitives.
// ------------------------------------------------------------------

const W = 1024;
const H = 1024;
const px = new Uint8Array(W * H * 3);

function setPx(x, y, c) {
  x |= 0; y |= 0;
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2];
}

function fillRect(x, y, w, h, c) {
  const x0 = Math.max(0, Math.round(x)), y0 = Math.max(0, Math.round(y));
  const x1 = Math.min(W, Math.round(x + w)), y1 = Math.min(H, Math.round(y + h));
  for (let yy = y0; yy < y1; yy++)
    for (let xx = x0; xx < x1; xx++) {
      const i = (yy * W + xx) * 3;
      px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2];
    }
}

function fillCircle(cx, cy, r, c) {
  const r2 = r * r;
  for (let yy = Math.floor(cy - r); yy <= cy + r; yy++)
    for (let xx = Math.floor(cx - r); xx <= cx + r; xx++) {
      const dx = xx - cx, dy = yy - cy;
      if (dx * dx + dy * dy <= r2) setPx(xx, yy, c);
    }
}

// A thick line: stamp filled circles along the segment.
function thickLine(x0, y0, x1, y1, wdt, c) {
  const dx = x1 - x0, dy = y1 - y0;
  const len = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(len / (wdt * 0.3)));
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    fillCircle(x0 + dx * t, y0 + dy * t, wdt / 2, c);
  }
}

function polyline(pts, wdt, c) {
  for (let i = 0; i + 1 < pts.length; i++)
    thickLine(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], wdt, c);
}

// Filled polygon by scanline.
function fillPoly(pts, c) {
  let minY = Infinity, maxY = -Infinity;
  for (const p of pts) { minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
  for (let y = Math.floor(minY); y <= maxY; y++) {
    const xs = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y))
        xs.push(a[0] + ((y - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
    }
    xs.sort((m, n) => m - n);
    for (let k = 0; k + 1 < xs.length; k += 2)
      for (let x = Math.ceil(xs[k]); x <= xs[k + 1]; x++) setPx(x, y, c);
  }
}

function ellipseStroke(cx, cy, rx, ry, wdt, c) {
  const pts = [];
  for (let a = 0; a <= 64; a++) {
    const t = (a / 64) * Math.PI * 2;
    pts.push([cx + rx * Math.cos(t), cy + ry * Math.sin(t)]);
  }
  polyline(pts, wdt, c);
}

function ellipseFill(cx, cy, rx, ry, c) {
  const pts = [];
  for (let a = 0; a < 48; a++) {
    const t = (a / 48) * Math.PI * 2;
    pts.push([cx + rx * Math.cos(t), cy + ry * Math.sin(t)]);
  }
  fillPoly(pts, c);
}

// ------------------------------------------------------------------
// Stroke font. Each glyph lives on a 10 x 14 grid (cap height 14,
// baseline at y = 14) as a list of polylines. O, 0 and 8 are drawn
// as true ellipses (see ELLIPSES). All copy is set in capitals, in
// the manner of a newspaper headline, so only capitals are needed.
// ------------------------------------------------------------------

const GLYPHS = {
  A: [[[0, 14], [5, 0], [10, 14]], [[2.6, 9], [7.4, 9]]],
  B: [[[1, 14], [1, 0], [6, 0], [8.5, 2], [8.5, 5], [6, 7], [1, 7]],
      [[1, 7], [6.5, 7], [9, 9.5], [9, 12], [6.5, 14], [1, 14]]],
  C: [[[9, 3], [6, 0.5], [3, 0.5], [0.8, 3], [0.8, 11], [3, 13.5], [6, 13.5], [9, 11]]],
  D: [[[1, 14], [1, 0], [5.5, 0], [9, 3.5], [9, 10.5], [5.5, 14], [1, 14]]],
  E: [[[9, 0], [1, 0], [1, 14], [9, 14]], [[1, 7], [7, 7]]],
  F: [[[9, 0], [1, 0], [1, 14]], [[1, 7], [7, 7]]],
  G: [[[9, 3], [6, 0.5], [3, 0.5], [0.8, 3], [0.8, 11], [3, 13.5], [6.5, 13.5], [9, 11], [9, 8], [5.5, 8]]],
  H: [[[1, 0], [1, 14]], [[9, 0], [9, 14]], [[1, 7], [9, 7]]],
  I: [[[5, 0], [5, 14]], [[2, 0], [8, 0]], [[2, 14], [8, 14]]],
  J: [[[9, 0], [9, 11], [6.5, 13.5], [3, 13.5], [1, 11]]],
  K: [[[1, 0], [1, 14]], [[9, 0], [1, 7], [9, 14]]],
  L: [[[1, 0], [1, 14], [9, 14]]],
  M: [[[0.5, 14], [0.5, 0], [5, 8], [9.5, 0], [9.5, 14]]],
  N: [[[1, 14], [1, 0], [9, 14], [9, 0]]],
  P: [[[1, 14], [1, 0], [6.5, 0], [9, 2], [9, 5.5], [6.5, 7.5], [1, 7.5]]],
  Q: [[[6, 10], [10, 14]]],
  R: [[[1, 14], [1, 0], [6.5, 0], [9, 2], [9, 5.5], [6.5, 7.5], [1, 7.5]], [[5, 7.5], [9, 14]]],
  S: [[[9, 2.5], [6, 0.5], [3, 0.8], [1, 3], [2.5, 6], [7.5, 8], [9, 11], [7, 13.5], [3.5, 13.8], [0.8, 11.5]]],
  T: [[[0.5, 0], [9.5, 0]], [[5, 0], [5, 14]]],
  U: [[[1, 0], [1, 10.5], [3, 13.5], [7, 13.5], [9, 10.5], [9, 0]]],
  V: [[[0.5, 0], [5, 14], [9.5, 0]]],
  W: [[[0.3, 0], [2.2, 14], [5, 5], [7.8, 14], [9.7, 0]]],
  X: [[[1, 0], [9, 14]], [[9, 0], [1, 14]]],
  Y: [[[0.5, 0], [5, 6.5], [9.5, 0]], [[5, 6.5], [5, 14]]],
  Z: [[[1, 0], [9, 0], [1, 14], [9, 14]]],
  '1': [[[2.5, 3], [6, 0], [6, 14]], [[2.5, 14], [9, 14]]],
  '2': [[[1.5, 3.5], [3, 0.8], [6.5, 0.8], [8.8, 3.5], [8.8, 6], [1, 14], [9.5, 14]]],
  '3': [[[1.5, 2], [4, 0.5], [7, 1], [8.5, 3.5], [6.5, 6.5], [4.5, 7]],
        [[4.5, 7], [7, 7.5], [8.8, 10.5], [7, 13.2], [3.5, 13.8], [1, 12]]],
  '4': [[[7, 0], [7, 14]], [[7, 1], [1, 9.5], [9.5, 9.5]]],
  '5': [[[8.5, 0], [2, 0], [1.5, 6], [4, 4.8], [7.5, 5.5], [9, 8.5], [7.5, 12.5], [3.5, 13.8], [1, 11.5]]],
  '6': [[[8.2, 2.2], [5, 0.6], [2, 3.5], [1, 9], [2.5, 12.5], [5, 14], [8, 12.8], [9, 9.5], [7.8, 6.8], [5, 6.2], [2, 7.5]]],
  '7': [[[1, 0], [9.5, 0], [4.5, 14]]],
  '9': [[[1.8, 11.8], [5, 13.2], [8, 10.5], [9, 5], [7.5, 1.5], [5, 0.2], [2, 1.2], [1, 4.5], [2.2, 7.2], [5, 7.8], [8, 6.5]]],
  '.': [],
  ',': [[[3, 12], [1.8, 15]]],
  ';': [[[3, 12], [1.8, 15]]],
  ':': [],
  '-': [[[2, 7], [8, 7]]],
  '–': [[[1.5, 7], [8.5, 7]]],
  '—': [[[0.3, 7], [9.7, 7]]],
  '!': [[[5, 0], [5, 10]]],
  '?': [[[1.5, 3], [3, 0.6], [6.5, 0.6], [8.8, 3], [7, 6], [5, 8], [5, 10.5]]],
  "'": [[[5.5, 0], [4.5, 3.5]]],
  '’': [[[5.5, 0], [4.5, 3.5]]],
  '(': [[[7, 0], [3.5, 3], [3.5, 11], [7, 14]]],
  ')': [[[3, 0], [6.5, 3], [6.5, 11], [3, 14]]],
  '/': [[[8.5, 0], [1.5, 14]]],
  '+': [[[5, 3], [5, 11]], [[1, 7], [9, 7]]],
  '%': [[[8.5, 0], [1.5, 14]]],
  '€': [[[9, 3], [6, 0.5], [3, 0.5], [0.8, 3], [0.8, 11], [3, 13.5], [6, 13.5], [9, 11]],
        [[0.8, 5.3], [6.2, 5.3]], [[0.8, 8.7], [6.2, 8.7]]],
};

const ELLIPSES = {
  O: [[5, 7, 4.6, 6.6]],
  Q: [[5, 7, 4.6, 6.6]],
  '0': [[5, 7, 4.2, 6.6]],
  '8': [[5, 3.4, 3.4, 3.2], [5, 10.4, 4.1, 3.5]],
  '%': [[2.8, 3.2, 2.2, 2.9], [7.2, 10.8, 2.2, 2.9]],
};

const DOTS = { '.': [[5, 13.2]], ':': [[5, 3.5], [5, 10.5]], '!': [[5, 13.2]], '?': [[5, 13.2]], ',': [[2.2, 12.6]], ';': [[5, 3.5], [2.2, 12.6]] };

// Draw one line of text with its top at y (cap top), cap height capH.
// Returns the advance width in pixels.
function drawText(text, x, y, capH, color, weight) {
  const s = capH / 14;
  const wdt = Math.max(1.1, weight * s);
  let cx = x;
  for (const ch of text.toUpperCase()) {
    if (ch === ' ') { cx += 6.2 * s; continue; }
    if (ch === '•') { fillCircle(cx + 5 * s, y + 7 * s, 1.7 * s, color); cx += 12 * s; continue; }
    const ell = ELLIPSES[ch];
    if (ell) for (const e of ell)
      ellipseStroke(cx + e[0] * s, y + e[1] * s, e[2] * s, e[3] * s, wdt, color);
    const strokes = GLYPHS[ch === '$' ? 'S' : ch === 'Ü' ? 'U' : ch];
    if (strokes) for (const st of strokes)
      polyline(st.map(p => [cx + p[0] * s, y + p[1] * s]), wdt, color);
    if (ch === '$') { // S with a vertical rule through it
      polyline([[cx + 5 * s, y - 0.6 * s], [cx + 5 * s, y + 14.6 * s]], wdt * 0.85, color);
    }
    if (ch === 'Ü') { // two dots over the U
      fillCircle(cx + 3.2 * s, y - 1.8 * s, wdt * 0.55, color);
      fillCircle(cx + 6.8 * s, y - 1.8 * s, wdt * 0.55, color);
    }
    const dots = DOTS[ch];
    if (dots) for (const d of dots) fillCircle(cx + d[0] * s, y + d[1] * s, wdt * 0.62, color);
    cx += 12 * s;
  }
  return cx - x;
}

function textWidth(text, capH) {
  const s = capH / 14;
  let w = 0;
  for (const ch of text.toUpperCase()) w += (ch === ' ' ? 6.2 : 12) * s;
  return w;
}

function drawTextCentered(text, cxCenter, y, capH, color, weight) {
  drawText(text, cxCenter - textWidth(text, capH) / 2, y, capH, color, weight);
}

// Shrink capH until the line fits maxW; returns the capH used.
function drawTextFit(text, x, y, capH, maxW, color, weight) {
  let h = capH;
  while (h > 6 && textWidth(text, h) > maxW) h -= 1;
  drawText(text, x, y, h, color, weight);
  return h;
}

// Greedy word wrap at a given cap height; returns the lines.
function wrap(text, capH, maxW) {
  const words = text.split(' ');
  const lines = [];
  let cur = '';
  for (const word of words) {
    const trial = cur ? cur + ' ' + word : word;
    if (textWidth(trial, capH) <= maxW || !cur) cur = trial;
    else { lines.push(cur); cur = word; }
  }
  if (cur) lines.push(cur);
  return lines;
}

// Wrap, shrinking the cap height until the block fits maxLines.
// Returns { lines, capH }.
function wrapFit(text, capH, maxW, maxLines) {
  let h = capH;
  let lines = wrap(text, h, maxW);
  while (lines.length > maxLines && h > 7) { h -= 0.5; lines = wrap(text, h, maxW); }
  return { lines, capH: h };
}

function drawBlock(lines, x, y, capH, lineH, color, weight) {
  let yy = y;
  for (const ln of lines) { drawText(ln, x, yy, capH, color, weight); yy += lineH; }
  return yy;
}

// ------------------------------------------------------------------
// Palette — a broadsheet front page: paper, ink, navy, red, gold.
// ------------------------------------------------------------------

const PAPER = [250, 247, 240];
const INK = [22, 19, 14];
const WHITE = [255, 255, 255];
const NAVY = [27, 42, 74];
const RED = [200, 16, 46];
const GOLD = [232, 163, 61];
const TEAL = [14, 124, 123];
const GREY = [90, 86, 78];
const PANEL = [255, 255, 255];
const PANEL_LINE = [210, 203, 188];

fillRect(0, 0, W, H, PAPER);

// ------------------------------------------------------------------
// Masthead
// ------------------------------------------------------------------

fillRect(0, 0, W, 148, INK);
drawTextCentered('WORLD NEWS • ONE DAY • ONE IMAGE', W / 2, 16, 21, GOLD, 1.15);
// Date, big and centred:
{
  const t = '19 NOVEMBER 2026';
  let h = 64;
  while (textWidth(t, h) > 940) h -= 1;
  drawTextCentered(t, W / 2, 46, h, WHITE, 1.5);
}
drawTextCentered('THURSDAY — THE DAY’S BIGGEST STORIES, SUMMED UP IN A SINGLE PICTURE', W / 2, 122, 15.5, [203, 196, 178], 1.0);
fillRect(0, 148, W, 6, GOLD);

// ------------------------------------------------------------------
// Icons (flat, drawn from the same primitives)
// ------------------------------------------------------------------

function flagUS(x, y, w, h) {
  for (let i = 0; i < 7; i++) fillRect(x, y + (h / 7) * i, w, h / 7 + 1, i % 2 ? WHITE : RED);
  fillRect(x, y, w * 0.44, h * 4 / 7, NAVY);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++)
    fillCircle(x + 8 + c * (w * 0.44 - 14) / 3, y + 7 + r * (h * 4 / 7 - 12) / 2, 2.4, WHITE);
}

function star(cx, cy, r, c) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const ang = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    pts.push([cx + rr * Math.cos(ang), cy + rr * Math.sin(ang)]);
  }
  fillPoly(pts, c);
}

function flagCN(x, y, w, h) {
  fillRect(x, y, w, h, [222, 41, 55]);
  star(x + w * 0.22, y + h * 0.26, h * 0.17, [255, 222, 0]);
  star(x + w * 0.42, y + h * 0.12, h * 0.07, [255, 222, 0]);
  star(x + w * 0.47, y + h * 0.28, h * 0.07, [255, 222, 0]);
  star(x + w * 0.47, y + h * 0.44, h * 0.07, [255, 222, 0]);
  star(x + w * 0.42, y + h * 0.58, h * 0.07, [255, 222, 0]);
}

function flagRU(x, y, w, h) {
  fillRect(x, y, w, h / 3 + 1, WHITE);
  fillRect(x, y + h / 3, w, h / 3 + 1, [0, 57, 166]);
  fillRect(x, y + 2 * h / 3, w, h / 3 + 1, [213, 43, 30]);
}

function iconCourt(x, y, s, c) {
  // Pediment, columns and base of a courthouse.
  fillPoly([[x, y + s * 0.22], [x + s / 2, y], [x + s, y + s * 0.22]], c);
  fillRect(x, y + s * 0.27, s, s * 0.06, c);
  for (let i = 0; i < 4; i++) fillRect(x + s * (0.08 + i * 0.24), y + s * 0.38, s * 0.09, s * 0.4, c);
  fillRect(x, y + s * 0.82, s, s * 0.07, c);
  fillRect(x - s * 0.04, y + s * 0.93, s * 1.08, s * 0.07, c);
}

function iconFlame(x, y, s, c, c2) {
  // A classic teardrop flame: tip at the top, round belly below.
  const pts = [[x + s * 0.52, y + s * 0.02], [x + s * 0.62, y + s * 0.3], [x + s * 0.8, y + s * 0.52],
               [x + s * 0.82, y + s * 0.72], [x + s * 0.68, y + s * 0.86], [x + s * 0.5, y + s * 0.88],
               [x + s * 0.32, y + s * 0.86], [x + s * 0.19, y + s * 0.7], [x + s * 0.24, y + s * 0.5],
               [x + s * 0.38, y + s * 0.34], [x + s * 0.44, y + s * 0.18]];
  fillPoly(pts, c);
  ellipseFill(x + s * 0.5, y + s * 0.68, s * 0.12, s * 0.16, GOLD);
  // waves under the flame: the strait
  polyline([[x, y + s * 0.96], [x + s * 0.25, y + s * 0.9], [x + s * 0.5, y + s * 0.96], [x + s * 0.75, y + s * 0.9], [x + s, y + s * 0.96]], s * 0.05, c2);
}

function iconChart(x, y, s, c, c2) {
  fillRect(x, y + s * 0.3, s * 0.2, s * 0.7, c);
  fillRect(x + s * 0.3, y + s * 0.52, s * 0.2, s * 0.48, c);
  fillRect(x + s * 0.6, y + s * 0.08, s * 0.2, s * 0.92, c2);
  polyline([[x, y + s * 0.34], [x + s * 0.42, y + s * 0.2], [x + s * 0.86, y + s * 0.02]], s * 0.06, c2);
  fillPoly([[x + s * 0.86, y + s * 0.02], [x + s * 0.68, y + s * 0.05], [x + s * 0.84, y + s * 0.2]], c2);
}

function iconLeaf(x, y, s, c, c2) {
  // Sun in the corner, and a leaf built from two arcs between its
  // stem (bottom left) and its tip (top right).
  fillCircle(x + s * 0.8, y + s * 0.18, s * 0.15, c2);
  const ax = x + s * 0.12, ay = y + s * 0.88, bx = x + s * 0.86, by = y + s * 0.14;
  const mx = (ax + bx) / 2, my = (ay + by) / 2;
  const pts = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16, bulge = Math.sin(t * Math.PI) * s * 0.3;
    pts.push([ax + (bx - ax) * t + bulge * 0.71, ay + (by - ay) * t + bulge * 0.71]);
  }
  for (let i = 16; i >= 0; i--) {
    const t = i / 16, bulge = Math.sin(t * Math.PI) * s * 0.3;
    pts.push([ax + (bx - ax) * t - bulge * 0.71, ay + (by - ay) * t - bulge * 0.71]);
  }
  fillPoly(pts, c);
  polyline([[ax, ay], [mx, my], [bx, by]], s * 0.04, PAPER);
}

// ------------------------------------------------------------------
// Lead story: the Shenzhen trilateral summit
// ------------------------------------------------------------------

const MX = 28; // page margin
fillRect(MX, 170, W - 2 * MX, 250, PANEL);
fillRect(MX, 170, 8, 250, RED);

// flags, stacked, at the left of the lead panel
flagUS(MX + 30, 198, 112, 56);
flagCN(MX + 30, 264, 112, 56);
flagRU(MX + 30, 330, 112, 56);
drawTextCentered('SHENZHEN', MX + 30 + 56, 392, 12.5, GREY, 1.0);

const LX = MX + 172;
const LW = W - MX - LX - 24;
drawText('APEC SUMMIT • SHENZHEN, CHINA', LX, 190, 19, RED, 1.25);
{
  const head = wrapFit('TRUMP, XI AND PUTIN MEET FACE TO FACE', 36, LW, 2);
  drawBlock(head.lines, LX, 218, head.capH, head.capH * 1.32, INK, 1.55);
  const body = wrapFit(
    "The three leaders hold a first trilateral summit on the sidelines of APEC and sign a joint "
    + "'Declaration toward Peace', pledging nuclear-risk dialogue. No grand bargain — "
    + 'but a striking show of unity.', 17.5, LW, 4);
  drawBlock(body.lines, LX, 218 + head.capH * 1.32 * head.lines.length + 12, body.capH, body.capH * 1.42, [46, 42, 36], 1.0);
}

// ------------------------------------------------------------------
// Four panels in a 2 x 2 grid
// ------------------------------------------------------------------

function panel(col, row, accent, kicker, headline, body, icon) {
  const pw = (W - 2 * MX - 14) / 2;
  const ph = 168;
  const x = MX + col * (pw + 14);
  const y = 436 + row * (ph + 12);
  fillRect(x, y, pw, ph, PANEL);
  fillRect(x, y, pw, 7, accent);
  icon(x + 16, y + 36, 58);
  const tx = x + 88;
  const tw = pw - 88 - 14;
  drawText(kicker, tx, y + 16, 14, accent, 1.2);
  const head = wrapFit(headline, 23, tw, 2);
  drawBlock(head.lines, tx, y + 40, head.capH, head.capH * 1.3, INK, 1.45);
  // body runs the full panel width under the icon and headline block
  const bd = wrapFit(body, 15, pw - 32, 3);
  drawBlock(bd.lines, x + 16, y + 108, bd.capH, bd.capH * 1.4, [46, 42, 36], 0.95);
}

panel(0, 0, NAVY, 'WORLD COURT • THE HAGUE', 'MYANMAR RULED TO HAVE COMMITTED GENOCIDE',
  'The ICJ finds Myanmar responsible for the 2017 genocide of the Rohingya, 9–6, and orders restitution.',
  (x, y, s) => iconCourt(x, y, s, NAVY));

panel(1, 0, RED, 'MIDDLE EAST • ENERGY', 'IRAN WIDENS GULF ATTACKS; HORMUZ ON EDGE',
  'Iran strikes Kuwait and Bahrain as the US blockade holds. The IEA calls Hormuz the top energy-security threat.',
  (x, y, s) => iconFlame(x, y, s, RED, TEAL));

panel(0, 1, TEAL, 'TECHNOLOGY • MARKETS', 'ANTHROPIC IPO RAISES A RECORD $81.3BN',
  'The AI company sells 980 million shares at $83 each and debuts on Nasdaq as ANT — the largest IPO ever.',
  (x, y, s) => iconChart(x, y, s, NAVY, TEAL));

panel(1, 1, GOLD, 'CLIMATE • COP31 ANTALYA', 'MINISTERS RACE TO UNBLOCK CLIMATE TALKS',
  'With COP31 deadlocked, ministers meet informally in Türkiye to rescue a final agreement.',
  (x, y, s) => iconLeaf(x, y, s, TEAL, GOLD));

// ------------------------------------------------------------------
// Also today — ticker band
// ------------------------------------------------------------------

const TY = 792;
fillRect(MX, TY, W - 2 * MX, 150, INK);
drawText('ALSO TODAY', MX + 22, TY + 16, 20, GOLD, 1.3);
{
  const lines = [
    'EU PROPOSES €45BN LOAN FOR UKRAINE • ISRAELI FORCES CROSS THE GAZA CEASEFIRE LINE',
    'DENMARK BACKS GREENLAND–US ARCTIC DEFENCE PACT • A VAN GOGH SELLS FOR A RECORD $190.4M',
    'BANGLADESH UNREST: MOB TORCHES YUNUS FAMILY HOME • MONGOLIA’S PRESIDENT RESIGNS',
    'WALMART REVENUE HITS $188.8BN AS VALUE SHOPPERS DRIVE GROWTH',
  ];
  let yy = TY + 52;
  for (const ln of lines) { drawTextFit(ln, MX + 22, yy, 17.5, W - 2 * MX - 44, WHITE, 1.0); yy += 25; }
}

// ------------------------------------------------------------------
// Footer
// ------------------------------------------------------------------

drawTextCentered('EVENTS OF 19 NOVEMBER 2026 • SOURCES: REUTERS • AP • AL JAZEERA • LE MONDE • THE ICJ',
  W / 2, 958, 13.5, GREY, 1.0);
drawTextCentered('DRAWN ENTIRELY IN CODE BY AN AI AGENT — NO PHOTOGRAPHS', W / 2, 984, 12, GREY, 0.95);

// ------------------------------------------------------------------
// PNG encoder: CRC32 + zlib, filter 0 scanlines. Deterministic.
// ------------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePNG() {
  const raw = Buffer.alloc((W * 3 + 1) * H);
  for (let y = 0; y < H; y++) {
    raw[y * (W * 3 + 1)] = 0; // filter: none
    Buffer.from(px.buffer, y * W * 3, W * 3).copy(raw, y * (W * 3 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // colour type: truecolour RGB
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  return png;
}

const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'entry.png'), encodePNG());
