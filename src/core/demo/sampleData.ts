import { addDays, localDate, weekStart } from '../logic/dates';
import type { Clock, IdGenerator, ScoreKind, TopicStatus, TrackColor } from '../domain/types';
import type { Repository } from '../repo/Repository';
import { seededRandom } from './random';

// DEMO-3: the demo's sample data, built relative to today with a seeded generator so every visit
// (and every test) sees the same shape: about 12 weeks of sessions, topics in every status, nested
// and weekly tasks, past scores, 3 deadlines, and one neglected subtask (Science). General names
// only; no personal data.

export const DEMO_STUDENT_NAME = 'Demo Student';
export const DEMO_SEED = 20_261_010;
const DEMO_DAYS = 84;
/** Science stops being studied this many days ago, so it shows a neglect warning. */
const NEGLECTED_FOR_DAYS = 10;

const MINUTES = [20, 25, 30, 40, 45, 60, 75, 90] as const;
const NOTES = [
  'Reviewed mistakes from last time',
  'Timed practice',
  'Chapter summary',
  'Went over the hard questions again',
  'Made new flashcards',
] as const;

interface TopicSpec {
  name: string;
  status: TopicStatus;
}

interface SubtaskSpec {
  key: string;
  name: string;
  topics: TopicSpec[];
  /** How often it's picked on an active day, relative to the others. */
  weight: number;
}

interface TrackSpec {
  name: string;
  color: TrackColor;
  weeklyTargetMinutes: number;
  subtasks: SubtaskSpec[];
}

const TRACKS: TrackSpec[] = [
  {
    name: 'Exam Prep',
    color: 'amber',
    weeklyTargetMinutes: 180,
    subtasks: [
      { key: 'flashcards', name: 'Flashcards', topics: [], weight: 3 },
      {
        key: 'practice',
        name: 'Practice',
        weight: 2,
        topics: [
          { name: 'Past paper 2023', status: 'done' },
          { name: 'Past paper 2024', status: 'in_progress' },
          { name: 'Timed essay', status: 'not_started' },
        ],
      },
    ],
  },
  {
    name: 'School Subjects',
    color: 'blue',
    weeklyTargetMinutes: 300,
    subtasks: [
      {
        key: 'maths',
        name: 'Maths',
        weight: 3,
        topics: [
          { name: 'Algebra', status: 'done' },
          { name: 'Geometry', status: 'done' },
          { name: 'Probability', status: 'in_progress' },
          { name: 'Calculus', status: 'not_started' },
        ],
      },
      {
        key: 'english',
        name: 'English',
        weight: 2,
        topics: [
          { name: 'Poetry', status: 'done' },
          { name: 'Essay writing', status: 'in_progress' },
          { name: 'Grammar', status: 'not_started' },
        ],
      },
      {
        key: 'science',
        name: 'Science',
        weight: 1,
        topics: [
          { name: 'Cells', status: 'done' },
          { name: 'Forces', status: 'not_started' },
        ],
      },
    ],
  },
  {
    name: 'Online Course',
    color: 'violet',
    weeklyTargetMinutes: 120,
    subtasks: [
      { key: 'videos', name: 'Videos', topics: [], weight: 2 },
      { key: 'projects', name: 'Projects', topics: [], weight: 1 },
    ],
  },
];

/** On the last two days every subtask but Science gets a session, so only Science is neglected. */
const RECENT_COVERAGE: Record<number, string[]> = {
  2: ['practice', 'english', 'projects'],
  1: ['flashcards', 'maths', 'videos'],
};

interface Placed {
  /** The subtask's id, plus the ids of its topics that can take sessions (not "not started"). */
  subtaskId: string;
  topicIds: string[];
  weight: number;
}

/** An instant on a local date, at a sensible evening hour (18:00 in Karachi). */
const eveningOf = (date: string) => `${date}T13:00:00.000Z`;

