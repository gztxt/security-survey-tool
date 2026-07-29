# 安全说明：xlsx 依赖 CVE 风险与缓解方案

> 适用范围：`packages/exporter`
> 记录人：Claude（代码审查修复第二轮，2026-07-22）
> 关联审查报告：`.claude/reviews/local-review-20260722.md`（H4）

## 1. 受影响依赖

| 依赖 | 当前版本 | 来源 |
|------|----------|------|
| `xlsx`（SheetJS CE） | `^0.18.5` | npm |

## 2. 已知 CVE

| CVE | 类型 | 影响版本 | 修复版本 | 严重度 |
|-----|------|----------|----------|--------|
| [CVE-2023-30533](https://github.com/advisories/GHSA-4r6h-8v6p-xvw6) | 原型污染 (CWE-1321) | `< 0.19.3` | `0.19.3` | High (CVSS 7.8) |
| [CVE-2024-22363](https://github.com/advisories/GHSA-5pgg-2g8v-p4x9) | 正则拒绝服务 ReDoS (CWE-1333) | `< 0.20.2` | `0.20.2` | High (CVSS 7.5) |

**关键限制**：SheetJS 已停止在 npm 与 GitHub 发布，修复版本（`0.19.3` / `0.20.2+`）**仅能从官方 CDN `https://cdn.sheetjs.com/` 获取**，`npm install xlsx@latest` 仍会装到有漏洞的 `0.18.5`。

## 3. 本项目实际暴露面（重要）

经核查 `packages/exporter/src/index.ts`，本项目对 xlsx **只做写出（导出 Excel）**，调用集中在：

- `XLSX.utils.book_new()` / `XLSX.utils.aoa_to_sheet()` / `XLSX.utils.book_append_sheet()`
- `XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })`

**从不调用 `XLSX.read()` / `XLSX.readFile()` 解析外部/不可信电子表格**。

而两个 CVE 均在**解析恶意文件**时触发：
- CVE-2023-30533 原型污染 → 解析畸形工作簿时触发；
- CVE-2024-22363 ReDoS → 解析阶段的正则；

因此**本项目当前用法下的实际可利用性为「低」**。但仍建议治理，原因：（a）依赖被安全扫描/SCA 工具持续标红；（b）未来若新增「导入 Excel」功能会立刻踩雷；（c）供应链层面该包已不再维护。

## 4. 三种缓解方案对比

| 方案 | 改动量 | 优点 | 缺点 | 推荐度 |
|------|--------|------|------|--------|
| **A. 迁移到 `exceljs@4.4.0`** | 中（重写导出逻辑，约 2 处 `buildXlsx`） | 纯 JS、活跃维护、无已知严重 CVE、API 支持样式/公式更强 | 需改写工作表构建代码并回归测试 | ⭐ **推荐** |
| B. 锁定 SheetJS 官方源 `0.20.2+` | 小（改 package.json 依赖来源为 `https://cdn.sheetjs.com/xlsx-0.20.2/xlsx-0.20.2.tgz`） | 保留现有 API，零业务代码改动 | 脱离 npm、CI/私有 registry 需额外配置、离线构建需缓存 tarball | 次选 |
| C. 保持现状 + 输入约束 | 无 | 零改动 | 依赖持续标红、无法防未来导入功能 | 仅作临时兜底 |

## 5. 推荐结论

**推荐方案 A：迁移到 `exceljs@4.4.0`。**

理由：exceljs 为纯 JS 实现、社区活跃、无当前 xlsx 的两个 High CVE；本项目 xlsx 用法简单（仅 `aoa_to_sheet` + `write`），迁移面小、可控。迁移映射参考：

- `XLSX.utils.book_new()` → `new ExcelJS.Workbook()`
- `XLSX.utils.aoa_to_sheet(rows)` + `book_append_sheet(wb, ws, name)` → `wb.addWorksheet(name)` 后 `ws.addRows(rows)`
- `XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })` → `await wb.xlsx.writeBuffer()`

**过渡期（迁移前）临时措施**：
1. 维持「只导出、不解析」的现状，**严禁**在未升级前新增 `XLSX.read/readFile` 调用；
2. 如短期需消音 SCA 告警，可在 `packages/exporter/package.json` 加 `pnpm.overrides`/`resolutions` 备注（不引入未安装依赖，需先在受控网络下拉取官方 tarball）。

> 本文件仅为风险记录与迁移建议，未改动运行时依赖版本，避免引入未验证的构建变更。实际迁移应单独立任务、配套回归测试后再执行。
