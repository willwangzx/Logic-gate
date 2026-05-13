# Logic Lab 项目文档

Logic Lab 是一个基于 React 和 Vite 的逻辑表达式可视化工具。它可以把自然语言逻辑陈述或布尔代数表达式解析成统一的逻辑结构，并自动生成布尔代数形式、自然语言表述、逻辑门图和真值表。

## 功能概览

- 支持逻辑陈述输入，例如 `if A and not B, then C`
- 支持布尔表达式输入，例如 `(A * !B) -> C`
- 支持输出赋值输入，例如 `X=A+B`
- 提供紧凑逻辑符号输入键盘
- 在自然语言陈述和布尔代数表示之间切换
- 自动识别变量并生成完整真值表
- 支持从交互式真值表倒推最小化布尔表达式
- 支持把当前 6 个以内变量的表达式精确化简为最小 SOP 形式
- 按表达式结构渲染逻辑门图，包括蕴含和等价节点
- 支持导出真值表 CSV 文件
- 提供桌面端和移动端自适应界面

## 技术栈

- React 18
- Vite 5
- lucide-react
- 原生 JavaScript 逻辑解析和测试

## 本地运行

先安装依赖：

```bash
npm install
```

启动开发服务器：

```bash
npm run dev
```

默认会在本机地址启动 Vite 服务：

```text
http://127.0.0.1:5173
```

如果端口被占用，Vite 会自动选择下一个可用端口，请以终端输出为准。

### 局域网访问

如果希望同一局域网里的其他用户访问当前开发服务，运行：

```bash
npm run dev:lan
```

然后在 Windows 终端运行 `ipconfig`，找到当前网卡的 IPv4 地址。局域网用户可以访问：

```text
http://<你的IPv4>:<Vite端口>/
```

例如 Vite 输出端口为 `5173`，本机 IPv4 为 `192.168.1.20`，访问地址就是 `http://192.168.1.20:5173/`。如果无法访问，请确认设备在同一局域网，并在 Windows 防火墙中允许 Node.js 或该端口的入站访问。仅建议在可信局域网中使用。

## 测试

项目的核心逻辑解析、求值和真值表生成测试位于 `src/logic.test.js`。

运行测试：

```bash
npm test
```

当前测试覆盖：

- 自然语言条件句解析
- 布尔代数表达式解析
- AST 求值
- XOR 表达式
- 输出赋值表达式
- 真值表行数生成
- 真值表倒推表达式
- 精确 SOP 化简
- 逻辑门归一化

## 构建

生成生产环境静态资源：

```bash
npm run build
```

构建结果会输出到 `dist/` 目录。

## 项目结构

```text
.
├── index.html              # Vite 入口 HTML
├── package.json            # 项目脚本和依赖
├── src/
│   ├── App.jsx             # 主界面、交互和逻辑门图渲染
│   ├── logic.js            # 表达式解析、AST、求值、真值表和门图归一化
│   ├── logic.test.js       # 核心逻辑测试
│   ├── main.jsx            # React 挂载入口
│   └── styles.css          # 应用样式和响应式布局
└── qa/
    ├── desktop.png         # 桌面端截图
    └── mobile.png          # 移动端截图
```

## 输入语法

### 自然语言模式

可以输入简单英文逻辑语句：

```text
if A and not B, then C
either A or B, and not C
A xor B
A if and only if B
```

支持的常见词包括：

- `and`
- `or`
- `not`
- `xor`
- `if ... then ...`
- `only if`
- `if and only if`
- `iff`
- `true`
- `false`

### 布尔代数模式

可以输入变量、常量、括号和逻辑运算符：

```text
(A * !B) -> C
A + B
A xor B
A <-> B
X=A+B
```

`X=A+B` 这类写法会把 `X` 作为输出名，右侧 `A+B` 作为实际逻辑表达式。`=` 不表示逻辑等价；等价请使用 `A <-> B`、`A <=> B` 或 `A ↔ B`。

输入框下方的符号键盘可以快速插入 `A B C X Y Z 0 1 ¬ · + ⊕ → ↔ = ( )`。点击键盘按钮会自动切换到布尔代数模式，并把符号插入当前光标位置。

支持的运算符：

| 含义 | ASCII 写法 | 符号写法 |
| --- | --- | --- |
| 非 | `!A`, `~A`, `not A` | `¬A` |
| 与 | `A * B`, `A & B`, `A and B` | `A ∧ B`, `A · B` |
| 或 | `A + B`, `A \| B`, `A or B` | `A ∨ B` |
| 异或 | `A ^ B`, `A xor B` | `A ⊕ B` |
| 蕴含 | `A -> B`, `A => B` | `A → B` |
| 等价 | `A <-> B`, `A <=> B` | `A ↔ B` |

### 真值表模式

输入区可以切换到 `Truth table`。变量名用逗号或空格分隔，例如：

```text
A, B, C
```

右侧真值表的结果列可以点击切换 `0` / `1`。系统会按标准行序枚举变量组合，并从输出列倒推出等价的最小 SOP 布尔表达式。当前版本支持 1 到 6 个变量，不支持 don't-care / `X` 项。

## 核心逻辑说明

`src/logic.js` 是项目的核心模块，主要流程如下：

1. `parseLogicInput` 先识别顶层输出赋值，例如 `X=A+B`，并把输出名和右侧表达式分开。
2. `normalizeStatement` 将自然语言陈述转成更接近布尔表达式的形式。
3. `tokenize` 将输入文本拆成变量、常量、括号和运算符。
4. `Parser` 根据运算符优先级生成 AST。
5. `simplifyAst` 对常量和双重否定等情况做简化。
6. `evaluateAst` 根据变量赋值计算表达式结果。
7. `buildTruthTable` 枚举所有变量组合并生成真值表。
8. `deriveExpressionFromTruthTable` 使用 Quine-McCluskey 从 0/1 真值表输出倒推出最小 SOP AST。
9. `minimizeAst` 会枚举表达式真值表并生成等价的最小 SOP AST；界面会复用已经生成的真值表以避免重复枚举。
10. 界面使用当前 AST 绘制逻辑门图，让 `→` 和 `↔` 在表达式模式中保持为清晰的 `IMPLIES` / `IFF` 节点。

运算符优先级从低到高为：

```text
iff < implies < or/xor < and < not < variable/constant
```

## 界面说明

页面分为三块主要区域：

- 左侧输入区：选择表达式或真值表来源、编辑表达式或变量名、使用符号键盘和示例、查看转换后的表示
- 中间逻辑门区：将表达式渲染为逻辑门图，并用输出端标注当前结果列
- 右侧真值表区：展示变量组合和最终输出结果；真值表来源下可点击结果列编辑

顶部工具栏提供：

- Convert：在自然语言和布尔代数表示之间切换
- Simplify：把当前有效表达式替换为精确化简后的布尔代数形式
- Clear：清空输入
- Export：导出当前真值表为 CSV

## 开发建议

- 修改解析能力时，优先更新 `src/logic.js`，并同步补充 `src/logic.test.js`
- 修改界面布局时，主要关注 `src/App.jsx` 和 `src/styles.css`
- 新增运算符时，需要同时处理分词、解析优先级、表达式渲染、求值和门图归一化
- 修改真值表倒推或化简时，需要同步覆盖 `deriveExpressionFromTruthTable`、`minimizeAst` 和等价性测试
- 提交前建议至少运行 `npm test` 和 `npm run build`