/** Fills an empty repository with the demo's sample data. */
export async function loadSampleData(
  repo: Repository,
  clock: Clock,
  newId: IdGenerator,
  seed: number = DEMO_SEED,
): Promise<void> {
  const random = seededRandom(seed);
  const today = localDate(clock());
  const subtasks = new Map<string, Placed>();
  const trackIds: string[] = [];

  for (const [trackIndex, track] of TRACKS.entries()) {
    const trackId = newId();
    trackIds.push(trackId);
    await repo.insertNode({
      id: trackId,
      parentId: null,
      name: track.name,
      color: track.color,
      sortOrder: trackIndex,
      topicStatus: null,
    });
    await repo.updateNode(trackId, { weeklyTargetMinutes: track.weeklyTargetMinutes });

    for (const [subIndex, sub] of track.subtasks.entries()) {
      const subtaskId = newId();
      await repo.insertNode({
        id: subtaskId,
        parentId: trackId,
        name: sub.name,
        color: null,
        sortOrder: subIndex,
        topicStatus: null,
      });
      const topicIds: string[] = [];
      for (const [topicIndex, topic] of sub.topics.entries()) {
        const topicId = newId();
        await repo.insertNode({
          id: topicId,
          parentId: subtaskId,
          name: topic.name,
          color: null,
          sortOrder: topicIndex,
          topicStatus: topic.status,
        });
        if (topic.status === 'done') {
          await repo.updateNode(topicId, {
            topicDoneAt: eveningOf(addDays(today, -random.int(14, 60))),
          });
        }
        // Logging on a "not started" topic would move it to "in progress", so sessions skip them.
        if (topic.status !== 'not_started') topicIds.push(topicId);
      }
      subtasks.set(sub.key, { subtaskId, topicIds, weight: sub.weight });
    }
  }

  const node = (key: string): Placed => {
    const placed = subtasks.get(key);
    if (!placed) throw new Error(`Unknown demo subtask "${key}"`);
    return placed;
  };

  const logOn = async (date: string, placed: Placed) => {
    const nodeId =
      placed.topicIds.length > 0 && random.chance(0.6)
        ? random.pick(placed.topicIds)
        : placed.subtaskId;
    await repo.insertSession({
      id: newId(),
      nodeId,
      studiedOn: date,
      minutes: random.pick(MINUTES),
      note: random.chance(0.25) ? random.pick(NOTES) : null,
      source: random.chance(0.1) ? 'claude' : 'app',
    });
  };

  // Sessions: today is left empty so the visitor can log the day's first session themselves.
  for (let daysAgo = DEMO_DAYS; daysAgo >= 1; daysAgo -= 1) {
    const date = addDays(today, -daysAgo);
    const forced = RECENT_COVERAGE[daysAgo];
    if (forced) {
      for (const key of forced) await logOn(date, node(key));
      continue;
    }
    if (daysAgo === NEGLECTED_FOR_DAYS) {
      await logOn(date, node('science'));
      continue;
    }
    // The last week and a half is unbroken, so there's a current streak to see.
    if (daysAgo > 9 && !random.chance(0.78)) continue;
    const pool = [...subtasks.entries()]
      .filter(([key]) => key !== 'science' || daysAgo > NEGLECTED_FOR_DAYS)
      .flatMap(([, placed]) => Array<Placed>(placed.weight).fill(placed));
    const count = random.int(1, 3);
    for (let i = 0; i < count; i += 1) await logOn(date, random.pick(pool));
  }

  await addTasks(repo, newId, today, trackIds, node);
  await addScores(repo, newId, today, node, random);

  const [, schoolSubjects] = trackIds;
  for (const [title, nodeId, inDays] of [
    ['Maths mock exam', node('maths').subtaskId, 12],
    ['English essay due', node('english').subtaskId, 20],
    ['End-of-year exams', schoolSubjects, 45],
  ] as const) {
    if (!nodeId) continue;
    await repo.insertDeadline({ id: newId(), nodeId, title, dueOn: addDays(today, inDays) });
  }

  await repo.updateSettings({ studentName: DEMO_STUDENT_NAME });
  // A recent export, so Home doesn't open on a backup reminder.
  await repo.recordExport(eveningOf(addDays(today, -6)));
}

