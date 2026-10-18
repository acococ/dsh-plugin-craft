// ============================================================================
// lib/index.d.mts —— 类型声明文件，逐行注释版
// ----------------------------------------------------------------------------
// 【这个文件是什么】
// 给 **TypeScript 消费者**看的说明书。里面一行可执行代码都没有，
// 全是 `interface` / `type` / `declare`，专门告诉编辑器和 tsc：
// 「这个包导出了什么、每个字段是什么类型」。
//
// 实际效果：你装了 `dsh-plugin-craft` 之后，在自己代码里
//     import type { Project } from 'dsh-plugin-craft'
//     const p: Project = ...
//     p.                    // ← 编辑器自动补全出下面那些字段，还带中文说明
//
// 【和 index.mjs 的分工】
//     index.mjs   = 真正跑起来的代码（给 Node 执行）
//     index.d.mts = 类型说明书（给 TypeScript / 编辑器看）
// 两者由同一次 `pnpm build` 一起产出，永远配套。
//
// 【本文件在 docs/ 下的原因】
// `tsdown.config.mjs` 里配了 `clean: true`，`pnpm build` 会先整个清空 lib/。
// 注释副本不能放 lib/，否则下次构建就没了。真正的产物在 ../../lib/index.d.mts。
//
// ----------------------------------------------------------------------------
// 【重要机制：`/** */` 和 `//` 哪个会活下来】
// ----------------------------------------------------------------------------
// 构建时 **只有 `/** */`（JSDoc）会被提取进这个文件，`//` 普通注释会被丢掉。**
//
// 这直接决定源码里该怎么写：
//
//     // ❌ 这样写，使用者在 IDE 里看不到任何字段说明
//     interface Project {
//       id: string // 随机 UUID
//     }
//
//     // ✅ 这样写，会进 lib/index.d.mts
//     interface Project {
//       /** 随机 UUID */
//       id: string
//     }
//
// 所以本项目的规矩是：
//   · `/** */` → 写「这个 API 是干什么的」，会随产物发布给使用者
//   · `//`    → 写「这段代码怎么实现的、为什么这么写」，只给读源码的人看
// 下面每个声明前面的 `/** 中文 */` 就是这么来的。
// ============================================================================


// ############################################################################
// 第 1 组：import 区
// ############################################################################
//
// 【import 在 .d.mts 里会保留，在 index.mjs 里有的会被删】
//   这里两行 import 都保留了，因为 .d.mts 从头到尾只在**描述类型**，
//   不产生任何运行时代码。
//   对比 index.mjs：那里的 `import { Context } from '@deepseek-ai/cordis'`
//   被整个删掉了，因为 Context 是纯类型，运行时用不到。
//
// -----------------------------------------------------------------------------
// 引入：@deepseek-ai/schemastery 的 Schema（配置声明 + 校验库）
// -----------------------------------------------------------------------------
//   注意这里 import 的是**值**（Schema 这个对象本身），不是类型。
//   打个比方：普通 TS 类型 `interface { a: number }` 只是说明文档，编译完就没了；
//   而 Schema 是一台**真正的检查机器**，你声明「a 必须是数字且不小于 1」，
//   它就真的会在运行时拦住不合法的值。
import Schema from "@deepseek-ai/schemastery";
// -----------------------------------------------------------------------------
// 引入：@deepseek-ai/cordis 的 Context（宿主上下文）
// -----------------------------------------------------------------------------
//   Cordis = 官方插件框架（底层是一个叫「cordis」的依赖注入容器）。
//   Context = 「宿主上下文」这个类型，装着宿主提供的所有服务。
//
//   它是**纯类型** import：只是告诉编译器「apply 的第一个参数长这样」，
//   运行时并不需要真的 import 什么东西。
//   写成 `import type { Context }` 更规范，但这个文件的生成器用了普通 import，
//   两者对 TypeScript 而言完全等价。
import { Context } from "@deepseek-ai/cordis";


// ############################################################################
// 第 2 组：来自 src/config.d.ts
// ############################################################################
//
// ↑↑ 这行 `//#region src/config.d.ts` 是**打包器加的**（源码里没有）。
//   它标记：下面这整段代码来自 src/config.ts。
//   作用是让人能看出产物里哪几行对应哪个源文件，排查问题很好用。
//   ⚠️ 这些标记每次构建位置可能变，不要依赖它们写逻辑。
//   注意后缀是 .d.ts 不是 .ts —— 因为这一段来自「生成的类型声明」。

