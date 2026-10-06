import { NativeSelect } from '@/components/NativeSelect';
import { TOPIC_STATUSES } from '@/core/domain/types';
import type { TopicStatus, TreeNode } from '@/core/domain/types';
import { useDataMutation } from '@/data/queries';
import { TOPIC_STATUS_LABELS } from '@/lib/format';
import { cn } from '@/lib/utils';

// TOP-1: not started / in progress / done; a done topic is reopened by choosing another status.

export function TopicStatusSelect({ topic }: { topic: TreeNode }) {
  const setStatus = useDataMutation(
    (ds, status: TopicStatus) => ds.setTopicStatus(topic.id, { status }),
    ['tree', 'track'],
  );
  const status = topic.topicStatus ?? 'not_started';
  return (
    <NativeSelect
      aria-label={`${topic.name} status`}
      className={cn('h-11 w-36 shrink-0', status === 'done' && 'font-medium')}
      value={status}
      disabled={setStatus.isPending}
      onChange={(e) => {
        const next = TOPIC_STATUSES.find((s) => s === e.target.value);
        if (next) setStatus.mutate(next);
      }}
    >
      {TOPIC_STATUSES.map((s) => (
        <option key={s} value={s}>
          {TOPIC_STATUS_LABELS[s]}
        </option>
      ))}
    </NativeSelect>
  );
}
