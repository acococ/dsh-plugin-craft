import Schema from '@deepseek-ai/schemastery'

// Tunable configuration must be a Schemastery Schema, never a plain object:
// the harness validates it at load time and fails loud on invalid values, and
// every key can be changed from cordis.yml without editing code (guide §3.6).
export interface Config {
  /** Workspace-relative (or absolute) directory holding workshop projects. */
  projectsDir: string
  /** Cap on auto-retained projects listed in the UI; older ones stay on disk. */
  maxListedProjects: number
}

export const Config: Schema<Config> = Schema.object({
  projectsDir: Schema.string()
    .default('projects/dsh-plugin-craft')
    .description('Directory holding workshop projects, resolved relative to the DSH home.'),
  maxListedProjects: Schema.number()
    .default(50)
    .min(1)
    .description('Maximum number of projects listed in the Workshop UI before older ones roll off.'),
})