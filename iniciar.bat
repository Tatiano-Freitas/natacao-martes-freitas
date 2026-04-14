@echo off
chcp 65001 >nul
title Natacao - Monitoramento

echo.
echo  Natacao - Iniciando servidor...
echo.

call venv\Scripts\activate.bat

start "" cmd /c "timeout /t 2 >nul && start http://localhost:5000"

python app.py

pause
