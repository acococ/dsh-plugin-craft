# dsh-plugin-craft v0.3.5 — 2026-10

> **DSH Plugin Workshop** — 兼容 DSH 主体 0.2.1-alpha.1 的 patch 版。

---

## ✨ 这个版本是什么

v0.3.5 是纯兼容性 patch，**代码无行为变更**。

仅放宽 `peerDependencies` 的版本上限，让本插件能被运行在 DSH `0.2.x` 系列宿主上的 `dsh plugin add` 命令接受。

| ---------------- | ------------------------ |
| ---------------- | ------------------------ |
| **Harness 兼容** | `0.1.7-rc.2` 或更高，含 `0.2.0-rc.x` / `0.2.1-alpha.1` |
| **行为变化**     | 无（与 v0.3.4 完全一致）   |
| **Node**         | `^22.19.0` 或 `>=24.0.0` |
| **平台**         | Windows / macOS / Linux  |
| **License**      | Apache-2.0               |

---

## 🔧 这个版本改了什么 (0.3.4 → 0.3.5)

### 改动 1：`package.json` peerDependencies 放宽

**之前（v0.3.4）**：

```jsonc
"@deepseek-ai/dsh-tools": ">=0.1.2-rc.1 <0.2.0 || >=0.1.5-alpha.1 <0.2.0 || >=0.1.6-0 <0.2.0 || >=0.1.7-0 <0.2.0"
```

**现在（v0.3.5）**：

```jsonc
"@deepseek-ai/dsh-tools": ">=0.1.2-rc.1 <0.2.0 || >=0.1.5-alpha.1 <0.2.0 || >=0.1.6-0 <0.2.0 || >=0.1.7-0 <0.2.0 || >=0.2.0-0 <0.3.0 || >=0.2.1-0 <0.3.0"
```

新增 `0.2.0-*` / `0.2.1-*` 两个区间，让插件能装在 0.2.x 宿主上（dsh 在安装时会校验 peer 范围，范围停在 0.1.x 会被直接拒收）。

> ⚠️ 每个预发布元组必须单独一段：semver 的预发布规则要求区间里存在**同一个
> [主.次.修] 元组**的带预发布比较器，`0.1.6-0` / `0.1.7-0` 光靠
> `>=0.1.2-rc.1` 一段是匹配不上的。整串范围由 `dsh-plugin-dev check` 写死校验，
> 必须逐字照抄。

### 改动 2：`src/index.ts` 加注释

在 `apply()` 的「把 store 挂到 ctx 上」区块新增一段 ⚠️ 注释，明确说明：

> DSH 0.2.0+ 的依赖是**运行时解析 + 运行时卸载**（v0.1.6-alpha.2 引入，v0.2.1-alpha.1 修复了 HMR 下残留依赖映射）。所以 store **必须**挂到 `ctx.effect()` 里 —— 否则 `dsh web` 重载本插件时旧 store 会泄漏。

本插件原本就用了 `ctx.effect(() => ctx.provide('craft', store), 'dsh-plugin-craft: store')`，**不需要改代码**；注释只是给未来维护者看。

### 改动 3：README 兼容性行

README 顶部 `> 当前版本：v0.3.5` 下方新增一行：

> **DSH 兼容性**：≥ `0.1.7-rc.2`，含 `0.2.0-rc.x` / `0.2.1-alpha.1` 全部已发布版本。

---

## ✅ 0.2.1-alpha.1 release notes 逐条对账（无影响）

下面逐条声明 DSH 0.2.1-alpha.1 release notes 提到的破坏性变更对 `dsh-plugin-craft` 无影响：

