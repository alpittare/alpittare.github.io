# PowerShell HTTP File Server - Port 8080
# Serves files from the current directory for mobile game testing

$port = 8080
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://+:$port/")

try {
    $listener.Start()
} catch {
    Write-Host ""
    Write-Host "ERROR: Could not start server. Try running as Administrator." -ForegroundColor Red
    Write-Host "Right-click start-server.bat -> Run as Administrator" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

# Get local IP for convenience
$ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notmatch "Loopback" -and $_.IPAddress -ne "127.0.0.1" } | Select-Object -First 1).IPAddress

Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "  Game Server Running!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Local:   http://localhost:$port" -ForegroundColor Cyan
if ($ip) {
    Write-Host "  Network: http://${ip}:$port" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  Your IP for QR codes: $ip" -ForegroundColor Yellow
}
Write-Host ""
Write-Host "  Serving from: $root" -ForegroundColor Gray
Write-Host "  Press Ctrl+C to stop" -ForegroundColor Gray
Write-Host ""

$mimeTypes = @{
    ".html" = "text/html"
    ".htm"  = "text/html"
    ".css"  = "text/css"
    ".js"   = "application/javascript"
    ".json" = "application/json"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".jpeg" = "image/jpeg"
    ".gif"  = "image/gif"
    ".svg"  = "image/svg+xml"
    ".ico"  = "image/x-icon"
    ".woff" = "font/woff"
    ".woff2"= "font/woff2"
    ".ttf"  = "font/ttf"
    ".mp3"  = "audio/mpeg"
    ".wav"  = "audio/wav"
    ".ogg"  = "audio/ogg"
    ".mp4"  = "video/mp4"
    ".webm" = "video/webm"
}

while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $urlPath = [System.Web.HttpUtility]::UrlDecode($request.Url.LocalPath)
        $filePath = Join-Path $root ($urlPath -replace "/", "\")

        # Default to index.html for directories
        if (Test-Path $filePath -PathType Container) {
            $filePath = Join-Path $filePath "index.html"
        }

        if (Test-Path $filePath -PathType Leaf) {
            $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
            $contentType = if ($mimeTypes.ContainsKey($ext)) { $mimeTypes[$ext] } else { "application/octet-stream" }

            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            $response.ContentType = $contentType
            $response.ContentLength64 = $bytes.Length
            $response.Headers.Add("Access-Control-Allow-Origin", "*")
            $response.StatusCode = 200
            $response.OutputStream.Write($bytes, 0, $bytes.Length)

            Write-Host "  200  $($request.Url.LocalPath)" -ForegroundColor Green
        } else {
            $response.StatusCode = 404
            $msg = [System.Text.Encoding]::UTF8.GetBytes("<h1>404 - Not Found</h1><p>$urlPath</p>")
            $response.ContentType = "text/html"
            $response.ContentLength64 = $msg.Length
            $response.OutputStream.Write($msg, 0, $msg.Length)

            Write-Host "  404  $($request.Url.LocalPath)" -ForegroundColor Red
        }

        $response.OutputStream.Close()
    } catch {
        if ($listener.IsListening) {
            Write-Host "  ERR  $($_.Exception.Message)" -ForegroundColor Red
        }
    }
}
