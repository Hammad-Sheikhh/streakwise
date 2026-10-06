import { useEffect, useRef, useState } from 'react';
import type { PointerEvent } from 'react';

import type { ScorePoint, Trend } from '@/core/logic/scores';
import { formatDay } from '@/lib/format';

// SCORE-2, SCORE-4: percentage over time, one line per subtask (or track), with a legend that
// carries each line's trend. The results table below the chart is the accessible view of the same
// data, so the chart itself is one labelled image with a pointer tooltip.

export interface ChartLine {
  nodeId: string;
  label: string;
  /** Fixed per node across filters, so a line never changes color (0-based). */
  colorIndex: number;
  points: ScorePoint[];
  trend: Trend | null;
}

const SERIES_COUNT = 8;
const HEIGHT = 220;
const MARGIN = { top: 12, right: 16, bottom: 28, left: 40 };
const DIRECT_LABEL_WIDTH = 96;
const MIN_LABEL_GAP = 14;
const DAY_MS = 86_400_000;

const seriesColor = (index: number) => `var(--series-${(index % SERIES_COUNT) + 1})`;
// Past the 8 palette colors, lines repeat a color but are dashed, so they still differ.
const seriesDash = (index: number) => (index >= SERIES_COUNT ? '6 4' : undefined);
const toDay = (date: string) => Date.parse(`${date}T00:00:00Z`) / DAY_MS;

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.max(240, Math.round(entry.contentRect.width)));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return { ref, width };
}

export function TrendLabel({ trend }: { trend: Trend | null }) {
  if (!trend) return null;
  const text =
    trend.direction === 'flat'
      ? 'no change'
      : `${trend.direction === 'up' ? '▲' : '▼'} ${trend.points} pts`;
  const spoken =
    trend.direction === 'flat'
      ? 'Trend: no change'
      : `Trend: ${trend.direction} ${trend.points} percentage points`;
  return (
    <span className="text-muted-foreground">
      <span aria-hidden="true">{text}</span>
      <span className="sr-only">{spoken}</span>
    </span>
  );
}

interface Hover {
  x: number;
  y: number;
  text: string;
}

