import { resolve } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { Config } from './config'
import type { Config as ConfigShape } from './config'
import { CraftStore } from './store'

// Plugin identity. This row runs as a child entry of the `preset-craft`
// agent preset declared in cordis.patch.yml. Activating that preset from
// the Web preset selector mounts this row, which in turn seeds the host
// context with `ctx.craft` and the three workshop chat tools.
export const name = 'dsh-plugin-craft'
export const inject = ['tools'] as const

// Re-export the schema so the loader can validate this plugin's config.
export { Config }

// Shape declared on `ctx` so any code that wants the typed hook can read
// the store without `any` casts. Declaration merging keeps the line below
// invisible to anyone who doesn't import the plugin.
declare module '@deepseek-ai/cordis' {
  interface Context {
    craft: CraftStore
  }
}

export function apply(ctx: Context, config: ConfigShape): void {
  // Resolve the projects directory relative to the DSH home. The host seam
  // exposes the home through `process.env.DSH_HOME`; an explicit absolute
  // path in cordis.yml is treated as already resolved.
  const projectsDir = config.projectsDir.startsWith('/') ||
    /^[a-zA-Z]:[\\/]/.test(config.projectsDir)
    ? config.projectsDir
    : resolve(process.env.DSH_HOME || '.', config.projectsDir)

  // Allocate one store per activation and expose it as ctx.craft. The
  // singleton lives at module load so the two chat tools share one
  // instance and the same on-disk directory.
  store.configure(projectsDir, config.maxListedProjects)
  ctx.effect(() => ctx.provide('craft', store), 'dsh-plugin-craft: store')

  // ----- Chat-side tools -------------------------------------------------
  // `craft.create_project`: lets a user kick off the Workshop from Chat by
  // describing a fuzzy idea in one message.
  ctx.tools.register(
    defineTool({
      name: 'craft.create_project',
      description:
        'Open the Plugin Workshop and start a new project from a fuzzy one-liner idea. Returns the registered plugin name and the stage the project is now on (always "interview").',
      parameters: {
        pluginName: {
          type: 'string',
          required: true,
          description:
            'Lowercase plugin id, e.g. "device-scanner". Becomes the project key on disk.',
        },
        fuzzyIdea: {
          type: 'string',
          required: true,
          description:
            'The user-facing one-liner describing what the plugin should do.',
        },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            pluginName: { type: 'string' },
            stage: { type: 'string' },
          },
        },
        render: (_args, value) => [
          { type: 'text', text: `Workshop project "${value.pluginName}" created. Begin stage 1 — interview.` },
        ],
      },
      async execute(args) {
        const project = await store.create({
          pluginName: String(args.pluginName),
          fuzzyIdea: String(args.fuzzyIdea),
        })
        return { pluginName: project.pluginName, stage: project.stage as string }
      },
    }),
  )

  // `craft.advance_stage`: lets the model move the project to the next
  // stage (accept) or stay put with feedback (revise).
  ctx.tools.register(
    defineTool({
      name: 'craft.advance_stage',
      description:
        'Advance a Workshop project to the next stage (decision="accept") or stay on it with feedback (decision="revise", feedback="...").',
      parameters: {
        pluginName: { type: 'string', required: true },
        decision: { type: 'string', required: true },
        feedback: { type: 'string' },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            nextStage: { type: 'string' },
            awaitingGate: { type: 'boolean' },
          },
        },
        render: (_args, value) => [
          { type: 'text', text: `Workshop moved to stage "${value.nextStage}". Awaiting gate: ${value.awaitingGate}.` },
        ],
      },
      async execute(args) {
        const result = await store.advance(String(args.pluginName), {
          decision: args.decision === 'revise' ? 'revise' : 'accept',
          feedback: args.feedback ? String(args.feedback) : undefined,
        })
        return {
          nextStage: result.nextStage as string,
          awaitingGate: result.awaitingGate,
        }
      },
    }),
  )

  // `craft.appendinterview`: the model calls this after the user clicks
  // an option in an ask_user_question card, to persist that requirement.
  ctx.tools.register(
    defineTool({
      name: 'craft.appendinterview',
      description:
        'Record one requirement from the Workshop interview. Called after the user clicks an option in a clickable question.',
      parameters: {
        pluginName: { type: 'string', required: true },
        field: { type: 'string', required: true, description: 'Question id used as the requirement key.' },
        value: { type: 'string', required: true, description: 'The option label the user picked.' },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            pluginName: { type: 'string' },
            field: { type: 'string' },
            value: { type: 'string' },
            total: { type: 'number' },
          },
        },
        render: (_args, value) => [
          { type: 'text', text: `Recorded requirement "${value.field}" → "${value.value}". ${value.total} captured so far.` },
        ],
      },
      async execute(args) {
        const updated = await store.appendInterview(
          String(args.pluginName),
          String(args.field),
          String(args.value),
        )
        return {
          pluginName: updated.pluginName,
          field: String(args.field),
          value: String(args.value),
          total: updated.interview.length,
        }
      },
    }),
  )
}

// The store is allocated at module load (singleton) so the two chat tools
// share one instance. Configured in apply() above.
const store = new CraftStore()