# dsh-plugin-craft（DSH 插件工坊）

> **DSH Plugin Workshop** —— 一个为产品经理设计的 DSH 插件开发引导插件。把 Chat 变成"五阶段引导式对话"，让普通用户**用自然语言**告诉 DSH 想做什么插件，DSH 自动完成需求采访 → 设计 → 任务拆分 → 代码生成 → 验证全过程。
>
> 源码仓库：<https://github.com/acococ/dsh-plugin-craft>
> Releases：<https://github.com/acococ/dsh-plugin-craft/releases>
> 当前版本：**v0.3.3**

---

## ✨ 这个插件能做什么

`dsh-plugin-craft` 是 DeepSeek Harness（DSH）的官方兼容插件。装上之后，在 DSH Chat 的 **preset 选择器**里会出现一个名为 **「插件工坊」** 的预设。选上它，Chat 会以"插件工坊主持人"人格重新加载会话，引导你完成下面五阶段：

| # | 阶段 | 你要做什么 | 工坊做什么 |
|---|---|---|---|
| **1** | 采访 | 点选项卡回答 5-7 个产品级问题 | 把答案落到 `01-interview.md` |
| **2** | 设计 | 看模块划分 + `cordis.patch.yml` 骨架，同意或退回 | 起草 `02-design.md` |
| **3** | 拆任务 | 不需要 | 把设计拆成 DAG，写到 `03-tasks.md` |
| **4** | 生成代码 | 不需要 | 写出 `src/` / `tests/` / `package.json` / `cordis.patch.yml` / 双语 README |
| **5** | 验证 | 不需要（最多自动修 3 轮） | `dsh-plugin-dev check --strict` + 冒烟测试 + 需求覆盖 |

完成后工坊交付 `04-implementation/`，**绝不自动 install 到当前 profile** —— 是否安装由你决定。

---

## 🚀 三步安装

### 方式 A · 从 GitHub Releases 装 tarball（推荐，零编译）

1. 到 <https://github.com/acococ/dsh-plugin-craft/releases> 下载 `dsh-plugin-craft-0.3.3.tgz`
2. 装到 DSH：

   ```powershell
   dsh plugin --profile web add "C:\path\to\dsh-plugin-craft-0.3.3.tgz"
   ```

3. 重启 `dsh --profile web`，浏览器 `Ctrl + Shift + R` 硬刷新

### 方式 B · 从 GitHub 源码装（需 pnpm ≥10）

```powershell
dsh plugin --profile web add "github:acococ/dsh-plugin-craft#v0.3.3"
```

第一次会触发 `prepare` 脚本构建，需要在 profile 的 `pnpm-workspace.yaml` 里加：

```yaml
allowBuilds:
  dsh-plugin-craft: true
```

### 方式 C · 从 npm 装（计划中）

```powershell
# 暂未发布到 npm；上面两种方式任选一种即可
```

### 验证安装

```powershell
dsh --profile web --dump-config | Select-String dsh-plugin-craft
```

应该看到两行：`preset-craft` + `dsh-plugin-craft`。然后在 DSH Chat 的 preset 下拉里应能看到 **「插件工坊」**。

---

## 📦 依赖关系（重点 —— 工坊需要配合 7 个插件一起使用）

工坊本身**只提供** Chat preset 的"工坊控制器"（`CraftStore`）+ 三个 Chat 工具。**完整的五阶段工作流**需要 **5 个官方插件 + 2 个社区插件**协同工作：

### A 组 · DSH 官方插件（标准 `web` profile 已具备）

> ✅ 标准 `web` profile 默认已经全部具备，无需手动装。
> ⚠️ 自定义 / 裁剪 profile 必须单独安装。

| 配套插件 | npm 包名 | 工坊为什么需要它 | 阶段 |
|---|---|---|---|
| **`@deepseek-ai/dsh-agent-preset`** | `@deepseek-ai/dsh-agent-preset` | preset 注册入口 | 全程 |
| **`@deepseek-ai/dsh-persona`** | `@deepseek-ai/dsh-persona` | 覆盖 system prompt，让模型扮"插件工坊主持人" | 全程 |
| **`@deepseek-ai/dsh-tool-ask-user`** | `@deepseek-ai/dsh-tool-ask-user` | 可点击选项卡工具 | 阶段 1 / 2 |
| **`@deepseek-ai/dsh-skill-filesystem`** | `@deepseek-ai/dsh-skill-filesystem` | 挂载 skills 目录 | 阶段 2 / 4 |
| **`@deepseek-ai/dsh-tool-skill`** | `@deepseek-ai/dsh-tool-skill` | `skill` 工具调用 | 阶段 2 / 4 |

