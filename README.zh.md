# dsh-3d-model-viewer

> 一个面向 [DeepSeek Harness (DSH)](https://github.com/deepseek-ai/deepseek-harness) 的
> 插件：在 **Web 界面里查看三维模型**，并把模型转译成 **标准化的、LLM 可读的 JSON**，
> 让纯语言大模型无需 CAD 内核也能“看懂”一个零件。

`#dsh-plugin`

---

## 功能

| # | 能力 |
| - | ---- |
| 1 | 在 DSH Web 界面**右侧的悬浮面板**中展示 OBJ / STL / STEP 模型，样式对齐 DSH 主题。 |
| 2 | **交互**：旋转 / 平移 / 缩放；材质（颜色、金属度、粗糙度、线框）、光照（环境光 + 主光）、**剖面（裁剪平面）视图**。 |
| 3 | 把任意受支持模型**转译成同一套标准 JSON**（`dsh-3d-model/v1`），语言模型可直接阅读。 |
| 4 | **发送到 AI**：一键把 JSON + 提示词写入 DSH 输入框，随用户输入一同上传；或**立即发送**为排队消息。 |

## 工作原理

一个包、两个半边（DSH 插件的标准形态）：

- **Host 半边**（`src/index.ts`）—— 注册 `read_3d_model` 工具，让 Agent 自己能读盘上的
  OBJ/STL 并转译成标准 JSON；同时导出转译库（`translateFromBytes` / `translateObj` /
  `translateStl` 与 schema）。
- **Client 半边**（`src/client/*`）—— 按 DSH client-module 契约构建的浏览器 bundle，在
  `shell.overlay`（加性、帧级悬浮层，不会覆盖系统 UI）注册面板，用
  [three.js](https://threejs.org) 渲染，并通过 sessions scope 触达对话、追加/发送模型块。

## 安装与部署

本插件是一个 DSH **bundle**：`package.json` 声明了 `dsh.bundle`（指向 `cordis.patch.yml`）
与 `dsh.client`（浏览器 bundle）。把它加进一个 **profile**，`dsh plugin` 会将其作为一层
叠加在 `@deepseek-ai/dsh-base` 之上。

> DSH 的 Web 界面运行在 `web` profile 上（`dsh web` ≡ `dsh --profile web`，由
> `@deepseek-ai/dsh-base` + `@deepseek-ai/dsh-web-app` 组成）。如果你用的是其它 profile，
> 把下面的 `web` 换成你的 profile 名。

### 方式 A —— 从 GitHub 安装（推荐）

```sh
dsh plugin --profile web add github:lishLRF/3DModelReadAndExplain
```

pnpm ≥ 10 会拒绝执行 git 依赖的 `prepare` 构建脚本，直到你显式允许。第一次 `add` 会失败并
打印需要复制的包名，把它写进 profile 的 `pnpm-workspace.yaml`，再重跑 `add`：

```yaml
allowBuilds:
  dsh-3d-model-viewer: true
```

为供应链安全建议锁定 commit（`prepare` 脚本会在你机器上执行）：

```sh
dsh plugin --profile web add github:lishLRF/3DModelReadAndExplain#<sha>
```

### 方式 B —— 从本地目录或 tarball 安装

```sh
# 本地目录（链接该文件夹；prepare 仍会构建 lib/）
dsh plugin --profile web add ./3DModelReadAndExplain

# 或打包后安装（无需构建脚本）
pnpm pack
dsh plugin --profile web add ./dsh-3d-model-viewer-0.1.0.tgz
```

### 启动与验证

```sh
dsh web        # 或：dsh --profile web
```

然后确认已生效：

1. Web 界面右上角出现 **三维模型查看器** 面板。
2. 让 Agent 对某个 `.obj`/`.stl` 路径调用 `read_3d_model`，应返回标准 JSON（说明 Host 工具已注册）。
3. 不启动也能检查组合结果：
   ```sh
   dsh --profile web --dump-config
   ```
   找到 `# == dsh-3d-model-viewer` 这一层即为成功。

### 环境要求

- Node ≥ 20，pnpm ≥ 10。
- 查看器面板需要 **web** surface（`web` profile）；headless/TUI profile 仍能使用
  `read_3d_model` 工具，只是没有面板。

## 使用

1. 打开一个会话。
2. 在 **三维模型查看器** 面板中点击 **加载模型**（或拖拽文件）——`.obj` `.stl` `.step` `.stp`。
3. 旋转 / 平移 / 缩放，调节材质与光照，开启剖面查看。
4. 点击 **发送到 AI** 把标准 JSON + 提示词追加到输入框；或 **立即发送**。**下载 JSON** /
   **复制 JSON** 可导出文档。

## STEP (.stp/.step) 支持

STEP 是 BREP 实体格式，离散成三角网格需要 CAD 内核。本插件在**浏览器端**使用
[`occt-import-js`](https://github.com/kovacsv/occt-import-js)（OpenCascade 的 WASM 移植）。
因此 Host 端的 `read_3d_model` 工具会提示 STEP 需在 Web 查看器中打开。

- `.wasm` 无法与打包后的 `client.js` 同路径部署，默认从固定 CDN 加载。离线部署请修改
  `src/client/load.ts` 中的 `STEP_WASM_URL`（或在 bundle 旁托管 `.wasm`）后重新构建。
- **许可说明**：本项目为 MIT，但 `occt-import-js` 封装了 OpenCascade（LGPL-2.1 + 例外）。
  OCCT 的 WASM 是独立动态加载的二进制，详见 `LICENSE` 与 occt-import-js 仓库。

## 标准 JSON

见 [`docs/SCHEMA.zh.md`](./docs/SCHEMA.zh.md)（中文）/ [`docs/SCHEMA.md`](./docs/SCHEMA.md)
（英文）及机器可读的 [`docs/dsh-3d-model.schema.json`](./docs/dsh-3d-model.schema.json)。

## 开发

```sh
pnpm install
pnpm build        # 产出 lib/index.js（host）与 lib/client.js（浏览器 bundle）
pnpm typecheck    # tsc --noEmit
pnpm watch        # tsdown --watch
```

构建自包含（`tsdown.config.ts`）：client bundle 将 DSH 平台模块（`react`、`react/jsx-runtime` 等）
作为 external 从 shell 的冻结模块表解析，其余（`three`、`occt-import-js`）全部内联；host 半边
是纯 ESM 插件，对 DSH monorepo 无运行时依赖。

## 许可证

MIT —— 见 [`LICENSE`](./LICENSE)，其中含第三方声明。

## 贡献

见 [`CONTRIBUTING.md`](./CONTRIBUTING.md)。欢迎提 issue 与 PR；较大改动请先开 discussion 沟通。
