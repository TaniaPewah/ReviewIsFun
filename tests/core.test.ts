import { describe, expect, it } from "vitest";
import {
  applyAssessment,
  beginAssessment,
  continueSession,
  createSession,
  failAssessment,
  hydrateSession,
  retryLesson,
  skipLesson,
  validateLesson,
} from "../src/core/engine";
import type { Assessment, Lesson, ReviewSession } from "../src/core/types";

const sha = "a".repeat(40);

function lesson(id = "first"): Lesson {
  return {
    id,
    title: "Check before using a value",
    explanation: "The committed change guards access to a possibly absent value.",
    rationaleKind: "inferred",
    alternatives: [{ name: "Throw early", tradeoff: "Clear failure, but callers must handle an exception." }],
    question: "What happens when the value is absent, and why choose a guard?",
    criteria: [
      { id: "behavior", label: "Explain behavior", maxPoints: 60 },
      { id: "tradeoff", label: "Explain tradeoff", maxPoints: 40 },
    ],
    code: [{ path: "src/value.ts", before: "return value.name;", after: "return value?.name;", oldStart: 1, newStart: 1 }],
  };
}

function session(lessons = [lesson(), lesson("second")]): ReviewSession {
  return createSession({ id: "review-1", repositoryPath: "/repo", commitSha: sha, lessons });
}

function assessment(points = 100, overrides: Partial<Assessment> = {}): Assessment {
  return {
    scores: [
      { criterionId: "behavior", earnedPoints: Math.min(points, 60), evidence: "The answer predicts the returned value." },
      { criterionId: "tradeoff", earnedPoints: Math.max(0, points - 60), evidence: "The answer discusses caller responsibilities." },
    ],
    feedback: "You explained the observable outcome and its implications.",
    confidence: "high",
    understood: points >= 80,
    ...overrides,
  };
}

function grade(value: ReviewSession, points: number, overrides: Partial<Assessment> = {}): ReviewSession {
  return applyAssessment(beginAssessment(value), assessment(points, overrides));
}

describe("frozen review sessions and prepared rubrics", () => {
  it("captures its own lesson data and a full commit SHA without binding to changing HEAD", () => {
    const originalLesson = lesson();
    const options = { id: "review-1", repositoryPath: "/repo", commitSha: sha.toUpperCase(), lessons: [originalLesson] };
    const saved = createSession(options);
    options.commitSha = "b".repeat(40);
    originalLesson.code[0].after = "different working tree code";
    originalLesson.criteria[0].maxPoints = 1;
    expect(saved.commitSha).toBe(sha);
    expect(saved.lessons[0].code[0].after).toBe("return value?.name;");
    expect(saved.lessons[0].criteria[0].maxPoints).toBe(60);
    expect(saved.state).toBe("awaitingAnswer");
  });

  it.each(["HEAD", "abc123", "a".repeat(39), "a".repeat(40) + " "])("rejects non-fixed commit identity %s", (commitSha) => {
    expect(() => createSession({ id: "review", repositoryPath: "/repo", commitSha, lessons: [lesson()] })).toThrow(/full fixed commit SHA/);
  });

  it("allows SHA-256 repositories and empty coverage-only sessions", () => {
    const empty = createSession({ id: "empty", repositoryPath: "/repo", commitSha: "b".repeat(64), lessons: [] });
    expect(empty.state).toBe("complete");
    expect(hydrateSession(JSON.parse(JSON.stringify(empty)))).toEqual(empty);
    expect(() => beginAssessment(empty)).toThrow();
  });

  it("rejects duplicate lesson IDs, unsafe map keys and rubrics that do not total 100", () => {
    expect(() => session([lesson(), lesson()])).toThrow(/unique/);
    expect(() => session([lesson("__proto__")])).toThrow(/reserved/);
    const bad = lesson();
    bad.criteria[0].maxPoints = 59;
    expect(() => validateLesson(bad)).toThrow(/100 points/);
    bad.criteria[0].maxPoints = 60;
    bad.criteria[1].id = "behavior";
    expect(() => validateLesson(bad)).toThrow(/unique/);
  });
});

