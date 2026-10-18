// ============================================================================
// lib/index.mjs —?构建产物，逐行注释?// ============================================================================
//
// 【这个文件是什么?//   宿主加载你的插件时，import 的就是这个文件?//   它由 `pnpm build`（tsdown，内部是 rolldown 打包器）?src/ 下的
//   4 ?TypeScript 文件打包生成?*你不需要手写它，也永远不要改它** —?//   下次构建就被整个覆盖了?//
// 【为什么要看它?//   这是「你写的 TS」变成「Node 实际执行?JS」之后的样子?//   看懂它，就知?TS 编译时到底把什么东西扔掉了、留下了什么?//
// 【本文件?docs/ 下的原因?//   `tsdown.config.mjs` 里配?`clean: true`，`pnpm build` 会先整个清空 lib/?//   所以注释副本不能放?lib/ 里，否则下次构建就没了?//   真正的产物在 ../../lib/index.mjs?//
// ----------------------------------------------------------------------------
// 【编译时到底扔掉了什么？—?对照表?// ----------------------------------------------------------------------------
//   源码里的东西                产物里变成什?//   ─────────────────────────────────────────────────────────────────
//   interface Config {…}        ?完全消失（纯类型，编译后无代码）
//   type Stage = 'a' | 'b'      ?完全消失（同上）
//   : string  类型标注           ?完全消失
//   private baseDir             ⚠️  private 关键字消失，字段还在（见下面详解?//   interface X 的方法签?      ⚠️  变成真实方法体（有空实现就抽走）
//   as const                    ?完全消失（类型层约束，运行时还是普通数组）
//   x as Project                ?完全消失（类型断言，纯给编译器看）
//   // 普通注?                 ?完全消失
//   /** JSDoc 注释 */            ?保留（但排版被压扁，星号对齐会变?//
//   ⚠️ private 单独说：TypeScript ?private ?*编译?*约束，不是运行时约束?//      JavaScript 里没有真正的私有字段（要私有得用 # 语法）?//      所以产物里 `baseDir;` 就是个普通字段，谁都?store.baseDir 访问到?//      打包器只是不再帮你检查而已?// ============================================================================


// ############################################################################
// ?1 组：import ?// ############################################################################
//
// 【注意：源码?5 ?import，这里也?5 个，但顺序变了?//   打包器会把所有模块的 import 提到文件最前面，并按模块重新分组?//   源码里的书写顺序（types ?store ?config ?index）在这里完全没有了?
// -----------------------------------------------------------------------------
// node:path —?Node.js 内置的「路径处理」模?// -----------------------------------------------------------------------------
//   import { 名字1, 名字2 } from '模块?
//        ?//        └── 「引入」命令：从别的模块把东西拿进当前文件
//            {}  = 从模块里挑「具名成员」，要一个一个列出来
//            from = 从哪个模块拿
//   注意这里**没有**默认导入。要对比的话，Schemastery ?Schema
//   就用默认导入（见下面?3 行）?//
// · dirname —?取「父目录?//   例：dirname('C:\\work\\foo\\project.json') ?'C:\\work\\foo'
//   Windows ?\，Linux/macOS ?/，你不用关心平台差异?//
// · join —?拼接路径
//   它比手写 "\" ?"/" 强的地方在于：会智能处理分隔符和重复斜杠?//   Windows / Linux 通用?//   例：join('C:\\work', 'foo') ?'C:\\work\\foo'
//
// · resolve —?把相对路?*转成绝对路径**
//   相对路径 = 依赖「当前工作目录」的路径，比?'projects/foo'?//   它会基于 Node 进程的当前工作目录展开成完整路径?//   例：resolve('.', 'projects/foo') ?'C:\\Users\\你\\dsh\\projects\\foo'
//   ⚠️ 这也是为什?configure() 里要立刻 resolve —?//      万一之后有人?process.chdir() 换掉工作目录，项目就找不到家了?
import { dirname, join, resolve } from "node:path";

// -----------------------------------------------------------------------------
// @deepseek-ai/dsh-tools —?官方「工具定义」库
// -----------------------------------------------------------------------------
//   一?Chat 工具 = 一份「说明书 + 一个执行函数」?//   模型读说明书决定**什么时候调**?*怎么传参**，然?Node 调执行函数干活?//
// · defineTool —??{ 名字, 说明, 参数? 输出? 执行函数 } 包成标准工具
//   它的好处是：包完之后，工?*自动**出现在模型的可用工具列表里?//   你不用自己去某处登记?
import { defineTool } from "@deepseek-ai/dsh-tools";

// -----------------------------------------------------------------------------
// @deepseek-ai/schemastery —?官方的「配置声?+ 校验」库
// -----------------------------------------------------------------------------
//   （@deepseek-ai/ 是官方包的组织名；schemastery 意思是「schema 工具箱」）
//   注意这行**没有 {}**，用的是「默认导入」—?//   因为这个库的 Schema 既是类型、又是值，默认导入最方便?//
//   · Schema —?配置校验器。造好之后，宿主在加载插件那一刻就调用它校验配置?//     打个比方：普?TS 类型 `interface { a: number }` 只是「说明文档」，编译完就没了?//     ?Schema 是一?*真正的检查机?*：你声明「a 必须是数字且不小?1」，
//     它就真的会在运行时拦住不合法的值?//     这一点对插件特别重要 —?用户会在 cordis.patch.yml 里手写配置，
//     写错了必须在「加载那一刻」就响亮报错?
import Schema from "@deepseek-ai/schemastery";

// -----------------------------------------------------------------------------
// node:fs/promises —?Node.js 内置的「文件操作（异步版）」模?// -----------------------------------------------------------------------------
//   fs = file system 文件系统?//   ?/promises 后缀 = 异步版，每个函数返回 Promise，要 await?//   为什么不?/promises？加了才?await，让出事件循环不卡住主线程?//   （同步版 node:fs 会阻塞整个进程，Node 服务里不该用。）
//
// · mkdir  —?递归创建目录（就?mkdir -p，一次建出整条链?// · readFile —?读文件内容，读出来是字符?// · readdir —?列出某个目录下的所有文件名/子目录名
// · rename —?重命?移动文件（⚠?在同一磁盘内它?*原子**的，这是下面原子写的关键?// · rm     —?删除文件或目?// · writeFile —?写文?
import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";

