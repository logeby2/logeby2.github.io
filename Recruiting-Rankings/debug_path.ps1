$path = "Recruiting Rankings - 2029 Recruiting Summer 2026.csv"
Write-Host "Checking path: '$path'"
$exists = Test-Path $path
Write-Host "Exists: $exists"
Get-ChildItem "Recruiting Rankings - 2029*" | ForEach-Object { Write-Host "Found: '$($_.Name)'" }