/** cordis.patch.yml 里 `dsh-plugin-craft` 那一行的 `config` 块的形状。
 *
 * ⚠️ 覆盖规则：用户在 profile 里按 `id` 覆盖 bundle 行时，是**整块替换**
 * config，不做深合并。所以覆盖方必须把它需要的键全部重写一遍，
 * 漏掉的会回落到下面的默认值，而不是 bundle 里原来配的那个值。
 */
// 【interface 是什么】
//   interface 是 TypeScript 的一种「类型定义」，用来说明一个对象
//   应该有哪些字段、每个字段是什么类型。它是**纯说明文档**，编译后什么都不剩。
//   打个比方：像一张商品标签模板 —— 上面写着「名称、产地、规格」，
//   标签本身不是商品，只是对商品的描述。
//
// ⚠️ 注意它是 `interface Config` 而不是 `export interface Config` ——
//    因为这个文件末尾统一 export，前面不用重复写。
interface Config {
  // projectsDir 字段：工坊项目存放目录。类型是 string。
  projectsDir: string;
  // maxListedProjects 字段：列表页最多显示几个项目。类型是 number。
  maxListedProjects: number;
}
// ⚠️ 这两个字段**没有各自的 `/** */` 注释**，因为源码里它们用的是 `//`。
//    上面 interface 顶部的总说明已经覆盖了它们的用途。
//    （如果希望 IDE 补全时逐字段显示，得回 src/config.ts 把 `//` 改成 `/** */`。）

/** 运行时 schema 对象。宿主在加载插件时调用它校验配置。
 *
 * 必须是一个 Schema 对象，不能写普通对象 —— 这样配置写错会在「加载那一刻」
 * 直接响亮报错，而不是拖到运行时变成一个费解的错误。
 */
// `declare const Config` = 「这里有一个常量，但它的真实值在 index.mjs 里，
// 你只要知道它的类型是 Schema<Config> 就行」。
// 泛型 `<Config>`（尖括号 = 泛型参数）把这个常量和上面那个同名接口绑起来，
// 保证默认值和字段名跟接口对得上，写错字段名会直接报错。
declare const Config: Schema<Config>;
// ⚠️ 关键认知：interface Config 和 const Config **同名但不是一回事**
//   · interface Config = 编译期的类型说明，运行时不存在
//                    （你能在 index.mjs 里搜到它吗？搜不到，因为它被完全删掉了）
//   · const Config     = 运行时真正存在的 schema 对象（index.mjs 第 7 行就有）
//   TypeScript 允许同名，因为它们活在不同的「命名空间」里
//   —— 一个管类型、一个管值，就像「 结构体 Foo」和「函数 Foo」可以同名。
//#endregion


// ############################################################################
// 第 3 组：来自 src/types.d.ts
// ############################################################################

/** 工坊的六道工序，按 {@link STAGE_ORDER} 的顺序依次走过。
 *
 * AUTO（自动）工序由助手一口气跑完；GATE（关卡）工序必须用户点一下才能离开。
 */
// 【联合类型是什么】
//   写法 `type 别名 = 值1 | 值2 | 值3`，竖线 `|` 的意思是「或者」。
//   它规定：这个值只能是列出来的其中之一，写别的 TypeScript 直接报错。
//   这就是它能「挡住手滑」的价值 —— 你把 'interveiw' 拼错了，
//   保存文件时编辑器立刻标红，而不是等到线上才发现。
//
// ⚠️ 运行时它就是普通字符串。index.mjs 里对应的是 `stage: "interview"`。
//    编译时这些字面量被内联进代码，类型信息一点不留。
type Stage = 'interview' | 'design' | 'tasks' | 'generate' | 'verify' | 'deliver';
// ↑ 展开就是六个可能值：需求访谈 / 出设计方案 / 拆任务 / 写代码 / 验证 / 交付

/** 每道工序在 UI 上的状态：还没走到、正在自动跑、卡住等点击、已通过、跑挂了
 *  *（跑挂时看 {@link StageView.error}）。
 */
// 又一个联合类型。五个值对应进度条上一格的五种画法：
type StageStatus = 'pending' | 'auto' | 'gate' | 'done' | 'failed';
// ↑ pending=还没走到(灰) auto=正在自动跑(蓝) gate=卡住等点击(橙)
//   done=已通过(绿) failed=跑挂了(红)
//
// 【Stage 和 StageStatus 的区别】
//   Stage       = 「是哪道工序」→ 工序的**身份**
//   StageStatus = 「它什么状态」→ 工序的**状态**
//   进度条上的一格 = 这两者的组合。