### B 组 · 社区插件（必须另外安装，工坊核心工作流依赖）

> ⚠️ 这两个插件是工坊**真正干活的"手脚"**——阶段 3 的任务拆分、阶段 4 的并行代码生成，都靠它们。
> ❌ 没装这2个插件，工坊阶段 1/2 能跑（聊天提问），阶段 3/4 会"模型只能用文字描述"。

| 配套插件 | npm 包名 | 仓库 | 工坊为什么需要它 | 阶段 | 安装命令 |
|---|---|---|---|---|---|
| **`@nanmicoder/dsh-agent-teams`** | `@nanmicoder/dsh-agent-teams` | <https://github.com/NanmiCoder/dsh-agent-teams> | 把设计稿拆成 DAG、并行调度多个 Engineer agent | 阶段 3 / 4 | `dsh plugin --profile web add @nanmicoder/dsh-agent-teams` |
| **`dsh-plugin-guide`** | `dsh-plugin-guide` | <https://github.com/PerryLink/dsh-plugin-guide> | 提供 `cordis-plugin-development`、`editing-cordis-compositions`、`cordis-composition-reference` 三个开发 skill | 阶段 2 / 4 | `dsh plugin --profile web add dsh-plugin-guide` |

### 一次性安装全部依赖

在装 `dsh-plugin-craft` 之前先装这两个社区插件（如果还没装的话）：

```powershell
dsh plugin --profile web add @nanmicoder/dsh-agent-teams
dsh plugin --profile web add dsh-plugin-guide
dsh plugin --profile web add "github:acococ/dsh-plugin-craft#v0.3.3"
# 重启 dsh host
dsh --profile web
```

工坊会在 `cordis.patch.yml` 的 `preset-craft.plugins` 里**显式声明**这两个插件作为 preset 成员，确保选「插件工坊」preset 时它们自动加载到 Agent（不依赖 profile 默认组合）。

### 验证全部就绪

```powershell
dsh --profile web --dump-config | Select-String "dsh-agent-preset|dsh-persona|dsh-tool-ask-user|dsh-skill-filesystem|dsh-tool-skill|dsh-agent-teams|dsh-plugin-guide|dsh-plugin-craft"
```

输出应包含**全部 8 条**记录（5 个官方 + 2 个社区 + dsh-plugin-craft 本身）。

### 这个插件本身依赖（peerDependencies）

```json
{
  "@deepseek-ai/cordis": "^4.0.2",
  "@deepseek-ai/dsh-tools": ">=0.1.2-rc.1 <0.2.0 || >=0.1.5-alpha.1 <0.2.0 || >=0.1.6-0 <0.2.0 || >=0.1.7-0 <0.2.0",
  "@deepseek-ai/schemastery": "^3.18.2"
}
```

这些由 DSH 宿主自带，独立装插件包无需重复声明。

---

## 🎯 怎么用

1. 打开 DSH Web UI：<http://127.0.0.1:3080>
2. 进入 **Chat**
3. 点击 Chat 顶部的 **preset 选择器**
4. 选 **「插件工坊」**（id `craft`，order=50）
5. 用自然语言告诉工坊你想做什么，例如：
   > "我每次打开 DSH 都能看到 NAS 的健康状态"
   > "我希望 DSH 在我快下班时提醒我哪些任务还没完成"

### Chat 里的工具（模型使用，用户不直接调用）

工坊在 Chat 里直接暴露 3 个工具，模型可调用：

| 工具 | 作用 | 调用方 |
|---|---|---|
| `craft.create_project` | 一句话起一个新项目 | 模型在阶段 1 开头调用 |
| `craft.appendinterview` | 把可点击问题答案写入需求日志 | 模型每收到一个点击答案就调用一次 |
| `craft.advance_stage` | 接受当前阶段 / 退回修订 | 模型在阶段 1/2/5 结尾调用 |

调用示例（用户看到的是自然语言，模型内部用）：

```
craft.create_project({
  pluginName: "device-scanner",
  fuzzyIdea: "让 AI 看到我家里有哪些设备在线"
})
→ { pluginName: "device-scanner", stage: "interview" }
```

---

## 🗂 项目落盘位置

工坊数据写到 `$DSH_HOME/projects/dsh-plugin-craft/<plugin-name>/`（默认）：

```
my-foo/
├── project.json           # 工坊的项目状态（stage / interview / design / stages...）
├── 01-interview.md        # 阶段 1 产物
├── 02-design.md           # 阶段 2 产物
├── 03-tasks.md            # 阶段 3 产物
├── 04-implementation/     # 阶段 4 产物（src/、tests/、cordis.patch.yml…）
└── 05-verify-report.md    # 阶段 5 产物
```

