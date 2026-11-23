import { invalid, notFound } from '../domain/errors.js';
import type { Clock, ExamSummary, ExamTarget, ExamView, IdGenerator } from '../domain/types.js';
import { daysBetween } from '../logic/dates.js';
import { examDetail } from '../logic/exam.js';
import { hiddenIds, subtreeIds } from '../logic/tree.js';
import type { ExamTargetPatch, Repository } from '../repo/Repository.js';
import { createExamTargetInputSchema, updateExamTargetInputSchema } from '../schemas/inputs.js';
import type { CreateExamTargetInput, UpdateExamTargetInput } from '../schemas/inputs.js';
import { parseInput } from '../schemas/parse.js';
import { studyToday } from './today.js';

// EXAM-1–6: exams are deadlines marked "This is an exam"; each can have score targets.

/**
 * EXAM-2: the exam view for `deadlineId`, or by default the next upcoming exam (the most recent
 * past one when none is upcoming). Exams on archived parts of the tree are left out (TREE-2).
 */
export async function getExamView(
  repo: Repository,
  clock: Clock,
  deadlineId?: string,
): Promise<ExamView> {
  const [nodes, deadlines, targets, scores, today] = await Promise.all([
    repo.listNodes(),
    repo.listDeadlines(),
    repo.listExamTargets(),
    repo.listScores(),
    studyToday(repo, clock),
  ]);
  const hidden = hiddenIds(nodes);
  const summaries: ExamSummary[] = deadlines
    .filter((d) => d.isExam && !hidden.has(d.nodeId))
    .map((d) => ({
      deadlineId: d.id,
      title: d.title,
      dueOn: d.dueOn,
      nodeId: d.nodeId,
      daysLeft: daysBetween(today, d.dueOn),
    }));
  const upcoming = summaries.filter((e) => e.daysLeft >= 0).sort((a, b) => a.daysLeft - b.daysLeft);
  const past = summaries.filter((e) => e.daysLeft < 0).sort((a, b) => b.daysLeft - a.daysLeft);
  const exams = [...upcoming, ...past];

  const chosen = (deadlineId && exams.find((e) => e.deadlineId === deadlineId)) || exams[0];
  if (!chosen) return { today, exams, exam: null };
  if (deadlineId && chosen.deadlineId !== deadlineId) throw notFound('exam_not_found');

  const inSubtree = new Set(subtreeIds(nodes, chosen.nodeId));
  const examTargets = targets.filter((t) => t.deadlineId === chosen.deadlineId);
  return {
    today,
    exams,
    exam: {
      summary: chosen,
      targets: examTargets,
      ...examDetail(
        nodes,
        chosen.nodeId,
        scores.filter((s) => inSubtree.has(s.nodeId)),
        examTargets,
      ),
    },
  };
}

async function findExam(repo: Repository, deadlineId: string) {
  const deadline = (await repo.listDeadlines()).find((d) => d.id === deadlineId);
  if (!deadline) throw notFound('deadline_not_found');
  if (!deadline.isExam) {
    throw invalid('not_an_exam', 'Mark this deadline as an exam before adding targets.');
  }
  return deadline;
}

/** EXAM-3. */
export async function addExamTarget(
  repo: Repository,
  newId: IdGenerator,
  deadlineId: string,
  rawInput: CreateExamTargetInput,
): Promise<ExamTarget> {
  const input = parseInput(createExamTargetInputSchema, rawInput);
  await findExam(repo, deadlineId);
  return repo.insertExamTarget({ id: newId(), deadlineId, ...input });
}

export async function updateExamTarget(
  repo: Repository,
  id: string,
  rawInput: UpdateExamTargetInput,
): Promise<ExamTarget> {
  const input = parseInput(updateExamTargetInputSchema, rawInput);
  const patch: ExamTargetPatch = {};
  if (input.label !== undefined) patch.label = input.label;
  if (input.targetOn !== undefined) patch.targetOn = input.targetOn;
  if (input.minPercent !== undefined) patch.minPercent = input.minPercent;
  return repo.updateExamTarget(id, patch);
}

export async function deleteExamTarget(repo: Repository, id: string): Promise<void> {
  await repo.deleteExamTarget(id);
}
