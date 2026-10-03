# dsh-plugin-craft

DSH 插件工坊 —— 注册一个名为 **「插件工坊」** 的预设（preset id `craft`），把 Chat 变成五阶段引导的开发插件对话。在 Web 的预设下拉里选这个预设，Chat 会用「插件工坊主持人」人格重新加载会话。

## 兼容性

| 项 | 状态 |
|---|---|
| Harness | DeepSeek Harness `0.1.7-rc.2` |
| Node | `^22.19.0 \|\| >=24.0.0` |
| 平台 | 全部（纯 ESM；无原生代码，安装时无网络） |

## 怎么用

1. 打开 DSH 的 Chat，点击 **preset 选择器**，选「**插件工坊**」（id `craft`）。会话以该预设重新挂载。
2. 用自然语言告诉助手你想做什么。助手会按五阶段引导：

| 阶段 | 做什么 |
|---|---|
| 1. 采访 | 助手一次一个问题，你直接在 Chat 里回答。每条答案通过 Chat 内部工具（背后的工坊）落到需求日志。 |
| 2. 设计 | 你接受阶段 1 后，助手起草 `cordis.patch.yml` 骨架 + 模块拆分，请你确认。 |
| 3. 拆任务 | 助手（或 `dsh-agent-teams`）把设计拆成 DAG，写到 `03-tasks.md`。 |
| 4. 生成代码 | 工程师们写 `src/`、`tests/`、`package.json`、`cordis.patch.yml`、中英 README。每个 worker 报完先跑 `dsh-plugin-dev check`。 |
| 5. 检查上线 | `dsh-plugin-dev check --strict` + `dsh-plugin-dev verify` + 需求覆盖核验。最多自动修 3 轮；全失败的话助手把失败交回给你。 |

阶段 5 通过后助手把成果交给你。**绝不自动 install** 到当前 profile —— install 需要你手动跑 `dsh plugin --profile web add ./<pkg>.tgz`。

## 装了什么

一个 Host 模块，当它在 `preset-craft` preset 下激活时:

- 把 `CraftStore` 暴露成 `ctx.craft`,Agent 可读写工坊状态
- 注册两个 Chat 工具:`craft.create_project` 和 `craft.advance_stage`,Agent 用它们起项目和推进阶段

`preset-craft` 自己在 `cordis.patch.yml` 里声明,包含:

| 子条目 | 作用 |
|---|---|
| `@deepseek-ai/dsh-persona` | 覆盖 system prompt,让模型知道自己是「插件工坊」主持人 |
| `dsh-plugin-craft`(本插件) | 提供上面两个 Chat 工具 + 磁盘上的持久化存储 |
| `@deepseek-ai/dsh-skill-filesystem` | 挂载 `@deepseek-ai/dsh-agent-preset/skills/` 目录,让 Agent 拿到 `cordis-plugin-development`、`editing-cordis-compositions`、`cordis-composition-reference` 三个 skill |

## 项目存哪

工坊数据写到 `$DSH_HOME/projects/dsh-plugin-craft/<plugin-name>/project.json`(默认)。要换位置,改 profile 的 `cordis.patch.yml`:

```yaml
- id: dsh-plugin-craft
  config:
    projectsDir: 'D:/my-projects/workshop'
    maxListedProjects: 100
```

## Chat 工具

### `craft.create_project`
```
pluginName: device-scanner
fuzzyIdea: "让 AI 看到我家里有哪些设备在线"
```
返回 `{pluginName, stage}`。

### `craft.advance_stage`
```
pluginName: device-scanner
decision: "accept"   # 或 "revise"
feedback: "再补点主功能的描述"   # revise 时才填
```
返回 `{nextStage, awaitingGate}`。

## 0.3.0 破坏性变更

旧版本(≤0.2.0)会注册一个侧边栏图标 + main 面板,把工坊做成独立 Web 标签。**0.3.0 删掉了侧边栏和 Web 标签** —— 现在工坊是 Chat 对话,不是 Web 页面。如果旧版残留的侧边栏图标还在,重启 `dsh --profile web` 就会清除。

## 开发
```sh
pnpm install
pnpm run typecheck
pnpm test
pnpm run build
```

## 安全边界

工坊**绝不自动 install** 生成的插件。交付物只是磁盘上的项目目录,是否 install 需要用户单独授权(不在本插件范围内)。

## 许可证
[Apache License 2.0](LICENSE) © 2026 dsh-plugin-craft contributors.