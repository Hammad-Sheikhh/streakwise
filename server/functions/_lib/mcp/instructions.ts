// MCP-3, MCP-22, MCP-23: what Claude is told about Streakwise when it connects. Kept under about
// 3,500 characters, because every connection sends it. The study-day sentence states the
// student's current "My day ends at" setting.

function clockTime(minutes: number): string {
  const hours = String(Math.floor(minutes / 60)).padStart(2, '0');
  return `${hours}:${String(minutes % 60).padStart(2, '0')}`;
}

/** DAY-2 in one sentence, for the current setting. */
export function studyDaySentence(dayEndsAtMinutes: number): string {
  if (dayEndsAtMinutes === 0) {
    return 'The student’s day ends at midnight, so "today" is the calendar date.';
  }
  const time = clockTime(dayEndsAtMinutes);
  return (
    `The student’s day ends at ${time}: time before ${time} counts for the day before, so ` +
    `until ${time} "today" is still the previous date.`
  );
}

export function mcpInstructions(dayEndsAtMinutes: number): string {
  return `Streakwise is one student's personal study tracker.

Structure: a tree of up to 3 levels. Tracks (level 1, e.g. "School Subjects") contain subtasks
(level 2, e.g. "Maths"), which may contain topics (level 3, e.g. "Chapter 3"). Topics have a status:
not_started, in_progress, or done. Archived nodes are hidden and can't take new time. Refer to a
node by its id or a path such as "School Subjects > Maths > Chapter 3" (case-insensitive); the end
of a path or a unique partial name like "maths" also works. If a reference is ambiguous or unknown,
the error lists the closest matches: pick one and retry.

Sessions record study time on any node in whole minutes (1.5 hours = 90). Time rolls up: a session
on a topic also counts for its subtask and track. Logging on a not-started topic marks it in
progress. Sessions you log are marked as coming from Claude. log_sessions saves up to 10 at once.

Days are calendar days in Asia/Karachi (UTC+5); weeks run Monday to Sunday. Dates accept "today",
"yesterday", or YYYY-MM-DD. ${studyDaySentence(dayEndsAtMinutes)} Every default date and "today"
field follows this. Tracks can have a weekly target in minutes. A day counts toward the streak when
it has at least one session.

Tasks are to-dos on any node: one-off (optional due date) or weekly (due every Monday-Sunday week
until done for that week), with sub-tasks nested freely; parents are never completed
automatically. A scored task records a score when completed. complete_task takes a date for work
done on an earlier day. "Due this week" means weekly tasks not done this week plus one-off tasks
due by Sunday.

Scores (past_paper, quiz, mock_test, revision, other) are score out of max_score on any node;
percent = score / max x 100. Reports summarise a period (today, yesterday, this week, last week, or
up to 92 custom days); notes are left out unless asked for.

Mistakes: add_mistake saves one; it comes up for review 1, 3, and 7 days later.
list_due_mistakes shows what's due; review_mistake "right" moves it on (learned after the third),
"wrong" starts again from tomorrow.

Keep answers small: prefer compact: true on list_tasks and list_sessions, narrow lists with
title_contains, note_contains, or due dates, and use get_task or get_latest_note for one item.
Lists return at most 50 items (up to 200 with "limit") and say "truncated": true when more exist.

Fixing things: update_session, update_score, update_task, update_node, uncomplete_task,
archive_node, and the delete tools work on items of any date, but nothing that happened can be
dated in the future. Every change returns the changed item, so confirm it in one line. The student
sees your changes in the app (Recent changes) and can undo them there. Confirm with the student
before deleting anything.`;
}
