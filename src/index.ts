// ============================================================================
// src/index.ts —— 插件入口
// ============================================================================

// ############################################################################
// 第 1 段：引入模块
// ############################################################################
//
// 【先搞懂 import 的语法】
//
//   import { 成员 } from '模块名'
//    │        │              │
//    │        │              └── 模块名：去哪儿拿
//    │        └───────────────── 要拿的具体成员
//    └────────────────────────── 「引入」命令
//
// · import  = 「引入」，把别的模块里现成的东西拿到本文件用
// · { } 里  = 你具体要拿哪几个成员
// · from '…'= 从哪个模块拿
// 打个比方：模块像工具箱，import 像你去工具箱里拿几把工具，拿回来本文件直接用。
//
// -----------------------------------------------------------------------------
// 引入 1：node:path 里的 resolve
// -----------------------------------------------------------------------------
//   node:path = Node 自带的「路径处理」模块（node: 前缀 = 内置，不用安装）
//
//   · resolve —— 把路径转成绝对路径（补上「你当前在哪个文件夹」这段前缀）
//       用在哪：把配置里的相对目录变成完整路径。
//       例子：resolve('C:/work', 'projects/x') → 'C:/work/projects/x'
import { join, resolve } from 'node:path'

// -----------------------------------------------------------------------------
// 引入 1b：node:os 里的 homedir
// -----------------------------------------------------------------------------
//   node:os = Node 自带的「操作系统信息」模块。
//
//   · homedir —— 拿到「当前用户的家目录」（Windows 上是 C:\Users\<你>，
//       macOS/Linux 上是 /home/<你>）。
//       用在哪：DSH_HOME 没设时的兜底——官方 dsh-home-paths 的解析顺序是
//       「显式配置 > $DSH_HOME > ~/.dsh」，所以这里必须拼出同一个 ~/.dsh，
//       不能退成进程当前目录（那样相对路径会落到 CWD，行为不可预测）。
import { homedir } from 'node:os'

// -----------------------------------------------------------------------------
// 引入 2：@deepseek-ai/cordis 里的 Context（纯类型）
// -----------------------------------------------------------------------------
//   @deepseek-ai/cordis = 官方插件框架本体（宿主 DSH 底下用的就是它）。
//                        @deepseek-ai/ 是官方包的组织名（类似 npm 的 @babel/）。
//
//   · Context = 「宿主上下文」这个对象的类型。
//       打个比方：Context 就是插件和宿主之间的「总机」。你想找宿主的任何能力，
//       都通过它：ctx.tools（工具箱）、ctx.provide（挂东西上去）等等。
//       因为它是**类型**不是值，所以用 import type —— 告诉编译器
//       「我只要类型，不要真的在运行时去 import 它」。
import type { Context } from '@deepseek-ai/cordis'

// -----------------------------------------------------------------------------
// 引入 3：@deepseek-ai/dsh-tools 里的 defineTool
// -----------------------------------------------------------------------------
//   @deepseek-ai/dsh-tools = 官方「定义工具」的辅助库。
//
//   · defineTool —— 定义一个「模型可以调用的工具」的方法。
//       你把工具的名字、说明、参数、返回格式交给它，它帮你包装成
//       宿主认得的格式，并自动做参数校验。
//       不直接用它的话，你得自己实现一整套工具协议，很麻烦。
import { defineTool } from '@deepseek-ai/dsh-tools'

// -----------------------------------------------------------------------------
// 引入 4：./config —— 本项目自己的配置文件
// -----------------------------------------------------------------------------
//   这两行是同一次引入的两种写法：
//   · Config         = 值（真正的 schema 对象），下面要再导出给宿主
//   · type ConfigShape= 类型（interface 的形状），给函数参数做类型标注
//   为什么要起别名？因为 interface 和 const 同名会打架，
//   所以把类型那份改名成 ConfigShape。
import { Config } from './config'
import type { Config as ConfigShape } from './config'

