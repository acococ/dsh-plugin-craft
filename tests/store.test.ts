// ============================================================================
// tests/store.test.ts —— CraftStore 的单元测试
// ============================================================================
//
// 【这个文件在项目里的位置】
//   单元测试（unit test）= 直接测某一个模块本身对不对，
//   不启动整个应用、不连数据库、不发网络请求，跑得极快（本文件 1 秒内跑完）。
//   vitest 是干这件事的官方工具，配置在项目根的 vitest.config.ts。
//
//   跑法：npx vitest run
//
// 【关键取舍：用真实的临时目录，不 mock 文件系统】
//   mock = 「假装」文件操作成功，不真的碰磁盘。
//   很多项目为了图快会 mock，但这个文件里最容易坏的地方恰恰是 mock 测不到的那部分：
//   · 原子写（先写 tmp 文件，再改名 rename）
//   · JSON 信封的序列化 / 反序列化
//   · dirFor() 里的路径穿越防护
//   这三样一旦 mock 掉，等于把真正有风险的部分全绕开了，
//   测试会「全绿」但线上照样坏。所以这里宁可慢一点，也要用真磁盘。
// ============================================================================


// ############################################################################
// 引入模块
// ############################################################################
//
// 【先搞懂 import 的语法】
//   import { 名字1, 名字2 } from '模块名'
//        │
//        └── 「引入」命令：从别的模块把东西拿进当前文件来用
//            {}  = 从模块里挑「具名成员」（要一个一个列出名字）
//            from = 从哪个模块拿
//
//   ⚠️ 两种引入方式的区别：
//   · import { a, b } from 'x'  → 拿具名成员（要用 {} 把名字列出来）
//   · import 名字 from 'x'      → 拿「默认导出」（不用 {}，模块自己决定叫什么）
//     本文件全部用第一种，因为 Node 内置模块和 vitest 都是具名导出。
// -----------------------------------------------------------------------------
// node:fs —— Node.js 内置的「文件操作」模块（fs = file system 文件系统）
// -----------------------------------------------------------------------------
//   ⚠️ 为什么不从 'node:fs/promises' 引入？
//     fs/promises 是 fs 的「异步版」，功能一样但返回 Promise，要 await。
//     但本文件在 beforeEach / afterEach 这类**生命周期钩子**里要做准备和清理，
//     同步写法更直白，也少一层 await 出错点。
//     所以这里刻意用同步版 node:fs。
//
//   · mkdtempSync —— 「同步版创建临时目录」
//     作用：在指定父目录下造一个名字随机的全新文件夹，返回它的完整路径。
//     为什么要随机名？因为两个测试进程同时跑的话，
//     固定名字会互相覆盖。随机名天然隔离。
//     例：父目录 C:\Temp，前缀 "craft-store-" → 得到 C:\Temp\craft-store-a8x3k1
//
//   · rmSync —— 「同步版删除」
//     作用：删文件或删整个目录树。
//     例：rmSync('C:\\Temp\\craft-store-a8x3k1', { recursive: true, force: true })
//     两个选项的意思：
//       recursive: true = 连子目录一起删（不写这个参数，删非空目录会报错）
//       force: true     = 目录不存在时也不报错（否则清理失败会掩盖真正的测试失败）
import { mkdtempSync, rmSync } from 'node:fs'
// -----------------------------------------------------------------------------
// node:os —— Node.js 内置的「操作系统信息」模块（os = operating system）
// -----------------------------------------------------------------------------
//   · tmpdir —— 返回「系统临时目录」的完整路径
//     Windows 上通常是 C:\Users\<你>\AppData\Local\Temp
//     macOS / Linux 上是 /tmp
//     为什么要用它？临时文件本来就不该放在项目目录里，
//     否则会把垃圾文件混进项目、还会被 git 扫到。
//     写成 tmpdir() 而不是硬编码路径，是为了跨平台不用改。
import { tmpdir } from 'node:os'
// -----------------------------------------------------------------------------
// node:path —— Node.js 内置的「路径处理」模块
// -----------------------------------------------------------------------------
//   · join —— 拼接路径。它比手写 "\" 或 "/" 强的地方在于
//     它会智能处理分隔符和重复斜杠，Windows / Linux 通用。
//     例：join('C:\\Temp', 'craft-store-') → 'C:\\Temp\\craft-store-'
import { join } from 'node:path'
// -----------------------------------------------------------------------------
// vitest —— 官方测试框架
// -----------------------------------------------------------------------------
//   · describe —— 「分组」。把一串相关测试装进一个带名字的盒子，
//     报告里会显示成缩进的一层。纯粹是组织用，不参与任何逻辑。
//   · it      —— 「一条测试」。等价于 test()，是同一件事的简写。
//     第一个参数是测试名（失败时报告里靠它定位），第二个是 async 函数体。
//   · beforeEach —— 生命周期钩子。每条 it 开始**之前**自动跑一次。
//   · afterEach  —— 生命周期钩子。每条 it 结束**之后**自动跑一次（含失败时）。
//   · expect   —— 「断言」工具。expect(实际值).toBe(期望值) —— 不相等就报错。
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
// -----------------------------------------------------------------------------
// 被测对象：CraftStore —— 真正要测的那个类
// -----------------------------------------------------------------------------
//   '../src/store' 是相对路径，两个点表示「往上一级」。
//   本文件在 tests/ 目录，所以 ../src/store 就是项目根下的 src/store.ts。
//   （import 会自动帮你找 .ts 扩展名，所以不用写 '../src/store.ts'）
import { CraftStore } from '../src/store'


