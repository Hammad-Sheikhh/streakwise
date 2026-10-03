import type { TrackColor } from '@/core/domain/types';

// TREE-4: one place maps palette tokens to classes, so badges, charts, and the heatmap stay
// consistent. Class names are written out in full so Tailwind can find them.
export const trackSwatchClass: Record<TrackColor, string> = {
  amber: 'bg-amber-500',
  blue: 'bg-blue-500',
  violet: 'bg-violet-500',
  emerald: 'bg-emerald-500',
  rose: 'bg-rose-500',
  cyan: 'bg-cyan-500',
  orange: 'bg-orange-500',
  slate: 'bg-slate-500',
};