// -----------------------------------------------------------------------------
// 引入 5：./store —— 本项目的存储类
// -----------------------------------------------------------------------------
//   · CraftStore = 工坊的落盘类，本文件用它来存项目数据。
import { CraftStore } from './store'

// ############################################################################
// 第 2 段：插件契约的四件套
// ############################################################################
// 一个 DSH 插件对外只暴露 4 样东西，少一样宿主就认不出来。

// -----------------------------------------------------------------------------
// ① name —— 插件 id
// -----------------------------------------------------------------------------
//   宿主靠这个字符串把「配置行」和「代码模块」对上。
//   必须与 cordis.patch.yml 第一行的 name、package.json 的 name 三处一致。
/** 插件 id。必须与 cordis.patch.yml 第一行的 name、package.json 的 name 三处一致 —— 宿主靠这个字符串把配置行和代码模块对上。
 */
export const name = 'dsh-plugin-craft'

// -----------------------------------------------------------------------------
// ② inject —— 声明依赖哪些宿主服务
// -----------------------------------------------------------------------------
//   inject 是一个「等一会儿再加载我」的清单。
//   声明了 'tools' 意味着：
//     · ctx.tools 这个能力还没就绪时，本插件不会激活（宿主会等）
//     · 之后 ctx.tools 一旦消失，本插件会被自动卸载
//     · 服务回来时自动重载
//
//   打个比方：装软件前先检查「电源插上了吗」，没插就先不启动。
//
//   这里只依赖 tools 这一个：store 是自包含的（纯 node:fs），
//   所以本插件对其它插件没有任何加载顺序要求。
/** 依赖的宿主服务清单。ctx.tools 没就绪时本插件不激活；它消失时本插件被自动卸载，服务回来自动重载。
 */
export const inject = ['tools'] as const
//  ↑ as const = 告诉 TypeScript「这是个只读数组，内容就固定是 'tools'」，
//    而不是「一个 string 数组」。这是纯类型约束，运行时数组还是普通数组。

// -----------------------------------------------------------------------------
// ③ Config —— 把配置 schema 再导出一次
// -----------------------------------------------------------------------------
//   宿主是**按名字**找这个 Config 导出的。
//   · 写成普通对象 → 宿主会拒绝
//   · 配置值不合法 → 加载期直接响亮报错，而不是拖到运行时才炸
export { Config }

// -----------------------------------------------------------------------------
// ④ 声明合并：让 Context 认识 ctx.craft
// -----------------------------------------------------------------------------
//   正常情况下 TypeScript 不知道 Context 上有 craft 这个属性，
//   别的插件想用它就得写 `ctx.craft as any` 强制断言。
//
//   这个 declare module 块是在「教 TypeScript」：
//   「Context 上还多了一个 craft 字段，类型是 CraftStore」。
//
//   ⚠️ 关键：这个块在编译后**什么都不剩**，运行时完全不存在。
//      它只对 TypeScript 编译器有意义。
//      所以别的插件能拿到完整类型，又不需要真的 import 本文件。
declare module '@deepseek-ai/cordis' {
  interface Context {
    craft: CraftStore // ctx.craft 的类型就是 CraftStore
  }
}

// ############################################################################
// 第 3 段：apply —— 插件被激活时调用
// ############################################################################
//
//   apply 是 Cordis 约定的「入口函数」。宿主加载插件时会调用它一次。
//   参数：
//   · ctx    = 宿主上下文（上面解释过的 Context）
//   · config = 宿主校验过的配置对象（符合 Config 的形状）
/** 插件激活入口：算出项目目录、把 store 以 `ctx.craft` 发布出去、再注册三个工坊 Chat 工具。
 *  *
 *  * `ctx.effect()` 是 Cordis 强制的注册接缝：它返回的东西会在卸载时自动销毁、
 *  * 重载时自动重跑，所以绝不要自己写 removeListener / clearInterval 手动收尾。
 */
