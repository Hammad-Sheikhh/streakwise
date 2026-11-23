import { Button } from '@/components/ui/button';

/** A toggle-style choice button (date and duration shortcuts). */
export function Chip({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <Button
      type="button"
      variant={pressed ? 'default' : 'outline'}
      aria-pressed={pressed}
      className="h-11 min-w-14"
      onClick={onClick}
    >
      {children}
    </Button>
  );
}
