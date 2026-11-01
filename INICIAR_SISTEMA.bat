@echo off
title Zipaquira Enterprise - Agendamiento de Citas
echo ===================================================================
echo  Iniciando Servidor Zipaquira Enterprise...
echo  Abriendo http://localhost:5000/citas
echo ===================================================================

start "" cmd /c "timeout /t 2 >nul & start http://localhost:5000/citas"
node server/server.js
pause