| # | 0.2.1-alpha.1 变更 | 本插件状态 |
|---|---|---|
| 1 | **移除运行时 invariant 插件及各包的 `./invariant` 导出** | ✅ 代码无 `./invariant` import（grep 0 命中） |
| 2 | **Composer stats 拆为 `activity` / `usage` 两独立入口** | ✅ 本插件**不挂** composer extension（grep 0 命中） |
| 3 | **子路径插件不再读独立 `package.json`，显示文本与图标须经子路径导出** | ✅ 本插件是独立 npm 包（非 monorepo 子路径），manifest 走根 `package.json` + `icon.svg`，合法 |
| 4 | **插件依赖改为运行时解析；Plugin Manager 支持运行时卸载；请开发者检查加载/卸载逻辑** | ✅ 已用 `ctx.effect(() => ctx.provide(...))` 注册 store；工具走 `ctx.tools.register()`；无手动 `removeListener` / `clearInterval` 收尾 |
| 5 | **HMR 可刷新包入口 + 依赖映射配置**（v0.2.1-alpha.1 修复） | ✅ dev 时改 `src/index.ts` 现在能被 HMR 捕获，无需改插件侧 |
| 6 | **自动化任务改由可选插件包提供；自动审阅默认关闭** | ✅ 不涉及 |
| 7 | **`SandboxProvider.confine` / `ShellExecutor.start` 改为可取消的异步接口** | ✅ `CraftStore` 用 `node:fs/promises` 自管文件，不走 dsh-shell |
| 8 | **`agent/session-start` 改为 `agent/created`（异步串行）** | ✅ 不监听 `agent/created`，自然兼容 |
| 9 | **PTC 包名改为 `ptc-runtime` 系列** | ✅ `cordis.patch.yml` 不引用 PTC |

---

## 🎁 0.2.1-alpha.1 顺带利好本插件

- **「让 Agent 创建插件」入口**（Plugins 页）—— 官方工作流，工坊正好是这个流程的可选多阶段 gate 化身
- **可选开发者工具组合包** —— 阶段 5 现在有官方日志工具做对照；README 建议搭配 `@deepseek-ai/dsh-developer-tools` 调试会话（v0.4.0 模板升级时落地）
- **组合包详情页显示代码来源和当前版本** —— 现在 `dsh-plugin-craft` 在 Plugins 页会显式标注 "v0.3.5 · 本地 tarball"
- **修复启停插件时其他插件的样式被残留** —— 0.3.0 移除客户端后 HMR 行为更稳
- **修复新组合包启用后找不到依赖** —— 工坊 preset 的 6 个子条目启用更可靠

---

## 📦 安装 / 升级

```powershell
# 从本地 tarball 装
dsh plugin --profile web add "C:\path\to\dsh-plugin-craft-0.3.5.tgz"

# 或从 GitHub 装
dsh plugin --profile web add "github:acococ/dsh-plugin-craft#v0.3.5"

# 重启 dsh host
dsh --profile web
```

浏览器 `Ctrl + Shift + R` 硬刷新一次（让 `__DSH_BOOT__` 拉新入口）。

### 从 v0.3.4 升级

不需要先卸载。`dsh plugin --profile web add` 会就地覆盖。

### 从 ≤ v0.3.0（含 Web 侧边栏版本）升级

需要先卸载再装，否则双客户端会冲突：

```powershell
dsh plugin --profile web remove dsh-plugin-craft
dsh plugin --profile web add "C:\path\to\dsh-plugin-craft-0.3.5.tgz"
```

---

## ⚠️ 0.3.0 破坏性变更（仍在生效）

0.3.0 起，工坊**不再是**带 Web 侧边栏图标 / 独立页面的插件——而是一个 Chat preset。
如果旧版（≤0.2.0）的侧边栏图标还在，重启 `dsh --profile web` 就会清除。

---

## 🛠 质量门禁

| 检查             | 结果                                           |
| ---------------- | ---------------------------------------------- |
| `tsc --noEmit`   | ✅ exit 0                                      |
| `pnpm test`      | ✅ 8/8 pass                                    |
| `pnpm run build` | ✅ `lib/index.{mjs,d.mts}`                     |
| `pnpm pack`      | ✅ tarball 含 10 文件，~10 KB+                 |

---

## 📄 许可证

[Apache License 2.0](https://github.com/acococ/dsh-plugin-craft/blob/main/LICENSE) © 2026 dsh-plugin-craft contributors.

## 🔗 链接

- **仓库**：<https://github.com/acococ/dsh-plugin-craft>
- **Issue**：<https://github.com/acococ/dsh-plugin-craft/issues>
- **DSH 官方**：<https://github.com/deepseek-ai/deepseek-harness>
- **0.2.1-alpha.1 release notes**：<https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.2.1-alpha.1>
