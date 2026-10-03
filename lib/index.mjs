import { dirname, join, resolve } from "node:path";
import { defineTool } from "@deepseek-ai/dsh-tools";
import Schema from "@deepseek-ai/schemastery";
import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
//#region src/config.ts
const Config = Schema.object({
	projectsDir: Schema.string().default("projects/dsh-plugin-craft").description("Directory holding workshop projects, resolved relative to the DSH home."),
	maxListedProjects: Schema.number().default(50).min(1).description("Maximum number of projects listed in the Workshop UI before older ones roll off.")
});
//#endregion
//#region src/types.ts
const STAGE_ORDER = [
	"interview",
	"design",
	"tasks",
	"generate",
	"verify",
	"deliver"
];
/** Lightweight validation helper exposed for tests. */
function isValidPluginName(name) {
	if (name.length < 2 || name.length > 63) return false;
	return /^[a-z][a-z0-9-]*[a-z0-9]$/.test(name);
}
/** Build a default stages view for a freshly created project. */
function buildInitialStages() {
	return STAGE_ORDER.map((stage, index) => ({
		stage,
		status: index === 0 ? "gate" : "pending"
	}));
}
//#endregion
//#region src/store.ts
const UTF8 = "utf-8";
var CraftStore = class {
	baseDir;
	maxListed;
	/** Wire-up called from apply(): tells us where to put files. */
	configure(baseDir, maxListed) {
		this.baseDir = resolve(baseDir);
		this.maxListed = maxListed;
	}
	/** Lazy-resolve a project directory for a plugin name. */
	dirFor(pluginName) {
		if (!isValidPluginName(pluginName)) throw new Error(`invalid plugin name: ${pluginName}`);
		return join(this.baseDir, pluginName);
	}
	/** Atomic write: write to <path>.tmp then rename. */
	async writeJson(path, body) {
		await mkdir(dirname(path), { recursive: true });
		const tmp = `${path}.tmp`;
		await writeFile(tmp, JSON.stringify(body, null, 2), UTF8);
		await rename(tmp, path);
	}
	/** Read a project file from disk, or null if absent / unreadable. */
	async readProject(dir) {
		const file = join(dir, "project.json");
		try {
			const text = await readFile(file, UTF8);
			const parsed = JSON.parse(text);
			if (parsed.version !== 1 || !parsed.project) return null;
			return parsed.project;
		} catch (err) {
			if (err && err.code === "ENOENT") return null;
			throw err;
		}
	}
	/** Build the lightweight meta row used by the project list. */
	meta(p) {
		return {
			id: p.id,
			pluginName: p.pluginName,
			stage: p.stage,
			accepted: p.accepted,
			createdAt: p.createdAt,
			updatedAt: p.updatedAt
		};
	}
	/** Enumerate known projects in mtime-desc order (best-effort). */
	async list() {
		let entries = [];
		try {
			entries = await readdir(this.baseDir);
		} catch (err) {
			if (err && err.code === "ENOENT") return [];
			throw err;
		}
		const metas = [];
		for (const entry of entries) {
			const dir = join(this.baseDir, entry);
			const proj = await this.readProject(dir);
			if (proj) metas.push(this.meta(proj));
		}
		metas.sort((a, b) => a.updatedAt < b.updatedAt ? 1 : -1);
		return metas.slice(0, this.maxListed);
	}
	/** Get a single project by its plugin name (the user-visible id). */
	async get(pluginName) {
		return this.readProject(this.dirFor(pluginName));
	}
	/** Create a brand-new project from a fuzzy idea. */
	async create(input) {
		if (!isValidPluginName(input.pluginName)) throw new Error("pluginName must match /^[a-z][a-z0-9-]{1,62}$/");
		const dir = this.dirFor(input.pluginName);
		if (await this.readProject(dir)) throw new Error(`project "${input.pluginName}" already exists`);
		const now = (/* @__PURE__ */ new Date()).toISOString();
		const project = {
			id: randomUUID(),
			pluginName: input.pluginName,
			fuzzyIdea: input.fuzzyIdea,
			stage: "interview",
			accepted: false,
			createdAt: now,
			updatedAt: now,
			interview: [],
			design: "",
			tasks: "",
			stages: buildInitialStages()
		};
		await mkdir(dir, { recursive: true });
		await this.writeJson(join(dir, "project.json"), {
			version: 1,
			project
		});
		return project;
	}
	/**
	* Move the project forward by one stage, or stay put with a revise decision.
	*/
	async advance(pluginName, decision) {
		const dir = this.dirFor(pluginName);
		const project = await this.readProject(dir);
		if (!project) throw new Error(`project "${pluginName}" not found`);
		const currentIndex = STAGE_ORDER.indexOf(project.stage);
		if (decision.decision === "revise") {
			project.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
			project.accepted = false;
			await this.writeJson(join(dir, "project.json"), {
				version: 1,
				project
			});
			return {
				project,
				nextStage: project.stage,
				awaitingGate: true
			};
		}
		const nextIndex = Math.min(currentIndex + 1, STAGE_ORDER.length - 1);
		const nextStage = STAGE_ORDER[nextIndex];
		const stages = project.stages.slice();
		const markStage = (stage, status) => {
			const idx = stages.findIndex((s) => s.stage === stage);
			if (idx >= 0) stages[idx] = {
				...stages[idx],
				status
			};
		};
		markStage(project.stage, "done");
		markStage(nextStage, isAutoStage(nextStage) ? "auto" : "gate");
		const updated = {
			...project,
			stage: nextStage,
			accepted: nextStage === "deliver",
			updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
			stages
		};
		await this.writeJson(join(dir, "project.json"), {
			version: 1,
			project: updated
		});
		return {
			project: updated,
			nextStage,
			awaitingGate: !isAutoStage(nextStage)
		};
	}
	/** Append an interview answer to the project's requirements spec. */
	async appendInterview(pluginName, field, value) {
		const dir = this.dirFor(pluginName);
		const project = await this.readProject(dir);
		if (!project) throw new Error(`project "${pluginName}" not found`);
		const updated = {
			...project,
			updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
			interview: [...project.interview, {
				field,
				value,
				capturedAt: (/* @__PURE__ */ new Date()).toISOString()
			}]
		};
		await this.writeJson(join(dir, "project.json"), {
			version: 1,
			project: updated
		});
		return updated;
	}
	/** Replace the design document for stage 2. */
	async setDesign(pluginName, design) {
		const dir = this.dirFor(pluginName);
		const project = await this.readProject(dir);
		if (!project) throw new Error(`project "${pluginName}" not found`);
		const updated = {
			...project,
			updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
			design
		};
		await this.writeJson(join(dir, "project.json"), {
			version: 1,
			project: updated
		});
		return updated;
	}
	/** Replace the tasks document for stage 3. */
	async setTasks(pluginName, tasks) {
		const dir = this.dirFor(pluginName);
		const project = await this.readProject(dir);
		if (!project) throw new Error(`project "${pluginName}" not found`);
		const updated = {
			...project,
			updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
			tasks
		};
		await this.writeJson(join(dir, "project.json"), {
			version: 1,
			project: updated
		});
		return updated;
	}
	/** Delete a project entirely. */
	async remove(pluginName) {
		await rm(this.dirFor(pluginName), {
			recursive: true,
			force: true
		});
	}
};
function isAutoStage(stage) {
	return stage === "tasks" || stage === "generate" || stage === "verify";
}
//#endregion
//#region src/index.ts
const name = "dsh-plugin-craft";
const inject = ["tools"];
function apply(ctx, config) {
	const projectsDir = config.projectsDir.startsWith("/") || /^[a-zA-Z]:[\\/]/.test(config.projectsDir) ? config.projectsDir : resolve(process.env.DSH_HOME || ".", config.projectsDir);
	store.configure(projectsDir, config.maxListedProjects);
	ctx.effect(() => ctx.provide("craft", store), "dsh-plugin-craft: store");
	ctx.tools.register(defineTool({
		name: "craft.create_project",
		description: "Open the Plugin Workshop and start a new project from a fuzzy one-liner idea. Returns the registered plugin name and the stage the project is now on (always \"interview\").",
		parameters: {
			pluginName: {
				type: "string",
				required: true,
				description: "Lowercase plugin id, e.g. \"device-scanner\". Becomes the project key on disk."
			},
			fuzzyIdea: {
				type: "string",
				required: true,
				description: "The user-facing one-liner describing what the plugin should do."
			}
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					pluginName: { type: "string" },
					stage: { type: "string" }
				}
			},
			render: (_args, value) => [{
				type: "text",
				text: `Workshop project "${value.pluginName}" created. Begin stage 1 — interview.`
			}]
		},
		async execute(args) {
			const project = await store.create({
				pluginName: String(args.pluginName),
				fuzzyIdea: String(args.fuzzyIdea)
			});
			return {
				pluginName: project.pluginName,
				stage: project.stage
			};
		}
	}));
	ctx.tools.register(defineTool({
		name: "craft.advance_stage",
		description: "Advance a Workshop project to the next stage (decision=\"accept\") or stay on it with feedback (decision=\"revise\", feedback=\"...\").",
		parameters: {
			pluginName: {
				type: "string",
				required: true
			},
			decision: {
				type: "string",
				required: true
			},
			feedback: { type: "string" }
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					nextStage: { type: "string" },
					awaitingGate: { type: "boolean" }
				}
			},
			render: (_args, value) => [{
				type: "text",
				text: `Workshop moved to stage "${value.nextStage}". Awaiting gate: ${value.awaitingGate}.`
			}]
		},
		async execute(args) {
			const result = await store.advance(String(args.pluginName), {
				decision: args.decision === "revise" ? "revise" : "accept",
				feedback: args.feedback ? String(args.feedback) : void 0
			});
			return {
				nextStage: result.nextStage,
				awaitingGate: result.awaitingGate
			};
		}
	}));
	ctx.tools.register(defineTool({
		name: "craft.appendinterview",
		description: "Record one requirement from the Workshop interview. Called after the user clicks an option in a clickable question.",
		parameters: {
			pluginName: {
				type: "string",
				required: true
			},
			field: {
				type: "string",
				required: true,
				description: "Question id used as the requirement key."
			},
			value: {
				type: "string",
				required: true,
				description: "The option label the user picked."
			}
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					pluginName: { type: "string" },
					field: { type: "string" },
					value: { type: "string" },
					total: { type: "number" }
				}
			},
			render: (_args, value) => [{
				type: "text",
				text: `Recorded requirement "${value.field}" → "${value.value}". ${value.total} captured so far.`
			}]
		},
		async execute(args) {
			const updated = await store.appendInterview(String(args.pluginName), String(args.field), String(args.value));
			return {
				pluginName: updated.pluginName,
				field: String(args.field),
				value: String(args.value),
				total: updated.interview.length
			};
		}
	}));
}
const store = new CraftStore();
//#endregion
export { Config, apply, inject, name };
