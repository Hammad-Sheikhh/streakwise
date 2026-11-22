import { useId } from 'react';

import { Chip } from '@/components/Chip';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { addDays } from '@/core/logic/dates';

/**
 * A day that already happened (TASK-11 "Done on" and the like): Today and Yesterday chips plus
 * a date picker that stops at today, the study day.
 */
export function DayField({
  legend,
  value,
  today,
  onChange,
  error,
}: {
  legend: string;
  value: string;
  today: string;
  onChange: (date: string) => void;
  error?: string | null;
}) {
  const id = useId();
  const yesterday = addDays(today, -1);
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap items-end gap-2">
        <Chip pressed={value === today} onClick={() => onChange(today)}>
          Today
        </Chip>
        <Chip pressed={value === yesterday} onClick={() => onChange(yesterday)}>
          Yesterday
        </Chip>
        <Label htmlFor={`${id}-date`} className="sr-only">
          {legend}
        </Label>
        <Input
          id={`${id}-date`}
          type="date"
          className="h-11 w-auto"
          max={today}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
        />
      </div>
      {error && (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </fieldset>
  );
}
