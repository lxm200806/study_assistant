# ==========================================
# Study Assistant Mobile - 一键调试启动
# PowerShell 下运行，推荐 VS Code 终端或 pwsh
# ==========================================
$ErrorActionPreference = "Continue"
Write-Host "`n=== Study Assistant Mobile 调试检查 ===" -ForegroundColor Cyan

# Node.js
try { $nv = node -v; Write-Host "[OK] Node.js: $nv" -ForegroundColor Green } catch { Write-Host "[FAIL] 缺少 Node.js >=18" -ForegroundColor Red; exit 1 }

# Expo CLI
if (-Not (Get-Command expo -ErrorAction SilentlyContinue)) { Write-Host "[WARN] 无全局 expo，使用 npx expo" -ForegroundColor Yellow }

# mobile deps
if (Test-Path "mobile/node_modules") { Write-Host "[OK] mobile/依赖已安装" -ForegroundColor Green } else { Write-Host "`n[INFO] mobile/缺少 node_modules，执行 npm install..." -ForegroundColor Yellow; cd mobile; npm install; if ($LASTEXITCODE -ne 0) { exit 1 }; cd .. }

# API check
Write-Host ""
try { Invoke-WebRequest -Uri "http://127.0.0.1:3005/api" -Method GET -TimeoutSec 3 -UseBasicParsing | Out-Null; Write-Host "[OK] 后端 API (3005) 已运行" -ForegroundColor Green } catch { Write-Host "[WARN] 后端未启动！请另开终端运行: bash start-server.sh" -ForegroundColor Yellow }

# Choose mode
Write-Host ""
Write-Host "=== 选择调试模式 ===" -ForegroundColor Cyan
Write-Host "  [1] Expo Go   (手机扫码，UI/JS 调试)" -ForegroundColor White
Write-Host "  [2] DevClient (编译原生壳，可测麦克风等)" -ForegroundColor White
$mode = Read-Host "输入 1 或 2"

cd mobile
$ENV:EXPO_PUBLIC_API_BASE_URL = "http://127.0.0.1:3005/api"
Write-Host "[INFO] API URL -> $ENV:EXPO_PUBLIC_API_BASE_URL" -ForegroundColor Yellow

if ($mode -eq "1") { Write-Host "`n[START] Metro Server + Expo QR..." -ForegroundColor Green; npx expo start --port 8081 }
elseif ($mode -eq "2") { if (-Not (Get-Command java)) { Write-Host "[FAIL] Java/JDK 17 未安装" -ForegroundColor Red; exit 1 }; Write-Host "`n[START] Android Dev Client..." -ForegroundColor Green; npx expo run:android } else { Write-Host "无效选项" }

Write-Host "`n调试提示：" -ForegroundColor Cyan
Write-Host "  - 手机连接同一 WiFi，打开 Expo Go App 扫码即可运行" -ForegroundColor Gray
Write-Host "  - 如需录音/语音功能，选 [2] DevClient 并安装 JDK 17" -ForegroundColor Gray