// ############################################################################
// 分组 1：CraftStore 的行为
// ############################################################################
//
// 【let 而不是 const 的原因】
//   下面两个变量是「先声明、后面在钩子里赋值」的。
//   如果写成 const，声明时必须同时给值，而这里要等 beforeEach 才知道临时目录路径。
//   所以用 let（可重新赋值）先占个位。
describe('CraftStore', () => {
  let tmpDir: string // 每个测试独占的临时目录；: string 是类型标注
  let store: CraftStore // 被测实例

  // --------------------------------------------------------------------------
  // 钩子 1：每条测试开始前 —— 造一套全新的环境
  // --------------------------------------------------------------------------
  // 【为什么每条测试都要重造一遍，而不是整个文件共用一个】
  //   因为一旦共用，第一个测试残留的项目会影响第二个测试的断言
  //   （比如「列表应该只有 1 个」就会变成 2 个）。
  //   这种「上一个测试污染下一个」叫测试污染，是单测最常见的翻车原因。
  beforeEach(() => {
    // 在系统临时目录下建一个以 craft-store- 为前缀的唯一目录，返回其绝对路径。
    // （前缀是给人看的：以后去 Temp 里翻垃圾，能一眼认出是本测试留下的）
    tmpDir = mkdtempSync(join(tmpdir(), 'craft-store-'))
    // 新建被测对象。new 关键字 = 「调用类，造一个实例出来」。
    // 此刻它还没配置，不能用 —— 下一行才告诉它项目根目录在哪。
    store = new CraftStore()
    // store.configure(目录, 上限) —— 告诉 store 把项目存在哪、最多列几个。
    // 上限设 10：远高于任何单个测试会创建的数量，
    // 所以这个上限不会干扰本文件断言的内容。
    // ⚠️ 关键：每个 store 在 configure() 时会存下**绝对路径**，
    // 所以每条测试都有自己独立的项目根目录，测试之间彻底不互相干扰。
    store.configure(tmpDir, 10)
  })

  // --------------------------------------------------------------------------
  // 钩子 2：每条测试结束后 —— 无条件清场
  // --------------------------------------------------------------------------
  afterEach(() => {
    // 删除刚才那个临时目录。
    // 无条件执行（哪怕上面的测试失败了也跑）—— 否则失败的测试会在
    // Temp 目录里留一堆垃圾，累积几百 MB，跑几次机器就满了。
    // recursive 处理子目录，force 保证即使测试中途挂了也能删干净。
    rmSync(tmpDir, { recursive: true, force: true })
  })

  // --------------------------------------------------------------------------
  // 测试 1：创建 + 列出（主流程）
  // --------------------------------------------------------------------------
  // 【async 箭头函数和 await】
  //   `async` 标记「本函数里会用 await」，于是它**返回 Promise**。
  //   `await` = 「先等这个异步操作出结果，再拿结果继续往下走」。
  //   store 的所有方法都是异步的（内部用的 fs/promises），所以必须 await。
  //   注意：写错了 await 而忘了 —— 拿到的是「还没完成的信封」，
  //   后面的断言会报出一堆看不懂的错误。
  it('创建项目后能列出来', async () => {
    // 端到端跑一遍：创建 → 落盘 → 从磁盘重新读出来。
    // 最重要的一条断言是进度条：新项目必须落在 interview 关卡，
    // 并且这一格的状态已经被标好了 —— 否则 Client 画出来的进度条
    // 会没有任何「当前步骤」。
    //
    // 【参数里的花括号】
    //   `{ pluginName: 'foo-bar', fuzzyIdea: 'idea' }` 是一个对象字面量，
    //   形状必须对上 FuzzyIdea 类型（见 src/types.ts）。
    const created = await store.create({ pluginName: 'foo-bar', fuzzyIdea: 'idea' })
    // .toBe(期望值) —— 严格相等断言，不相等就这条测试失败。
    expect(created.pluginName).toBe('foo-bar') // 名字原样返回
    expect(created.stage).toBe('interview') // 固定落在第 1 道

    // 进度条断言，逐层拆开：
    //   created.stages            → 6 个 StageView 组成的数组
    //   .find(...)                → 在数组里找出符合条件的第一项，找不到返回 undefined
    //   (s) => s.stage === '...'  → 回调函数：「这一格是不是 interview」
    //   ?.status                  → 可选链 ?. ：取 status，取不到（undefined）也不报错
    //   .toBe('gate')             → 必须是「关卡」状态
    expect(created.stages.find((s) => s.stage === 'interview')?.status).toBe('gate')

    // list() 必须**纯靠遍历目录**找到项目 —— store 内部没有任何内存注册表。
    // 也就是说：只要文件在盘上就能列出来，进程重启也不影响。
    // 这条断言守的就是「不引入内存状态」这个设计。
    const list = await store.list()
    // .toHaveLength(1) —— 断言数组长度是 1。比 toBe(list.length === 1) 好，
    // 因为失败时报告里会直接写「期望长度 1，实际 2」，一眼看懂。
    expect(list).toHaveLength(1) // 应该恰好找到一个
    expect(list[0]?.pluginName).toBe('foo-bar') // 且名字对得上
  })

  // --------------------------------------------------------------------------
  // 测试 2：非法插件名要被拒
  // --------------------------------------------------------------------------
  // 插件名同时是目录名，所以这四个用例是**穿越/冲突防护**，不是审美规则：
  //   'Has-Caps'  —— 大写会挂：在大小写不敏感的文件系统上会撞名
  //   'a'         —— 太短，当不了有用的 id
  //   '-leading'  —— 必须以字母开头
  //   'trailing-' —— 必须以字母或数字结尾，不能是连字符
  it('拒绝非法的插件名', async () => {
    // 【rejects.toThrow 怎么读】
    //   expect(...).rejects      = 断言「这个 Promise 会失败（被 reject）」
    //   .toThrow(正则)            = 并且失败原因里含有匹配这段正则的文字
    //   ⚠️ 这里必须用 rejects 不是 toThrow：create() 是异步的，
    //      失败表现为 Promise 被 reject，而不是同步抛异常。
    //   写成 expect(() => ...).toThrow() 只会得到一个莫名其妙的错。
    //   正则末尾的 i 标志 = ignore case，忽略大小写匹配。
    await expect(
      store.create({ pluginName: 'Has-Caps', fuzzyIdea: 'x' }),
    ).rejects.toThrow(/pluginName must match/i)
    await expect(
      store.create({ pluginName: 'a', fuzzyIdea: 'x' }),
    ).rejects.toThrow(/pluginName must match/i)
    await expect(
      store.create({ pluginName: '-leading', fuzzyIdea: 'x' }),
    ).rejects.toThrow(/pluginName must match/i)
    await expect(
      store.create({ pluginName: 'trailing-', fuzzyIdea: 'x' }),
    ).rejects.toThrow(/pluginName must match/i)
  })

  // --------------------------------------------------------------------------
  // 测试 3：不允许重复创建同名项目
  // --------------------------------------------------------------------------
  // 防的是静默覆盖：如果允许重复 create，已收集的全部需求会被一次
  // create_project 悄悄抹掉，而且用户完全不会察觉
  // （他会以为需求还在，其实文件已经被整个换掉了）。
  it('拒绝重复创建同名项目', async () => {
    await store.create({ pluginName: 'foo-bar', fuzzyIdea: 'idea' }) // 先建一个
    await expect(
      store.create({ pluginName: 'foo-bar', fuzzyIdea: 'idea' }), // 再建同名
    ).rejects.toThrow(/already exists/i) // 必须报「已存在」
  })

  // --------------------------------------------------------------------------
  // 测试 4：访谈/设计/任务的落盘往返
  // --------------------------------------------------------------------------
  // 「往返」= 写出去，再读回来，验证一模一样。
  // 每一道工序的内容字段都得能扛过这一轮。
  //
  // 这里故意用中文：确认 UTF-8 在原子写和 JSON 信封两侧都完好 ——
  // 在 Windows 上这很容易坏掉，因为某些工具链的平台默认编码是 GBK。
  // 这条测试就是专门盯这个坑的。
  it('访谈需求、设计稿、任务清单都能落盘再读回', async () => {
    await store.create({ pluginName: 'foo-bar', fuzzyIdea: 'idea' })
    // appendInterview(项目名, 字段名, 值) —— 往访谈记录尾部追加一条
    await store.appendInterview('foo-bar', 'mainFeature', '扫描局域网')
    // setDesign(项目名, 文本) —— 写设计稿（覆盖式写入）
    await store.setDesign('foo-bar', '模块 A + 模块 B')
    // setTasks(项目名, 文本) —— 写任务清单（覆盖式写入）
    await store.setTasks('foo-bar', 'task 1')

    // get(项目名) —— 从磁盘**重新读一遍**（不是拿内存里的缓存，
    // 这才是真正的往返验证）
    const proj = await store.get('foo-bar')
    // ⚠️ 下面全部用 ?. ：get() 找不到项目时返回 undefined，
    // 不加问号 TypeScript 会直接报错，也会在断言时炸出难懂的错。
    expect(proj?.interview).toHaveLength(1) // 需求应该正好 1 条
    // [0] 取第 0 项（数组下标从 0 开始），?.field 再取它的字段名
    expect(proj?.interview[0]?.field).toBe('mainFeature') // field 对得上
    expect(proj?.design).toBe('模块 A + 模块 B') // 中文设计稿一字不差
    expect(proj?.tasks).toBe('task 1') // 任务清单对得上
  })

  // --------------------------------------------------------------------------
  // 测试 5：完整走一遍状态机（关键回归测试）
  // --------------------------------------------------------------------------
  // 一口气走完全部六道工序。这条测试守着 AUTO/GATE 的划分：
  //   tasks / generate / verify 回来必须是 awaitingGate=false 且状态为 auto
  //   design 和 deliver 必须是关卡
  // 如果以后有人加一道新工序、改了关卡位置，这条测试会第一时间红给你看。
  it('走完整个状态机并正确标记自动/关卡工序', async () => {
    await store.create({ pluginName: 'foo-bar', fuzzyIdea: 'idea' })

    // 用 `let` 而不是 `const`，因为下面 r 要被反复重新赋值。
    // 如果写成 const，第 2 次赋值那行就会直接编译报错。
    //
    // interview → design（关卡）
    let r = await store.advance('foo-bar', { decision: 'accept' }) // 用 let，后面还要复赋值
    expect(r.nextStage).toBe('design') // 到了第 2 道
    expect(r.awaitingGate).toBe(true) // design 是关卡，要用户点
    // 「离开的那一格标完成」+「落下的那一格标关卡」= 状态机推进的完整语义
    expect(r.project.stages.find((s) => s.stage === 'interview')?.status).toBe('done')
    expect(r.project.stages.find((s) => s.stage === 'design')?.status).toBe('gate')

    // design → tasks（自动）
    r = await store.advance('foo-bar', { decision: 'accept' })
    expect(r.nextStage).toBe('tasks') // 到了第 3 道
    expect(r.awaitingGate).toBe(false) // 自动工序，不用用户点
    expect(r.project.stages.find((s) => s.stage === 'design')?.status).toBe('done')
    expect(r.project.stages.find((s) => s.stage === 'tasks')?.status).toBe('auto') // 自动工序标 auto

    // tasks → generate（自动）
    r = await store.advance('foo-bar', { decision: 'accept' })
    expect(r.nextStage).toBe('generate')

    // generate → verify（自动）
    r = await store.advance('foo-bar', { decision: 'accept' })
    expect(r.nextStage).toBe('verify')

    // verify → deliver（关卡）
    r = await store.advance('foo-bar', { decision: 'accept' })
    expect(r.nextStage).toBe('deliver')
    expect(r.awaitingGate).toBe(true) // deliver 是关卡

    // deliver → deliver（被夹住）
    // 最后再 accept 一次，应该停在原地，而不是冲出 STAGE_ORDER 尾部
    // 变成 undefined。这条是**边界防护**：
    // 一旦这里没夹住，nextStage 会是 undefined，
    // 后面所有拿它查进度条的地方全会炸。
    r = await store.advance('foo-bar', { decision: 'accept' })
    expect(r.nextStage).toBe('deliver')
  })

  // --------------------------------------------------------------------------
  // 测试 6：revise 必须原地不动
  // --------------------------------------------------------------------------
  it('revise 会让项目停在原地', async () => {
    // revise 绝不能让状态机往前跑 —— 这是它和 accept 的根本区别。
    // 守的是「用户点了『返工』，结果工序还是往前走」这种致命 bug。
    // 注意：feedback 文字虽然 API 收下了但不会落盘 —— 见 CraftStore.advance()
    // 上面的文档注释。
    await store.create({ pluginName: 'foo-bar', fuzzyIdea: 'idea' })
    const r = await store.advance('foo-bar', {
      decision: 'revise', // 原地返工
      feedback: '再补点', // 用户说的问题
    })
    expect(r.nextStage).toBe('interview') // 工序没变
    expect(r.awaitingGate).toBe(true) // 仍然在关卡上等用户重新审
  })

  // --------------------------------------------------------------------------
  // 测试 7：删除项目
  // --------------------------------------------------------------------------
  it('删除项目', async () => {
    // 删除要同时清掉目录和列表项；而且删一个从没建过的名字
    // 应该是空操作而不是报错。
    await store.create({ pluginName: 'foo-bar', fuzzyIdea: 'idea' })
    await store.remove('foo-bar') // 删
    const list = await store.list() // 再列一次
    expect(list).toHaveLength(0) // 应该空了
  })
})


