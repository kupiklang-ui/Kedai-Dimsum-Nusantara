@echo off
setlocal
set "PATH=C:\laragon\bin\nodejs\node-v22;%PATH%"
echo [Dimsum POS] Menyinkronkan schema tabel ke TiDB Cloud (aman tanpa hapus data)...
node.exe scripts/sync-schema.mjs
endlocal
