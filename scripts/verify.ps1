# 验证闸门（架构设计·决策 7 的六步链封装）
# 用法：powershell -ExecutionPolicy Bypass -File scripts/verify.ps1
# 退出码非 0 = 任一闸门失败（阻断交付）。
# 说明：本机 pnpm 统一经 `npx --yes pnpm@11.22.0` 调用，避免全局 pnpm 版本漂移。

$ErrorActionPreference = 'Continue'
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

$script:Results = @()

function Invoke-Gate {
    param([string]$Name, [string]$Command, [string[]]$Args)
    Write-Host "`n==== [GATE] $Name ====" -ForegroundColor Cyan
    Write-Host ">>> $Command $($Args -join ' ')"
    & $Command @Args
    $code = $LASTEXITCODE
    $status = if ($code -eq 0) { 'PASS' } else { "FAIL(exit=$code)" }
    Write-Host "==== $Name => $status ====" -ForegroundColor $(if ($code -eq 0) { 'Green' } else { 'Red' })
    $script:Results += [pscustomobject]@{ Gate = $Name; Result = $status }
    return $code
}

# 0. 环境自检（Node>=20；pnpm 经 npx 固定 11.22.0）
Write-Host "node: $(node -v)"
$PNPM = 'npx'
$PNPM_BASE = @('--yes', 'pnpm@11.22.0')

# 跳过 Electron 二进制下载（postinstall 的 electron-builder install-app-deps 亦可能被墙）
$env:ELECTRON_SKIP_BINARY_DOWNLOAD = '1'

# 1. 依赖安装（workspace 链接必须成功）
$rc = Invoke-Gate 'install' $PNPM ($PNPM_BASE + @('install'))
if ($rc -ne 0) {
    Invoke-Gate 'install(ignore-scripts)' $PNPM ($PNPM_BASE + @('install', '--ignore-scripts')) | Out-Null
}

# 2. workspace 包构建（desktop 的 vue-tsc 依赖 packages/*/dist/*.d.ts，缺此步必报假错）
Invoke-Gate 'packages-build' $PNPM ($PNPM_BASE + @('-r', '--filter', './packages/**', 'run', 'build')) | Out-Null

# 3. 类型闸门
Invoke-Gate 'vue-tsc' $PNPM ($PNPM_BASE + @('--filter', '@security-survey/desktop', 'exec', 'vue-tsc', '--noEmit')) | Out-Null

# 4. 单测闸门（含 dxf-writer 往返测试；desktop 允许暂无用例）
Invoke-Gate 'vitest-exporter' $PNPM ($PNPM_BASE + @('--filter', '@security-survey/exporter', 'exec', 'vitest', 'run')) | Out-Null
Invoke-Gate 'vitest-cad-parser' $PNPM ($PNPM_BASE + @('--filter', '@security-survey/cad-parser', 'exec', 'vitest', 'run', '--passWithNoTests')) | Out-Null
Invoke-Gate 'vitest-device-lib' $PNPM ($PNPM_BASE + @('--filter', '@security-survey/device-lib', 'exec', 'vitest', 'run')) | Out-Null
Invoke-Gate 'vitest-desktop' $PNPM ($PNPM_BASE + @('--filter', '@security-survey/desktop', 'exec', 'vitest', 'run', '--passWithNoTests')) | Out-Null

# 5. renderer 构建闸门（绝不用带 electron-builder 的 build）
Invoke-Gate 'build-app' $PNPM ($PNPM_BASE + @('--filter', '@security-survey/desktop', 'run', 'build:app')) | Out-Null

# 汇总
Write-Host "`n================= VERIFY SUMMARY =================" -ForegroundColor Yellow
$script:Results | Format-Table -AutoSize
$failed = $script:Results | Where-Object { $_.Result -ne 'PASS' }
if ($failed) {
    Write-Host "RESULT: FAIL ($($failed.Count) gate(s))" -ForegroundColor Red
    exit 1
}
Write-Host 'RESULT: PASS' -ForegroundColor Green
exit 0
