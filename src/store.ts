// ============================================================================
// src/store.ts —— 工坊的落盘层
// ============================================================================

// ############################################################################
// 第 1 段：引入模块
// ############################################################################
//
// 【先搞懂 import 这条语句的语法】
//
//   import { 成员1, 成员2 } from '模块名'
//    │        │              │            │
//    │        │              │            └── 模块名：去哪拿
//    │        │              └─────────────── from 关键字
//    │        └────────────────────────────── ┐
//    └────────────────────────────────────────┘
//
// · import   = 「引入」命令。把别的模块里已经写好的东西拿到本文件来用。
// · { } 里   = 你具体要拿哪几个成员（用逗号分隔）
// · from '…' = 从哪个模块拿
//
// 打个比方：模块像「工具箱」，import 像「你去工具箱里拿几把工具」，
// 拿回来之后本文件就能直接用，不用每次都跑一趟工具箱。
//
// 【模块一：node:path】
//
//   node:path —— Node.js 自带的「路径处理」模块，开箱即用，不用安装。
//   node: 前缀 = 表示「这是 Node 内置模块」，不是从网上下载的第三方包。
//               写 node: 前缀是好习惯：能一眼看出这是内置的，不依赖。
//   path      = 这个模块的职责：处理「文件/文件夹在哪里」这种字符串。
//
//   引入了 3 个成员：
//
//   · dirname —— 取「父目录」。给它一个文件路径，返回它所在的文件夹。
//       用在哪：writeJson() 里要知道 project.json 该放在哪个文件夹。
//       例子：dirname('/a/b/project.json') → '/a/b'
//
//   · join —— 拼接路径。比手写字符串相加强在哪：它**自动处理斜杠方向**。
//       Windows 用 \，Linux/macOS 用 /，你不用关心平台差异。
//       它还会自动去重多余的斜杠。
//       例子：join('/a', 'b', 'c.json')
//             Windows → '\a\b\c.json'
//             Linux   → '/a/b/c.json'
//
//   · resolve —— 把路径转成「绝对路径」。
//       绝对路径 = 从盘符/根目录开始的完整路径，不依赖「你当前在哪个文件夹」。
//       用在哪：configure() 里立刻转绝对，防止之后有人 chdir 把项目搬走。
//       例子：resolve('./x') → 'C:/当前工作目录/x'
//
//   ⚠️ 这三个函数都**只算字符串，不碰硬盘**。它们不会创建文件夹、不读写文件。
//      真正碰硬盘的是下面那个 node:fs 模块。
import { dirname, join, resolve } from 'node:path'

// 【模块二：node:fs/promises】
//
//   node:fs —— 文件系统模块，管「真正读��写硬盘文件」。
//   /promises —— 这个后缀表示「Promise 版本」（异步写法）。
//
//   什么是异步/Promise？和 Promise 版本的区别：
//     · 旧写法 fs.readFileSync() = 同步：读到完才继续往下走，会卡住程序
//     · 新写法 await fs.readFile() = 异步：发起读文件后先去干别的，
//                                        读完了再回来继续
//   在 Web 服务里必须用异步版，否则一个大文件就能把所有请求堵死。
//   本文件所有函数都是 async 的，所以用 promises 版正好配套。
//
//   引入了 6 个成员：
//
//   · mkdir —— 创建文件夹。
//       用在哪：创建新项目时建项目目录。
//       关键参数 { recursive: true } = 「中间的父文件夹没有就一路建出来」。
//       例子：mkdir('/a/b/c', { recursive: true })
//             若 /a 不存在，会自动建 /a、/a/b、/a/b/c 三层。
//
//   · readdir —— 读一个文件夹里有什么，返回文件名数组。
//       用在哪：list() 遍历项目根目录，找出所有项目。
//       例：readdir('/projects') → ['foo-bar', 'device-scanner']
//
//   · readFile —— 读文件内容，返回字符串。
//       用在哪：readProject() 读 project.json。
//       参数里的 'utf-8' 是编码：不指定的话中文会变成乱码。
//
//   · writeFile —— 把内容写进文件（**会覆盖原有内容**）。
//       用在哪：writeJson() 写 project.json。
//       ⚠️ 所以我们先写 .tmp 再 rename，避免写到一半崩溃导致原文件被截断。
//
//   · rename —— 重命名 / 移动文件。
//       用在哪：writeJson() 里把 .tmp 改名成正式的 project.json。
//       关键性质：同一文件系统内它是**原子操作**——要么完全成功，要么完全没动。
//       读者永远看不到「写了一半」的文件。
//
//   · rm —— 删除文件或文件夹。
//       用在哪：remove() 删掉整个项目目录。
//       关键参数：
//         recursive: true = 连里面的内容一起删（不然只能删空文件夹）
//         force: true     = 目标不存在时不报错，当空操作处理
import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises'