// ############################################################################
// 分组 2：isValidPluginName 直接单测
// ############################################################################
//
// 【为什么要单独测一遍，store 里不是已经调过了吗】
//   因为 store 那边的测试是「间接」的：它只验证「非法名会被拒绝」，
//   但没有穷举各种非法形态。这里的每一条都直接打在这个谓词函数上，
//   边界一目了然，将来改正则表达式能立刻看出漏了哪种情况。
//
//   单独拿出来测，还因为这个谓词是**路径穿越防线**本身：
//   它的边界情况重要程度不亚于 store 的任何一条业务逻辑。
describe('isValidPluginName', () => {
  it('接受合法的目录名，拒绝不合法的', async () => {
    // 【这里的动态 import 是什么】
    //   `await import('../src/types')` —— 不在文件开头写 import，
    //   而是在函数执行到这一行时才去加载模块，**返回一个 Promise**。
    //   它和顶部 import 的区别：
    //     · 顶部 import  = 文件一加载就执行
    //     · 动态 import  = 真正执行到这行才加载（所以要 await）
    //   【为什么要在这用动态写法】
    //     纯粹是因为这个函数是纯函数（不依赖 store 那个 describe 里的变量），
    //     写在哪都能跑。写成动态 import 不会带来任何实际好处，
    //     顶部 import 是更常见、更符合直觉的写法 —— 这里保持现状只是因为
    //     它也能正常工作。
    //   【解构 = 从对象里挑出某几个属性】
    //     `const { isValidPluginName } = await import('../src/types')`
    //     等价于：先拿到整个模块对象，再把里面的 isValidPluginName 摘出来。
    //     和顶部 `import { isValidPluginName } from '../src/types'` 是同一个意思。
    const { isValidPluginName } = await import('../src/types')
    // 边界逐条打表：
    expect(isValidPluginName('a')).toBe(false) // 太短（下限 2 个字符）
    expect(isValidPluginName('device-scanner')).toBe(true) // 正常连字符名，合法
    expect(isValidPluginName('a-b-c-d-1-2-3')).toBe(true) // 混合连字符和数字，合法
    expect(isValidPluginName('Has-Caps')).toBe(false) // 有大写，非法
    expect(isValidPluginName('-leading')).toBe(false) // 连字符开头，非法
    expect(isValidPluginName('trailing-')).toBe(false) // 连字符结尾，非法
  })
})
