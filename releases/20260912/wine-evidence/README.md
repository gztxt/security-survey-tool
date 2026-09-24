# wine 验收证据日志（2026-09-12）

本目录存 `BUILD-INFO.md` "Windows 产物真启动验收（wine 层）"一节结论的**原始输出**，
便于事后复核：结论是被哪些实测数据支持的、哪些数据被作废过。
容器统一 `electronuserland/builder:wine`（wine-11.0 + node v24.15.0），
`--shm-size=2g`，被测对象是 `win-unpacked/安防勘点设计工具.exe`
（与 NSIS/portable 载荷逐文件哈希一致）。

**这些日志只证明 wine 层的行为，不能外推到真实 Windows。**

## 各文件对应的实验

| 文件 | 脚本（冻结副本） | 目的 | 关键读数 |
|---|---|---|---|
| `bisect.log` | `container-win-smoke.sh` 的三个变体 | 定位"3/3 在 W2 失败"的元凶：是我加的 ts_pipe，还是环境漂移 | **交错**跑（排除时间漂移）：v2 原始 2/2 通过、v5 加 `ts_pipe` 3/3 失败（见 `three.log`）、v5b 去掉 2/2 通过 ⇒ 元凶是 ts_pipe 进程替换 |
| `three2.log` | 去 ts_pipe + 三段观测 | 确认 W2 恢复，并首次拿到 W3h | W2 3/3 绿；W3h **3/3=1**；W3=e（探针当时遇 WS 失败即中止 ⇒ W3p 丢失） |
| `three3.log` | attach 失败不再中止探针 | 补测 W3p | W3h 3/3=1；W3=e；**但 W3p=0 无效**：探针在无界 `fetch` 里挂到被 wine `timeout 240` 杀掉（attach 尝试 2 落在 +239876ms），测的是自己拖死的尸体 |
| `three4.log` | 全部等待有界化（现行版本） | 在应用存活时测到 W3p | 单轮 ~250s→~97s；三元组 `1/1/1`、`1/e/1`、`1/e/1`；门禁 W1/W2/W4 3/3 绿 |
| `origin.log` | 独立握手探测 | 验证"wine 下 page 级 WS 一连就关"是否 Chrome 的 Origin 校验 | 带 `Origin: null` 或 `http://127.0.0.1:9222` 均 `403 Rejected…`；**不带 Origin 则 `101`**。但抓包证明 Node 内建 WebSocket 不发 Origin ⇒ **Origin 不是本用例故障原因**，真因是无界等待 |
| `noattach.log` | `container-win-noattach.sh` | 判崩溃是自发还是 CDP attach 引起（观察者效应） | 全程**一个 WebSocket 都不连**，3/3 轮 `crash=1` 且 `saw_router=1` ⇒ 观察者效应被否，wine 渲染层自发不稳 |

## 读数注意事项（避免二次误读）

- **`@@@NOATTACH crash=1` 每轮只出现一次，是权威计数。** `noattach.log` 里
  "渲染进程崩溃"文本行共 6 行 = 3 次真实崩溃 × 2（同脚本既在检测块打印、又在
  尾部片段打印）。数文本行会翻倍。
- `three*.log` 里每轮崩溃行数不一（1 或 2 行）属正常：取决于 wine 何时崩、
  以及该轮是否触发多次 `render-process-gone`。
- `exitCode: -2147483645` = `0x80000003` **STATUS_BREAKPOINT**（调试断点/CHECK 失败）。
  不要写成 `0xC0000005`（ACCESS_VIOLATION）—— 那个对应的十进制是 `-1073741819`。
- Chromium 行的时间戳（如 `[408:0912/111309.317]`）是 **UTC**，换算本地需 **+8h**。
  `main.ts:240` 的崩溃行**不带时间戳** ⇒ 只能取"前一条带戳行"作**下界**，
  不能用它来判定崩溃相对观测窗口的精确先后。
- 归档用的 `noattach.log` 来自**仓库内脚本**（`scripts/container-win-noattach.sh`，
  sha256 前缀 `73fa04b9`）的独立重跑，与已提交脚本逻辑一致；
  scratch 目录里更早那次（改动前）的结果相同（3/3 崩），但未归档。
