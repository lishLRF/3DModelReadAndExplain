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
| 3 | 把任意受支持模型**转译成同一套标准 JSON**（`dsh-3d-model/v1`），含语义分析，语言模型可直接阅读。 |
| 4 | **发送到 AI**：一键把 JSON + 提示词写入 DSH 输入框，随用户输入一同上传；或**立即发送**为排队消息。 |

## 工作原理

一个包、两个半边（DSH 插件的标准形态）：

- **Host 半边**（`src/index.ts`）—— 注册 `read_3d_model` 工具，让 Agent 自己能读盘上的
  OBJ/STL 并转译成标准 JSON；同时导出转译库（`translateFromBytes` / `translateObj` /
  `translateStl` 与 schema）。
- **Client 半边**（`src/client/*`）—— 按 DSH client-module 契约构建的浏览器 bundle，在
  `shell.overlay`（加性、帧级悬浮层，不会覆盖系统 UI）注册面板，用
  [three.js](https://threejs.org) 渲染，并通过 sessions scope 触达对话、追加/发送模型块。

```
  拖拽/选文件 ──▶ load.ts ──▶ 解析器(obj|stl|step) ──▶ 标准 JSON 文档
                                                    │
                          ┌─────────────────────────┤
                          ▼                         ▼
                 three.js 查看器(scene.ts)     buildPromptBlock(send.ts)
                 旋转/材质/光照/剖面            └──▶ conversation.input.setDraft
```

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

### 卸载

```sh
dsh plugin --profile web remove dsh-3d-model-viewer
```

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

## 标准 JSON（LLM 可读可懂）

核心格式见 [`docs/SCHEMA.md`](./docs/SCHEMA.md)，机器可读 Schema 见
[`docs/dsh-3d-model.schema.json`](./docs/dsh-3d-model.schema.json)。一个模型转译后形如：

```json
{
  "schema": "dsh-3d-model/v1",
  "meta": { "sourceFormat": "stl", "name": "bracket.stl", "units": "mm" },
  "bounds": { "min": [0,0,0], "max": [40,20,10], "size": [40,20,10], "center": [20,10,5], "radius": 22.9 },
  "summary": { "partCount": 1, "vertexCount": 512, "triangleCount": 1024, "materialCount": 0 },
  "analysis": {
    "partCount": 1,
    "totalSurfaceArea": 2200.0,
    "totalVolume": 8000.0,
    "watertight": true,
    "parts": [ { "surfaceArea": 2200.0, "volume": 8000.0, "watertight": true,
                 "boundaryEdgeCount": 0, "dimensions": [40,20,10],
                 "primitive": "box", "primitiveConfidence": 0.99 } ],
    "naturalDescription": "bracket.stl: 1 part (box), bounding box 40×20×10 mm, surface area 2200 mm², closed solid, volume 8000 mm³"
  },
  "parts": [ { "id": "part-0", "vertices": [ … ], "indices": [ … ] } ]
}
```

其中 `analysis.naturalDescription` 就是那句让 LLM 一眼“看懂”模型的自然语言摘要。

## 开发

```sh
pnpm install
pnpm test         # vitest（红绿测试）
pnpm build        # 产出 lib/index.js（host）与 lib/client.js（浏览器 bundle）
pnpm typecheck    # tsc --noEmit
pnpm watch        # tsdown --watch
```

构建自包含（`tsdown.config.ts`）：client bundle 将 DSH 平台模块（`react`、`react/jsx-runtime` 等）
作为 external 从 shell 的冻结模块表解析，其余（`three`、`occt-import-js`）全部内联；host 半边
是纯 ESM 插件，对 DSH monorepo 无运行时依赖。

### 项目结构

```
src/
├── index.ts             host 插件：read_3d_model 工具 + 转译库导出
├── schema.ts            标准文档：类型 + 构建器 + 量化
├── analyze.ts           语义分析：表面积/体积/watertight/形状分类/自然语言描述
├── parse/
│   ├── obj.ts           Wavefront OBJ 解析器（文本、多边形扇形化）
│   ├── stl.ts           STL 解析器（ASCII + 二进制）
│   ├── step.ts          occt-import-js 适配器（无 import 依赖）
│   └── index.ts         格式识别 + Host 端分发
└── client/
    ├── index.ts         client 插件 apply（shell.overlay 注册 + 发送面）
    ├── panel.tsx        悬浮查看器面板
    ├── scene.ts         three.js 场景控制器（旋转/材质/光照/剖面）
    ├── geometry.ts      文档 → BufferGeometry
    ├── load.ts          浏览器 File → 文档（STEP 走 WASM）
    ├── send.ts          提示词块构建器
    ├── dsh.ts           client 服务最小类型声明
    └── styles.module.css
```

## 许可证

MIT —— 见 [`LICENSE`](./LICENSE)，其中含第三方声明。

## 已知限制与路线图

- **STEP 仅浏览器端**（WASM）；Host 的 `read_3d_model` 工具覆盖 OBJ/STL。
- **材质文件**（`mtllib`）只做尽力解析名字/颜色；完整 MTL 贴图/BRDF 加载暂不在 v1 范围。
- **单位**对 OBJ/STL 默认 `unknown`（格式本身无单位）；STEP 单位在存在时读取。
- **不自动居中**——模型保留源坐标（见 `bounds`）。
- 计划中：从 DSH 工作区读取模型（而非仅本地文件选择）、MTL 贴图支持、OBJ/STL→STEP 导出。

## 贡献

见 [`CONTRIBUTING.md`](./CONTRIBUTING.md)。欢迎提 issue 与 PR；较大改动请先开 discussion 沟通。
