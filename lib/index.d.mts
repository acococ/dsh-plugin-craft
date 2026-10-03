import Schema from "@deepseek-ai/schemastery";
import { Context } from "@deepseek-ai/cordis";
//#region src/config.d.ts
interface Config {
  /** Workspace-relative (or absolute) directory holding workshop projects. */
  projectsDir: string;
  /** Cap on auto-retained projects listed in the UI; older ones stay on disk. */
  maxListedProjects: number;
}
declare const Config: Schema<Config>;
//#endregion
//#region src/types.d.ts
type Stage = 'interview' | 'design' | 'tasks' | 'generate' | 'verify' | 'deliver';
/** State machine values used by the StageStepper UI. */
type StageStatus = 'pending' | 'auto' | 'gate' | 'done' | 'failed';
interface StageView {
  stage: Stage;
  status: StageStatus;
  /** Optional last error message when status === 'failed'. */
  error?: string;
}
/** Plain data shape for a single requirement entry inside the interview spec. */
interface InterviewAnswer {
  /** Stable field id (e.g. "name", "mainFeature"). */
  field: string;
  /** Free-form value the user gave during the interview. */
  value: unknown;
  /** When this answer was captured (ISO timestamp). */
  capturedAt: string;
}
/** Snapshot of a single workshop project. Serializable to JSON. */
interface Project {
  id: string;
  /** Display name chosen at creation time; becomes the plugin's `name`. */
  pluginName: string;
  /** Fuzzy one-liner the user wrote to start the workshop. */
  fuzzyIdea: string;
  /** Current stage the project is on. */
  stage: Stage;
  /** Whether the user has approved the current stage's deliverable. */
  accepted: boolean;
  createdAt: string;
  updatedAt: string;
  /** Accumulated answers gathered during the interview stage. */
  interview: InterviewAnswer[];
  /** Free-form design notes captured at stage 2. */
  design: string;
  /** Free-form task list captured at stage 3. */
  tasks: string;
  /** Stage-by-stage view (used by the progress strip). */
  stages: StageView[];
}
/** Compact row used in the project list. */
interface ProjectMeta {
  id: string;
  pluginName: string;
  stage: Stage;
  accepted: boolean;
  createdAt: string;
  updatedAt: string;
}
/** Inputs for creating a brand-new project from a fuzzy idea. */
interface FuzzyIdea {
  pluginName: string;
  fuzzyIdea: string;
}
/** Result of advancing a project past a user gate. */
interface AdvanceDecision {
  /** 'accept' = move to next stage; 'revise' = stay and add feedback. */
  decision: 'accept' | 'revise';
  /** Optional user feedback text for the revise branch. */
  feedback?: string;
}
/** What we hand to the page after a stage transition. */
interface AdvanceResult {
  project: Project;
  nextStage: Stage;
  /** Whether the project still has the next user gate ahead. */
  awaitingGate: boolean;
}
//#endregion
//#region src/store.d.ts
declare class CraftStore {
  private baseDir;
  private maxListed;
  /** Wire-up called from apply(): tells us where to put files. */
  configure(baseDir: string, maxListed: number): void;
  /** Lazy-resolve a project directory for a plugin name. */
  private dirFor;
  /** Atomic write: write to <path>.tmp then rename. */
  private writeJson;
  /** Read a project file from disk, or null if absent / unreadable. */
  private readProject;
  /** Build the lightweight meta row used by the project list. */
  private meta;
  /** Enumerate known projects in mtime-desc order (best-effort). */
  list(): Promise<ProjectMeta[]>;
  /** Get a single project by its plugin name (the user-visible id). */
  get(pluginName: string): Promise<Project | null>;
  /** Create a brand-new project from a fuzzy idea. */
  create(input: FuzzyIdea): Promise<Project>;
  /**
   * Move the project forward by one stage, or stay put with a revise decision.
   */
  advance(pluginName: string, decision: AdvanceDecision): Promise<AdvanceResult>;
  /** Append an interview answer to the project's requirements spec. */
  appendInterview(pluginName: string, field: string, value: unknown): Promise<Project>;
  /** Replace the design document for stage 2. */
  setDesign(pluginName: string, design: string): Promise<Project>;
  /** Replace the tasks document for stage 3. */
  setTasks(pluginName: string, tasks: string): Promise<Project>;
  /** Delete a project entirely. */
  remove(pluginName: string): Promise<void>;
}
//#endregion
//#region src/index.d.ts
declare const name = "dsh-plugin-craft";
declare const inject: readonly ["tools"];
declare module '@deepseek-ai/cordis' {
  interface Context {
    craft: CraftStore;
  }
}
declare function apply(ctx: Context, config: Config): void;
//#endregion
export { Config, apply, inject, name };