export function apply(ctx: Context, config: ConfigShape): void {

  // --------------------------------------------------------------------------
  // 第一步：算出项目目录的绝对路径
  // --------------------------------------------------------------------------
  // DSH_HOME 是宿主通过环境变量告诉插件的工作区根目录。
  // 打个比方：DSH_HOME 是「房子地址」，projectsDir 是「房间号」，
  // 我们要把两者拼起来得到完整地址。
  //
  // startsWith('/')        = 以 / 开头 → POSIX 绝对路径（Linux/macOS）
  // /^[a-zA-Z]:[\\/]/       = 盘符开头 → Windows 绝对路径（形如 C:\ 或 D:/）
  // 两者任一成立就当它已经是完整地址，原样用（允许用户把工坊放到工作区之外）。
  // 都不成立说明是相对路径，用 resolve() 拼到 DSH_HOME 下面。
  //
  // process.env.DSH_HOME = 宿主给的工作区根；官方 dsh-home-paths 的解析顺序是
  // 「显式配置 > $DSH_HOME > ~/.dsh」，所以没设时用 homedir() 拼出 ~/.dsh，
  // 和宿主保持一致——绝不能退成 '.'（进程当前目录），否则相对路径会跟着
  // 启动位置漂移，同一份配置在不同机器/不同启动方式下落到不同地方。
  const dshHome = process.env.DSH_HOME || join(homedir(), '.dsh')
  const projectsDir = config.projectsDir.startsWith('/') ||
    /^[a-zA-Z]:[\\/]/.test(config.projectsDir)
    ? config.projectsDir
    : resolve(dshHome, config.projectsDir)

  // --------------------------------------------------------------------------
  // 第二步：把 store 挂到宿主的上下文上
  // --------------------------------------------------------------------------
  // store.configure(...)：告诉 store 写到哪、列表显示几条。
  //
  // ctx.effect(fn, '名字')：**Cordis 的强制注册方式**。
  //   · 你交给它的任何东西，它都会在插件卸载时自动销毁
  //   · 插件重新加载时会自动重跑
  //   所以你**绝不要**自己写 removeListener / clearInterval 那种手动收尾，
  //   那是 Cordis 里的反模式。
  //   第二个参数只是给这个 effect 起个名字，方便调试时认出来。
  //
  // ⚠️ DSH 0.2.0+ 的依赖是**运行时解析 + 运行时卸载**（v0.1.6-alpha.2 引入，
  //    v0.2.1-alpha.1 修复了 HMR 下残留依赖映射）。所以 store **必须**挂到
  //    ctx.effect() 里 —— 否则 dsh web 重载本插件时旧 store 会泄漏。
  //    下面这一行 ctx.effect(() => ctx.provide('craft', store), '...')
  //    正是这条规则的标准写法。
  //
  // ctx.provide('craft', store)：把 store 以「craft」这个名字发布到上下文上。
  //   发布之后，profile 里任何一个别的插件都能写 `ctx.craft` 拿到它。
  //   名字 'craft' 必须和上面 declare module 里声明的字段名一模一样。
  store.configure(projectsDir, config.maxListedProjects)
  ctx.effect(() => ctx.provide('craft', store), 'dsh-plugin-craft: store')

  // ##########################################################################
  // 第三步：注册三个 Chat 工具
  // ##################################################################
  //
  // 什么叫「Chat 工具」？
  //   就是模型在对话中可以主动调用的函数。比如你跟模型说「帮我建个项目」，
  //   模型决定调 craft.create_project 这个函数，而不是凭空编一段代码。
  //
  // ctx.tools.register(工具)：把工具登记到宿主的工具箱里。
  //
  // 三个工具都由 defineTool 包装，形状完全一样：
  //   · name        = 工具叫什么（模型靠它调用）
  //   · description = 「什么时候该用我」—— 模型读这段决定要不要调，必须写清楚
  //   · parameters  = 模型可以传什么参数
  //   · execute     = 真正干活的函数
  //   · output.schema= 返回值必须符合的格式（不符合就报错）
  //   · output.render= 把返回值渲染成用户能看懂的话
  //
  // 铁律：execute 只能返回 output.schema 声明的规范数据，
  //       不要往里塞散文。人话放到 output.render 里。

  // --------------------------------------------------------------------------
  // 工具 1/3：craft.create_project
  // --------------------------------------------------------------------------
  // 让用户用一句话的模糊想法，从 Chat 里直接开一个工坊项目。
  ctx.tools.register(
    defineTool({
      // 工具名。带 craft. 前缀是为了不和别的插件的工具重名。
      name: 'craft.create_project',

      // 这段 description 是给**模型**看的，不是给你看的。
      // 模型靠它判断「什么时候该调这个工具」，所以要写清楚用途和返回值。
      description:
        'Open the Plugin Workshop and start a new project from a fuzzy one-liner idea. Returns the registered plugin name and the stage the project is now on (always "interview").',

      // parameters：声明模型能传哪些参数。
      // 每个参数三个常见字段：type（类型）、required（是否必填）、description（说明）。
      // description 同样是给模型看的 —— 写得越清楚，模型越不会传错。
      parameters: {
        pluginName: {
          type: 'string', // 参数类型
          required: true, // true = 模型必须传
          description:
            'Lowercase plugin id, e.g. "device-scanner". Becomes the project key on disk, so it must match /^[a-z][a-z0-9-]*[a-z0-9]$/.',
        },
        fuzzyIdea: {
          type: 'string', // 参数类型
          required: true, // true = 模型必须传
          description:
            'The user-facing one-liner describing what the plugin should do.',
        },
      },

      // output：声明这个工具返回什么。
      output: {
        // schema = 「规范值」的形状。这是**机器可读**的结果，宿主会校验它。
        // type: 'object' = 返回一个对象
        // additionalProperties: false = 不允许出现 schema 之外的字段
        // properties = 对象里有哪些字段
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            pluginName: { type: 'string' }, // 字段 1
            stage: { type: 'string' }, // 字段 2
          },
        },
        // render = 「展示值」：把规范值变成用户在看的那行字。
        // 两个参数：
        //   _args = 模型传的原始参数（这里用不到，下划线前缀表示「故意不用」）
        //   value = execute 返回的规范值
        // 必须是纯函数：不许读文件、不许取时间、不许随机。
        render: (_args, value) => [
          { type: 'text', text: `Workshop project "${value.pluginName}" created. Begin stage 1 — interview.` },
        ],
      },

      // execute：真正干活的地方。async = 异步函数，返回 Promise。
      async execute(args) {
        // args = 模型传来的参数对象。
        // String(...) 是防御性归一：模型有可能传出非字符串，统一压成字符串再给 store。
        const project = await store.create({
          pluginName: String(args.pluginName),
          fuzzyIdea: String(args.fuzzyIdea),
        })
        // as string 是「类型断言」：告诉编译器「你放心，它是字符串」。
        // 这只是给编译器看的，运行时不执行任何检查。
        // 这里需要它，因为 store 返回的 stage 是 Stage 联合类型，
        // 而上面的 output.schema 声明的是普通 string。
        return { pluginName: project.pluginName, stage: project.stage as string }
      },
    }),
  )

  // --------------------------------------------------------------------------
  // 工具 2/3：craft.advance_stage
  // --------------------------------------------------------------------------
  // 让模型把项目推进到下一道（accept），或原地留下反馈返工（revise）。
  ctx.tools.register(
    defineTool({
      name: 'craft.advance_stage',
      description:
        'Advance a Workshop project to the next stage (decision="accept") or stay on it with feedback (decision="revise", feedback="...").',
      parameters: {
        pluginName: {
          type: 'string', // 类型
          required: true, // 必填
          description: 'The project to advance, as returned by craft.create_project.',
        },
        decision: {
          type: 'string', // 类型
          required: true, // 必填
          description:
            '"accept" to move to the next stage, "revise" to stay put and rework the current one.',
        },
        feedback: {
          type: 'string', // 类型
          // 注意这里**没有** required。省略了就是可选参数。
          description:
            'What the user wants changed. Only meaningful with decision="revise"; it is not persisted between sessions.',
        },
      },
      output: {
        schema: {
          type: 'object', // 返回对象
          additionalProperties: false, // 不允许多余字段
          properties: {
            nextStage: { type: 'string' }, // 字段 1：新工序
            awaitingGate: { type: 'boolean' }, // 字段 2：是否还在关卡
          },
        },
        render: (_args, value) => [
          { type: 'text', text: `Workshop moved to stage "${value.nextStage}". Awaiting gate: ${value.awaitingGate}.` },
        ],
      },
      async execute(args) {
        // 调 store 推进。await = 等这个异步操作完成再继续。
        const result = await store.advance(String(args.pluginName), {
          // 除了字面量 "revise" 之外一律当 "accept" 处理。
          // 理由：模型不该编造别的值，默认当 accept 可以避免
          // 一次参数写错就把项目卡死在原地。
          decision: args.decision === 'revise' ? 'revise' : 'accept',
          // 三元运算符：真值判断同时挡掉 undefined / 空串。
          // feedback 可能不传（可选参数），所以要有这个保护。
          feedback: args.feedback ? String(args.feedback) : undefined,
        })
        return {
          // 同上：Stage 联合类型 → string，用类型断言放宽
          nextStage: result.nextStage as string,
          // true = 刚落到的这道工序还需要用户点一下才能继续。
          awaitingGate: result.awaitingGate,
        }
      },
    }),
  )

  // --------------------------------------------------------------------------
  // 工具 3/3：craft.appendinterview
  // --------------------------------------------------------------------------
  // 用户在 ask_user_question 卡片上点完一个选项后，模型调这个把需求记下来。
  //
  // ⚠️ 命名提醒：这里少了下划线，和两个兄弟不一致。
  //    cordis.patch.yml 的 persona 提示词里硬编码了这个字符串，
  //    所以改名是破坏性变更，必须两边同时改。
  ctx.tools.register(
    defineTool({
      name: 'craft.appendinterview',
      description:
        'Record one requirement from the Workshop interview. Called after the user clicks an option in a clickable question.',
      parameters: {
        pluginName: {
          type: 'string', // 类型
          required: true, // 必填
          description: 'The project the requirement belongs to.',
        },
        field: {
          type: 'string', // 类型
          required: true, // 必填
          description: 'Question id used as the requirement key, e.g. "mainFeature".',
        },
        value: {
          type: 'string', // 类型
          required: true, // 必填
          description: 'The option label the user picked.',
        },
      },
      output: {
        schema: {
          type: 'object', // 返回对象
          additionalProperties: false, // 不允许多余字段
          properties: {
            pluginName: { type: 'string' }, // 字段 1
            field: { type: 'string' }, // 字段 2
            value: { type: 'string' }, // 字段 3
            total: { type: 'number' }, // 字段 4
          },
        },
        render: (_args, value) => [
          { type: 'text', text: `Recorded requirement "${value.field}" → "${value.value}". ${value.total} captured so far.` },
        ],
      },
      async execute(args) {
        // 追加一条访谈回答。
        const updated = await store.appendInterview(
          String(args.pluginName),
          String(args.field),
          String(args.value),
        )
        return {
          pluginName: updated.pluginName, // 哪个项目
          field: String(args.field), // 哪个问题
          value: String(args.value), // 选了什么
          // 累计条数：让模型不用重读整份需求列表就知道访谈收集得够不够。
          total: updated.interview.length,
        }
      },
    }),
  )
}

// ############################################################################
// 第 4 段：store 单例
// ############################################################################
//
// new CraftStore() = 创建一个 CraftStore 实例（「对象」）。
//   打个比方：class 是「图纸」，new 是「按图纸造一个实物」。
//   造出来的这个实物就是 store。
//
// 为什么放在文件末尾、而不是在 apply() 里面 new？
//   · 三个工具必须共用**同一个**实例、**同一个**磁盘目录
//   · 插件重载时 apply() 可能跑多次，模块作用域保证只有一个
//
// 它的 baseDir / maxListed 在上面 configure() 调过之前是未定义的，
// 所以 CraftStore 里那两个字段带 `!` 确定赋值断言。
const store = new CraftStore()