// 【模块三：node:crypto】
//
//   node:crypto —— Node 自带的「加密/随机数」模块。
//
//   引入的成员：
//
//   · randomUUID —— 生成一个随机 UUID（ Universally Unique Identifier，
//     全球唯一标识符），形如 '3f2504e0-4f89-11d3-9a0c-0305e82c3301'。
//     用途：给每个项目一个永远不会重复的 id。
//     为什么不用自增数字？因为项目目录可以被删掉重建，自增号会撞；
//     随机 UUID 撞的概率约等于 0。
import { randomUUID } from 'node:crypto'

// 【模块四：./types.js —— 本项目自己的类型定义】
//
//   路径写法：./ 开头 = 「当前文件夹里的」。
//   注意结尾是 types.js 而不是 types —— 但实际文件是 types.ts。
//   这是 TypeScript 的规定：import 时写编译后的样子（.js），
//   TypeScript 会自动帮你找到对应的 .ts 源文件。这样代码转成 JS 后路径才对得上。
//
//   这里面引入的东西分两类：
//   · 运行时真的存在的：buildInitialStages、isValidPluginName、STAGE_ORDER
//     这三个是函数或常量，JS 里真的有一份。
//   · 只有类型存在的：AdvanceDecision、AdvanceResult、FuzzyIdea、Project……
//     这些是 interface/type，编译后**什么都不剩**，它们只是给编译器看的。
//     所以前面加了 type 关键字告诉编译器「这些是纯类型，不用真的去 import」。
import {
  buildInitialStages, // 函数：给新项目生成初始进度条
  isValidPluginName, // 函数：校验插件名是否合法（同时是路径穿越防线）
  STAGE_ORDER, // 常量：六道工序的顺序数组
  type AdvanceDecision, // 纯类型：推进决策的形状
  type AdvanceResult, // 纯类型：推进结果的形状
  type FuzzyIdea, // 纯类型：创建项目的入参形状
  type Project, // 纯类型：项目完整结构
  type ProjectMeta, // 纯类型：列表页精简行
  type Stage, // 纯类型：单道工序
} from './types.js'

// 编码常量：读写文件都显式指定它，避免在中文 Windows 上踩到 GBK 默认编码。
const UTF8 = 'utf-8'

// ############################################################################
// 第 2 段：落盘信封
// ############################################################################
// 实际存盘的不是 Project 本身，而是把它包了一层。
// version 字段的作用：将来格式要改时，读的时候能认出「这文件是老格式」，
// 而不是拿新代码硬解老结构、解出半错不错的数据。
interface ProjectFile {
  version: 1 // 当前只有版本 1
  project: Project // 真正的项目数据
}

// ############################################################################
// 第 3 段：CraftStore 类
// ############################################################################
/** 工坊的宿主端落盘层。
 *  *
 *  * 它独占 `<projectsDir>/<pluginName>/project.json` 的所有读和写。
 *  * 由宿主的 `apply()` new 出唯一实例，并以 `ctx.craft` 的名字暴露出去。
 *  *
 *  * 用 `node:fs/promises` 而不是抽象文件系统接缝的原因：工坊写的是配置里指定的
 *  * 工作区目录，本来就在任何沙箱视图之外；直接用 fs 能白拿 tmp+rename 的原子写。
 */
export class CraftStore {
  // 下面两个字段用 `!`（TypeScript 的「确定赋值断言」）声明。
  // 意思是：「编译器你别报未初始化错误，我保证 configure() 会在任何人用之前跑。」
  // 这样构造函数就可以什么都不写。
  private baseDir!: string // 项目根目录（绝对路径）
  private maxListed!: number // 列表最多返回几条

  // --------------------------------------------------------------------------
  // configure：接线，告诉 store 文件写到哪、列表显示几条
  // --------------------------------------------------------------------------
  // apply() 一定会最先调它。
  // 这里立刻用 resolve() 转绝对路径，是为了防止之后有人 process.chdir()
  // 切换了工作目录，把项目位置「搬走」。
  /** 接线，由 `apply()` 调用：文件写到哪、列表最多返回几条。
   *  *  立刻 resolve 成绝对路径，防止之后有人 `process.chdir()` 把项目搬走。
   */
  configure(baseDir: string, maxListed: number) {
    this.baseDir = resolve(baseDir) // 转成绝对路径
    this.maxListed = maxListed // 原样记住上限
  }

