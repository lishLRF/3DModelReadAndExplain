# 标准化三维模型文档（`dsh-3d-model/v1`）

所有受支持的源格式（OBJ、STL、STEP）都会被转译成 **同一个** JSON 结构，目标是让
**纯语言大模型**（或任何下游程序）无需 CAD 内核、无需查看器、无需了解源文件私有
语法，就能直接“读懂”一个三维模型。

三条设计原则：

1. **语义化键名** —— JSON 描述的是“值是什么”（`bounds.center`、`summary.triangleCount`），
   而不是某个文件格式的内部字段。
2. **紧凑几何** —— 几何数据是扁平数字数组，绝不用“每顶点一个对象”。一个百万三角面的
   部件，就是一个 `vertices` 数组加一个 `indices` 数组。
3. **索引化** —— 三角面通过索引缓冲区共享顶点，共享拓扑只表达一次，文档更小。

## 顶层结构

```jsonc
{
  "schema": "dsh-3d-model/v1",
  "meta": { "sourceFormat": "obj|stl|step", "name": "…", "units": "mm|m|unknown", "generator": "…", "generatedAt": "…" },
  "bounds": { "min": [x,y,z], "max": [x,y,z], "size": [dx,dy,dz], "center": [x,y,z], "radius": 123.4 },
  "summary": { "partCount": 2, "vertexCount": 12345, "triangleCount": 6789, "materialCount": 3 },
  "materials": [ { "id": "mat-0", "name": "Steel", "color": "#8a8a8a", "metalness": 0.9, "roughness": 0.3 } ],
  "parts": [ { "id": "part-0", "name": "Body", "material": "mat-0", "vertices": […], "normals": […], "indices": […] } ],
  "analysis": { "partCount": 2, "totalSurfaceArea": …, "totalVolume": …, "watertight": true,
                "parts": [ … ], "naturalDescription": "…" }
}
```

## 字段说明

- `meta` —— 来源格式、名称、单位（OBJ/STL 无单位信息，默认 `unknown`；STEP 常带真实单位）、
  生成器与生成时间。
- `bounds` —— 所有部件的轴对齐包围盒与包围球：`min/max/size/center/radius`。
- `summary` —— 供模型快速判断规模的计数：部件数、顶点数、三角面数、材质数。
- `materials[]` —— 材质列表，`id` 被 `parts[].material` 引用；含颜色与 PBR 提示（金属度/粗糙度/透明度）。
- `parts[]` —— 每个部件是一组离散化后的三角网格：
  - `vertices`：扁平 `[x,y,z, …]`，长度为 `3 × 顶点数`；
  - `normals`：可选，逐顶点法线，长度与 `vertices` 相同；
  - `indices`：三角面索引，每 3 个一组。
- `analysis` —— **让 LLM「可懂」的语义层**：把裸三角面提炼成大模型能直接推理的特征：
  - `partCount` / `totalSurfaceArea` / `totalVolume` / `watertight`（是否封闭实体）;
  - `parts[]`：每部件的 `surfaceArea`、`volume`、`boundaryEdgeCount`（边界边数，0 即封闭）、
    `dimensions`（包围盒尺寸）、`primitive`（`box|cylinder|sphere|torus|planar|freeform`，
    由 `|体积|/包围盒体积` 比值启发式判断）、`primitiveConfidence`（0–1 置信度）；
  - `naturalDescription`：一句自然语言摘要，直接喂给 LLM 即可"读懂"模型。

## 坐标系约定

右手系，同 three.js/OpenGL：**+X 向右，+Y 向上，+Z 朝向观察者**。文档保存的是模型
**源坐标**（不自动居中、不缩放），`bounds` 告诉你它实际位置。浮点默认量化到 4 位小数
以减小体积，工具与查看器均可调整精度。

## Token 规模参考

记顶点数为 `V`、三角面数为 `T`（4 位小数，约 10 字符/数字）：

- `vertices`：`3V` 个数字
- `normals`：`3V` 个数字（存在时）
- `indices`：`3T` 个整数

一个 1 万三角面的部件约产生几百 KB JSON。做宏观推理优先用 `summary`/`bounds`/`analysis`；
确需逐面几何时才深入 `parts`。查看器的“发送到 AI”按钮会对超大载荷做截断并保留摘要。

## JSON Schema

机器可读的 Schema（draft 2020-12）见
[`docs/dsh-3d-model.schema.json`](./dsh-3d-model.schema.json)。

## 版本策略

`schema` 字段即契约。`v1` 已稳定；破坏性变更会升级主版本并附迁移说明；新增可选字段
属于非破坏性变更。
