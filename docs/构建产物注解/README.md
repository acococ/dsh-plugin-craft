# 构建产物注解

本目录是 `pnpm build`（tsdown / rolldown）产出的两个文件的**逐行注释版**。

| 注释版 | 对应真产物 | 作用 |
| --- | --- | --- |
| `index.annotated.mjs` | `../../lib/index.mjs` | Node 真正执行的 JS |
| `index.annotated.d.mts` | `../../lib/index.d.mts` | 给 TypeScript / 编辑器看的类型说明书 |

## 为什么不直接改 lib/ 里的文件

`tsdown.config.mjs` 里配了 `clean: true`：

```js
clean: true,   // ← 每次构建前清空 lib/
```

`pnpm build` 一跑就把 `lib/` 整个清掉重写，写进去的注释**下一次构建就没了**。
所以注释副本放本目录，真产物保持原样。

> 同理，**永远不要手改 `lib/` 里的任何文件** —— 它是产物，不是源。
> 要改逻辑请改 `src/` 下的 TypeScript，然后重新构建。

## 什么时候看哪个

- **想知道「这段代码实际跑起来是什么样」** → 看 `index.annotated.mjs`
  能看清 TS 编译时到底扔掉了什么（类型、断言、`private` 修饰符全部消失）。
- **想知道「别人 import 我的包时能看到什么」** → 看 `index.annotated.d.mts`
- **想改代码** → 改 `src/`，不是这两个文件

## 关键机制：`/** */` vs `//`

构建时**只有 JSDoc（`/** */`）会被提取进 `.d.mts`，普通 `//` 注释会被丢掉**。

这直接决定源码里该怎么写：

```ts
// ❌ 这样写，使用者在 IDE 里看不到任何字段说明
interface Project {
  id: string // 随机 UUID
}

// ✅ 这样写，会进 lib/index.d.mts
interface Project {
  /** 随机 UUID */
  id: string
}
```

`index.annotated.d.mts` 里每个字段前面的 `/** 中文 */` 就是这么来的。

## 两者的分工

```
src/*.ts  ──pnpm build──▶  lib/index.mjs     可执行代码，Node 跑这个
     │                             lib/index.d.mts   类型说明书，TS/编辑器读这个
     └────────────────────────────▶
```

两者永远由同一次构建配套产出。

## 同步提醒

`src/` 改完记得重新构建，本目录的注释版就落后了：

```bash
pnpm build
```

注释版不会自动更新，需要照着新的 `lib/` 内容手动同步。
