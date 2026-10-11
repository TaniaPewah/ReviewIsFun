export interface Criterion {
  id: string;
  label: string;
  maxPoints: number;
}

export interface Lesson {
  id: string;
  title: string;
  explanation: string;
  rationaleKind: "documented" | "inferred";
  alternatives: { name: string; tradeoff: string }[];
  question: string;
  criteria: Criterion[];
  code: {
    path: string;
    before: string;
    after: string;
    oldStart: number;
    newStart: number;
  }[];
}

export interface Assessment {
  scores: { criterionId: string; earnedPoints: number; evidence: string }[];
  feedback: string;
  confidence: "high" | "low";
  understood: boolean;
}

export type ReviewState = "awaitingAnswer" | "assessing" | "feedback" | "complete";

/** JSON-serializable state bound to a committed snapshot, never to changing HEAD. */
export interface ReviewSession {
  version: 1;
  id: string;
  repositoryPath: string;
  commitSha: string;
  lessons: Lesson[];
  currentLessonIndex: number;
  state: ReviewState;
  earnedPointsByLesson: Record<string, number>;
  totalPoints: number;
  masteredLessonIds: string[];
  skippedLessonIds: string[];
  attemptCountByLesson: Record<string, number>;
  assessmentsByLesson: Record<string, Assessment>;
  lastAssessment?: Assessment;
}

export interface CreateSessionOptions {
  id: string;
  repositoryPath: string;
  commitSha: string;
  lessons: Lesson[];
}
