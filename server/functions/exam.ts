import { z } from 'zod';

import { getExamView } from '../../src/core/services/exams.js';
import { apiHandler } from './_lib/api.js';
import type { ServerDeps } from './_lib/deps.js';
import { json, readQuery } from './_lib/http.js';

const examQuerySchema = z.object({ deadline: z.uuid().optional() });

// EXAM-2–6: the exam view, for `?deadline=<id>` or the next upcoming exam.
export function createExamHandler(getDeps: () => ServerDeps) {
  return apiHandler({ route: 'exam', auth: true }, getDeps, async ({ request, deps }) => {
    const { deadline } = readQuery(request, examQuerySchema);
    return json(await getExamView(deps.repo, deps.clock, deadline));
  });
}
