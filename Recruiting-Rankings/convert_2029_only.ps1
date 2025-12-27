try {
    $path = "Recruiting Rankings - 2029 Recruiting Summer 2026.csv"
    Write-Host "Processing 2029 from $path..."
    
    $headerLine = Get-Content $path -TotalCount 1
    $headers = $headerLine.Split(',')
    
    $uniqueHeaders = @()
    for ($i = 0; $i -lt $headers.Count; $i++) {
        $uniqueHeaders += $headers[$i].Trim()
    }
    
    $content = Get-Content $path | Select-Object -Skip 1
    $data = $content | ConvertFrom-Csv -Header $uniqueHeaders
    
    $cleanData = @()
    foreach ($row in $data) {
        $newRow = @{}
        foreach ($prop in $row.PSObject.Properties) {
            $newRow[$prop.Name.ToUpper().Trim()] = $prop.Value
        }
        $cleanData += $newRow
    }
    
    $allData = @{ "2029" = $cleanData }
    $json = $allData | ConvertTo-Json -Depth 5
    Set-Content "data_2029.js" "const PLAYER_DATA = $json;" -Encoding UTF8
    Write-Host "Done. Check data_2029.js"
}
catch {
    Write-Error $_
}
