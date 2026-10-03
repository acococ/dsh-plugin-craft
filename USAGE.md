# DSH 插件工坊（dsh-plugin-craft）使用手册

> 把「开发一个 DSH 插件」这件事变成五阶段引导流程，只在阶段 1、阶段 2 和交付页需要你确认。

---

## 1. 安装与启动

插件已经在 web profile 中激活。你只需要：

1. **打开 DSH Web UI**：`http://127.0.0.1:3080`
2. **侧边栏找「插件工坊」图标**（一个小型铁砧+凿+锤图标，order=50，紧邻 Chat、ComfyUI、插件页）
3. **点击图标**进入工坊主页

> 第一次安装后需要浏览器硬刷新（Ctrl+Shift+R / Cmd+Shift+R）让 `__DSH_BOOT__` 重新加载。

---

## 2. 五阶段总览

```
[阶段 1] 采访 → [阶段 2] 设计 → [阶段 3] 拆任务 → [阶段 4] 生成代码 → [阶段 5] 检查上线 → [交付页]
   GATE        GATE        AUTO            AUTO                AUTO            GATE
```

| 阶段 | 谁在干活 | 是否问你 | 你能做什么 |
|---|---|---|---|
| **1 采访需求** | 你 + 工坊 | **需要** | 一条一条地告诉工坊你的字段（pluginName、主功能、要不要 GUI 等） |
| **2 设计架构** | 工坊 + 你 | **需要** | 看工坊出的模块划分/接口/cordis.patch.yml 骨架，同意或退回 |
| **3 拆任务** | 工坊（dsh-agent-teams） | **不问** | 看进度仪表盘，进度条会自动走 |
| **4 生成代码** | 工坊（多个 Engineer 并行） | **不问** | 看每个 worker 状态、写好的文件、红线报告 |
| **5 检查上线** | 工坊（dsh-plugin-dev） | **不问** | 看红线 / 冒烟 / 需求覆盖结果，最多自动修 3 轮 |
| **交付页** | 工坊 | **需要** | 看产物、决定要不要 install 到当前 profile |

进度条颜色：

- 绿（done）— 这一阶段已通过
- 蓝（auto，脉冲）— 正在自动跑，**不要操作**
- 橙（gate，呼吸）— **等你审**，必须点「接受」或「重做」
- 灰（pending）— 还没到

---

## 3. 阶段 1 — 采访需求（需要你）

工坊会在「新建项目」表单里请你填两个最小字段：

| 字段 | 含义 | 例子 |
|---|---|---|
| **插件 ID** | 小写英文+数字+横线（2-63 字符） | `device-scanner` |
| **模糊想法** | 一句话描述插件干什么 | "让 AI 能看到我家里有哪些设备在线" |

填完点「创建并开始阶段 1」，工坊会跳到阶段1 详情页。

### 阶段 1 详情页里你能做的

在「阶段 1 · 采访需求」卡片里有：

- **已收集**区：列出你之前填过的字段
- **新增一条需求**表单：
  - 字段名（例：`mainFeature`、`outOfScope`、`needsUI`）
  - 你的回答（一段文字）
  - 点「追加」会把这一对 `(field, value)` 存到 `01-interview.md`

填得差不多了点「**接受，进入下一阶段**」。如果工坊出的需求规格还差很多，点页脚按钮退回列表重做。

> 阶段 1 接受之前随时可以回来追加新字段。

---

## 4. 阶段 2 — 设计架构（需要你）

阶段 1 接受后自动跳到阶段 2 详情页。工坊会预填一段「设计文档」占位文本，包含：

- 模块划分（Host 端 / Client 端 / Service 层）
- 关键接口签名（Service / Event / Tool / Slot）
- `cordis.patch.yml` 骨架
- 风险点与开放问题

你直接在 textarea 里编辑。改完点「**保存设计**」。设计落盘到 `02-design.md`。

设计稿满意后点「**接受，进入下一阶段**」。

---

## 5. 阶段 3 / 4 / 5 — 自动跑（不需要你）

点完阶段 2 的「接受」后，依次自动跑：

### 阶段 3 · 拆任务
- 状态：AUTO（蓝色脉冲）
- 工坊调用 `dsh-agent-teams` 把设计稿拆成 DAG 任务
- 进度写入 `03-tasks.md`
- 自动进入阶段 4

### 阶段 4 · 生成代码
- 状态：AUTO
- 多个 Engineer worker 并行写 `src/`、`tests/`、`package.json`、`cordis.patch.yml`、`README.md`（中英双语）
- 每写完一个 worker 就跑一次 `dsh-plugin-dev check`，红线不过必须改
- 自动进入阶段 5

### 阶段 5 · 检查上线
- 状态：AUTO
- 跑 `dsh-plugin-dev check --strict`（红线）
- 跑 `dsh-plugin-dev verify`（打包 + 临时 profile 装 + 启 + 卸）
- 跑需求覆盖核验（每条 1 自动检查）
- **最多 3 轮自动修复**；3 轮不过的话状态变红（progress 显示「需要你介入」卡片，附失败摘要 + 4 个出口）

### 进度条 AUTO 阶段你应该做什么

**什么都不做。** 任何中间操作只会让工坊困惑。如果你想看实时状态，仪表盘会显示：

- 已用 token / 总 token 预算
- 当前 sub-task 列表（带 worker 名 + 状态 + 已用 token）
- 最近日志 tail 50 行

---

## 6. 交付页（需要你）

阶段 5 全部通过后跳到「交付页」。

