import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import {
  buildInitialStages,
  isValidPluginName,
  STAGE_ORDER,
  type AdvanceDecision,
  type AdvanceResult,
  type FuzzyIdea,
  type Project,
  type ProjectMeta,
  type Stage,
} from './types.js'

// The store is a plain class. It is instantiated once in the Host's
// `apply()` and exposed on the host context under `ctx.craft`. The Client
// side reads it through the `CraftBridgeService` defined in `index.ts`.
//
// We use plain host-side node:fs/promises rather than the abstract fs seam:
// the workshop writes into the configured workspace directory which lives
// outside any sandboxed view, and plain fs gives us atomic writes via
// tmp+rename without the seam's stale guard overhead.

const UTF8 = 'utf-8'

interface ProjectFile {
  version: 1
  project: Project
}

export class CraftStore {
  private baseDir!: string
  private maxListed!: number

  /** Wire-up called from apply(): tells us where to put files. */
  configure(baseDir: string, maxListed: number) {
    this.baseDir = resolve(baseDir)
    this.maxListed = maxListed
  }

  /** Lazy-resolve a project directory for a plugin name. */
  private dirFor(pluginName: string): string {
    if (!isValidPluginName(pluginName)) {
      throw new Error(`invalid plugin name: ${pluginName}`)
    }
    return join(this.baseDir, pluginName)
  }

  /** Atomic write: write to <path>.tmp then rename. */
  private async writeJson(path: string, body: ProjectFile): Promise<void> {
    await mkdir(dirname(path), { recursive: true })
    const tmp = `${path}.tmp`
    await writeFile(tmp, JSON.stringify(body, null, 2), UTF8)
    await rename(tmp, path)
  }

  /** Read a project file from disk, or null if absent / unreadable. */
  private async readProject(dir: string): Promise<Project | null> {
    const file = join(dir, 'project.json')
    try {
      const text = await readFile(file, UTF8)
      const parsed = JSON.parse(text) as ProjectFile
      if (parsed.version !== 1 || !parsed.project) return null
      return parsed.project
    } catch (err: any) {
      if (err && err.code === 'ENOENT') return null
      throw err
    }
  }

  /** Build the lightweight meta row used by the project list. */
  private meta(p: Project): ProjectMeta {
    return {
      id: p.id,
      pluginName: p.pluginName,
      stage: p.stage,
      accepted: p.accepted,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }
  }

  /** Enumerate known projects in mtime-desc order (best-effort). */
  async list(): Promise<ProjectMeta[]> {
    let entries: string[] = []
    try {
      entries = await readdir(this.baseDir)
    } catch (err: any) {
      if (err && err.code === 'ENOENT') return []
      throw err
    }
    const metas: ProjectMeta[] = []
    for (const entry of entries) {
      const dir = join(this.baseDir, entry)
      const proj = await this.readProject(dir)
      if (proj) metas.push(this.meta(proj))
    }
    metas.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
    return metas.slice(0, this.maxListed)
  }

  /** Get a single project by its plugin name (the user-visible id). */
  async get(pluginName: string): Promise<Project | null> {
    return this.readProject(this.dirFor(pluginName))
  }

  /** Create a brand-new project from a fuzzy idea. */
  async create(input: FuzzyIdea): Promise<Project> {
    if (!isValidPluginName(input.pluginName)) {
      throw new Error('pluginName must match /^[a-z][a-z0-9-]{1,62}$/')
    }
    const dir = this.dirFor(input.pluginName)
    const existing = await this.readProject(dir)
    if (existing) {
      throw new Error(`project "${input.pluginName}" already exists`)
    }
    const now = new Date().toISOString()
    const project: Project = {
      id: randomUUID(),
      pluginName: input.pluginName,
      fuzzyIdea: input.fuzzyIdea,
      stage: 'interview',
      accepted: false,
      createdAt: now,
      updatedAt: now,
      interview: [],
      design: '',
      tasks: '',
      stages: buildInitialStages(),
    }
    await mkdir(dir, { recursive: true })
    await this.writeJson(join(dir, 'project.json'), { version: 1, project })
    return project
  }

  /**
   * Move the project forward by one stage, or stay put with a revise decision.
   */
  async advance(pluginName: string, decision: AdvanceDecision): Promise<AdvanceResult> {
    const dir = this.dirFor(pluginName)
    const project = await this.readProject(dir)
    if (!project) {
      throw new Error(`project "${pluginName}" not found`)
    }
    const currentIndex = STAGE_ORDER.indexOf(project.stage)
    if (decision.decision === 'revise') {
      project.updatedAt = new Date().toISOString()
      project.accepted = false
      await this.writeJson(join(dir, 'project.json'), { version: 1, project })
      return {
        project,
        nextStage: project.stage,
        awaitingGate: true,
      }
    }
    const nextIndex = Math.min(currentIndex + 1, STAGE_ORDER.length - 1)
    const nextStage = STAGE_ORDER[nextIndex]
    const stages = project.stages.slice()
    const markStage = (stage: Stage, status: Project['stages'][number]['status']) => {
      const idx = stages.findIndex((s) => s.stage === stage)
      if (idx >= 0) stages[idx] = { ...stages[idx], status }
    }
    markStage(project.stage, 'done')
    markStage(nextStage, isAutoStage(nextStage) ? 'auto' : 'gate')
    const updated: Project = {
      ...project,
      stage: nextStage,
      accepted: nextStage === 'deliver',
      updatedAt: new Date().toISOString(),
      stages,
    }
    await this.writeJson(join(dir, 'project.json'), { version: 1, project: updated })
    return {
      project: updated,
      nextStage,
      awaitingGate: !isAutoStage(nextStage),
    }
  }

  /** Append an interview answer to the project's requirements spec. */
  async appendInterview(pluginName: string, field: string, value: unknown): Promise<Project> {
    const dir = this.dirFor(pluginName)
    const project = await this.readProject(dir)
    if (!project) throw new Error(`project "${pluginName}" not found`)
    const updated: Project = {
      ...project,
      updatedAt: new Date().toISOString(),
      interview: [
        ...project.interview,
        { field, value, capturedAt: new Date().toISOString() },
      ],
    }
    await this.writeJson(join(dir, 'project.json'), { version: 1, project: updated })
    return updated
  }

  /** Replace the design document for stage 2. */
  async setDesign(pluginName: string, design: string): Promise<Project> {
    const dir = this.dirFor(pluginName)
    const project = await this.readProject(dir)
    if (!project) throw new Error(`project "${pluginName}" not found`)
    const updated: Project = {
      ...project,
      updatedAt: new Date().toISOString(),
      design,
    }
    await this.writeJson(join(dir, 'project.json'), { version: 1, project: updated })
    return updated
  }

  /** Replace the tasks document for stage 3. */
  async setTasks(pluginName: string, tasks: string): Promise<Project> {
    const dir = this.dirFor(pluginName)
    const project = await this.readProject(dir)
    if (!project) throw new Error(`project "${pluginName}" not found`)
    const updated: Project = {
      ...project,
      updatedAt: new Date().toISOString(),
      tasks,
    }
    await this.writeJson(join(dir, 'project.json'), { version: 1, project: updated })
    return updated
  }

  /** Delete a project entirely. */
  async remove(pluginName: string): Promise<void> {
    await rm(this.dirFor(pluginName), { recursive: true, force: true })
  }
}

function isAutoStage(stage: Stage): boolean {
  return stage === 'tasks' || stage === 'generate' || stage === 'verify'
}