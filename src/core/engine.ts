import type { Assessment, CreateSessionOptions, Lesson, ReviewSession, ReviewState } from "./types";

export const MASTERY_POINTS = 80;

export class ReviewValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReviewValidationError";
  }
}

export class ReviewStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReviewStateError";
  }
}

function fail(message: string): never { throw new ReviewValidationError(message); }
const object = (value: unknown, label: string): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) fail(`${label} must be an object.`);
  return value as Record<string, unknown>;
};
const array = (value: unknown, label: string): unknown[] => {
  if (!Array.isArray(value)) fail(`${label} must be an array.`);
  return value as unknown[];
};
const text = (value: unknown, label: string): string => {
  if (typeof value !== "string" || value.trim().length === 0) fail(`${label} must be a nonempty string.`);
  return value as string;
};
const safeId = (value: unknown, label: string): string => {
  const id = text(value, label);
  if (["__proto__", "prototype", "constructor"].includes(id)) fail(`${label} is reserved.`);
  return id;
};
const finite = (value: unknown, label: string, min: number, max: number): number => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    fail(`${label} must be finite and between ${min} and ${max}.`);
  }
  return value as number;
};
const integer = (value: unknown, label: string, min: number, max: number): number => {
  const result = finite(value, label, min, max);
  if (!Number.isInteger(result)) fail(`${label} must be an integer.`);
  return result;
};
const close = (left: number, right: number): boolean => Math.abs(left - right) < 1e-8;
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const own = (value: object, key: string): boolean => Object.prototype.hasOwnProperty.call(value, key);
const record = <T>(): Record<string, T> => Object.create(null) as Record<string, T>;

/** Validate provider-created lessons before they can define scoring or progression. */
export function validateLesson(value: unknown): Lesson {
  const lesson = object(value, "Lesson");
  const criteria = array(lesson.criteria, "Lesson criteria").map((entry) => {
    const criterion = object(entry, "Criterion");
    return {
      id: text(criterion.id, "Criterion ID"),
      label: text(criterion.label, "Criterion label"),
      maxPoints: finite(criterion.maxPoints, "Criterion maximum", Number.MIN_VALUE, 100),
    };
  });
  if (criteria.length === 0 || new Set(criteria.map((criterion) => criterion.id)).size !== criteria.length) {
    fail("A lesson needs unique rubric criterion IDs.");
  }
  if (!close(criteria.reduce((sum, criterion) => sum + criterion.maxPoints, 0), 100)) {
    fail("A lesson rubric must total 100 points.");
  }
  const alternatives = array(lesson.alternatives, "Lesson alternatives").map((entry) => {
    const alternative = object(entry, "Alternative");
    return { name: text(alternative.name, "Alternative name"), tradeoff: text(alternative.tradeoff, "Alternative tradeoff") };
  });
  if (alternatives.length === 0) fail("A lesson must explain at least one relevant alternative.");
  const code = array(lesson.code, "Lesson code").map((entry) => {
    const excerpt = object(entry, "Code excerpt");
    if (typeof excerpt.before !== "string" || typeof excerpt.after !== "string") fail("Code excerpts must be strings.");
    return {
      path: text(excerpt.path, "Code path"),
      before: excerpt.before as string,
      after: excerpt.after as string,
      oldStart: integer(excerpt.oldStart, "Old line start", 0, Number.MAX_SAFE_INTEGER),
      newStart: integer(excerpt.newStart, "New line start", 0, Number.MAX_SAFE_INTEGER),
    };
  });
  if (code.length === 0) fail("A lesson must show committed code.");
  if (lesson.rationaleKind !== "documented" && lesson.rationaleKind !== "inferred") fail("Rationale kind is invalid.");
  return {
    id: safeId(lesson.id, "Lesson ID"),
    title: text(lesson.title, "Lesson title"),
    explanation: text(lesson.explanation, "Lesson explanation"),
    rationaleKind: lesson.rationaleKind,
    alternatives,
    question: text(lesson.question, "Lesson question"),
    criteria,
    code,
  };
}

