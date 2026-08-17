# 贡献指南

感谢你帮助改进 `dsh-3d-model-viewer`。本插件遵循 DSH 插件规范，提前了解下面几点能省下
不少 review 往返。

## 基本规则

- **一个包、两个半边。** Host 半边（`src/index.ts`）注册工具并导出转译库；Client 半边
  （`src/client/*`）是浏览器 bundle。别让 host-only 与 browser-only 代码互相进入对方的
  import 图。
- **标准 JSON 是契约。** 任何对 `docs/dsh-3d-model.schema.json` 或 `src/schema.ts` 的改动
  都是 schema 决策——先开 issue 讨论，并保持向后兼容；除非升级 `schema` 主版本。
- **Client 端禁止跨插件 value import。** 浏览器 bundle 可导入 `react`/`react/jsx-runtime` 和
  解析库，并内联 `three`/`occt-import-js`；触达 DSH 服务要通过 context（`ctx.sessions`、
  `ctx.slots`），绝不要 import 其它 `@deepseek-ai/*` 包的 value。

## 环境准备

```sh
pnpm install
pnpm test         # 红绿测试
pnpm build
pnpm typecheck
```

## 约定

- TypeScript、strict 模式、ESM。Client UI 用 `.tsx`（JSX 由打包器编译）；动态 Cordis 插件的
  「用 `React.createElement`」规则**不适用**于本静态插件。
- CSS Modules（`.module.css`）使用 DSH 主题 token（`--dsw-alias-*`）取色——绝不硬编码产品
  选择器或写 `document.body`。
- 每个解析器必须纯净且同构（OBJ/STL 在 Host 与浏览器都能跑）；STEP 是唯一浏览器端路径。

## 提交前检查

1. `pnpm typecheck` 通过。
2. `pnpm build` 能产出 `lib/index.js` 与 `lib/client.js`。
3. 改了解析逻辑，就在 `examples/` 加一个样例并补单元测试。
4. 行为有变化时，更新 `README.md` 与 schema 文档。

## Commit 规范

简短、祈使句（如「Add section view」「Fix STL binary detection」）。相关时用 `#123` 引用 issue。

## 许可证

提交即表示你同意你的工作按本项目的 MIT 许可证（见 `LICENSE`）授权。注意 STEP 后端封装了
OpenCascade（LGPL-2.1）——该二进制是动态加载的，不属于本仓库。
