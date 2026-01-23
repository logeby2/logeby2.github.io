$path = "Recruiting Rankings - 2026 Recruiting Spring 2026.csv"
$content = Get-Content $path
$content = $content -replace '"""""', '"""'
Set-Content $path $content