/** 进度条上的一格 = 哪道工序 + 它当前什么状态。
 *
 * 为什么要把工序和状态打包成一个对象，而不是分成两个平行数组？
 * 因为进度条是按「格」渲染的，每格天然要同时知道这两件事。
 * 打包在一起，`store.advance()` 推进时只改那一格的字段，
 * 不会出现两个数组长度对不上、状态错位的情况。
 */
interface StageView {
  /** 哪道工序 */
  stage: Stage;
  /** 它现在什么状态 */
  status: StageStatus;
  /** 可选：只有 status === 'failed' 时才有值 */
  error?: string;
  // ↑ 问号表示「这个字段可以没有」。没有时读它会得到 undefined。
  //   所以源码里用的时候必须配可选链 ?.，否则 TS 会报「可能为 undefined」。
}

/** 访谈阶段采集到的一条需求。
 *
 * 只增不改：访谈是「用户到底点了什么」的审计轨迹，不允许事后编辑。
 */
interface InterviewAnswer {
  /** 问题的稳定 id，例如 "mainFeature"，用当前置词做键 */
  field: string;
  /** 用户点选的选项文案；用 unknown 是因为选项形态不固定 */
  value: unknown;
  // ↑ unknown = 「类型未知的万能占位」，接受任何值，但用之前必须先判断类型。
  //   它比 any 严格得多：any 会让 TS 彻底放弃检查（出了错要运行时才发现），
  //   unknown 则**强制你在使用前先缩小范围**。
  //   之所以选它，是因为访谈答案形态本来就不固定：单选(字符串)、
  //   多选(字符串数组)、开关(布尔)、自由输入(长文本)都可能有。
  //   一刀切成 string 会骗人，写 any 又丢掉所有保护。
  /** 记录时间，ISO 8601 字符串，可直接 JSON 序列化 */
  capturedAt: string;
}
// ⚠️ 时间的坑：为什么不用 Date 对象？
//   因为 Date 不能直接 JSON 序列化（会变成一个数字时间戳），
//   而且带时区信息容易在往返中丢精度。存 ISO 字符串最省心，
//   读回来时 new Date(字符串) 就能还原。

/** 单个工坊项目的完整快照，落盘位置是
 *  `<projectsDir>/<pluginName>/project.json`。
 *
 * 每个字段都必须能 JSON 序列化 —— Client 端要跨 Remote 边界收到完全相同的结构。
 */
// 这是落盘的主结构（project.json 的内容）。
// 【加字段前必须确认两件事】
//   ① 能 JSON 序列化（不能塞函数、Date、Map 之类）
//      为什么？因为 store 用「写临时文件 + 改名」的原子写法保存它，
//      临时文件写的就是 JSON 文本，塞不进 JSON 的东西会直接丢。
//   ② Client 那边能显示
//      为什么？因为这个对象要跨 Host ↔ Client 完整传过去，收不到就等于白加。
interface Project {
  /** 创建时分配的 UUID。改名也不会变，可以当稳定主键用 */
  id: string;
  /** 创建时定的名字，同时就是磁盘上的目录名 */
  pluginName: string;
  /** 用户开场那句话，比如「我想看到 NAS 健康状态」 */
  fuzzyIdea: string;
  /** 当前停在哪道工序 */
  stage: Stage;
  /** 当前这道工序的交付物用户是否已认可 */
  accepted: boolean;
  /** 创建时间，ISO 字符串 */
  createdAt: string;
  /** 最后修改时间，ISO 字符串；列表排序就靠它 */
  updatedAt: string;
  /** 访谈阶段累积的所有回答，只增不改 */
  interview: InterviewAnswer[];
  // ↑ `类型[]` = 「由这种类型组成的数组」，不是「类型有一个叫 [] 的字段」
  /** 第 2 道工序存的设计稿，自由文本 */
  design: string;
  /** 第 3 道工序存的任务清单，自由文本 */
  tasks: string;
  /** 进度条状态数组，由 buildInitialStages 初始化、由 advance 推进 */
  stages: StageView[];
}

/** 列表页用的精简行 = {@link Project} 砍掉重量级自由文本字段。
 *  列表页要一次画 N 行，每行都带上完整内容会很浪费。
 */
