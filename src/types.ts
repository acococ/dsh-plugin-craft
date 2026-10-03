// Type definitions for the dsh-plugin-craft Workshop. The store service and
// the Host tools both speak this vocabulary; the Client page receives the
// same shape over a Remote boundary.

export type Stage =
  | 'interview' // Stage 1 — collecting requirements
  | 'design' // Stage 2 — designing architecture
  | 'tasks' // Stage 3 — splitting into tasks (AUTO)
  | 'generate' // Stage 4 — generating code (AUTO)
  | 'verify' // Stage 5 — checks + smoke tests (AUTO)
  | 'deliver' // Final delivery page

export const STAGE_ORDER: readonly Stage[] = [
  'interview',
  'design',
  'tasks',
  'generate',
  'verify',
  'deliver',
] as const

/** State machine values used by the StageStepper UI. */
export type StageStatus = 'pending' | 'auto' | 'gate' | 'done' | 'failed'

export interface StageView {
  stage: Stage
  status: StageStatus
  /** Optional last error message when status === 'failed'. */
  error?: string
}

/** Plain data shape for a single requirement entry inside the interview spec. */
export interface InterviewAnswer {
  /** Stable field id (e.g. "name", "mainFeature"). */
  field: string
  /** Free-form value the user gave during the interview. */
  value: unknown
  /** When this answer was captured (ISO timestamp). */
  capturedAt: string
}

/** Snapshot of a single workshop project. Serializable to JSON. */
export interface Project {
  id: string
  /** Display name chosen at creation time; becomes the plugin's `name`. */
  pluginName: string
  /** Fuzzy one-liner the user wrote to start the workshop. */
  fuzzyIdea: string
  /** Current stage the project is on. */
  stage: Stage
  /** Whether the user has approved the current stage's deliverable. */
  accepted: boolean
  createdAt: string
  updatedAt: string
  /** Accumulated answers gathered during the interview stage. */
  interview: InterviewAnswer[]
  /** Free-form design notes captured at stage 2. */
  design: string
  /** Free-form task list captured at stage 3. */
  tasks: string
  /** Stage-by-stage view (used by the progress strip). */
  stages: StageView[]
}

/** Compact row used in the project list. */
export interface ProjectMeta {
  id: string
  pluginName: string
  stage: Stage
  accepted: boolean
  createdAt: string
  updatedAt: string
}

/** Inputs for creating a brand-new project from a fuzzy idea. */
export interface FuzzyIdea {
  pluginName: string
  fuzzyIdea: string
}

/** Result of advancing a project past a user gate. */
export interface AdvanceDecision {
  /** 'accept' = move to next stage; 'revise' = stay and add feedback. */
  decision: 'accept' | 'revise'
  /** Optional user feedback text for the revise branch. */
  feedback?: string
}

/** What we hand to the page after a stage transition. */
export interface AdvanceResult {
  project: Project
  nextStage: Stage
  /** Whether the project still has the next user gate ahead. */
  awaitingGate: boolean
}

/** Lightweight validation helper exposed for tests. */
export function isValidPluginName(name: string): boolean {
  // Lowercase letter start, lowercase letter or digit end, internal can have
  // lowercase letters / digits / dashes; total length 2-63.
  if (name.length < 2 || name.length > 63) return false
  return /^[a-z][a-z0-9-]*[a-z0-9]$/.test(name)
}

/** Build a default stages view for a freshly created project. */
export function buildInitialStages(): StageView[] {
  return STAGE_ORDER.map((stage, index) => ({
    stage,
    // First stage is awaiting the user (gate); the rest are pending until
    // we reach them. AUTO stages (tasks / generate / verify) are auto-marked
    // 'auto' once they begin, by the advance logic.
    status: index === 0 ? 'gate' : 'pending',
  }))
}