// -----------------------------------------------------------------------------
// node:crypto —?Node.js 内置的「密码学工具」模?// -----------------------------------------------------------------------------
// · randomUUID —?生成一个随?UUID?Universally Unique Identifier，全局唯一标识符）
//   格式长这样：550e8400-e29b-41d4-a716-446655440000
//   用途：给每个项目一?*撞不出重?*?id?//   ⚠️ 别用 Math.random() + 时间戳凑 —?并发创建时真会撞?
import { randomUUID } from "node:crypto";

// ⚠️ 消失?import：源?src/index.ts 里有 `import type { Context } from '@deepseek-ai/cordis'`
//    `import type` ?*纯类?import**，编译后没有任何运行时代码，
//    打包器直接删掉了?//    同理，源码里?'./config' 导入?Config、从 './store' 导入?CraftStore?//    ?'./types' 导入?STAGE_ORDER 等，因为在本文件内都被用到了?//    也不会变?import —?它们被打包进来了（往下看就知道）?

// ############################################################################
// ?2 组：来自 src/config.ts
// ############################################################################
//
// ↑↑ `//#region src/config.ts` ?*打包器加?*（源码里没有）?//   它标记：下面这整段代码来?src/config.ts?//   好处是能看出产物里哪几行对应哪个源文件，排查问题很好用?//   ⚠️ 每次构建位置可能变，不要依赖它们写逻辑?
/** 运行?schema 对象。宿主在加载插件时调用它校验配置?*
* 必须是一?Schema 对象，不能写普通对?—?这样配置写错会在「加载那一刻?* 直接响亮报错，而不是拖到运行时变成一个费解的错误?*/
// ↑↑ JSDoc ?*保留**了（打包器只?`//` 普通注释，保留 `/** */`）?//    注意排版被压扁了：源码里?` * ` 开头，这里变成裸的 `*`?//    而且没有前导空格 —?这是打包器重新排版的结果，语义完全没变?//
// 【Schema.object({...}) = 声明「配置是一个对象，里面有这些字段」?
const Config = Schema.object({
	// projectsDir 字段：Schema.string() = 造一个「必须是字符串」的校验规则?	// 【链式调用是什么】Schema 的每个方法都返回「自己」，所以能一路点下去?	//   .default(x)      = 用户没填时用它，加载期就填上，所以代码里拿到的一定是字符?	//   .min(1)          = 数值下限。设 1 是防止有人配?0，导致一个项目都看不见却毫无报错
	//   .description(s) = 说明文字，会出现?`dsh --dump-config` 输出?	// ⚠️ 这里?.description(...) ?*面向用户的文?*，不是注释，所以是英文?	//    而且绝对不能翻译 —?它是功能字符串，改了就是改功能?	// ⚠️ 注意：源码里这条链式调用?*换行写的**（每步一行）?	//    产物里被压成了一?—?换行和缩进在运行时毫无意义，打包器顺手去掉了?	projectsDir: Schema.string().default("C:\Users\Administrator\.dsh\myfile").description("Directory holding workshop projects, resolved relative to the DSH home."),
 // maxListedProjects 字段：Schema.number() = 造一个「必须是数字」的规则?	//   .default(50) = 默认显示 50 ?
	projectsDir: Schema.string().default("C:\\Users\\Administrator\\.dsh\\myfile").description("Directory holding workshop projects, resolved relative to the DSH home."),
 maxListedProjects: Schema.number().default(50).min(1).description("Maximum number of projects listed in the Workshop UI before older ones roll off.")
});
// ⚠️ 注意：`interface Config`（那个说?projectsDir/maxListedProjects 长什么样的类型）
//    在这?*完全消失?*。因?interface 是「纯类型」，编译后不存在任何代码?//    但它出现?lib/index.d.mts 里（?TS 消费者看）。两者的区别后面细说?
//#endregion


// ############################################################################
// ?3 组：来自 src/types.ts
// ############################################################################