  // --------------------------------------------------------------------------
  // dirFor：把插件名换算成磁盘目录
  // --------------------------------------------------------------------------
  // 这是全文件唯一拼接路径的地方，所以路径穿越防线也只需要在这里写一次。
  // 所有接收 pluginName 的公开方法，第一件事都是调它。
  private dirFor(pluginName: string): string {
    // 名字不合法就直接抛错，绝不进入下一步的 join。
    if (!isValidPluginName(pluginName)) {
      throw new Error(`invalid plugin name: ${pluginName}`)
    }
    // 名字已经保证「没有 / 没有 \ 没有 ..」，所以拼出来必然在 baseDir 之内。
    return join(this.baseDir, pluginName)
  }

  // --------------------------------------------------------------------------
  // writeJson：原子写
  // --------------------------------------------------------------------------
  // 做法：先写 <path>.tmp，再 rename 覆盖目标。
  // rename 是原子操作，所以读的人要么读到完整的旧文件，
  // 要么读到完整的新文件，**永远不会读到写了一半的文件**。
  // 这点很重要：列表页和 Chat 工具完全可能在模型推进工序的同时读同一个项目。
  private async writeJson(path: string, body: ProjectFile): Promise<void> {
    // dirname(path) 取父目录，recursive: true 表示目录不存在就一路建出来。
    // 首次创建项目时必需（这时父目录还不存在）。
    await mkdir(dirname(path), { recursive: true })
    // 临时文件名 = 目标名 + .tmp
    const tmp = `${path}.tmp`
    // JSON.stringify 把对象变成字符串：
    //   · 第二个参数 null = 不传「过滤函数」，全都要
    //   · 第三个参数 2 = 每层缩进 2 个空格（为了人能直接看懂 project.json）
    // writeFile 写进去。注意它会覆盖，所以写的是 tmp 不是正式文件。
    await writeFile(tmp, JSON.stringify(body, null, 2), UTF8)
    // 原子替换：临时文件在这一步「变成」正式文件。
    await rename(tmp, path)
  }

  // --------------------------------------------------------------------------
  // readProject：读一个项目，读不到就返回 null
  // --------------------------------------------------------------------------
  // 「项目不存在」是预期内的情况（list() 会遍历到根本不是项目的目录），
  // 所以 ENOENT（文件不存在这个错误码）吞掉。
  // 其它失败（JSON 坏了、没权限）一律往上抛 ——
  // 把这些也当成「没有这个项目」会把真正的数据损坏悄悄藏起来。
  private async readProject(dir: string): Promise<Project | null> {
    // 项目文件固定叫 project.json，和目录名平级。
    const file = join(dir, 'project.json')
    try {
      const text = await readFile(file, UTF8) // 读成字符串
      // JSON.parse 把字符串变回对象。as ProjectFile 是类型断言（只给编译器看，运行时不执行）。
      const parsed = JSON.parse(text) as ProjectFile
      // 版本对不上、或者 project 字段缺失，一律当作「不认识这个文件」。
      if (parsed.version !== 1 || !parsed.project) return null
      return parsed.project // 只把里面的 project 返回出去
    } catch (err: any) {
      // ENOENT = 文件/目录不存在，属于正常情况。
      if (err && err.code === 'ENOENT') return null
      throw err // 其它错误（JSON 语法错、权限…）必须抛出去
    }
  }

  // --------------------------------------------------------------------------
  // meta：把完整项目压成列表行
  // --------------------------------------------------------------------------
  private meta(p: Project): ProjectMeta {
    // 逐个字段照搬。砍掉的是体积大的自由文本字段（interview/design/tasks/stages），
    // 因为列表页不用显示它们。
    return {
      id: p.id,
      pluginName: p.pluginName,
      stage: p.stage,
      accepted: p.accepted,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }
  }

