import { useEffect, useMemo, useRef } from 'react';
import { clock, prefersReducedMotion } from '../lib/anim/clock';
import { easeInOutCubic } from '../lib/anim/easing';
import { FAR, FRONT, NEAR } from '../lib/anim/layers';
import { createTimeline, play } from '../lib/anim/timeline';
import type { IsochroneResult } from '../lib/types';

/** "#RRGGBB" -> [r, g, b]. */
function hexRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Colour of a street reached after `share` (0..1) of the time limit: the same linear navy -> cyan
 * ramp as the walking-time flood on the results map (`NEAR`/`FAR` in lib/anim/layers.ts).
 */
export function rampColor(share: number): string {
  const f = Math.min(1, Math.max(0, share));
  const a = hexRgb(NEAR);
  const b = hexRgb(FAR);
  const c = a.map((v, i) => Math.round(v + (b[i]! - v) * f));
  return `rgb(${c[0]} ${c[1]} ${c[2]})`;
}

/** One 0.25-minute bucket of the isochrone, projected to metres around the origin. */
export interface BackdropBucket {
  t: number;
  color: string;
  /** Polylines as flat [x0, y0, x1, y1, ...] arrays (metres, y down). */
  lines: number[][];
}

/** True when the value has the shape of a `GET /api/v1/isochrone` response. */
export function isIsochrone(value: unknown): value is IsochroneResult {
  const v = value as Partial<IsochroneResult> | null | undefined;
  return (
    !!v &&
    typeof v.max_min === 'number' &&
    !!v.origin &&
    typeof v.origin.lon === 'number' &&
    Array.isArray(v.buckets?.features)
  );
}

/**
 * Projects the isochrone buckets to metres around the origin (equirectangular is exact enough for a
 * few kilometres), sorted by walking time. `extent` is the largest |x| or |y|.
 */
export function projectBuckets(data: IsochroneResult): {
  buckets: BackdropBucket[];
  extent: number;
} {
  const { lon: lon0, lat: lat0 } = data.origin;
  const metresPerDegree = 111_320;
  const kx = Math.cos((lat0 * Math.PI) / 180) * metresPerDegree;
  let extent = 1;
  const buckets: BackdropBucket[] = [];
  for (const feature of data.buckets.features) {
    const lines: number[][] = [];
    for (const line of feature.geometry.coordinates) {
      const flat: number[] = [];
      for (const pos of line) {
        const x = (pos[0]! - lon0) * kx;
        const y = (lat0 - pos[1]!) * metresPerDegree;
        extent = Math.max(extent, Math.abs(x), Math.abs(y));
        flat.push(x, y);
      }
      if (flat.length >= 4) lines.push(flat);
    }
    const t = feature.properties.t;
    buckets.push({ t, color: rampColor(t / data.max_min), lines });
  }
  buckets.sort((a, b) => a.t - b.t);
  return { buckets, extent };
}

/** Buckets reached after `from` and up to `to` minutes (the ones to draw in one step). */
export function bucketsBetween(buckets: BackdropBucket[], from: number, to: number) {
  return buckets.filter((b) => b.t > from && b.t <= to);
}

const FLOOD_MS = 2600; // screen time from the address to the time limit
const FRONT_MIN = 0.75; // width of the orange front in minutes (as on the results map)
const LINE_PX = 2;

function context2d(canvas: HTMLCanvasElement | null): CanvasRenderingContext2D | null {
  try {
    return canvas?.getContext('2d') ?? null;
  } catch {
    return null;
  }
}

/**
 * Background of the home hero: the real streets reachable on foot from the example address within
 * the time limit (from `GET /api/v1/isochrone`), drawn outwards in walking-time order on a canvas.
 * Each bucket is drawn once onto the base canvas; only the thin orange front is redrawn per frame on a
 * second canvas, so the browser never repaints the whole network. Without data it renders only the
 * dotted paper, never invented streets.
 */
export function WalkBackdrop({ data }: { data: IsochroneResult | undefined }) {
  const box = useRef<HTMLDivElement | null>(null);
  const base = useRef<HTMLCanvasElement | null>(null);
  const front = useRef<HTMLCanvasElement | null>(null);
  const projected = useMemo(() => (isIsochrone(data) ? projectBuckets(data) : null), [data]);

  useEffect(() => {
    const el = box.current;
    if (!projected || !el) return;
    const baseCtx = context2d(base.current);
    const frontCtx = context2d(front.current);
    if (!baseCtx || !frontCtx || !base.current || !front.current) return;
    const maxMin = data?.max_min ?? 15;
    const extent = projected.extent * 1.15;
    let drawnUpTo = -1; // minutes already on the base canvas
    let clockMin = 0;
    let scale = 1;

    const setup = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = el.clientWidth;
      const h = el.clientHeight;
      for (const c of [base.current!, front.current!]) {
        c.width = Math.max(1, Math.round(w * dpr));
        c.height = Math.max(1, Math.round(h * dpr));
      }
      // "cover": the network fills the hero, centred on the address
      scale = (Math.max(w, h) / (2 * extent)) * dpr;
      for (const ctx of [baseCtx, frontCtx]) {
        ctx.setTransform(scale, 0, 0, scale, (w * dpr) / 2, (h * dpr) / 2);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }
    };

    const stroke = (ctx: CanvasRenderingContext2D, list: BackdropBucket[], color?: string) => {
      ctx.lineWidth = (LINE_PX * Math.min(window.devicePixelRatio || 1, 2)) / scale;
      for (const b of list) {
        ctx.strokeStyle = color ?? b.color;
        ctx.beginPath();
        for (const flat of b.lines) {
          ctx.moveTo(flat[0]!, flat[1]!);
          for (let i = 2; i < flat.length; i += 2) ctx.lineTo(flat[i]!, flat[i + 1]!);
        }
        ctx.stroke();
      }
    };

    const clear = (ctx: CanvasRenderingContext2D) => {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.restore();
    };

    const drawTo = (min: number, showFront: boolean) => {
      clockMin = min;
      if (min > drawnUpTo) {
        stroke(baseCtx, bucketsBetween(projected.buckets, drawnUpTo, min));
        drawnUpTo = min;
      }
      clear(frontCtx);
      if (showFront)
        stroke(frontCtx, bucketsBetween(projected.buckets, min - FRONT_MIN, min), FRONT);
    };

    const redrawAll = () => {
      setup();
      drawnUpTo = -1;
      clear(baseCtx);
      drawTo(clockMin, false);
    };

    setup();
    const reduced = prefersReducedMotion();
    const handle = play(
      clock,
      createTimeline([
        {
          at: 0,
          duration: FLOOD_MS,
          ease: easeInOutCubic,
          apply: (p) => drawTo(p * maxMin, p < 1),
        },
      ]),
      { reduced, onDone: () => drawTo(maxMin, false) },
    );

    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(redrawAll);
    ro?.observe(el);
    return () => {
      handle.cancel();
      ro?.disconnect();
    };
  }, [projected, data?.max_min]);

  return (
    <div className="na-backdrop" aria-hidden="true" ref={box}>
      {projected ? (
        <>
          <canvas ref={base} className="na-backdrop__canvas" data-testid="walk-backdrop" />
          <canvas ref={front} className="na-backdrop__canvas" />
          {/* decorative: marks the example address (its own layer, cheap to animate) */}
          <span className="na-backdrop__pulse" />
          <span className="na-backdrop__pin" />
        </>
      ) : null}
    </div>
  );
}