// 【为什么不直接用 Project 画列表页】
//   interview / design / tasks 这三样自由文本可能有几十 KB。
//   列表页要一次画 N 行，每行都带全文既浪费内存，又拖慢跨进程传输。
//   所以专门定义一个「瘦版」，只留列表真正要显示的字段。
//
// ⚠️ 代价：以后 Project 加字段时，要记得判断「列表页需不需要」，
//    需要就同步加到 ProjectMeta。**这是最容易忘的一步。**
interface ProjectMeta {
  /** 同 Project.id */
  id: string;
  /** 同 Project.pluginName */
  pluginName: string;
  /** 同 Project.stage */
  stage: Stage;
  /** 同 Project.accepted */
  accepted: boolean;
  /** 同 Project.createdAt */
  createdAt: string;
  /** 同 Project.updatedAt */
  updatedAt: string;
}

/** 用一句话需求创建新项目时的入参。
 */
// 「Fuzzy」是「模糊」的意思 —— 呼应字段名 fuzzyIdea：
// 用户开场只给一句大概的想法，具体的要靠后面的访谈工序去问清楚。
//
// 它是 store.create() 这个**公开方法的入参形状**，
// 独立成类型的好处是「创建项目需要什么」在文件里一目了然。
interface FuzzyIdea {
  /** 要用的插件名，会被当目录名，必须过 isValidPluginName */
  pluginName: string;
  /** 用户的模糊需求原话 */
  fuzzyIdea: string;
}

/** 推进决策：往前走一道（`accept`），还是原地返工（`revise`）。
 */
// 【函数签名怎么读】
//   在 store.ts 里它长这样：
//       advance(key: string, decision: AdvanceDecision): Promise<AdvanceResult>
//                 └── 参数1: 项目键      └── 参数2: 这个类型      └── 返回值
//   括号里是「进去什么」，冒号后面是「出来什么」。
interface AdvanceDecision {
  // ⚠️ 这一行**没有 `/** */` 注释**，因为源码里它是行尾 `//` 注释，被丢掉了。
  decision: 'accept' | 'revise';
  // ↑ 联合类型：只可能是这两个值之一
  /** 可选：revise 时用户说的问题描述（目前不落盘，见 store.ts） */
  feedback?: string;
}

/** 工序切换完成后 store 返回给调用方的东西。
 *  `awaitingGate` 为 true 表示刚落到的这道工序还需要用户点一下。
 */
// 「回执」= 操作完成后返回给调用方的结果。
//
// 【awaitingGate 为什么要单独返回一遍】
//   因为调用方要立刻知道「接下来要不要显示『继续』按钮」，
//   而从 project.stages 里现场找那一格很啰嗦。直接给个布尔值，一行代码搞定。
interface AdvanceResult {
  /** 推进之后的完整项目对象 */
  project: Project;
  /** 推进之后所在的新工序 */
  nextStage: Stage;
  // ⚠️ awaitingGate 同样没注释，理由同上
  awaitingGate: boolean;
}
// ⚠️ 注意：isValidPluginName 和 buildInitialStages 这两个函数**没有**出现在这里。
//    因为它们是 src/types.ts 内部用的、没有从 src/index.ts 重新导出，
//    所以不属于包的公开 API。公开 API 的判定标准 = 「index.ts 有没有 export 它」。
//#endregion


// ############################################################################
// 第 4 组：来自 src/store.d.ts
// ############################################################################

/** 工坊的宿主端落盘层。
 *
 *  *
 *  * 它独占 `<projectsDir>/<pluginName>/project.json` 的所有读和写。
 *  * 由宿主的 `apply()` new 出唯一实例，并以 `ctx.craft` 的名字暴露出去。
 *  *
 *  * 用 `node:fs/promises` 而不是抽象文件系统接缝的原因：工坊写的是配置里指定的
 *  * 工作区目录，本来就在任何沙箱视图之外；直接用 fs 能白拿 tmp+rename 的原子写。
 */