要换位置，在 profile 的 `cordis.patch.yml` 覆盖 `dsh-plugin-craft` 行的 `config`：

```yaml
- id: dsh-plugin-craft
  config:
    projectsDir: 'D:/my-projects/workshop'
    maxListedProjects: 100
```

---

## ⚙️ 兼容性

| 项 | 要求 |
|---|---|
| Harness | DeepSeek Harness `0.1.7-rc.2` 或更高 |
| Node | `^22.19.0 \|\| >=24.0.0` |
| 平台 | Windows / macOS / Linux（全平台，纯 ESM；无原生代码，安装时无网络） |

---

## 🛠 卸载

```powershell
dsh plugin --profile web remove dsh-plugin-craft
# 重启 dsh host
```

仅删插件，**项目数据保留在磁盘上**。要彻底清理工坊产物可手动 `rm -rf $DSH_HOME/projects/dsh-plugin-craft/`。

---

## ⚠️ 0.3.0 破坏性变更（仍在生效）

旧版本（≤0.2.0）会注册一个侧边栏图标 + main 面板，把工坊做成独立 Web 标签。**0.3.0 起工坊不再是带 Web 侧边栏图标 / 独立页面的插件 —— 而是一个 Chat preset**。

如果旧版残留的侧边栏图标还在，重启 `dsh --profile web` 就会清除。

---

## 🧑‍💻 自己开发本插件

```sh
pnpm install          # 拉依赖（pnpm ≥10）
pnpm run typecheck    # tsc --noEmit
pnpm test             # vitest run（8 个 store 测试）
pnpm run build        # tsdown → lib/index.{mjs,d.mts}
pnpm pack             # 出 dsh-plugin-craft-X.Y.Z.tgz
```

---

## 🔒 安全边界

工坊**绝不自动 install** 你开发的插件到当前 profile。交付物只是磁盘上的项目目录，是否 install 需要用户单独确认（不在本插件范围内）。

---

## 🐛 故障排查

| 现象 | 原因 | 处理 |
|---|---|---|
| preset 下拉里看不到「插件工坊」 | 浏览器没拿到新的 `__DSH_BOOT__` | `Ctrl + Shift + R` 硬刷新 |
| 硬刷新后仍看不到 | DSH host 进程仍持有旧 preset 列表 | 重启 `dsh --profile web` |
| `dsh plugin add` 失败：`cannot find module '@deepseek-ai/dsh-agent-preset'` 等 | 当前 profile 缺被引用子条目 | 见上文"依赖关系"，按缺失项补装 |
| **阶段 3 只能产出文字 DAG、没真正派 worker** | 没装 `@nanmicoder/dsh-agent-teams` 社区插件 | `dsh plugin --profile web add @nanmicoder/dsh-agent-teams` 后重启 |
| **阶段 4 写出的 `cordis.patch.yml` 不符合规范** | 没装 `dsh-plugin-guide`，模型读不到 `cordis-plugin-development` skill | `dsh plugin --profile web add dsh-plugin-guide` 后重启 |
| 报 "peerDependencies not met" | DSH host 版本 < 0.1.7-rc.2 | 升级 host 到 0.1.7-rc.2 或更高 |
| Chat 工具调用失败：项目目录无法写入 | `projectsDir` 路径不存在或无写权限 | 检查绝对路径/权限，或在 profile 里覆盖 |
| 阶段 5 三轮不过 | 生成代码有红线 / 冒烟失败 | 模型会把失败交回给你（不是插件 bug） |
| Git 源安装时报 `ERR_PNPM_ALLOW_BUILD_NOT_SET` | pnpm ≥10 默认拒绝 git 依赖跑 prepare | 在 profile 的 `pnpm-workspace.yaml` 加 `allowBuilds: { dsh-plugin-craft: true }` |

---

## 📄 许可证

[Apache License 2.0](LICENSE) © 2026 dsh-plugin-craft contributors.

---

## 🔗 链接

- **仓库**：<https://github.com/acococ/dsh-plugin-craft>
- **Issue 反馈**：<https://github.com/acococ/dsh-plugin-craft/issues>
- **DSH 官方仓库**：<https://github.com/deepseek-ai/deepseek-harness>
- **DSH 文档**：<https://deepseek-harness.github.io/deepseek-harness/>
- **插件模板参考**：[omdsh-dev/plugin-template](https://github.com/omdsh-dev/plugin-template)