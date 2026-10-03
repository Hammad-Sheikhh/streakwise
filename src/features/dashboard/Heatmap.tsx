import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Link } from 'react-router';

import { addDays } from '@/core/logic/dates';
import { heatLevel, heatmapWeeks } from '@/core/logic/heatmap';
import type { HeatLevel } from '@/core/logic/heatmap';
import { dayLabel } from '@/lib/format';
import { cn } from '@/lib/utils';

// HEAT-1–3: a GitHub-style year of study. One focusable cell at a time (roving tabindex), so the
// keyboard moves with arrows instead of tabbing through 370 squares.

const LEVEL_CLASS: Record<HeatLevel, string> = {
  0: 'bg-muted',
  1: 'bg-emerald-200 dark:bg-emerald-900',
  2: 'bg-emerald-400 dark:bg-emerald-700',
  3: 'bg-emerald-600 dark:bg-emerald-500',
  4: 'bg-emerald-800 dark:bg-emerald-300',
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ROW_LABELS = ['Mon', '', 'Wed', '', 'Fri', '', ''];

export function Heatmap({
  start,
  end,
  days,
  historyPath,
}: {
  start: string;
  end: string;
  days: readonly { date: string; minutes: number }[];
  /** Where a day's sessions are listed (History); `?from=&to=` is added. */
  historyPath: string;
}) {
  const minutesByDate = useMemo(() => new Map(days.map((d) => [d.date, d.minutes])), [days]);
  const weeks = useMemo(() => heatmapWeeks(start, end), [start, end]);
  const [selected, setSelected] = useState(end);
  const scroller = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLDivElement>(null);

  // HEAT-1: on narrow screens, start scrolled to today (the right-hand end).
  useEffect(() => {
    const element = scroller.current;
    if (element) element.scrollLeft = element.scrollWidth;
  }, []);

  function move(event: KeyboardEvent<HTMLDivElement>) {
    const steps: Record<string, number> = {
      ArrowLeft: -7,
      ArrowRight: 7,
      ArrowUp: -1,
      ArrowDown: 1,
    };
    let next: string | undefined;
    if (event.key in steps) next = addDays(selected, steps[event.key] ?? 0);
    else if (event.key === 'Home') next = start;
    else if (event.key === 'End') next = end;
    if (next === undefined) return;
    event.preventDefault();
    next = next < start ? start : next > end ? end : next;
    setSelected(next);
    grid.current?.querySelector<HTMLButtonElement>(`[data-date="${next}"]`)?.focus();
  }

  const selectedMinutes = minutesByDate.get(selected) ?? 0;

  return (
    <div className="flex flex-col gap-3">
      <div ref={scroller} className="overflow-x-auto pb-2">
        <div className="flex w-max gap-1 text-[10px] text-muted-foreground">
          <div className="flex flex-col gap-[3px] pt-4 pr-1" aria-hidden="true">
            {ROW_LABELS.map((label, i) => (
              <span key={i} className="h-3.5 leading-3.5">
                {label}
              </span>
            ))}
          </div>
          <div
            ref={grid}
            role="group"
            aria-label="Study time per day over the last 12 months"
            className="flex gap-[3px]"
            onKeyDown={move}
          >
            {weeks.map((week, column) => {
              const monday = week[0] ?? end;
              const previous = weeks[column - 1]?.[0];
              const newMonth = !previous || previous.slice(5, 7) !== monday.slice(5, 7);
              return (
                <div key={monday} className="flex flex-col gap-[3px]">
                  <span className="h-3.5 leading-3.5 whitespace-nowrap" aria-hidden="true">
                    {newMonth && column < weeks.length - 1
                      ? MONTHS[Number(monday.slice(5, 7)) - 1]
                      : ''}
                  </span>
                  {week.map((date, row) => {
                    if (date === null) return <span key={row} className="size-3.5" />;
                    const minutes = minutesByDate.get(date) ?? 0;
                    const label = dayLabel(date, minutes);
                    return (
                      <button
                        key={date}
                        type="button"
                        data-date={date}
                        aria-label={label}
                        aria-pressed={date === selected}
                        title={label}
                        tabIndex={date === selected ? 0 : -1}
                        onClick={() => setSelected(date)}
                        onFocus={() => setSelected(date)}
                        className={cn(
                          'size-3.5 rounded-[3px] outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          LEVEL_CLASS[heatLevel(minutes)],
                          date === selected && 'ring-2 ring-foreground/60',
                        )}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <p aria-live="polite" className="flex flex-wrap items-center gap-x-3">
          <span>{dayLabel(selected, selectedMinutes)}</span>
          {selectedMinutes > 0 && (
            <Link
              to={`${historyPath}?from=${selected}&to=${selected}`}
              className="underline underline-offset-4"
            >
              See sessions
            </Link>
          )}
        </p>
        <div className="flex items-center gap-1 text-xs text-muted-foreground" aria-hidden="true">
          Less
          {([0, 1, 2, 3, 4] as const).map((level) => (
            <span key={level} className={cn('size-3.5 rounded-[3px]', LEVEL_CLASS[level])} />
          ))}
          More
        </div>
      </div>
    </div>
  );
}