export function ScoreChart({ lines }: { lines: readonly ChartLine[] }) {
  const { ref, width } = useWidth();
  const [hover, setHover] = useState<Hover | null>(null);

  const all = lines.flatMap((l) => l.points);
  const days = all.map((p) => toDay(p.date));
  let minDay = Math.min(...days);
  let maxDay = Math.max(...days);
  if (minDay === maxDay) {
    minDay -= 3;
    maxDay += 3;
  }
  const directLabels = lines.length <= 4 && width >= 480;
  const right = MARGIN.right + (directLabels ? DIRECT_LABEL_WIDTH : 0);
  const plotWidth = width - MARGIN.left - right;
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const x = (date: string) =>
    MARGIN.left + ((toDay(date) - minDay) / (maxDay - minDay)) * plotWidth;
  const y = (percent: number) => MARGIN.top + (1 - percent / 100) * plotHeight;

  const plotted = lines.map((line) => ({
    ...line,
    coords: line.points.map((p) => ({ ...p, cx: x(p.date), cy: y(p.percent) })),
  }));

  // Direct labels in the right margin, level with each line’s last point, nudged apart.
  const labels = directLabels
    ? plotted
        .map((line) => ({ line, y: line.coords.at(-1)?.cy ?? 0 }))
        .sort((a, b) => a.y - b.y)
        .reduce<{ line: (typeof plotted)[number]; y: number }[]>((placed, label) => {
          const previous = placed.at(-1);
          const yPos = previous ? Math.max(label.y, previous.y + MIN_LABEL_GAP) : label.y;
          return [...placed, { ...label, y: yPos }];
        }, [])
    : [];

  const fromDate = new Date(minDay * DAY_MS).toISOString().slice(0, 10);
  const toDate = new Date(maxDay * DAY_MS).toISOString().slice(0, 10);

  function handlePointer(event: PointerEvent<SVGSVGElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const px = event.clientX - box.left;
    const py = event.clientY - box.top;
    let best: Hover | null = null;
    let bestDistance = Infinity;
    for (const line of plotted) {
      for (const p of line.coords) {
        const distance = Math.hypot(p.cx - px, p.cy - py);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = { x: p.cx, y: p.cy, text: `${line.label} · ${formatDay(p.date)} · ${p.percent}%` };
        }
      }
    }
    setHover(bestDistance <= 40 ? best : null);
  }

  return (
    <div className="flex flex-col gap-3">
      <div ref={ref} className="relative w-full">
        <svg
          role="img"
          aria-label={`Score percentages over time, ${lines.length} ${
            lines.length === 1 ? 'line' : 'lines'
          }. The results table below lists every score.`}
          width={width}
          height={HEIGHT}
          className="block touch-pan-y"
          onPointerMove={handlePointer}
          onPointerLeave={() => setHover(null)}
        >
          {[0, 50, 100].map((tick) => (
            <g key={tick}>
              <line
                x1={MARGIN.left}
                x2={MARGIN.left + plotWidth}
                y1={y(tick)}
                y2={y(tick)}
                className="stroke-border"
                strokeWidth={1}
              />
              <text
                x={MARGIN.left - 8}
                y={y(tick)}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-muted-foreground text-xs"
              >
                {tick}%
              </text>
            </g>
          ))}
          <text
            x={MARGIN.left}
            y={HEIGHT - 8}
            className="fill-muted-foreground text-xs"
            textAnchor="start"
          >
            {formatDay(fromDate)}
          </text>
          <text
            x={MARGIN.left + plotWidth}
            y={HEIGHT - 8}
            className="fill-muted-foreground text-xs"
            textAnchor="end"
          >
            {formatDay(toDate)}
          </text>

          {plotted.map((line) => (
            <g key={line.nodeId}>
              {line.coords.length > 1 && (
                <polyline
                  points={line.coords.map((p) => `${p.cx},${p.cy}`).join(' ')}
                  fill="none"
                  stroke={seriesColor(line.colorIndex)}
                  strokeDasharray={seriesDash(line.colorIndex)}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              )}
              {line.coords.map((p) => (
                <circle
                  key={p.scoreId}
                  cx={p.cx}
                  cy={p.cy}
                  r={4}
                  fill={seriesColor(line.colorIndex)}
                  className="stroke-background"
                  strokeWidth={2}
                />
              ))}
            </g>
          ))}

          {labels.map(({ line, y: labelY }) => (
            <text
              key={line.nodeId}
              x={MARGIN.left + plotWidth + 10}
              y={labelY}
              dominantBaseline="middle"
              className="fill-foreground text-xs"
            >
              {line.label.length > 14 ? `${line.label.slice(0, 13)}…` : line.label}
            </text>
          ))}

          {hover && (
            <circle
              cx={hover.x}
              cy={hover.y}
              r={6}
              fill="none"
              className="stroke-foreground"
              strokeWidth={2}
            />
          )}
        </svg>
        {hover && (
          <div
            role="status"
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md border bg-popover px-2 py-1 text-xs whitespace-nowrap text-popover-foreground shadow-sm"
            style={{
              left: Math.min(Math.max(hover.x, 80), width - 80),
              top: hover.y - 10,
            }}
          >
            {hover.text}
          </div>
        )}
      </div>

      {lines.length > 1 && (
        <ul aria-label="Legend" className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {lines.map((line) => (
            <li key={line.nodeId} className="flex items-center gap-1.5">
              <svg aria-hidden="true" width={18} height={10}>
                <line
                  x1={1}
                  x2={17}
                  y1={5}
                  y2={5}
                  stroke={seriesColor(line.colorIndex)}
                  strokeDasharray={seriesDash(line.colorIndex) ? '4 2' : undefined}
                  strokeWidth={2}
                  strokeLinecap="round"
                />
              </svg>
              <span>{line.label}</span>
              <TrendLabel trend={line.trend} />
            </li>
          ))}
        </ul>
      )}
      {lines.length === 1 && lines[0] && (
        <p className="text-sm">
          {lines[0].label} <TrendLabel trend={lines[0].trend} />
        </p>
      )}
    </div>
  );
}