  // --------------------------------------------------------------------------
  // list：列出所有项目，最近改的排前面
  // --------------------------------------------------------------------------
  // maxListed 只截断「返回的列表」——项目本身照样留在磁盘上，
  // 用 get(名字) 照样能取到。
  //
  // 【健壮性提醒】这里遍历的是项目根目录下的**所有**条目，不是只挑项目目录。
  // 如果有人在根目录里丢了个非目录文件（.DS_Store、残留的 README），
  // 后面 readProject 会拿到 ENOTDIR（不是目录）而不是 ENOENT，
  // 而这个错误是被 rethrow 的 —— 结果整个列表直接挂掉。
  // 解法：readdir 传第二个参数 { withFileTypes: true }，
  //       然后跳过 !dirent.isDirectory() 的条目。
  /** 列出所有项目，最近改的排前面，最多返回 `maxListed` 条。
   *  *  上限只截断返回的列表，项目本身照样留在磁盘上，用 get() 照样能取到。
   */
  async list(): Promise<ProjectMeta[]> {
    // 声明一个空的目录名数组，等下填。
    let entries: string[] = []
    try {
      // ENOENT 在这里是正常的：项目目录要到第一次 create() 才建，
      // 全新安装时这个目录根本不存在。
      entries = await readdir(this.baseDir)
    } catch (err: any) {
      // 目录不存在 → 返回空列表，而不是报错。
      if (err && err.code === 'ENOENT') return []
      throw err // 其它错误照抛
    }
    // 准备收集结果。
    const metas: ProjectMeta[] = []
    // for...of：逐个遍历数组元素。这里遍历的是文件夹名。
    for (const entry of entries) {
      const dir = join(this.baseDir, entry) // 拼出这个条目的完整路径
      // 读不到合法 project.json 的目录会被跳过——半创建的项目就是这么从列表里消失的。
      const proj = await this.readProject(dir)
      // 读到了才收进结果。
      if (proj) metas.push(this.meta(proj))
    }
    // 按 updatedAt **倒序**排：a < b 就返回 1，代表 a 排后面（新的在前）。
    // 尽力而为：同一毫秒写入的两个项目没有实际先后，列表页场景无所谓。
    metas.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
    // slice(0, n)：取数组前 n 项。超出上限的排在后面不返回。
    return metas.slice(0, this.maxListed)
  }

  // --------------------------------------------------------------------------
  // get：按插件名取单个项目
  // --------------------------------------------------------------------------
  /** 按插件名（用户可见的 id）取单个项目，不存在时返回 `null`。
   */
  async get(pluginName: string): Promise<Project | null> {
    // 直接复用 readProject，找不到自然返回 null。
    return this.readProject(this.dirFor(pluginName))
  }

  // --------------------------------------------------------------------------
  // create：凭一句模糊需求开一个新项目
  // --------------------------------------------------------------------------
  // 新项目一律落在 interview 关卡，需求列表为空，进度条刚铺好。
  // 同名项目会被拒：工坊是「一个插件一个项目」，撞名说明用户是把旧项目
  // 捡起来了，不是要新建。
  /** 凭一句模糊需求开一个新项目。
   *  *  一律落在 `interview` 关卡。名字不合法或已被占用都直接拒绝，
   *  *  绝不覆盖已有项目的数据。
   */
  async create(input: FuzzyIdea): Promise<Project> {
    if (!isValidPluginName(input.pluginName)) {
      // 这里报的字面规则必须和 isValidPluginName 真正执行的规则一致，
      // 否则模型会照着错误信息反复生成非法名字。
      throw new Error(
        'pluginName must match /^[a-z][a-z0-9-]*[a-z0-9]$/ (2-63 chars, lowercase start, alphanumeric end)',
      )
    }
    const dir = this.dirFor(input.pluginName) // 算出目录
    const existing = await this.readProject(dir) // 先看看有没有同名项目
    if (existing) {
      // 有就拒绝，绝不静默覆盖（否则会丢掉已收集的全部需求）。
      throw new Error(`project "${input.pluginName}" already exists`)
    }
    // new Date() 取当前时间，toISOString() 转成标准字符串格式（如 '2026-10-04T06:00:00.000Z'）。
    // createdAt 和 updatedAt 在创建那一刻按定义就是同一个时间，用一个变量保证。
    const now = new Date().toISOString()
    // 组装项目对象。
    const project: Project = {
      id: randomUUID(), // 随机 UUID 做主键
      pluginName: input.pluginName, // 用户起的名字
      fuzzyIdea: input.fuzzyIdea, // 用户的原始需求
      stage: 'interview', // 固定落在第 1 道
      accepted: false, // 还没认可任何东西
      createdAt: now, // 创建时间
      updatedAt: now, // 创建时间
      interview: [], // 需求列表：空数组
      design: '', // 设计稿：空字符串
      tasks: '', // 任务清单：空字符串
      stages: buildInitialStages(), // 铺一条初始进度条
    }
    // 递归创建项目目录。
    await mkdir(dir, { recursive: true })
    // 落盘：把项目包进 { version, project } 信封再写。
    await this.writeJson(join(dir, 'project.json'), { version: 1, project })
    return project // 把新项目返回给调用方
  }