// ⚠️ 注意上面 JSDoc 里那两行「  *」开头、内容为空的行 ——
//    它们在源码里就是这么写的（我保留了原始排版）。它们不传递任何信息，
//    是排版遗留。留着无害，但如果你觉得碍眼，删掉即可。
//
// 【为什么用 .d.ts 而不是 .js 来描述它】
//   因为 .d.mts 是**声明**文件：只说「有这个类、有这些方法」，
//   不包含任何实现。对应的真实现（class CraftStore {...} 那一大段）
//   在 index.mjs 里。
//
// 【declare class 是什么】
//   声明「这里存在一个叫 CraftStore 的类」。它告诉 tsc：这个类有哪些方法、
//   每个方法收什么参数、返回什么。运行时不需要有实现 —— 实现去 index.mjs 找。
declare class CraftStore {
  // 私有字段。⚠️ 这里是「声明私有」不是「运行时私有」——
  // JS 里没有真正的私有字段（# 语法才有），别的代码照样能 store.baseDir 访问到。
  // 这个 private 只让 TypeScript 编译器在**编译期**拦住你，
  // 防止你在别的文件里乱写 store.baseDir = ...。
  //
  // ⚠️ 这里只有名字、没有类型。原因是 private 成员的签名不外泄，
  //    使用者本来就不该碰它们，声明器也就不给类型。
  private baseDir;
  private maxListed;
  /** 接线，由 `apply()` 调用：文件写到哪、列表最多返回几条。
   *  *  立刻 resolve 成绝对路径，防止之后有人 `process.chdir()` 把项目搬走。
   */
  // 公开方法 configure(目录, 上限)
  // 拆签名看：configure( baseDir: string , maxListed: number ): void
  //          名字     参数1:字符串    参数2:数字        返回:无
  // void = 没有返回值（它只是改 this.baseDir / this.maxListed 两个字段）
  configure(baseDir: string, maxListed: number): void;
  // ↓ 下面这**四个** private 方法在 .d.mts 里只有名字，没有类型和实现。
  //   它们是：dirFor（拼路径+校验）、writeJson（原子写）、
  //        readProject（读单个）、meta（裁剪成精简行）
  //   全部标 private = 使用者不该也不需要用它们。
  private dirFor;
  private writeJson;
  private readProject;
  private meta;
  /** 列出所有项目，最近改的排前面，最多返回 `maxListed` 条。
   *  *  上限只截断返回的列表，项目本身照样留在磁盘上，用 get() 照样能取到。
   */
  // 列出所有项目（最近改的排前面）
  // 返回类型 Promise<ProjectMeta[]> 怎么读：
  //   Promise = 「将来某个时间会给出一个值」，要 await 才能拿到
  //   <ProjectMeta[]> = 兑现的值是一个 ProjectMeta 数组
  list(): Promise<ProjectMeta[]>;
  /** 按插件名（用户可见的 id）取单个项目，不存在时返回 `null`。
   */
  // 取单个项目，不存在返回 null
  get(pluginName: string): Promise<Project | null>;
  // ↑ 注意 `Project | null`：可能是项目，也可能是 null。
  //   TypeScript 会**强制你在用之前先判空**，忘了就编译报错。
  //   这是好事 —— 否则就是那句经典的
  //   「Cannot read properties of null (reading 'stage')」运行时崩溃。
  /** 凭一句模糊需求开一个新项目。
   *  *  一律落在 `interview` 关卡。名字不合法或已被占用都直接拒绝，
   *  *  绝不覆盖已有项目的数据。
   */
  // 创建新项目
  create(input: FuzzyIdea): Promise<Project>;
  /** 往前推进一道工序（`accept`），或原地不动并清掉 `accepted`（`revise`）。
   *
   *  *
   *  * `deliver` 是终点：多调的 `accept` 会被夹住，不会冲出 STAGE_ORDER 尾部。
   *
   *  * ⚠️ `decision.feedback` 收下了但不落盘，撑不过一次会话重启。
   */
  // 推进一道工序
  advance(pluginName: string, decision: AdvanceDecision): Promise<AdvanceResult>;
  /** 往需求列表追加一条。刻意的只增不改：访谈始终是一条可信的审计轨迹。
   */
  // 追加一条访谈需求（只增不改）
  // 第三个参数 value 用了 unknown，理由见上面 InterviewAnswer.value
  appendInterview(pluginName: string, field: string, value: unknown): Promise<Project>;
  /** 整段覆盖第 2 道工序的设计稿。不追加 —— 只有最新一版有意义。
   */
  // 整段覆盖设计稿
  setDesign(pluginName: string, design: string): Promise<Project>;
  /** 整段覆盖第 3 道工序的任务清单。
   */
  // 整段覆盖任务清单
  setTasks(pluginName: string, tasks: string): Promise<Project>;
  /** 递归删掉一个项目及其整个目录。删不存在的项目是空操作，不是报错。
   */
  // 删除项目
  // 返回类型 Promise<void> = 返回 Promise，但兑现值是 undefined（没有数据给你）
  remove(pluginName: string): Promise<void>;
}
//#endregion


// ############################################################################
// 第 5 组：来自 src/index.d.ts
// ############################################################################