describe("explicit progression gates", () => {
  it("pauses before and after the answer; a mastered lesson needs explicit Continue", () => {
    const initial = session();
    expect(() => continueSession(initial)).toThrow();
    expect(() => applyAssessment(initial, assessment())).toThrow();
    const assessing = beginAssessment(initial);
    expect(assessing.state).toBe("assessing");
    expect(() => beginAssessment(assessing)).toThrow();
    expect(() => skipLesson(assessing)).toThrow();
    const feedback = applyAssessment(assessing, assessment());
    expect(feedback.state).toBe("feedback");
    expect(feedback.currentLessonIndex).toBe(0);
    expect(feedback.masteredLessonIds).toEqual(["first"]);
    expect(() => retryLesson(feedback)).toThrow(/mastered/);
    expect(() => beginAssessment(feedback)).toThrow();
    const next = continueSession(feedback);
    expect(next.currentLessonIndex).toBe(1);
    expect(next.state).toBe("awaitingAnswer");
    expect(next.lastAssessment).toBeUndefined();
    expect(initial.state).toBe("awaitingAnswer");
    expect(initial.totalPoints).toBe(0);
  });

  it.each([
    { points: 79, understood: true, confidence: "high" as const },
    { points: 100, understood: false, confidence: "high" as const },
    { points: 100, understood: true, confidence: "low" as const },
  ])("keeps unresolved understanding gated with $points points, $understood understanding, $confidence confidence", (input) => {
    const feedback = grade(session(), input.points, input);
    expect(feedback.masteredLessonIds).toEqual([]);
    expect(() => continueSession(feedback)).toThrow(/unresolved/);
    expect(retryLesson(feedback).state).toBe("awaitingAnswer");
  });

  it("requires an explicit skip and records unresolved checkpoints through completion", () => {
    const partial = grade(session(), 30);
    const skipped = skipLesson(partial);
    expect(skipped.skippedLessonIds).toEqual(["first"]);
    expect(skipped.masteredLessonIds).toEqual([]);
    expect(skipped.currentLessonIndex).toBe(1);
    const finalFeedback = grade(skipped, 80);
    expect(finalFeedback.state).toBe("feedback");
    const completed = continueSession(finalFeedback);
    expect(completed.state).toBe("complete");
    expect(completed.totalPoints).toBe(110);
    expect(completed.masteredLessonIds).toEqual(["second"]);
    expect(() => continueSession(completed)).toThrow();
    expect(() => retryLesson(completed)).toThrow();
    expect(hydrateSession(JSON.parse(JSON.stringify(completed)))).toEqual(completed);
  });
});