/** Scores must cover the frozen rubric exactly; assessment text never supplies XP. */
export function validateAssessment(value: unknown, lesson: Lesson): Assessment {
  const assessment = object(value, "Assessment");
  const scores = array(assessment.scores, "Assessment scores").map((entry) => {
    const score = object(entry, "Criterion score");
    const criterionId = text(score.criterionId, "Score criterion ID");
    const criterion = lesson.criteria.find((candidate) => candidate.id === criterionId);
    if (!criterion) fail(`Unknown criterion ID: ${criterionId}.`);
    return {
      criterionId,
      earnedPoints: finite(score.earnedPoints, "Earned points", 0, criterion!.maxPoints),
      evidence: text(score.evidence, "Score evidence"),
    };
  });
  if (scores.length !== lesson.criteria.length || new Set(scores.map((score) => score.criterionId)).size !== scores.length) {
    fail("Assessment must score every rubric criterion exactly once.");
  }
  if (assessment.confidence !== "high" && assessment.confidence !== "low") fail("Assessment confidence is invalid.");
  if (typeof assessment.understood !== "boolean") fail("Assessment understanding must be a boolean.");
  return {
    scores,
    feedback: text(assessment.feedback, "Assessment feedback"),
    confidence: assessment.confidence,
    understood: assessment.understood,
  };
}

export function assessmentPoints(assessment: Assessment): number {
  return assessment.scores.reduce((sum, score) => sum + score.earnedPoints, 0);
}

function passed(assessment: Assessment): boolean {
  return assessment.confidence === "high" && assessment.understood && assessmentPoints(assessment) >= MASTERY_POINTS;
}

export function createSession(options: CreateSessionOptions): ReviewSession {
  const commitSha = text(options.commitSha, "Commit SHA").toLowerCase();
  if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(commitSha)) fail("Session must use a full fixed commit SHA.");
  const lessons = array(options.lessons, "Lessons").map(validateLesson);
  if (new Set(lessons.map((lesson) => lesson.id)).size !== lessons.length) fail("Lesson IDs must be unique.");
  return {
    version: 1,
    id: text(options.id, "Session ID"),
    repositoryPath: text(options.repositoryPath, "Repository path"),
    commitSha,
    lessons,
    currentLessonIndex: 0,
    state: lessons.length === 0 ? "complete" : "awaitingAnswer",
    earnedPointsByLesson: record<number>(),
    totalPoints: 0,
    masteredLessonIds: [],
    skippedLessonIds: [],
    attemptCountByLesson: record<number>(),
    assessmentsByLesson: record<Assessment>(),
  };
}

function currentLesson(session: ReviewSession): Lesson {
  const lesson = session.lessons[session.currentLessonIndex];
  if (!lesson || session.state === "complete") throw new ReviewStateError("This review session is complete.");
  return lesson;
}

function requireState(session: ReviewSession, states: ReviewState[]): void {
  if (!states.includes(session.state)) throw new ReviewStateError(`Cannot perform this action while ${session.state}.`);
}

export function beginAssessment(session: ReviewSession): ReviewSession {
  requireState(session, ["awaitingAnswer"]);
  const lesson = currentLesson(session);
  if (session.masteredLessonIds.includes(lesson.id)) throw new ReviewStateError("This checkpoint is already mastered.");
  const next = copy(session);
  next.state = "assessing";
  next.attemptCountByLesson[lesson.id] = (own(next.attemptCountByLesson, lesson.id) ? next.attemptCountByLesson[lesson.id] : 0) + 1;
  delete next.lastAssessment;
  return next;
}