/** 工序的权威顺序表。`CraftStore.advance()` 靠在这个数组上取下标来判?*  「下一道是哪道」，所以想新增一道工序，只能往这里加一项?*/
// 六道工序的顺序表?//
// ⚠️ 源码里写的是 `as const`（只读字面量元组），这里变成?*普通数?* —?//    因为 as const ?*类型层面?*约束：它只告诉编译器「别让我改这个数组」，
//    运行时它就是个普通数组，谁都?STAGE_ORDER.push(...)?//    这是 TypeScript 的一贯特点：**类型信息编译后一点不?*?//
//    源码里还?`readonly Stage[]` 标注 —?也一样消失了。同理，
//    Stage、StageStatus 这两个联合类型整个不见踪影?
const STAGE_ORDER = [
	"interview",
	"design",
	"tasks",
	"generate",
	"verify",
	"deliver"
];
function isValidPluginName(name) {
	if (name.length < 2 || name.length > 63) return false;
	return /^[a-z][a-z0-9-]*[a-z0-9]$/.test(name);
}
function buildInitialStages() {
	return STAGE_ORDER.map((stage, index) => ({
		stage,
		status: index === 0 ? "gate" : "pending"
	}));
}
const UTF8 = "utf-8";
var CraftStore = class {
	baseDir;
	maxListed;
	configure(baseDir, maxListed) {
		this.baseDir = resolve(baseDir);
		this.maxListed = maxListed;
	}
	dirFor(pluginName) {
		if (!isValidPluginName(pluginName)) throw new Error(`invalid plugin name: ${pluginName}`);
		return join(this.baseDir, pluginName);
	}
	async writeJson(path, body) {
		await mkdir(dirname(path), { recursive: true });
		const tmp = `${path}.tmp`;
		await writeFile(tmp, JSON.stringify(body, null, 2), UTF8);
		await rename(tmp, path);
	}
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
	async get(pluginName) {
		return this.readProject(this.dirFor(pluginName));
	}
	async create(input) {
		if (!isValidPluginName(input.pluginName)) throw new Error("pluginName must match /^[a-z][a-z0-9-]*[a-z0-9]$/ (2-63 chars, lowercase start, alphanumeric end)");
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
	async appendInterview(pluginName, field, value) {
		const dir = this.dirFor(pluginName);
		const project = await this.readProject(dir);
		if (!project) throw new Error(`project "${pluginName}" not found`);
		const now = (/* @__PURE__ */ new Date()).toISOString();
		const updated = {
			...project,
			updatedAt: now,
			interview: [...project.interview, {
				field,
				value,
				capturedAt: now
			}]
		};
		await this.writeJson(join(dir, "project.json"), {
			version: 1,
			project: updated
		});
		return updated;
	}
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
				description: "Lowercase plugin id, e.g. \"device-scanner\". Becomes the project key on disk, so it must match /^[a-z][a-z0-9-]*[a-z0-9]$/."
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
				required: true,
				description: "The project to advance, as returned by craft.create_project."
			},
			decision: {
				type: "string",
				required: true,
				description: "\"accept\" to move to the next stage, \"revise\" to stay put and rework the current one."
			},
			feedback: {
				type: "string",
				description: "What the user wants changed. Only meaningful with decision=\"revise\"; it is not persisted between sessions."
			}
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
				required: true,
				description: "The project the requirement belongs to."
			},
			field: {
				type: "string",
				required: true,
				description: "Question id used as the requirement key, e.g. \"mainFeature\"."
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
export { Config, apply, inject, name };

/** 磁盘上项目键的校验器，它同时就是目录名?*
* 这是一?*安全边界**：名字会?`CraftStore.dirFor()` 直接拼到项目根目录上?* 所以一个含 `/` ?`..` 的名字就能让项目读写到配置根目录之外?*
* 规则?~63 个字符；小写字母开头；小写字母或数字结尾；
*      中间只能是小写字?/ 数字 / 连字符?*/
// 插件名校验函数。返?true = 合法，false = 不合法?// （以 is/has 开头且返回布尔值的函数，英文叫「谓?predicate」，
//  这个命名惯例是国际通行的，代码里一眼能看出它不是干别的的。）
 // 先卡长度? 个字符起?3 个字符封顶?	// 太短没意义，太长在某些文件系统上有麻烦?	// `||` = 或者。只要任一条件成立就进这个分支?
	// 形状规则。返回的是一?*正则表达式的测试结果**?	//
	// 【正?/^[a-z][a-z0-9-]*[a-z0-9]$/ 逐段拆解?	//   开头的 / 和结尾的 /  = 正则的分隔符，里面才是规则本?	//   ^  = 锚点，要?*从这里开?*（否?"xx-foo" 前面带别的东西也会通过?	//   [a-z]   = 一个小写字?	//   [a-z0-9-] = 一个小写字母、数字或连字?	//              （连字符必须写在**最?*，写在中间会被当成「范围符号」，
	//               变成匹配 a ?z? ?9 之间的所有字符）
	//   *  = 前面这一?*重复 0 次或多次**（所以能匹配 "foo"?foo-bar"?f-1-2"?	//   [a-z0-9] = 再要一个小写字母或数字
	//   $  = 锚点，要?*到这里结?*
	//   读作：「小写字母开??若干个小写字?数字/连字??以字母或数字结尾?	//
	//   举例?	//     "foo-bar"   ?a 开头，中间?- 合法，以 r 结尾
	//     "-leading"  ?第一个字符是 - 不是小写字母
 //     "trailing-" ?最后一个字符是 - 不是字母或数?	//     "Has-Caps"  ?H 是大?	//   最后那?[a-z0-9]$ 就是专门用来?"trailing-" 这种以连字符结尾的?

/** 给刚创建的项目铺一条默认进度条：第 1 道是 `gate`（关卡）?*  后面的全?`pending`（还没走到）?*/
// 铺进度条的函数?
	// 【map 是什么?	//   Array.prototype.map = 把数组每一项按某个规则变成新的一项，返回**新数?*?	//   原数组不动。举例：[1,2,3].map(x => x * 2) ?[2,4,6]
	//
	// 【回调函数里的两个参数?	//   (stage, index) => ({ ?
	//     ?      ?     └── 这个函数**返回什?*，就会成为新数组的一?	//     ?      └───────── index：这一项在原数组里的下标（0,1,2…）
	//     └───────────────── stage：这一项的值本身（'interview' 等）
	//
	// 【箭头函?=>?	//   JavaScript 特有的简写，等价?function(参数) { return ?}?	//   不需要写 function 关键字，所以特别适合「只干一件事」的短回调?	//   源码里写的是 map((stage, index): StageView => ({ ?}))?	//   那个 `: StageView` 是返回类型标?—?编译后消失了?	//
 // 【小括号是必须的?	//   箭头函数返回**对象字面?*时必须包一?( )?	//   否则 { 会被当成「函数体开始」，而不是「要返回的对象」?	//   这就是为什么你看到的是 `=> ({ ?})` 而不?`=> { ?}`?
		// 三元运算符：`条件 ? 真?: 假值`
  // 只有?1 道（index === 0）开局就是关卡，因为所有新项目都落在访谈这一道?		// 后面的先摆成 pending，等 store.advance() 推进到它?		// 才会?isAutoStage() 的判定改?auto ?gate?
//#endregion


// ############################################################################
// ?4 组：来自 src/store.ts
// ############################################################################

// 文件编码常量。提出来是为了只写一次?// 源码里是 `const UTF8 = "utf-8"`?// ⚠️ 为什么要显式指定编码？因?Node 默认?utf-8，但显式写出来是好习?—?//    ?Windows 上某些老工具链的平台默认编码是 GBK，不指定就可能写出乱码?//    本项目的测试里专门有一条用例塞中文来验证这件事?

/** 工坊的宿主端落盘层?*  *
*  * 它独?`<projectsDir>/<pluginName>/project.json` 的所有读和写?*  * 由宿主的 `apply()` new 出唯一实例，并?`ctx.craft` 的名字暴露出去?*  *
*  * ?`node:fs/promises` 而不是抽象文件系统接缝的原因：工坊写的是配置里指定的
*  * 工作区目录，本来就在任何沙箱视图之外；直接用 fs 能白?tmp+rename 的原子写?*/
//
// ⚠️ class 变成?`
	// ⚠️ 下面这两行是**字段声明**，运行时什么都没有（值是 undefined）?	//    源码里写的是 `private baseDir!: string` —?那个 `!` 是「我保证会赋值?	//    的断言（definite assignment assertion），
	//    告诉编译器「别报『未初始化』，我会?configure() 里填」，
	//    运行时一点痕迹都不留?	//    而且 `private` 关键?*也消失了** —?TypeScript ?private 只是编译期约束?	baseDir;

	/** 接线，由 `apply()` 调用：文件写到哪、列表最多返回几条?	*  *  立刻 resolve 成绝对路径，防止之后有人 `process.chdir()` 把项目搬走?	*/
 // configure(目录, 上限) —?由宿主的 apply() 调用一?
		// resolve(baseDir) = 把相对路径转成绝对路径?		// 为什么要立刻做？因为 Node 的「当前工作目录」是会变?		//（有人调 process.chdir() 就变了）。存绝对路径就免疫这个问题?		// 例：resolve('C:\Users\Administrator\.dsh\myfile') ?'C:\Users\Administrator\.dsh\myfile' （严对路径下去去，解析出来一样）
		// `this` = 「调用这个方法的那个对象」。这里是?new 出来?store 实例?

	// 拼出某个项目的目录，同时做路径穿越防护?	// ⚠️ 源码里是 `private dirFor(...)` —?private 消失了，但方法还在，
 //    所以别的代?*照样?* store.dirFor(...) 调用它（虽然不该）?
		// 先过一遍安全校验。不合法就直接抛错，绝不往下走?		// ⚠️ 这是整条防线的关键：pluginName 会被 join ?baseDir 上，
		//    如果它能?"../../.ssh"，项目就写到配置根外面去了?		// `throw` = 立刻抛出一个错误，中断当前函数?		// 反引?`` 是模板字符串，可以在字符串里直接嵌变量，
  // ?"invalid plugin name: " + pluginName 方便?
  // join = 拼接路径，自动处理分隔符?

	// 原子写：写临时文?+ 改名
		// 【async 是什么?		//   async 标记「本函数里有 await」，于是它返回的**不是**函数体结果，
  //   而是一?Promise（一个「将来会给结果」的信封）?		//   调用方必?await 才能拆开信封拿到真正的值?		// 【递归建目录?		//   { recursive: true } = ?mkdir -p，一次建出整条父目录链?		//   例：?C:\work\foo\project.json 时，foo 不存在也会自动建出来?
  // 先写到一个带 .tmp 后缀的临时文件?		// 模板字符串拼接：path 后面接字面量 ".tmp"?
		// writeFile(路径, 内容, 编码)
		// JSON.stringify(body, null, 2) = 把对象转?JSON 文本?		//   第一个参?body = 要转的对?		//   第二个参?null  = 不做「只转指定字段」的筛选（全转?		//   第三个参?2     = 缩进 2 个空格（?null 就不缩进，全挤一行）
  // 用缩进是为了让人能直接打开 project.json 看内容，出问题时好排查?
		// rename(旧名, 新名) —?在同一磁盘内这?*原子操作**?		// 要么完全成功，要么完全没发生，中间不存在「半个文件」的状态?		//
		// 【这才是「原子写」的意义?		//   如果直接 writeFile(path, ?，写到一半进程崩?/ 断电了，
		//   磁盘上就剩一?*被截断的 JSON**，下次读直接解析失败，项目报废?		//   改成「先?.tmp 再改名」之后：
		//     · 崩在 writeFile 阶段 ?磁盘上只有那个完整的 .tmp，真正的 .json 没动
		//     · 崩在 rename 阶段     ?改名是原子的，要么改完要么没?		//   所以永远读到一?*完整**?project.json?		await rename(tmp, path);

	// 读一个项目文件。⚠?源码里是 private readProject(dir)
  // join(dir, "project.json") = 拼出这个项目的配置文件路径?		// 约定每个项目一个目录，project.json 放在里面?
   // try = 「试着执行下面这段，出错就跳到 catch」?			// readFile(路径, 编码) ?返回文件内容的字符串?
   // JSON.parse(文本) ??JSON 文本变回对象?			// ⚠️ 这一行是整个 store 里最脆弱的地方：文件被截?/ 被人手改坏了?			//    这里就会?SyntaxError。它能被 catch 兜住（见下）?			//    但会被当成「文件不存在」之外的情况重新抛出去?
   // 【版本号信封?			//   落盘的不?project 本体，而是 { version, project } 两层套娃?			//   好处：以后改数据结构要迁移时，可以靠 version 号区分新旧格式?			//   version 不是 1，或者里面没 project ?当成不认识，返回 null?
			// catch 接住 try 里抛出的任何错误，放?err 里?			// 【ENOENT 是什么?			//   Node 的错误码：Error NOENT = "No such file or directory"
			//   也就是「文件不存在」。这是最常见、也最不需要报警的情况
   //   （项目还没建 / 已经删了），所以特殊处理成「返?null」?			//   `&&` = 而且。前后两个条件都要成立?			//   ⚠️ 为什么要?`err &&`？因?JS 允许抛出?Error 的东?			//   （throw "字符?），那样 err.code 会直接报错?			//   先确?err 是个对象，再取它?code?
			// 其他错误（权限不足、JSON 坏了、磁盘满了…）原样抛出去?			// **不吞?* —?吞掉的话你会看到一个「项目凭空消失」的现象?			// 根本不知道底下出了什么事?			throw err;

	// 把完整项目裁剪成「列表页精简行」。⚠?源码里是 private meta(p)
	// p = 完整项目对象
		// 【对象字面量简写?		//   `id: p.id` 这种「字段名和取值变量同名」的情况可以缩写?`id`?		//   源码写的是完整形式，打包器顺手压短了?		// ⚠️ 关键：这?*只挑 6 个字?*出来，故意丢?interview/design/tasks
		//    这三样重量级自由文本。列表页要一次画 N 行，
		//    每行都带全文会浪费内存、拖慢跨进程传输?		return {

	/** 列出所有项目，最近改的排前面，最多返?`maxListed` 条?	*  *  上限只截断返回的列表，项目本身照样留在磁盘上，用 get() 照样能取到?	*/
 // 列出所有项目?
  // let = 可以重新赋值的变量声明。为什么要 let?		// 因为下面 try 里要赋一次、catch 里可能提?return?		// ?const 的话初始化和赋值得分两步，很别扭?
   // readdir(目录) ?列出这个目录下的所?*名字**（字符串数组）?			// ⚠️ 它只给名字，不判断是文件还是目录，也不递归?			//   这正是本 store「纯靠遍历目录找项目」的基础 —?			//   没有任何内存注册表，进程重启也不影响?
   // 项目根目录本身还不存在（比如插件刚装上还没建过项目）?返回空列表?			// 这是「正常状态」，不是错误?
  // const = 声明后不能重新赋值（但对?数组的内容可以改）?
  // for...of = 「逐个遍历数组里的项」?		// 比传统的 for (let i = 0; i < arr.length; i++) 好读得多?		// 不用手写下标、不用担?off-by-one?
   // join = 拼出这个项目自己的目?
   // ⚠️ 逐个 await（串行），不?Promise.all 并发?			//   项目数量?maxListed 限制，通常几个到几十个?			//   串行的等待时间可以接受；换成并发反而要处理部分失败的复杂情况?
   // 读不出来（不是项?/ 格式不认识）就跳过，不进列表?
		// 【sort 的排序函数怎么读?		//   sort((a, b) => 数字)
		//   规则?*返回负数 = a 排前面，返回正数 = a 排后面，返回 0 = 不动**?		//   这里是「按 updatedAt 从新到旧」：
		//     a ?b 旧（字符串比较小）→ 返回 1 ?a 往后排
		//     a ?b ?             ?返回 -1 ?a 往前排
		//   ISO 8601 字符串是「字典序 = 时间序」，所以直接比字符串就行，
  //   不用?new Date() 转成时间戳?
		// slice(起点, 终点) = 复制数组的一段，不改原数组?		// 【重要】上限只截断「返回的列表」，项目本身照样留在磁盘上，
  //        ?get() 按名字照样能取到。这不是删除?

	/** 按插件名（用户可见的 id）取单个项目，不存在时返?`null`?	*/
 // 取单个项?
  // 一行搞定：dirFor 拼路径（顺便做安全校验），readProject 读文件?

	/** 凭一句模糊需求开一个新项目?	*  *  一律落?`interview` 关卡。名字不合法或已被占用都直接拒绝?	*  *  绝不覆盖已有项目的数据?	*/
 // 创建新项?
		// ⚠️ 为什么这里又校验一遍，dirFor 里不是已经校验了吗？
		//   因为两处?*报错信息不一?*?		//     · dirFor 里的 ?"invalid plugin name: xxx"（给内部调用方看?		//     · 这里         ?完整说明了格式要求（给用?/ 模型看，更友好）
  //   工具被模型调用时，用户看到的是这一条?
		// 【防覆盖检查?		//   如果已经有一个项目了，直接拒绝?		//   ⚠️ 这一条很重要：如果允许重?create，用户已经收集的全部访谈需?		//   会被一次「创建」悄悄抹掉，而他完全不会察觉
  //   （他会以为需求还在，其实整个文件被换掉了）?
		// new Date() = 当前时间对象?toISOString() = 转成 ISO 8601 字符串?		//
  // ⚠️ `/* @__PURE__ */` 这个奇怪的注释?*打包器加?*?		//    告诉 minifier「这?new Date() 没有副作用，可以安全删掉」?		//    你可以理解成「这里标了记号，看代码时忽略它」?
  // 造出项目对象。⚠?源码里这个对象带 `: Project` 类型标注?		//    编译后完全消?—?运行时它就是个普通对象，字段对不对全靠人守?
  // 先把目录建出来（万一后面写文件失败，至少目录已经在那儿）?
  // 套上 version 信封再原子写?		// ⚠️ 源码这里写的?{ version: 1, project }? 被内联成了字面量 1?
  // 源码写的?`return project satisfies Project`?		// satisfies 是「检查但不改变类型」的运算?—?		// 它验证这个对象确实符?Project，但**?*把类型窄化成 Project?		// 所以它编译后一点痕迹都不留?

	/** 往前推进一道工序（`accept`），或原地不动并清掉 `accepted`（`revise`）?	*  *
	*  * `deliver` 是终点：多调?`accept` 会被夹住，不会冲?STAGE_ORDER 尾部?	*  *
	*  * ⚠️ `decision.feedback` 收下了但不落盘，撑不过一次会话重启?	*/
	// 推进一道工?—?整个 store 里最核心的逻辑
		// 项目不存在直接报错。（注意：这里和 create() 不一样，
		// create 里有「已存在就拒绝」，这里有「不存在就拒绝」）
		// indexOf(? = 在数组里找这个值的位置（下标），找不到返回 -1?		// 例：STAGE_ORDER.indexOf('tasks') ?2
		// ---- 分支 A：revise（原地返工）----
   // 改一下最后修改时间（让列表页把它排到前面?
			// 取消「已认可」标记，回到未认可状态?			project.accepted = false;
			// 写盘
			// ⚠️ 关键：nextStage 就是**当前** stage，工序一点没动?			//   这就?revise ?accept 的根本区别?			// ⚠️ 注意 feedback **没有**被写进任何地?—?			//   persona 预期助手在当次对话里就把它消化掉，所以不落盘?			//   代价：撑不过一次会话重启。这是已知取舍?			return {
		// ---- 分支 B：accept（往前走一道）----
		// 【终点夹取】Math.min(a, b) = 取较小的那个?		//   currentIndex + 1 = 下一道的下标
  //   STAGE_ORDER.length - 1 = 最后一道的下标??		//   取两者较???deliver 上再?accept，index 还是 5，不会冲出去?		//   ⚠️ 如果没这个夹取，nextIndex 会变?6?		//      STAGE_ORDER[6] 就是 undefined，然后整个下游全崩?
		// slice() = 复制一份数组（不给参数 = 全部复制）?		// ⚠️ 为什么要复制？直接改原数组会就地修改 project.stages?		//   这里是「不可变更新」：造新对象 ?改新对象 ?存新的，
  //   原对象保持不动，万一中间出错不会留下改了一半的脏数据?
  // 定义一个「给某道工序打状态标签」的局部小函数?		// ⚠️ 它是普通函数不是箭头函数，因为源码里要引用外层?stages?		// 【markStage 是什么?		//   = 修改标记。找到那一格，把它?status 改掉?		//   找不到（idx < 0）就什么都不做 —?宁可漏改，也不能凭空加一格?
   // findIndex = 找出第一个符合条件的**下标**，找不到返回 -1?			// 回调 (s) => s.stage === stage = 「这一格是不是我要找的那道工序?
   // `>= 0` = 「找到了」。因?-1 是「没找到」的哨兵值?
				// 【展开运算?...?				//   ...stages[idx] = 把原来那一格的所有字?*原样复制**过来?				//   然后再覆盖你显式写的字段?				//   这是 JavaScript 里最常用的「改对象但不破坏原对象」的写法?				//   打个比方：复印一份，然后在复印件上改，原件不动?				...stages[idx],
  // 离开的那??标完?
		// 落下的那??标「自动」或「关卡」，?isAutoStage() 决定
		// 造出更新后的项目对象?		// ⚠️ 注意 ...project 在前、显式字段在?—?**顺序很关?*?		//    后面的会覆盖前面的。如果把 ...project 写在最后，
  //    它会把上面所有改动全盖回去，就白改了?
   // 到了 deliver 才算「完成?
  // 写盘。⚠?源写的?project: updated —?shorthand 在这里不适用?		//   因为字段名叫 project、值叫 updated，名字不一样，必须写全?
		// 回执
   // 「不自动? 需要用户点一下?			//   这里是唯一?isAutoStage() 反推 awaitingGate 的地方?

	/** 往需求列表追加一条。刻意的只增不改：访谈始终是一条可信的审计轨迹?	*/
 // 追加一条访谈需?
  // 只取一次当前时间，?updatedAt ?capturedAt 完全一致?		// ⚠️ 之前这里调了两次 new Date()，跨秒时会不一致?		//   「这条需求在 X 时刻被记录」和「项目在 X 时刻被改」应该是同一件事?
			// 【追加一个新数组，而不?push 到原数组?			//   [...原数? 新项] = 「把原数组的项都复制过来，再接上一项?			//   例：[1,2] 追加 3 ?[1,2,3]
   //   ⚠️ 为什么不直接 project.interview.push(...)?			//      因为那样?*就地修改**原对象，破坏「不可变更新」原则?			//      万一后面 JSON.stringify 失败，内存里的对象已经被改脏了?

	/** 整段覆盖?2 道工序的设计稿。不追加 —?只有最新一版有意义?	*/
 // 设置设计?
		// 【三个「取-?存」方法的共同骨架?		//   dirFor ?readProject ?判空 ?造新对象 ?writeJson ?返回
		//   抽出来看只有三步，但每一步都不能少：
		//     · 少了 dirFor 就没有安全校验（路径穿越?		//     · 少了判空，项目不存在时会写出一?null，后续全?		//     · 少了 writeJson，内存改了盘上没改，重启就丢
			// ⚠️ 这里没有?updatedAt 之外的东西，就是「整段覆盖」：
			//    design 字段被整个换成新传进来的文本，旧内容不留?			//    ?appendInterview 的「只增不改」是两种不同策略?			//      · 访谈 = 历史事实，不能改
			//      · 设计?= 当前状态，新版直接盖掉旧版

	/** 整段覆盖?3 道工序的任务清单?	*/
 // 设置任务清单 —??setDesign 结构一模一?

	/** 递归删掉一个项目及其整个目录。删不存在的项目是空操作，不是报错?	*/
	// 删除项目
		// rm(路径, 选项)
  //   recursive: true = 连子目录一起删（不写这个，删非空目录会?ERR_FS_EISDIR?		//   force: true     = 目标不存在时?*不报?*，直接成功返回?		//                     这就是「删不存在的项目是空操作」的来源?		//                     删两次、或者删一个从没建过的名字，都不会抛错?
		// ⚠️ 源码标注的返回类型是 Promise<void>，所以这里没?return?		//    JS 函数不写 return 就默认返?undefined?		//    和「声明了要返?void」正好对上?		//    如果源码里写?return，会?tsc 拦下来（void 类型不能有返回值）?

/** 哪些工序是「自动」的 —?AUTO/GATE 划分的唯一真相源?*/
// ⚠️ 源码里这?`function isAutoStage(stage: Stage): boolean`?//    stage: Stage ?: boolean 都是纯类型标注，编译后全部消失?//    所以运行时你看到的就是一个普通函数，参数什么都不校验?//    「只接受 Stage 类型」这件事只对?TypeScript 的人有效?
 // || = 或者。三道工序是自动的，其余（interview/design/deliver）是关卡?	// ?|| 串起来比写三个独立的 return 简洁?
//#endregion


// ############################################################################
// ?5 组：来自 src/index.ts —?插件入口
// ############################################################################

/** 插件 id。必须与 cordis.patch.yml 第一行的 name、package.json ?name 三处一?—?宿主靠这个字符串把配置行和代码模块对上?*/
// 插件 id。这三处（cordis.patch.yml / package.json / 这里）必须完全一致，
// 少一处插件就加载不上 —?这是 DSH 插件最容易踩的坑之一?

/** 依赖的宿主服务清单。ctx.tools 没就绪时本插件不激活；它消失时本插件被自动卸载，服务回来自动重载?*/
// 依赖声明。声明了 "tools" 意味着?//   · ctx.tools 还没就绪时，本插件不会激活（会一直等?//   · 之后 ctx.tools 一旦消失，本插件被自动卸载
//   · 服务回来时自动重?//
// ⚠️ 源码写的?`['tools'] as const`，这里变成了普通数?["tools"] —?//    as const 是类型层约束，运行时就是个普通数组?

/** 插件激活入口：算出项目目录、把 store ?`ctx.craft` 发布出去、再注册三个工坊 Chat 工具?*  *
*  * `ctx.effect()` ?Cordis 强制的注册接缝：它返回的东西会在卸载时自动销毁?*  * 重载时自动重跑，所以绝不要自己?removeListener / clearInterval 手动收尾?*/
// 插件激活入口。宿主加载插件时调用，且**只会调一?*?// 【apply 是什么】Cordis 框架的约定：每个插件导出一?apply 函数?//   框架启动时调用它来做初始化。你可以理解成「插件的 main 函数」?
	// 源码第一行是解构：const { projectsDir, maxListedProjects } = config
	// 【解构?	//   从一个对象里把几个属?*一次性拆成独立变?*?	//   效果等价于：
	//     const projectsDir = config.projectsDir
	//     const maxListedProjects = config.maxListedProjects
 //   打包器发现后面每次都?config.projectsDir 很长?	//   干脆自己做了这个优化 —?这就?*产物和源码长得不一?*的常见原因?	//   产物里还能看到，是因为下面第 2 ?configure 传的?config.maxListedProjects?	//   打包器只在收益够大时才做这种改写?
	// 【上面这一行长三元怎么读，从里往外拆?	//   条件 A = config.projectsDir.startsWith("/")
	//          = 是不是以 / 开头（这是 **Linux/macOS 绝对路径**的特征）
	//   条件 B = /^[a-zA-Z]:[\\/]/.test(...)
	//          = 是不是像 "C:\" ?"D:/" 这样（这?**Windows 绝对路径**的特征）
	//          这个正则的意思：一个小写或大写字母 + 冒号 + 一个斜?	//          例：'C:\\Users' ?  'D:/games' ?  'projects/foo' ?	//   A || B = 「看起来是绝对路径?	//
	//   三元运算符：`条件 ? 是绝对路径就原样?: 否则当成相对路径?resolve`
	//   条件成立 ?直接用用户写的路?	//   条件不成??第二个参?= resolve(基准目录, 相对路径)
	//       process.env.DSH_HOME = 读环境变?DSH_HOME（DSH 的数据根目录?	//       || "." = 如果这个环境变量**不存?*（是 undefined），就用 "."（当前目录）
	//       resolve(".", 'projects/foo') ?把相对路径接到基准目录后?	//   例：DSH_HOME=C:\Users\你\.dsh，配置写 'C:\Users\Administrator\.dsh\myfile'
	//     ?resolve 之后 = 'C:\\Users\\你\\.dsh\\projects\\dsh-plugin-craft'
	//
	//   ⚠️ 为什么要先判断绝对路径？
	//      因为绝对路径的基准就是它自己?	//      如果不判断硬?resolve('C:\Users\...', 'C:\Users\...')?	//      结果会变?C:\Users\...\C:\Users\... 这种荒唐拼接?	//
	// ⚠️ store 是文?*最末尾**声明的那?const（见下），但函数体里能提前用它?	//    这是因为 apply() 是等到宿主调用时才执行的，那时整个模块已经加载完毕?	//    （如果是模块顶层立刻执行，就会报错「变量未定义」。）

 // 告诉 store：项目存在哪、列表最多列几个?

	// 【把 store 挂到 ctx 上，让别的插件能?ctx.craft 拿到它?	//   ctx.effect(函数, 名字) = Cordis 框架的「注册接缝」：
	//     它接收一个「建?销毁」用的函数，并记住这个名字?	//     · 插件正常运行??调用这个函数，建立资?	//     · 插件卸载 / 重载??框架自动调用它返回的清理函数，销毁资?	//   ⚠️ 所?ctx.effect 里的函数可以 return 一个「清理函数」，
 //      框架会在合适的时机自动调它?	//   所?*绝不?*自己?removeListener / clearInterval 手动收尾 —?	//   那样重载时资源会泄漏（越积越多，最后崩）?	//   第二个参?'dsh-plugin-craft: store' 是这段资源的名字?	//   出问题时日志里能靠它定位是谁没清理干净?
	// ?ctx.provide(名字, ? = 「往 ctx 上挂一个服务」?	//   挂了之后，别的插件写 ctx.craft 就拿到这?store 实例?	//   为什么本插件自己?import 就能?ctx.craft?	//   因为 TypeScript 那边?declare module 做了「类型补丁」，
	//   告诉编译器「Context 上有 craft 字段」。运行时靠的?Cordis 的依赖注入?
	// ========================================================================
	// 工具 1：craft.create_project
	// ========================================================================
	// 【Chat 工具是什么?	//   一个工?= 一份「说明书? 一个「执行函数」?	//   模型读说明书决定什么时候调、怎么传参；Node 调执行函数真的干活?	//   defineTool(...) 把这两部分包成标准形状，
	//   之后**自动**出现在模型的可用工具列表里（不用去别处登记）?	//
 // ⚠️ 本文件里所?description 字符串都?*英文，而且绝对不能翻译** —?	//    它们是发给模型看的功能说明。翻译成中文会改变插件行?	//    （模型对中文的理解和对英文的权重不一样，可能导致调用时机改变）?	//    output.render 里的文案同理 —?那是用户实际看到的字?
		// 工具名。约定用「插件名.动作名」，防止和别的插件撞名?		name: "craft.create_project",
  // 给模型看的说明书：这个工具什么时候该用?
		// 【parameters = 参数说明书?		//   告诉模型「这个工具要收什么参数、每个参数是什么类型、必填还是可选」?		//   模型就是照着这张表填参数的?		parameters: {
				// ⚠️ 注意 required ?description 之间的逗号在产物里被压成了一行?				//    源码里是每个字段各占一行，产物里换行没?—?运行时毫无意义?			},
		// 【output = 输出说明书?		//   告诉模型「这个工具会返回什么?「怎么把这些结果显示给人看」?		output: {
			// schema = 返回值的结构定义（JSON Schema 格式，和 Web API 通用?			schema: {
			// render = 「把返回值渲染成人能看的文字?			//   (_args, value) => [{ type, text }]
			//     ?1 个参?_args = 调用参数。这里用不到?			//       所以写?_ 开头表示「故意不用」—?这是社区惯例?			//     ?2 个参?value  = 工具的返回值?			//     返回值是「一个或多个内容块」的数组?			// ⚠️ render 的文案是**用户实际看到的字**，不能翻译?			render: (_args, value) => [{
				// ?模板字符串：?value 里的实际值嵌进句子?			}]
  // 【execute = 真正干活的函数?		//   模型决定调用时，Node 调这个函数?		//   async 表示异步，必?await 才能拿到结果?
			// String(x) = 强制转成字符串?			// ⚠️ 为什么要转？因为 args 是模型给的，类型只在说明书里「约定了」，
			//    运行时没人检查。模型万一传了个数字进来，
   //    不转的话后面 join() 拼路径会直接炸?			//    这是「防御模型输出」的标准做法?
			// 【返回值的两个设计?			//   · 只返回「模型接下来用得上的字段」，不把整个项目倒出?			//     （省 token，也避免模型误改?			//   · pluginName ?project.pluginName（store 返回的）
			//     而不?args.pluginName（模型传的）
			//     —?以服务端实际存下来的为准

	// ========================================================================
	// 工具 2：craft.advance_stage
	// ========================================================================
	// 结构和工作 1 一模一样，只有业务含义不同。逐字段差异：
			// ⚠️ 这个参数**没有** required 字段 = 可选?			//    打包器把「缺少某个键」当?undefined，不报错?			feedback: {
     // ?这里?boolean 类型 —?告诉模型「这个字段是真假值?					//    而不是字符串。类型写错会误导模型的判断?
				// ⚠️ 【白名单校验】这里有一处很值得学的写法?				//   args.decision === "revise" ? "revise" : "accept"
				//   意思是?*只有**等于 revise 才当 revise，其他任何值一律当 accept」?				//
				//   为什么这样写？模型可能传出预料之外的?				//   （比?"ACCEPT"?"、null、甚至编一?"skip"）?				//   如果直接 `decision: args.decision`?				//   一个意外的值就会让 advance() 走到 accept 分支 —?静默推进?				//   用户根本不知道发生了什么?				//   用白名单写法，任何异常输入都退回到最安全的默认行为?				//
    //   通俗讲：这叫?*只信我认识的那几?*」?
				// 【可选参数的处理?				//   args.feedback ? String(args.feedback) : void 0
				//     = 如果有值就转成字符串，没值就?undefined
				//   void 0 = 「明确的 undefined」。写 undefined 也一样，
    //   ?void 0 不会被变量覆盖，是社区惯用写法?

	// ========================================================================
	// 工具 3：craft.appendinterview
	// ========================================================================
					// ?这个工具多返回一?total 字段：目前一共收集了几条需求?					//    返回累计数，模型才能在话里说「已经记?3 条了」，
					//    不用自己数（它数不准）?					total: { type: "number" }
				// ?注意这里有个箭头符号 →，是给用户看的分隔符，
				//    读起来像「这条需求归到了某个需求项下」?				//    中间还会回显用户实际选的那段文字（value.value），
				//    方便用户确认「记的是这条没错」?			}]
			// ⚠️ 这行是整个文件里最长的一行?			//    源码里是分三行写的：
			//      const updated = await store.appendInterview(
			//        String(args.pluginName), String(args.field), String(args.value))
   //    打包器把换行和缩进都去掉了，因为运行时它们毫无意义?
				// total = 追加完之后的总条数（interview 是数组，.length 是长度）
		// ↑↑?【这里有个不一致，值得单独说?		// pluginName 用的?updated.pluginName（服务端存的），
		// ?field ?value 用的?args.*（模型传的）?		// 为什么不统一?		//   · updated.field  / updated.value 确实存在（appendInterview 存了），
		//     ?updated.interview 是个**数组**，没有直接的 field/value 字段?		//     要拿到得?updated.interview.at(-1).field —?麻烦得多?		//   · 而且这三个值本来就都是模型刚传进来的，原样回显最直观?		//   所以这里不?bug，是「取起来方便」的选择?		//   ⚠️ 但严格说，最好还是从 updated 里取，保证「回显的 = 实际存的」?		//     如果以后 store 做了什么规范化（比?trim 空白），回显就会对不上?	}));
// ⚠️ apply 结束。注意它**没有 return 任何东西** —?//    源码标注?: void，产物里自然也没?return?//    这和 store 里那?`return xxx` 的方法形成对比：
//    那些方法要把结果交回给调用方，apply 不需要?
// ⚠️ store 实例在文?*最末尾**才创建?//    为什么放在这里？源码里就写在最后一行?//    这样任何?apply() 里用?store 的代码都没问?—?//    因为 apply() 是宿主之后才调用的，那时这个 const 已经执行完了?//
//    new CraftStore() = 「用这个类造一个对象出来」?//    此刻它还?configure()，两个字段都?undefined，不能用?//    真正能用是在 apply() 调完 configure() 之后?
//#endregion


// ############################################################################
// 导出?// ############################################################################
//
// 源码里是分散?export（config.ts / store.ts / types.ts / index.ts 各写各的），
// 这里被汇总成末尾这一句?//
// ⚠️ 只有 4 个东西被导出?//    Config（配?schema? apply（入口）  inject（依赖声明）  name（插?id?//
//    注意 **CraftStore 没有被导?*，但它的**代码**确实在文件里
//    （上面那一大段
//    CraftStore，就不给它加 export，但仍保留代码（因为 apply 要用）?//
//    如果以后想让别人直接 import 这个类，
//    得在 src/index.ts 里加一?`export { CraftStore } from './store'`?// ############################################################################