async function addTasks(
  repo: Repository,
  newId: IdGenerator,
  today: string,
  trackIds: string[],
  node: (key: string) => Placed,
): Promise<void> {
  const thisWeek = weekStart(today);
  const [examPrep] = trackIds;
  if (!examPrep) return;

  const task = async (input: {
    nodeId: string | null;
    title: string;
    parentTaskId?: string;
    dueOn?: string;
    recurrence?: 'none' | 'weekly';
    isScored?: boolean;
    defaultMaxScore?: number;
    sortOrder: number;
  }) => {
    const id = newId();
    await repo.insertTask({
      id,
      nodeId: input.nodeId,
      parentTaskId: input.parentTaskId ?? null,
      title: input.title,
      description: null,
      dueOn: input.dueOn ?? null,
      recurrence: input.recurrence ?? 'none',
      isScored: input.isScored ?? false,
      defaultMaxScore: input.defaultMaxScore ?? null,
      sortOrder: input.sortOrder,
    });
    return id;
  };

  // The weekly scored task (TASK-5/6), done in most past weeks with a rising score. This week is
  // left open so the visitor can complete it.
  const selfTest = await task({
    nodeId: examPrep,
    title: 'Weekly self-test',
    recurrence: 'weekly',
    isScored: true,
    defaultMaxScore: 20,
    sortOrder: 0,
  });
  const selfTestScores = [11, 12, 12, 14, 13, 15, 16, 15, 17, 18];
  for (const [index, score] of selfTestScores.entries()) {
    const weeksAgo = selfTestScores.length - index;
    if (weeksAgo === 6) continue; // a missed week
    const periodStart = addDays(thisWeek, -7 * weeksAgo);
    const takenOn = addDays(periodStart, 5);
    await repo.completeTask({
      taskId: selfTest,
      periodStart,
      completedAt: eveningOf(takenOn),
      note: null,
      score: {
        id: newId(),
        nodeId: examPrep,
        kind: 'revision',
        title: 'Weekly self-test',
        takenOn,
        score,
        maxScore: 20,
        note: null,
      },
    });
  }

  // A weekly task that's already done this week.
  const flashcards = await task({
    nodeId: node('flashcards').subtaskId,
    title: 'Review the whole flashcard deck',
    recurrence: 'weekly',
    sortOrder: 1,
  });
  for (let weeksAgo = 5; weeksAgo >= 0; weeksAgo -= 1) {
    const periodStart = addDays(thisWeek, -7 * weeksAgo);
    const doneOn = weeksAgo === 0 ? periodStart : addDays(periodStart, 2);
    await repo.completeTask({
      taskId: flashcards,
      periodStart,
      completedAt: eveningOf(doneOn),
      note: null,
      score: null,
    });
  }

  // A nested one-off task with sub-tasks in both states (TASK-2, TASK-9).
  const pack = await task({
    nodeId: node('maths').subtaskId,
    title: 'Finish the Maths revision pack',
    dueOn: addDays(today, 5),
    sortOrder: 2,
  });
  const parts = ['Algebra worksheet', 'Probability worksheet', 'Calculus notes'];
  for (const [index, title] of parts.entries()) {
    const id = await task({
      nodeId: node('maths').subtaskId,
      parentTaskId: pack,
      title,
      sortOrder: index,
    });
    if (index === 0) {
      await repo.completeTask({
        taskId: id,
        periodStart: null,
        completedAt: eveningOf(addDays(today, -3)),
        note: null,
        score: null,
      });
    }
  }

  // An overdue one, and a finished task that isn't tied to any track ("Other").
  await task({
    nodeId: node('english').subtaskId,
    title: 'Hand in the essay draft',
    dueOn: addDays(today, -2),
    sortOrder: 3,
  });
  const desk = await task({ nodeId: null, title: 'Tidy the study desk', sortOrder: 4 });
  await repo.completeTask({
    taskId: desk,
    periodStart: null,
    completedAt: eveningOf(addDays(today, -4)),
    note: null,
    score: null,
  });
}

async function addScores(
  repo: Repository,
  newId: IdGenerator,
  today: string,
  node: (key: string) => Placed,
  random: ReturnType<typeof seededRandom>,
): Promise<void> {
  const series: { key: string; kind: ScoreKind; title: string; max: number; values: number[] }[] = [
    { key: 'practice', kind: 'past_paper', title: 'Past paper', max: 80, values: [52, 58, 61, 67] },
    { key: 'maths', kind: 'quiz', title: 'Maths quiz', max: 10, values: [6, 7, 5, 8, 8, 9] },
    { key: 'english', kind: 'mock_test', title: 'English mock', max: 50, values: [31, 36] },
  ];
  for (const { key, kind, title, max, values } of series) {
    const gap = Math.floor(DEMO_DAYS / (values.length + 1));
    for (const [index, score] of values.entries()) {
      const daysAgo = DEMO_DAYS - gap * (index + 1) + random.int(-2, 2);
      await repo.insertScore({
        id: newId(),
        nodeId: node(key).subtaskId,
        kind,
        title: `${title} ${index + 1}`,
        takenOn: addDays(today, -Math.max(1, daysAgo)),
        score,
        maxScore: max,
        note: null,
      });
    }
  }
}