/** 插件 id。必须与 cordis.patch.yml 第一行的 name、package.json 的 name 三处一致 —— 宿主靠这个字符串把配置行和代码模块对上。
 */
// 插件 id 常量。
// `declare const name = "dsh-plugin-craft"` 里的字符串是**字面量类型**，
// 不是普通 string —— 所以它的类型是 "dsh-plugin-craft" 这个具体值，不是任意字符串。
// 好处：写 `const x: typeof name = "wrong"` 会直接报错。
declare const name = "dsh-plugin-craft";

/** 依赖的宿主服务清单。ctx.tools 没就绪时本插件不激活；它消失时本插件被自动卸载，服务回来自动重载。
 */
// 依赖的宿主服务。声明了 "tools" 意味着：
//   · ctx.tools 还没就绪时，本插件**不会激活**（会一直等）
//   · 之后 ctx.tools 一旦消失，本插件会被**自动卸载**
//   · 服务回来时自动重载
//
// 源码写的是 `['tools'] as const`，这里变成了 `readonly ["tools"]` ——
// as const 的效果被转成了「只读元组」类型。
// readonly 意味着调用方不能往里 push / delete 它。
declare const inject: readonly ["tools"];

// 【声明合并 declare module】
//   告诉 TypeScript：「@deepseek-ai/cordis 这个模块的 Context 类型上，
//   还多了一个 craft 字段」。这叫「模块增强」，是 TypeScript 官方提供的能力。
//
//   为什么要用它？
//   因为 ctx.craft 是本插件通过 ctx.provide('craft', store) 挂上去的，
//   而 Context 这个类型是**别人定义的**（Cordis 官方）。要往别人的类型上加字段，
//   就得用 declare module 这个「补丁」机制。
//
//   收益：别的插件写 ctx.craft.advance(...) 时能拿到完整类型和补全，
//         不用写 `as any` 强制断言。
//
// ⚠️ 这个块在运行时**完全不存在** —— index.mjs 里没有它。
//    它只对 TypeScript 编译器有意义。
//    这就是「别的插件能类型安全地用 ctx.craft，但运行时无需 import 本包」的原因。
declare module '@deepseek-ai/cordis' {
  interface Context {
    // ctx.craft 的类型就是 CraftStore
    craft: CraftStore;
  }
}

/** 插件激活入口：算出项目目录、把 store 以 `ctx.craft` 发布出去、再注册三个工坊 Chat 工具。
 *
 *  *
 *  * `ctx.effect()` 是 Cordis 强制的注册接缝：它返回的东西会在卸载时自动销毁、
 *  *  重载时自动重跑，所以绝不要自己写 removeListener / clearInterval 手动收尾。
 */
// 插件激活入口。宿主加载插件时调用，且**只会调一次**。
// 签名 apply(ctx: Context, config: Config): void
//   第 1 个参数 ctx    = 宿主上下文（拿到 ctx.tools、ctx.effect、ctx.provide）
//   第 2 个参数 config = 上面那个已经校验过的配置对象
//   返回 void          = 不返回任何东西
// ⚠️ 上面 JSDoc 里那两行「  *」开头、内容为空的行 ——
//    它们在源码里就是这么写的（我保留了原始排版）。它们不传递任何信息，
//    是排版遗留。留着无害，但如果你觉得碍眼，删掉即可。
declare function apply(ctx: Context, config: Config): void;
//#endregion


// ############################################################################
// 导出区
// ############################################################################
//
// 源码里是分散的 export（config.ts / store.ts / types.ts / index.ts 各写各的），
// 这里被汇总成末尾这一句。
//
// ⚠️ 导出的只有 **4 个**：
//    Config（配置 schema）  apply（入口）  inject（依赖声明）  name（插件 id）
//
//    注意 **CraftStore 没有**出现在 export 列表里！
//    但它仍然出现在本文件中（作为 declare class），
//    因为 apply 的签名要用到它、declare module 也要引用它。
//    这就是「声明文件可以包含外部可见但未导出的类型」——
//    它们服务于内部类型推导，不对外开放。
//
// 【这一点对使用者的影响】
//    别人不能写 `import { CraftStore } from 'dsh-plugin-craft'`（会报错）。
//    他只能通过 `ctx.craft` 拿到实例。
//    如果以后想让别人直接 import 这个类，
//    就得在 src/index.ts 里加一句 `export { CraftStore } from './store'`。
// ############################################################################
export { Config, apply, inject, name };
