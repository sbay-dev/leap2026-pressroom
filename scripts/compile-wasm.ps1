[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$target = "wasm32-unknown-unknown"
$installed = rustup target list --installed
if ($installed -notcontains $target) {
    throw "Rust target $target is not installed."
}

$source = Join-Path $root "wasm\evidence_match.rs"
$output = Join-Path $root "docs\evidence-match.wasm"
rustc $source `
    --target $target `
    --crate-type cdylib `
    -C opt-level=z `
    -C lto=fat `
    -C panic=abort `
    -C codegen-units=1 `
    -C link-arg=--no-entry `
    -C link-arg=--export=evidence_match `
    -C link-arg=-z `
    -C link-arg=stack-size=1024 `
    -C link-arg=--initial-memory=65536 `
    -C link-arg=--strip-all `
    -o $output
if ($LASTEXITCODE -ne 0) {
    throw "WASM compilation failed with exit code $LASTEXITCODE."
}

$hash = (Get-FileHash $output -Algorithm SHA256).Hash.ToLowerInvariant()
$size = (Get-Item $output).Length
Write-Output "wasm=$output"
Write-Output "bytes=$size"
Write-Output "sha256=$hash"
