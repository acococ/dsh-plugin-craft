# dsh-plugin-craft v0.3.3 — 2026-07

> **DSH Plugin Workshop** — 注册 Chat preset「插件工坊」（id `craft`），把 Chat 变成五阶段引导的插件开发对话。

---

## ✨ 这个版本是什么

`dsh-plugin-craft` 是 DeepSeek Harness（DSH）的官方兼容插件。它在 Chat 里注册一个名为 **「插件工坊」** 的预设（preset id `craft`），让产品经理/普通用户**用自然语言**告诉 DSH 你想做什么插件，DSH 自动完成需求采访 → 设计 → 任务拆分 → 代码生成 → 验证。

| | |
|---|---|
| **Harness 兼容** | `0.1.7-rc.2` 或更高 |
| **Node** | `^22.19.0` 或 `>=24.0.0` |
| **平台** | Windows / macOS / Linux |
| **License** | Apache-2.0 |

---

## 🚀 三步安装

### 1. 选一个安装方式

**方式 A · 从 GitHub Releases 装 tarball（推荐，零编译）**

下载 [`dsh-plugin-craft-0.3.3.tgz`](https://github.com/acococ/dsh-plugin-craft/releases/download/v0.3.3/dsh-plugin-craft-0.3.3.tgz)，然后：

```powershell
dsh plugin --profile web add "C:\path\to\dsh-plugin-craft-0.3.3.tgz"
```

**方式 B · 从 GitHub 源码装（需 pnpm ≥10）**

```powershell
dsh plugin --profile web add "github:acococ/dsh-plugin-craft#v0.3.3"
```

### 2. 重启 DSH host

```powershell
# 关闭正在运行的 dsh web 会话，再重新启动
dsh --profile web
```

### 3. 浏览器硬刷新

```
Ctrl + Shift + R
```

---

## 🎯 怎么用

1. 打开 DSH Web UI：`http://127.0.0.1:3080`
2. 进入 **Chat**，点击 **preset 选择器**（Chat 顶部）
3. 选 **「插件工坊」**（id `craft`）
4. 用自然语言描述你想做什么，例如：
   > "我希望 DSH 在我快下班时提醒我哪些任务还没完成"
   > "我每次打开 DSH 都能看到 NAS 的健康状态"

工坊会按下面 5 个阶段引导你：

| # | 阶段 | 你要做什么 | DSH 在做什么 |
|---|---|---|---|
| 1 | **采访** | 点击选项卡回答 5-7 个产品级问题 | 把答案落到 `01-interview.md` |
| 2 | **设计** | 看模块划分 + `cordis.patch.yml` 骨架，同意或退回 | 起草 `02-design.md` |
| 3 | **拆任务** | 不需要 | 把设计拆成 DAG，写到 `03-tasks.md` |
| 4 | **生成代码** | 不需要 | 写出 `src/` / `tests/` / `package.json` / `cordis.patch.yml` / 双语 README |
| 5 | **验证** | 不需要（最多自动修 3 轮） | `dsh-plugin-dev check --strict` + 冒烟测试 + 需求覆盖 |

完成后工坊交付 `04-implementation/`，**绝不自动 install 到当前 profile**——是否安装由你决定。

### Chat 里的工具

工坊在 Chat 里直接暴露 3 个工具，模型可直接调用：

| 工具 | 作用 |
|---|---|
| `craft.create_project` | 一句话起一个新项目 |
| `craft.appendinterview` | 把可点击问题答案写入需求日志 |
| `craft.advance_stage` | 接受当前阶段或退回修订 |

---

## 📦 依赖关系（profile 必须已具备）

工坊在 Chat 模式下工作需要以下 5 个官方包提供配套能力，标准 `web` profile 自带无需单独装：

| 引用名 | npm 包名 | 作用 |
|---|---|---|
| `@deepseek-ai/dsh-agent-preset` | `@deepseek-ai/dsh-agent-preset` | preset 注册入口 |
| `@deepseek-ai/dsh-persona` | `@deepseek-ai/dsh-persona` | 主持人 system prompt |
| `@deepseek-ai/dsh-tool-ask-user` | `@deepseek-ai/dsh-tool-ask-user` | 可点击选项卡 |
| `@deepseek-ai/dsh-skill-filesystem` | `@deepseek-ai/dsh-skill-filesystem` | skills 目录挂载 |
| `@deepseek-ai/dsh-tool-skill` | `@deepseek-ai/dsh-tool-skill` | `skill` 工具调用 |

用自定义 / 裁剪 profile 时，先验证：

```powershell
dsh --profile <name> --dump-config | Select-String "dsh-agent-preset|dsh-persona|dsh-tool-ask-user|dsh-skill-filesystem|dsh-tool-skill"
```

缺哪个用 `dsh plugin add @deepseek-ai/<pkg>` 补哪个。

---

## 📝 项目落盘位置

工坊数据写到 `$DSH_HOME/projects/dsh-plugin-craft/<plugin-name>/`：

```
<plugin-name>/
├── project.json          # 工坊项目状态
├── 01-interview.md       # 阶段 1
├── 02-design.md          # 阶段 2
├── 03-tasks.md           # 阶段 3
├── 04-implementation/    # 阶段 4 (src/, tests/, package.json, cordis.patch.yml, README)
└── 05-verify-report.md   # 阶段 5
```

要换位置，在 profile `cordis.patch.yml` 覆盖：

```yaml
- id: dsh-plugin-craft
  config:
    projectsDir: 'D:/my-projects/workshop'
    maxListedProjects: 100
```

---

## 🛠 卸载

```powershell
dsh plugin --profile web remove dsh-plugin-craft
# 重启 dsh host
```

仅删插件，项目数据保留在磁盘上。

---

## 🔧 这个版本改了什么 (0.3.2 → 0.3.3)

### 仓库整理
- 新增 `.gitignore` 排除 `node_modules/`、`lib/`、`*.tgz`
- 把 11000+ 个 `node_modules` 文件从 git 索引中清理（保留磁盘文件）
- 删除不存在的 `README-es.md` / `README-pt.md` / `README-hi.md` 引用
- 修复 `pnpm-workspace.yaml` 中无效的 `esbuild: set this to true or false` 占位符
- Bump 版本号 0.3.2 → 0.3.3

### 文档
- 重写 `安装插件命令.txt`：完整安装 / 升级 / 卸载 / 打包 / **依赖关系** / 版本要求 7 节
- 重写 `USAGE.md`：去除 0.3.0 之前已废弃的"侧边栏图标 + Web tab"叙述，融入依赖图
- `README.md` / `README-zh.md` 加入 GitHub 仓库地址和"配套包"兼容性行

### 质量
- `tsc --noEmit` exit 0
- `pnpm test` 8/8 passed
- `pnpm pack` tarball 12.9 KB，含 10 个文件 (`cordis.patch.yml` + `lib/index.{mjs,d.mts}` + 双语 README + locale + icon)

---

## ⚠️ 0.3.0 破坏性变更（仍在生效）

0.3.0 起，工坊**不再是**带 Web 侧边栏图标 / 独立页面的插件——而是一个 Chat preset。
如果旧版（≤0.2.0）的侧边栏图标还在，重启 `dsh --profile web` 就会清除。

---

## 📄 许可证

[Apache License 2.0](https://github.com/acococ/dsh-plugin-craft/blob/main/LICENSE) © 2026 dsh-plugin-craft contributors.

## 🔗 链接

- **仓库**：<https://github.com/acococ/dsh-plugin-craft>
- **Issue**：<https://github.com/acococ/dsh-plugin-craft/issues>
- **DSH 官方**：<https://github.com/deepseek-ai/deepseek-harness>