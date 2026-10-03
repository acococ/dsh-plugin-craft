# DSH 插件工坊（dsh-plugin-craft）使用手册

> 把"开发一个 DSH 插件"这件事变成五阶段引导流程；只在阶段 1（采访）和阶段 2（设计）需要你拍板，阶段 3/4/5 全自动。
>
> 当前版本 **0.3.3**（2026-07 系列），已切换为 **Chat preset** 形态：插件不再注册 Web 侧边栏图标/独立页面，只注册一个名为「插件工坊」（id `craft`）的 Chat 预设。

---

## 1. 安装与启动

`dsh-plugin-craft` 通过 `dsh plugin` 命令装到 DSH 的某个 profile（默认 `web`）。

### 1.1 安装命令

从本地 tarball 安装：

```powershell
dsh plugin --profile web add "C:\Users\Administrator\.dsh\projects\dsh-plugin-craft\dsh-plugin-craft-0.3.3.tgz"
```

从 GitHub 直接装：

```powershell
dsh plugin --profile web add "github:acococ/dsh-plugin-craft#v0.3.3"
```

> 完整的安装/升级/卸载/打包命令清单见 [安装插件命令.txt](安装插件命令.txt)。

### 1.2 必装依赖（profile 必须已具备）

本插件以 **bundle 插件** 形式分发（`dsh.bundle.patch` 指向 `cordis.patch.yml`），其内嵌的 `preset-craft` 行会引用以下 5 个官方子条目：

| 引用名 | npm 包名 | 作用 |
|---|---|---|
| `@deepseek-ai/dsh-agent-preset` | `@deepseek-ai/dsh-agent-preset` | preset 注册入口 |
| `@deepseek-ai/dsh-persona` | `@deepseek-ai/dsh-persona` | persona system prompt section |
| `@deepseek-ai/dsh-tool-ask-user` | `@deepseek-ai/dsh-tool-ask-user` | 可点击选项卡工具 |
| `@deepseek-ai/dsh-skill-filesystem` | `@deepseek-ai/dsh-skill-filesystem` | 挂载 skills 目录 |
| `@deepseek-ai/dsh-tool-skill` | `@deepseek-ai/dsh-tool-skill` | 让模型能调用 `skill` |

DSH 标准 `web` profile 已经自带上述 5 项，无需单独装。若使用自定义 / 裁剪过的 profile，请先用 `dsh --profile <name> --dump-config` 检查；缺哪个就 `dsh plugin add @deepseek-ai/<name>` 补哪个。

### 1.3 启动并进入工坊

1. 打开 DSH Web UI：`http://127.0.0.1:3080`
2. 进入 **Chat**
3. 点击 Chat 顶部的 **preset 选择器**（齿轮 / preset 下拉）
4. 在下拉里选 **「插件工坊」**（id `craft`，order=50）
5. 会话自动以工坊 preset 重新挂载，system prompt 切到「插件工坊主持人」人格

> 首次安装后浏览器需要硬刷新（Ctrl + Shift + R）让 `__DSH_BOOT__` 加载新的入口。

---

## 3. Chat 工坊中的工具

工坊在 Chat 里暴露了 3 个工具，模型可以直接调用；用户不需要写代码。

### 3.1 `craft.create_project`

从 Chat 一句话起一个新项目。

```
pluginName: device-scanner          # 必填，匹配 /^[a-z][a-z0-9-]*[a-z0-9]$/
fuzzyIdea:  "让 AI 看到我家里有哪些设备在线"   # 必填，一句话想法
```

返回 `{pluginName, stage: "interview"}`。

### 3.2 `craft.appendinterview`

每答完一道可点击问题后调用，把答案落到工坊需求日志。

```
pluginName: device-scanner
field:      mainFeature
value:      "扫描局域网网段"
```

返回 `{pluginName, field, value, total}`。

### 3.3 `craft.advance_stage`

阶段 1 接受后进入阶段 2；阶段 5 通过后回交成果。

```
pluginName: device-scanner
decision:   "accept"    # 或 "revise"
feedback:   "再补点主功能的描述"   # revise 时可选
```

返回 `{nextStage, awaitingGate}`。

---

## 4. 五阶段流程（从 0.3.x 开始以 Chat 为载体）

