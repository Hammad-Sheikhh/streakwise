import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDataMutation } from '@/data/queries';

/** TREE-1: add a track (Settings → Structure and the Tracks screen). */
export function AddTrackForm() {
  const id = useId();
  const [name, setName] = useState('');
  const add = useDataMutation(
    (ds, value: string) => ds.addNode({ parentId: null, name: value }),
    ['tree'],
    {
      onSuccess: (track) => {
        setName('');
        toast.success(`Added “${track.name}”.`);
      },
    },
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (name.trim()) add.mutate(name.trim());
  }

  return (
    <form className="flex flex-col gap-2" onSubmit={handleSubmit}>
      <Label htmlFor={`${id}-track`}>New track</Label>
      <div className="flex gap-2">
        <Input
          id={`${id}-track`}
          className="h-11"
          maxLength={60}
          placeholder="e.g. Piano"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Button type="submit" className="h-11" disabled={!name.trim() || add.isPending}>
          Add track
        </Button>
      </div>
    </form>
  );
}
