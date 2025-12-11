$http = [System.Net.HttpListener]::new() 
$http.Prefixes.Add("http://localhost:8080/") 
$http.Start() 
Write-Host "Server started at http://localhost:8080/" 
 
while ($http.IsListening) { 
    $context = $http.GetContext() 
    $request = $context.Request 
    $response = $context.Response 
 
    $localPath = Join-Path $PSScriptRoot $request.Url.LocalPath.Substring(1) 
    if ($request.Url.LocalPath -eq "/") { $localPath = Join-Path $PSScriptRoot "index.html" } 
     
    if (Test-Path $localPath -PathType Leaf) { 
        $content = [System.IO.File]::ReadAllBytes($localPath) 
        $response.ContentLength64 = $content.Length 
        
        $extension = [System.IO.Path]::GetExtension($localPath)
        switch ($extension) {
            ".html" { $response.ContentType = "text/html" }
            ".csv"  { $response.ContentType = "text/csv" }
            ".js"   { $response.ContentType = "text/javascript" }
            ".css"  { $response.ContentType = "text/css" }
        }
        
        $response.OutputStream.Write($content, 0, $content.Length) 
    } else { 
        $response.StatusCode = 404 
    } 
    $response.Close() 
}
