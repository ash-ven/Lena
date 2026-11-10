# Pulizia dei clienti vecchi sul database di Lena (Neon). Si lancia dalla cartella del progetto:
#   powershell -ExecutionPolicy Bypass -File scripts\pulizia-neon.ps1
# Chiede la stringa di connessione di Neon (Connect, con "Connection pooling" spento): mentre la incolli non si vede.
# 1) mostra l'ELENCO di chi verrebbe cancellato e perche' (non tocca niente);
# 2) se l'elenco non e' vuoto, ti chiede di scrivere CANCELLA per cancellare davvero. Invio = esci senza fare nulla.
# Una cancellazione e' definitiva: se non l'hai fatto da poco, prima lancia scripts\backup-neon.ps1.
# L'elenco contiene nomi e cognomi: non copiarlo in file o chat.

$progetto = Split-Path -Parent $PSScriptRoot
$api = Join-Path $progetto "api"
if (-not (Test-Path (Join-Path $api "pulizia.js"))) {
  Write-Host "Non trovo api\pulizia.js: lancia lo script dalla cartella del progetto."
  exit 1
}
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "Node non e' installato o non e' nel PATH."
  exit 1
}

$sicura = Read-Host "Incolla la stringa di connessione di Neon (non si vede mentre la incolli)" -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sicura)
try { $u = [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
$u = ($u.Trim().Trim('"')) -replace "&channel_binding=require", ""

if ($u -notmatch "^postgres(ql)?://") {
  Write-Host "Questa non sembra una stringa di connessione: deve cominciare con postgresql://"
  exit 1
}
if ($u -match "pooler") {
  Write-Host "Attenzione: nell'indirizzo c'e' 'pooler'. In Neon spegni 'Connection pooling' e copia di nuovo la stringa."
  exit 1
}

$vecchio = $env:DATABASE_URL
$env:DATABASE_URL = $u
Push-Location $api
try {
  Write-Host ""
  Write-Host "--- PROVA: elenco di chi verrebbe cancellato ---"
  node pulizia.js --prova
  if ($LASTEXITCODE -ne 0) { Write-Host "La prova non e' riuscita: guarda il messaggio qui sopra."; exit 1 }

  Write-Host ""
  $risposta = Read-Host "Per cancellare davvero l'elenco qui sopra scrivi CANCELLA (invio = esci senza cancellare)"
  if ($risposta -ceq "CANCELLA") {
    node pulizia.js --esegui
    if ($LASTEXITCODE -ne 0) { Write-Host "Qualcosa non e' andato a buon fine: guarda il messaggio qui sopra."; exit 1 }
  } else {
    Write-Host "Non ho cancellato niente."
  }
} finally {
  Pop-Location
  $env:DATABASE_URL = $vecchio
  $u = $null
}