export function applyAssessment(session: ReviewSession, value: Assessment): ReviewSession {
  requireState(session, ["assessing"]);
  const lesson = currentLesson(session);
  const assessment = validateAssessment(value, lesson);
  const next = copy(session);
  const previousPoints = own(session.earnedPointsByLesson, lesson.id) ? session.earnedPointsByLesson[lesson.id] : 0;
  // Uncertain assessments provide feedback only. Never retract prior earned XP.
  const awardedPoints = assessment.confidence === "high" ? Math.max(previousPoints, assessmentPoints(assessment)) : previousPoints;
  next.earnedPointsByLesson[lesson.id] = awardedPoints;
  next.totalPoints += awardedPoints - previousPoints;
  next.assessmentsByLesson[lesson.id] = assessment;
  next.lastAssessment = assessment;
  if (passed(assessment)) next.masteredLessonIds.push(lesson.id);
  next.state = "feedback";
  return next;
}

export function retryLesson(session: ReviewSession): ReviewSession {
  requireState(session, ["feedback"]);
  const lesson = currentLesson(session);
  if (session.masteredLessonIds.includes(lesson.id)) throw new ReviewStateError("This checkpoint is mastered; continue explicitly.");
  const next = copy(session);
  next.state = "awaitingAnswer";
  delete next.lastAssessment;
  return next;
}

function advance(session: ReviewSession): ReviewSession {
  const next = copy(session);
  next.currentLessonIndex += 1;
  next.state = next.currentLessonIndex === next.lessons.length ? "complete" : "awaitingAnswer";
  delete next.lastAssessment;
  return next;
}

/** Only the user's explicit Continue action calls this function. */
export function continueSession(session: ReviewSession): ReviewSession {
  requireState(session, ["feedback"]);
  const lesson = currentLesson(session);
  if (!session.masteredLessonIds.includes(lesson.id)) throw new ReviewStateError("Understanding is unresolved. Retry or explicitly skip this checkpoint.");
  return advance(session);
}

/** An explicit skip is recorded as unresolved, never as demonstrated understanding. */
export function skipLesson(session: ReviewSession): ReviewSession {
  requireState(session, ["awaitingAnswer", "feedback"]);
  const lesson = currentLesson(session);
  if (session.masteredLessonIds.includes(lesson.id)) throw new ReviewStateError("This checkpoint is mastered; use Continue.");
  const next = copy(session);
  next.skippedLessonIds.push(lesson.id);
  return advance(next);
}

export function failAssessment(session: ReviewSession): ReviewSession {
  requireState(session, ["assessing"]);
  const next = copy(session);
  next.state = "awaitingAnswer";
  delete next.lastAssessment;
  return next;
}

