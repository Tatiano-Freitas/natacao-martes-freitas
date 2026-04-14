@echo off
chcp 65001 >nul
title Natacao - Instalacao

echo.
echo  Natacao - Monitoramento de Desempenho
echo  Instalacao - aguarde...
echo.

python --version >nul 2>&1
if errorlevel 1 (
    echo  ERRO: Python nao encontrado!
    echo  Instale em: https://www.python.org/downloads/
    echo  IMPORTANTE: marque "Add Python to PATH"
    pause
    exit /b 1
)

echo  Python encontrado OK

if not exist "venv" (
    echo  Criando ambiente virtual...
    python -m venv venv
)

call venv\Scripts\activate.bat
pip install flask --quiet
echo  Flask instalado OK

echo  Criando banco de dados...
python app.py &
timeout /t 3 >nul
taskkill /f /im python.exe >nul 2>&1

echo.
echo  Instalacao concluida!
echo  Execute o arquivo iniciar.bat para abrir o site
echo.
pause
