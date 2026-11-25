@echo off
setlocal
set "PATH=C:\laragon\bin\nodejs\node-v22;%PATH%"
echo [Dimsum POS] Menjalankan server Nuxt 3...
call npm.cmd run dev
endlocal