### 交付页会告诉你
- 插件 ID、创建时间、最后更新时间
- 源码位置：`projects/dsh-plugin-craft/<plugin-id>/04-implementation/`
- 各阶段产物：`01-interview.md`、`02-design.md`、`03-tasks.md`、`05-verify-report.md`
- 改动清单 + 已知限制 + 安装建议

### 你能做的 4 个选择

| 按钮 | 干什么 |
|---|---|
| **完成项目** | 把项目标记为 done，回到项目列表 |
| **重做阶段5** | 让工坊再跑一轮检查 |
| **导出失败日志给 dsh-plugin-guide 反馈 bug** | 把所有失败日志打包给「插件开发指南」插件 |
| 放弃项目 | 在项目列表里手动点「删除」 |

### install 到当前 profile 是手动操作
工坊**绝不自动 install** 你开发的插件。装到 profile 还需要你单独走一次：

```
pnpm pack # 在项目根目录打包
dsh plugin --profile web add ./<pkg>.tgz   # 安装
```

或者用 DSH 设置面板的「Plugins」标签页一键装。装完要重启 DSH host。

---

## 7. 项目管理

侧边栏点「插件工坊」图标 → 默认看到「项目列表」。

### 项目列表显示
- 插件 ID
- 当前阶段（采访 / 设计 / 拆任务 / 生成代码 / 检查上线 / 交付）
- 最后更新时间
- 项目状态（按更新时间倒序，最多 50 个）

### 列表上方按钮

| 按钮 | 作用 |
|---|---|
| **新建项目** | 跳到阶段 0 表单 |
| **← 项目列表** | 从详情页退回列表 |
| 项目行（点整行） | 打开该项目详情 |

### 项目落盘位置

每个项目是 `projectsDir/<plugin-name>/project.json`。默认 `projectsDir = projects/dsh-plugin-craft`，相对于 `$DSH_HOME`。例如：

```
C:\Users\Administrator\.dsh\projects\dsh-plugin-craft\my-foo\project.json
```

工坊项目（被工坊管理的、用户在开发的插件）落在 `projects/dsh-plugin-craft/<plugin-name>/`：

```
my-foo/
├── project.json     # 工坊的项目状态（stage / interview / design / stages...）
├── 01-interview.md   # 阶段 1 产物
├── 02-design.md      # 阶段 2 产物
├── 03-tasks.md       # 阶段 3 产物
├── 04-implementation/  # 阶段 4 产物（生成的 src/、tests/、cordis.patch.yml...）
└── 05-verify-report.md  # 阶段 5 产物
```

### 修改 projectsDir

在 DSH profile 的 `cordis.patch.yml` 里覆盖：

```yaml
- id: dsh-plugin-craft
  config:
    projectsDir: D:/my-projects/workshop
    maxListedProjects: 100
```

---

## 8. Chat 入口（不用打开 UI也能用）

工坊在 Chat 里也暴露了两个工具，模型可以直接调用：

### `craft.create_project`
从 Chat 一句话起一个新项目。

```
pluginName: device-scanner
fuzzyIdea: "让 AI 看到我家里有哪些设备在线"
```

返回 `{pluginName, stage}`。

### `craft.advance_stage`
从 Chat 接受或退回当前阶段。

```
pluginName: device-scanner
decision: "accept"   # 或 "revise"
feedback: "再补点主功能的描述"   # revise 时可选
```

返回 `{nextStage, awaitingGate}`。

---

## 9. 故障排查

| 现象 | 原因 | 处理 |
|---|---|---|
| 侧边栏没图标 | 浏览器没拿到新的 `__DSH_BOOT__` | Ctrl+Shift+R 硬刷新 |
| 硬刷新后还看不到 | 浏览器 service-worker 缓存 | DevTools → Application → 勾 "Update on reload" 再硬刷 |
| 项目列表是空的 | 项目落盘路径没写入 | 检查 `$DSH_HOME/projects/dsh-plugin-craft/` |
| 阶段 5 三轮不过 | 生成代码有红线 / 冒烟错误 | 进度条变红 → 看「需要你介入」卡片 → 选「重做阶段 5」或退回阶段 2 |
| Host 重启后 Chat 工坊工具丢了 | 这是正常的（重启会重置 instance） | 重启会自动加载 |
| UI 异常闪一下消失 | Client bundle factory 抛错 | 看浏览器 DevTools Console 的红色 `[dsh-plugin-craft] client factory running` 之后是否还有 `[dsh-plugin-craft] styles installed`；如果只有第一条没第二条，说明 `ctx.slots.inject` 那一行抛错了 |

---

## 10. 当前状态（截至 2026-09-29）

| 检查 | 结果 |
|---|---|
| `dsh-plugin-dev check --strict` | ✅ 11 passed, 0 failed, 0 warned |
| `pnpm test` | ✅ 8/8 tests pass |
| `tsc --noEmit` | ✅ exit 0 |
| `pnpm run build` | ✅ lib/index.mjs + lib/client.mjs |
| Host config 注册 | ✅ `include:dsh-plugin-craft` 已激活 |
| Host tools 注册 | ✅ `craft.create_project` + `craft.advance_stage` |
| 浏览器 UI 显示 | ⚠️排查中（Client bundle 在浏览器加载时未出现可见图标） |

工坊的 Host 端已经全部就位（你可以现在就在 Chat 里用 `craft.create_project`）。Client UI 那边的修复（侧边栏图标 + 工坊页面）还在收尾。

如果你要立刻推进一个项目，最快的路径是在 Chat 里直接调用 `craft.create_project` —— Chat 端完全可用。

要继续修 UI 问题，告诉我「继续」我就接着排查。