  // --------------------------------------------------------------------------
  // advance：往前走一道，或者原地返工
  // --------------------------------------------------------------------------
  // revise：状态机完全不动，只把 accepted 清成 false、updatedAt 刷新，
  //        然后回报 awaitingGate: true。
  //        ⚠️ 注意 decision.feedback 目前**不落盘** —— persona 预期在当次
  //        对话里就把它消化掉，跨会话会丢。
  // accept：沿 STAGE_ORDER 走一步，把离开的那道标 done、
  //        落下的那道按 isAutoStage() 标成 auto 或 gate。
  /** 往前推进一道工序（`accept`），或原地不动并清掉 `accepted`（`revise`）。
   *  *
   *  * `deliver` 是终点：多调的 `accept` 会被夹住，不会冲出 STAGE_ORDER 尾部。
   *  *
   *  * ⚠️ `decision.feedback` 收下了但不落盘，撑不过一次会话重启。
   */
  async advance(pluginName: string, decision: AdvanceDecision): Promise<AdvanceResult> {
    const dir = this.dirFor(pluginName) // 算目录
    const project = await this.readProject(dir) // 读项目
    if (!project) {
      // 项目不存在是错误，不是「新建」——advance 不承担这个语义。
      throw new Error(`project "${pluginName}" not found`)
    }
    // indexOf：在数组里找元素的位置，找不到返回 -1。
    // 当前工序在顺序表里的下标。
    const currentIndex = STAGE_ORDER.indexOf(project.stage)

    // ---- 分支 A：revise，留在原地 ----
    if (decision.decision === 'revise') {
      // 只改这一个字段。同一个对象既返回给调用方也写盘，天然一致。
      project.updatedAt = new Date().toISOString() // 刷一下「最近动过」
      project.accepted = false // 之前那个认可作废
      await this.writeJson(join(dir, 'project.json'), { version: 1, project }) // 落盘
      return {
        project, // 返回同一个对象
        nextStage: project.stage, // 工序没变
        awaitingGate: true, // 用户还在同一个关卡上，要重新审一次
      }
    }

    // ---- 分支 B：accept，往前走一道 ----
    // Math.min 取两者中较小的：夹到最后一道理。
    // deliver 是终点，重复 accept 会被吸收掉，
    // 而不会冲出 STAGE_ORDER 尾部变成 undefined。
    const nextIndex = Math.min(currentIndex + 1, STAGE_ORDER.length - 1)
    const nextStage = STAGE_ORDER[nextIndex] // 新工序

    // slice()：复制一份数组（不传参数 = 全复制）。
    // 先浅拷贝进度条再改，避免改动泄漏回刚才读出来的那个对象。
    const stages = project.stages.slice()
    // 内部小工具：给指定工序设置状态。找不到就当无事发生。
    // 类型标注 Project['stages'][number]['status'] 是「索引访问类型」，
    // 意思是「取 stages 数组里某一项的 status 字段的类型」——纯编译期，运行时不执行。
    const markStage = (stage: Stage, status: Project['stages'][number]['status']) => {
      // findIndex：找出满足条件的元素下标，找不到返回 -1。在进度条里定位这一格。
      const idx = stages.findIndex((s) => s.stage === stage)
      // 进度条是磁盘上的数据，可能比当前代码旧（老数据里没这道工序），
      // 所以定位不到就静默跳过，而不是抛错。
      // 展开运算符 ...：把原对象的所有键复制一份，再只换 status。
      if (idx >= 0) stages[idx] = { ...stages[idx], status }
    }
    markStage(project.stage, 'done') // 离开的那道：完成
    // 落下的那道：自动工序标 auto，关卡标 gate。
    markStage(nextStage, isAutoStage(nextStage) ? 'auto' : 'gate')

    // 组装新项目对象。展开运算符把原项目所有字段带过来。
    const updated: Project = {
      ...project, // 其余字段原样带过来
      stage: nextStage, // 当前工序更新
      // accepted 的语义是「当前工序的交付物已签字」，只有到了交付页才成立。
      accepted: nextStage === 'deliver',
      updatedAt: new Date().toISOString(), // 刷新
      stages, // 换上新进度条
    }
    await this.writeJson(join(dir, 'project.json'), { version: 1, project: updated }) // 落盘
    return {
      project: updated, // 返回新对象
      nextStage, // 返回新工序
      // 告诉 client 刚落到的工序是否还需要用户点一下 —— 它靠这个决定显不显示「继续」。
      awaitingGate: !isAutoStage(nextStage),
    }
  }