```
[阶段 1] 采访  →  [阶段 2] 设计  →  [阶段 3] 拆任务  →  [阶段 4] 生成  →  [阶段 5] 验证  →  [交付]
   GATE     看稿确认     AUTO          AUTO          AUTO        GATE
```

| 阶段 | 谁在干活 | 是否需要你 | 你能做什么 |
|---|---|---|---|
| **1 采访需求** | 模型 + 你 | **需要** | 在 Chat 里点选项卡回答 5-7 个产品级问题 |
| **2 设计架构** | 模型 | 需要你看 | 看模型给出的模块划分 / cordis.patch.yml 骨架，同意或退回 |
| **3 拆任务** | 模型（agent-teams） | 不问 | 看模型把任务拆成 DAG 落到 `03-tasks.md` |
| **4 生成代码** | 模型（worker） | 不问 | 看 `src/` / `tests/` / `package.json` / `cordis.patch.yml` / 双语 README 被写出 |
| **5 检查上线** | 模型（dsh-plugin-dev） | 不问 | 看红线 / 冒烟 / 需求覆盖结果；最多自动修 3 轮 |
| **交付** | 模型 | 需要你 | 看产物、决定要不要 install 到当前 profile（手动 install） |

---

## 5. 项目落盘位置

工坊数据写到 `$DSH_HOME/projects/dsh-plugin-craft/<plugin-name>/`（默认）。要在 profile 里换位置，覆盖 `dsh-plugin-craft` 行的 `config`：

```yaml
- id: dsh-plugin-craft
  config:
    projectsDir: 'D:/my-projects/workshop'
    maxListedProjects: 100
```

每个项目目录结构：

```
<plugin-name>/
├── project.json           # 工坊的项目状态（stage / interview / design / stages...）
├── 01-interview.md        # 阶段 1 产物
├── 02-design.md           # 阶段 2 产物
├── 03-tasks.md            # 阶段 3 产物
├── 04-implementation/     # 阶段 4 产物（生成的 src/、tests/、cordis.patch.yml…）
└── 05-verify-report.md    # 阶段 5 产物
```

---

## 6. install 到 profile 是手动操作

工坊**绝不自动 install** 你开发的插件。阶段 5 通过后模型把交付物（`04-implementation/`）展示出来，是否安装到当前 profile 需要你单独授权：

```powershell
cd "<你开发的项目目录>/04-implementation"
pnpm pack
dsh plugin --profile web add ./<pkg>.tgz
```

或者用 DSH 设置面板的「Plugins」标签页一键装。装完要重启 DSH host。

---

## 7. 故障排查

| 现象 | 原因 | 处理 |
|---|---|---|
| preset 下拉里看不到「插件工坊」 | 浏览器没拿到新的 `__DSH_BOOT__` | Ctrl+Shift+R 硬刷新 |
| 硬刷新后仍看不到 | DSH host 进程仍持有旧 preset 列表 | 重启 `dsh --profile web` |
| `dsh plugin add` 失败：`cannot find module '@deepseek-ai/dsh-agent-preset'` 等 | 当前 profile 缺被引用子条目 | 见 §1.2，按缺失项补装 |
| 报 "peerDependencies not met" | DSH host 版本 < 0.1.7-rc.2 | 升级 host 到 0.1.7-rc.2 或更高 |
| Chat 工具调用失败：项目目录无法写入 | `projectsDir` 路径不存在或无写权限 | 检查绝对路径/权限，或在 profile 里覆盖 |
| 阶段 5 三轮不过 | 生成代码有红线 / 冒烟失败 | 模型会把失败交回给你（不是插件 bug） |

---

## 8. 当前状态（截至 2026-07 系列，0.3.3）

| 检查 | 结果 |
|---|---|
| `tsc --noEmit` | ✅ exit 0 |
| `pnpm test` | ✅ 8/8 tests pass |
| `pnpm run build` | ✅ lib/index.mjs + lib/index.d.mts |
| `pnpm pack` | ✅ 10 文件 tarball，10 KB+ |
| tarball 内容 | `cordis.patch.yml` + `lib/index.{mjs,d.mts}` + 双语 README + locale + icon + LICENSE + package.json |

---

## 9. 许可证

[Apache License 2.0](LICENSE) © 2026 dsh-plugin-craft contributors.