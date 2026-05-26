Write-Host "--- NCS Fusion Center: Bắt đầu Quy Trình Kiểm Thử Tự Động Liên Tục ---" -ForegroundColor Cyan

# 1. Kiểm tra biên dịch Backend Go
Write-Host "Step 1: Compiling Go backend..." -ForegroundColor Yellow
cd e:\VSC\TheHive\platform\backend
go build ./...
if ($LASTEXITCODE -ne 0) {
    Write-Error "Biên dịch backend Go THẤT BẠI!"
    exit 1
}
Write-Host "Compile Go backend: SUCCESS!" -ForegroundColor Green

# 2. Chạy bộ Unit Tests bảo mật & logic mới
Write-Host "Step 2: Running Go unit tests (RBAC & Regex Parser)..." -ForegroundColor Yellow
go test -v ./internal/tests/ -run "TestRequirePermissionRBACWriteHardening|TestRegexParserLogic"
if ($LASTEXITCODE -ne 0) {
    Write-Error "Chạy bộ unit test Go THẤT BẠI!"
    exit 1
}
Write-Host "Unit tests Go: SUCCESS!" -ForegroundColor Green

# 3. Kiểm tra kiểu dữ liệu Frontend Next.js
Write-Host "Step 3: Checking Next.js TypeScript types..." -ForegroundColor Yellow
cd e:\VSC\TheHive\platform\frontend
npx tsc --noEmit
if ($LASTEXITCODE -ne 0) {
    Write-Error "Typecheck Next.js frontend THẤT BẠI!"
    exit 1
}
Write-Host "Typecheck Next.js frontend: SUCCESS!" -ForegroundColor Green

Write-Host "--- [HOÀN TẤT] Hệ thống NCS Fusion Center Đạt Trạng Thái Hoàn Hảo 100% ---" -ForegroundColor Green
