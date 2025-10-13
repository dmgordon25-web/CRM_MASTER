[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Command
)

$fullCommand = "& { $Command }"
$encodedCommand = [Convert]::ToBase64String([System.Text.Encoding]::Unicode.GetBytes($fullCommand))

$powerShellPath = (Get-Command powershell.exe -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -ErrorAction SilentlyContinue)
if (-not $powerShellPath) {
    $powerShellPath = 'powershell.exe'
}

$startInfo = New-Object System.Diagnostics.ProcessStartInfo
$startInfo.FileName = $powerShellPath
$startInfo.Arguments = "-NoLogo -NoProfile -ExecutionPolicy Bypass -EncodedCommand $encodedCommand"
$startInfo.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden
$startInfo.CreateNoWindow = $true
$startInfo.UseShellExecute = $false
$startInfo.RedirectStandardOutput = $true
$startInfo.RedirectStandardError = $true

$process = New-Object System.Diagnostics.Process
$process.StartInfo = $startInfo
$process.EnableRaisingEvents = $true

$process.OutputDataReceived += {
    param($sender, $args)
    if ($null -ne $args.Data) {
        Write-Output $args.Data
    }
}

$process.ErrorDataReceived += {
    param($sender, $args)
    if ($null -ne $args.Data) {
        Write-Error $args.Data
    }
}

if (-not $process.Start()) {
    Write-Error 'Failed to launch hidden PowerShell process.'
    exit 1
}

$process.BeginOutputReadLine()
$process.BeginErrorReadLine()
$process.WaitForExit()

exit $process.ExitCode