describe("rubric scoring and durable XP", () => {
  it("awards only a lesson's highest score, including genuine partial-credit improvement", () => {
    const first = grade(session(), 50);
    expect(first.totalPoints).toBe(50);
    const duplicateAnswer = grade(retryLesson(first), 50);
    expect(duplicateAnswer.totalPoints).toBe(50);
    const improvement = grade(retryLesson(duplicateAnswer), 75);
    expect(improvement.totalPoints).toBe(75);
    const weaker = grade(retryLesson(improvement), 40);
    expect(weaker.totalPoints).toBe(75);
    expect(weaker.earnedPointsByLesson.first).toBe(75);
    expect(weaker.attemptCountByLesson.first).toBe(4);
    expect(weaker.lastAssessment?.scores[0].earnedPoints).toBe(40);
    expect(() => applyAssessment(weaker, assessment(40))).toThrow();
    expect(hydrateSession(JSON.parse(JSON.stringify(weaker)))).toEqual(weaker);
  });

  it("gives uncertain feedback no new XP and preserves previously earned XP", () => {
    const partial = grade(session(), 55);
    const uncertain = grade(retryLesson(partial), 100, { confidence: "low", understood: true });
    expect(uncertain.totalPoints).toBe(55);
    expect(uncertain.earnedPointsByLesson.first).toBe(55);
    expect(uncertain.masteredLessonIds).toEqual([]);
    expect(uncertain.lastAssessment?.confidence).toBe("low");
  });

  it.each([
    [{ criterionId: "behavior", earnedPoints: 50, evidence: "Behavior evidence." }],
    [
      { criterionId: "behavior", earnedPoints: 50, evidence: "Behavior evidence." },
      { criterionId: "behavior", earnedPoints: 40, evidence: "Duplicate evidence." },
    ],
    [
      { criterionId: "behavior", earnedPoints: 50, evidence: "Behavior evidence." },
      { criterionId: "invented", earnedPoints: 40, evidence: "Not part of rubric." },
    ],
    [
      { criterionId: "behavior", earnedPoints: 61, evidence: "Exceeds weight." },
      { criterionId: "tradeoff", earnedPoints: 40, evidence: "Tradeoff evidence." },
    ],
    [
      { criterionId: "behavior", earnedPoints: -1, evidence: "Negative score." },
      { criterionId: "tradeoff", earnedPoints: 40, evidence: "Tradeoff evidence." },
    ],
    [
      { criterionId: "behavior", earnedPoints: Number.NaN, evidence: "Not a number." },
      { criterionId: "tradeoff", earnedPoints: 40, evidence: "Tradeoff evidence." },
    ],
    [
      { criterionId: "behavior", earnedPoints: Number.POSITIVE_INFINITY, evidence: "Infinite score." },
      { criterionId: "tradeoff", earnedPoints: 40, evidence: "Tradeoff evidence." },
    ],
  ].map((scores) => ({ scores })))("rejects malformed grades without mutating the session", ({ scores }) => {
    const assessing = beginAssessment(session());
    expect(() => applyAssessment(assessing, assessment(100, { scores }))).toThrow();
    expect(assessing.totalPoints).toBe(0);
    expect(assessing.state).toBe("assessing");
    expect(failAssessment(assessing).state).toBe("awaitingAnswer");
  });

  it("recovers failed assessment calls without resetting earlier progress", () => {
    const partial = grade(session(), 35);
    const failed = failAssessment(beginAssessment(retryLesson(partial)));
    expect(failed.state).toBe("awaitingAnswer");
    expect(failed.totalPoints).toBe(35);
    expect(failed.earnedPointsByLesson.first).toBe(35);
    expect(failed.attemptCountByLesson.first).toBe(2);
    expect(grade(failed, 75).totalPoints).toBe(75);
  });
});

describe("untrusted persisted sessions", () => {
  it("resumes the exact commit, current lesson, feedback and XP", () => {
    const original = grade(session(), 70);
    const restored = hydrateSession(JSON.parse(JSON.stringify(original)));
    expect(restored).toEqual(original);
    expect(restored.commitSha).toBe(sha);
    expect(() => continueSession(restored)).toThrow(/unresolved/);
  });

  it("recovers an interrupted in-flight assessment as a retryable question", () => {
    const assessing = beginAssessment(session());
    const restored = hydrateSession(JSON.parse(JSON.stringify(assessing)));
    expect(restored.state).toBe("awaitingAnswer");
    expect(restored.totalPoints).toBe(0);
    expect(grade(restored, 100).totalPoints).toBe(100);
  });

  it("rejects incoherent saved progress instead of trusting persisted unlocks", () => {
    const original = grade(session(), 60);
    const save = () => JSON.parse(JSON.stringify(original)) as ReviewSession;
    const badTotal = save();
    badTotal.totalPoints = 500;
    expect(() => hydrateSession(badTotal)).toThrow();
    const badMastery = save();
    badMastery.masteredLessonIds = ["first"];
    expect(() => hydrateSession(badMastery)).toThrow(/passing/);
    const badAdvance = save();
    badAdvance.currentLessonIndex = 1;
    badAdvance.state = "awaitingAnswer";
    delete badAdvance.lastAssessment;
    expect(() => hydrateSession(badAdvance)).toThrow(/Earlier/);
    const badFuture = save();
    badFuture.earnedPointsByLesson.second = 20;
    badFuture.assessmentsByLesson.second = assessment(20);
    badFuture.attemptCountByLesson.second = 1;
    badFuture.totalPoints += 20;
    expect(() => hydrateSession(badFuture)).toThrow(/Future/);
    const badFeedback = save();
    delete badFeedback.lastAssessment;
    expect(() => hydrateSession(badFeedback)).toThrow(/Feedback/);
    const unsupportedPoints = save();
    delete unsupportedPoints.assessmentsByLesson.first;
    expect(() => hydrateSession(unsupportedPoints)).toThrow(/points require/);
    const missingAttempt = beginAssessment(session());
    delete missingAttempt.attemptCountByLesson.first;
    expect(() => hydrateSession(missingAttempt)).toThrow(/saved attempt/);
  });
});