  // --------------------------------------------------------------------------
  // appendInterview：往需求列表追加一条
  // --------------------------------------------------------------------------
  // 只增不改是刻意的：访谈是「用户到底点了什么」的审计轨迹，
  // 所以回答不允许被编辑或删除。
  /** 往需求列表追加一条。刻意的只增不改：访谈始终是一条可信的审计轨迹。
   */
  async appendInterview(pluginName: string, field: string, value: unknown): Promise<Project> {
    const dir = this.dirFor(pluginName) // 算目录
    const project = await this.readProject(dir) // 读项目
    if (!project) throw new Error(`project "${pluginName}" not found`) // 不存在就报错
    // 一次取时间，updatedAt 和 capturedAt 共用，保证两条记录同一瞬间。
    const now = new Date().toISOString()
    const updated: Project = {
      ...project, // 其余字段带过来
      updatedAt: now, // 刷新
      interview: [
        ...project.interview, // 展开原数组：原有回答全保留（只追加）
        { field, value, capturedAt: now }, // 新增这一条
      ],
    }
    await this.writeJson(join(dir, 'project.json'), { version: 1, project: updated }) // 落盘
    return updated
  }

  // --------------------------------------------------------------------------
  // setDesign：覆盖第 2 道工序的设计稿
  // --------------------------------------------------------------------------
  // 整字段覆盖而不是追加：助手会在对话收敛过程中反复重写设计，
  // 而只有最新一版有意义。
  /** 整段覆盖第 2 道工序的设计稿。不追加 —— 只有最新一版有意义。
   */
  async setDesign(pluginName: string, design: string): Promise<Project> {
    const dir = this.dirFor(pluginName) // 算目录
    const project = await this.readProject(dir) // 读项目
    if (!project) throw new Error(`project "${pluginName}" not found`) // 不存在就报错
    const updated: Project = {
      ...project, // 其余带过来
      updatedAt: new Date().toISOString(), // 刷新
      design, // 整段替换
    }
    await this.writeJson(join(dir, 'project.json'), { version: 1, project: updated }) // 落盘
    return updated
  }

  // --------------------------------------------------------------------------
  // setTasks：覆盖第 3 道工序的任务清单
  // --------------------------------------------------------------------------
  /** 整段覆盖第 3 道工序的任务清单。
   */
  async setTasks(pluginName: string, tasks: string): Promise<Project> {
    const dir = this.dirFor(pluginName) // 算目录
    const project = await this.readProject(dir) // 读项目
    if (!project) throw new Error(`project "${pluginName}" not found`) // 不存在就报错
    const updated: Project = {
      ...project, // 其余带过来
      updatedAt: new Date().toISOString(), // 刷新
      tasks, // 整段替换
    }
    await this.writeJson(join(dir, 'project.json'), { version: 1, project: updated }) // 落盘
    return updated
  }

  // --------------------------------------------------------------------------
  // remove：彻底删掉一个项目
  // --------------------------------------------------------------------------
  // force: true 让「删一个不存在的项目」变成空操作而不是报错，
  // 调用方就不用先查一遍。路径依然走 dirFor()，所以穿越防护照样生效。
  /** 递归删掉一个项目及其整个目录。删不存在的项目是空操作，不是报错。
   */
  async remove(pluginName: string): Promise<void> {
    // rm：删除。recursive 连内容一起删，force 目标不存在也不报错。
    await rm(this.dirFor(pluginName), { recursive: true, force: true })
  }
}

// -----------------------------------------------------------------------------
// isAutoStage：哪些工序是「自动」的
// -----------------------------------------------------------------------------
// 这里是 AUTO/GATE 划分的**唯一**真相源。
// advance() 调了它两次：一次决定落下的工序状态标成 auto 还是 gate，
// 一次决定返回的 awaitingGate 标志。
// 所以进度条上的状态和客户端的「继续」按钮永远不会互相矛盾。
/** 哪些工序是「自动」的 —— AUTO/GATE 划分的唯一真相源。
 */
function isAutoStage(stage: Stage): boolean {
  // 三个自动工序：拆任务、生成代码、验证。其余三道是关卡。
  return stage === 'tasks' || stage === 'generate' || stage === 'verify'
}
