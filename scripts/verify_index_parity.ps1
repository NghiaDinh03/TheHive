param (
    [string]$DbUser = "thehive",
    [string]$DbName = "thehive",
    [string]$OsUrl = "http://localhost:9200"
)

Write-Host "Verifying data parity between PostgreSQL and OpenSearch..."

# 1. Cases Parity
$pgCases = docker exec thehive-postgres psql -U $DbUser -d $DbName -t -c "SELECT count(*) FROM cases;"
$pgCases = $pgCases.Trim()

$osCasesResponse = Invoke-RestMethod -Uri "$OsUrl/thehive_cases/_count" -Method Get -ErrorAction SilentlyContinue
$osCases = if ($osCasesResponse) { $osCasesResponse.count } else { 0 }

Write-Host "Cases -> Postgres: $pgCases | OpenSearch: $osCases"

# 2. Alerts Parity
$pgAlerts = docker exec thehive-postgres psql -U $DbUser -d $DbName -t -c "SELECT count(*) FROM alerts;"
$pgAlerts = $pgAlerts.Trim()

$osAlertsResponse = Invoke-RestMethod -Uri "$OsUrl/thehive_alerts/_count" -Method Get -ErrorAction SilentlyContinue
$osAlerts = if ($osAlertsResponse) { $osAlertsResponse.count } else { 0 }

Write-Host "Alerts -> Postgres: $pgAlerts | OpenSearch: $osAlerts"

# Summary
if ($pgCases -eq $osCases -and $pgAlerts -eq $osAlerts) {
    Write-Host "✅ Parity OK: 100% matched." -ForegroundColor Green
} else {
    Write-Host "❌ Parity FAILED: Data mismatch detected." -ForegroundColor Red
}