/** Restore only self-consistent JSON snapshots; an interrupted request becomes retryable. */
export function hydrateSession(value: unknown): ReviewSession {
  const saved = object(value, "Saved session");
  if (saved.version !== 1) fail("Unsupported session version.");
  const base = createSession({
    id: saved.id as string,
    repositoryPath: saved.repositoryPath as string,
    commitSha: saved.commitSha as string,
    lessons: saved.lessons as Lesson[],
  });
  const index = integer(saved.currentLessonIndex, "Current checkpoint index", 0, base.lessons.length);
  const states: ReviewState[] = ["awaitingAnswer", "assessing", "feedback", "complete"];
  if (!states.includes(saved.state as ReviewState)) fail("Saved session state is invalid.");
  const state = saved.state as ReviewState;
  if ((state === "complete") !== (index === base.lessons.length)) fail("Completion and checkpoint index disagree.");
  const lessonIds = new Set(base.lessons.map((lesson) => lesson.id));
  const points = object(saved.earnedPointsByLesson, "Saved points");
  const attempts = object(saved.attemptCountByLesson, "Saved attempts");
  const assessments = object(saved.assessmentsByLesson, "Saved assessments");
  for (const [id, score] of Object.entries(points)) {
    if (!lessonIds.has(id)) fail("Saved points reference an unknown checkpoint.");
    base.earnedPointsByLesson[id] = finite(score, "Saved checkpoint points", 0, 100);
  }
  for (const [id, count] of Object.entries(attempts)) {
    if (!lessonIds.has(id)) fail("Saved attempts reference an unknown checkpoint.");
    base.attemptCountByLesson[id] = integer(count, "Saved attempt count", 1, Number.MAX_SAFE_INTEGER);
  }
  for (const [id, assessment] of Object.entries(assessments)) {
    const lesson = base.lessons.find((entry) => entry.id === id);
    if (!lesson) fail("Saved assessment references an unknown checkpoint.");
    base.assessmentsByLesson[id] = validateAssessment(assessment, lesson!);
    if (!own(base.attemptCountByLesson, id)) fail("Saved assessment must have an attempt.");
    if (base.assessmentsByLesson[id].confidence === "high" && assessmentPoints(base.assessmentsByLesson[id]) > (base.earnedPointsByLesson[id] ?? 0)) {
      fail("Saved assessment points exceed earned points.");
    }
  }
  for (const id of Object.keys(points)) {
    if (!own(base.assessmentsByLesson, id)) fail("Saved points require a saved assessment.");
  }
  const ids = (value: unknown, label: string): string[] => {
    const entries = array(value, label).map((entry) => text(entry, label));
    if (new Set(entries).size !== entries.length || entries.some((id) => !lessonIds.has(id))) fail(`${label} must contain unique known checkpoint IDs.`);
    return entries;
  };
  base.masteredLessonIds = ids(saved.masteredLessonIds, "Mastered checkpoints");
  base.skippedLessonIds = ids(saved.skippedLessonIds, "Skipped checkpoints");
  if (base.masteredLessonIds.some((id) => base.skippedLessonIds.includes(id))) fail("A checkpoint cannot be both mastered and skipped.");
  for (const id of base.masteredLessonIds) {
    if (!own(base.assessmentsByLesson, id) || !passed(base.assessmentsByLesson[id])) fail("Mastery requires a passing saved assessment.");
  }
  for (const [id, assessment] of Object.entries(base.assessmentsByLesson)) {
    if (passed(assessment) && !base.masteredLessonIds.includes(id)) fail("Passing assessment and saved mastery disagree.");
  }
  for (const [position, lesson] of base.lessons.entries()) {
    const resolved = base.masteredLessonIds.includes(lesson.id) || base.skippedLessonIds.includes(lesson.id);
    if (position < index && !resolved) fail("Earlier checkpoints must be mastered or explicitly skipped.");
    if (position > index && (resolved || own(points, lesson.id) || own(attempts, lesson.id) || own(assessments, lesson.id))) fail("Future checkpoints cannot have progress.");
    if (position === index && base.skippedLessonIds.includes(lesson.id)) fail("Skipped checkpoint must already have advanced.");
  }
  base.totalPoints = finite(saved.totalPoints, "Saved total points", 0, base.lessons.length * 100);
  if (!close(base.totalPoints, Object.values(base.earnedPointsByLesson).reduce((sum, score) => sum + score, 0))) fail("Saved total points do not match checkpoint points.");
  base.currentLessonIndex = index;
  base.state = state;
  if (state === "assessing" && !own(base.attemptCountByLesson, base.lessons[index].id)) fail("An in-flight assessment needs a saved attempt.");
  if (saved.lastAssessment !== undefined) {
    const lesson = base.lessons[index];
    if (state !== "feedback" || !lesson) fail("Only feedback may have a current assessment.");
    base.lastAssessment = validateAssessment(saved.lastAssessment, lesson!);
    if (JSON.stringify(base.lastAssessment) !== JSON.stringify(base.assessmentsByLesson[lesson!.id])) fail("Current and saved assessments disagree.");
  } else if (state === "feedback") fail("Feedback needs the current assessment.");
  if (index < base.lessons.length && base.masteredLessonIds.includes(base.lessons[index].id) && state !== "feedback") fail("Mastery must pause at feedback before continuing.");
  return base.state === "assessing" ? failAssessment(base) : base;
}
