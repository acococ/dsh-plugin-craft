# dsh-plugin-craft

DSH Plugin Workshop — installs a preset named **「插件工坊」** (id: `craft`) that turns the chat into a guided five-stage plugin-building conversation. Pick the preset from the Web preset selector, and the same session is re-mounted with the Workshop assistant persona and the workshop-specific chat tools.

> Source: <https://github.com/acococ/dsh-plugin-craft> · Issues / PRs welcome.

## Compatibility

| Surface | Status |
|---|---|
| Harness | DeepSeek Harness `0.1.7-rc.2` (or later) |
| Node | `^22.19.0 \|\| >=24.0.0` |
| Platforms | All (pure ESM; no native code, no network at install time) |
| Companion packages (auto-included by `web` profile) | `@deepseek-ai/dsh-agent-preset`, `@deepseek-ai/dsh-persona`, `@deepseek-ai/dsh-tool-ask-user`, `@deepseek-ai/dsh-skill-filesystem`, `@deepseek-ai/dsh-tool-skill` |

## How to use it

1. Open Chat in DSH. Click the **preset selector** and pick **「插件工坊」** (id `craft`). The session reloads with this preset active.
2. Tell the assistant what you want to build in plain language. The assistant walks you through five stages:

| Stage | What happens |
|---|---|
| 1. Interview | The assistant asks questions one at a time. You answer in chat. Every answer lands in the workshop's requirement log via the `craft.create_project` and Chat-only interview turn tools. |
| 2. Design | Once you accept stage 1, the assistant drafts a `cordis.patch.yml` skeleton + module split and asks you to confirm. |
| 3. Tasks | The assistant (or `dsh-agent-teams`) splits the design into a DAG and writes `03-tasks.md`. |
| 4. Generate | Engineers write `src/`, `tests/`, `package.json`, `cordis.patch.yml`, README in both languages. Each worker runs `dsh-plugin-dev check` before reporting. |
| 5. Verify | `dsh-plugin-dev check --strict` + `dsh-plugin-dev verify` + requirement coverage. Up to 3 auto-fix rounds; if all fail the assistant surfaces the failures for you. |

After stage 5, the assistant hands you the result. **It never installs into the current profile** — that requires your separate `dsh plugin --profile web add ./<pkg>.tgz` command.

## What ships

A single host module that, when activated under the `preset-craft` preset:

- Exposes `ctx.craft` (the `CraftStore`) so the agent can read/write workshop state.
- Registers two chat tools, `craft.create_project` and `craft.advance_stage`, that the agent uses to start and step projects.

The agent preset itself (`preset-craft` in `cordis.patch.yml`) declares:

| Child entry | Purpose |
|---|---|
| `@deepseek-ai/dsh-persona` | Overrides the system prompt so the model knows it is the Workshop host. |
| `dsh-plugin-craft` (this plugin) | Brings the two Chat tools above + the persistent on-disk store. |
| `@deepseek-ai/dsh-skill-filesystem` | Mounts the shipped `@deepseek-ai/dsh-agent-preset/skills/` directory so the agent has the `cordis-plugin-development`, `editing-cordis-compositions`, and `cordis-composition-reference` skills. |

## Where projects live

Live data is written to `$DSH_HOME/projects/dsh-plugin-craft/<plugin-name>/project.json` (default). Override via the `dsh-plugin-craft` row config in your profile `cordis.patch.yml`:

```yaml
- id: dsh-plugin-craft
  config:
    projectsDir: 'D:/my-projects/workshop'
    maxListedProjects: 100
```

## Chat tools exposed

### `craft.create_project`

```
pluginName: device-scanner
fuzzyIdea: "让 AI 看到我家里有哪些设备在线"
```

Returns `{pluginName, stage}`.

### `craft.advance_stage`

```
pluginName: device-scanner
decision: "accept"   # or "revise"
feedback: "再补点主功能的描述"   # only for revise
```

Returns `{nextStage, awaitingGate}`.

## 0.3.0 breaking change

Older versions (≤0.2.0) registered a sidebar icon + main panel so the workshop ran in its own Web tab. **0.3.0 removes the sidebar and the Web tab** — the workshop is now a chat preset, not a Web page. If you still have a stale sidebar entry left over from an older install, restart `dsh --profile web` to clear it.

## Development

```sh
pnpm install
pnpm run typecheck
pnpm test
pnpm run build
```

## Safety boundary

The Workshop **never installs** the produced plugin into the current profile. The deliverable is the on-disk project tree. Installation requires a separate user authorization.

## License

[Apache License 2.0](LICENSE) © 2026 dsh-plugin-craft contributors.