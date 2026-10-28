@echo off
chcp 65001 >nul
title REC - Gestor de Contratos SCML (Servidor Local)
color 0A
cls
echo ======================================================================
echo   REC - Gestor de Contratos Publicos (SCML)
echo   Modo Servidor Local / Rede Interna (100%% Sem Cloud Externa)
echo ======================================================================
echo.

cd /d "%~dp0"

echo [1/3] A verificar o Node.js no computador...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo.
    echo [AVISO IMPORTANTE] O Node.js nao foi detetado no computador.
    echo.
    echo Para executar o sistema no computador ou na rede sem Cloud,
    echo e necessario ter o Node.js instalado (apenas uma vez).
    echo.
    echo 1. Aceda a: https://nodejs.org
    echo 2. Descarregue a versao recomendada (LTS).
    echo 3. Instale com as opcoes predefinidas (Seguinte ^> Seguinte ^> Concluir).
    echo 4. Volte a clicar neste ficheiro INICIAR_SISTEMA.bat.
    echo.
    echo Deseja abrir a pagina de instalacao do Node.js agora? (S/N)
    set /p RESP="Opcao: "
    if /i "%RESP%"=="S" (
        start https://nodejs.org/en/download
    )
    pause
    exit /b 1
)

echo [Node.js detetado com sucesso!]
echo.

echo [2/3] A verificar dependencias do sistema...
if not exist node_modules (
    echo [PRIMEIRA VEZ DETETADA] A instalar componentes necessarios...
    echo Isto demora cerca de 1 a 2 minutos apenas na primeira vez. Por favor aguarde.
    echo.
    call npm install
    if %errorlevel% neq 0 (
        echo.
        echo [ERRO] Nao foi possivel instalar as dependencias. Verifique a ligacao a rede.
        pause
        exit /b 1
    )
    echo [Instalacao de componentes concluida com sucesso!]
    echo.
) else (
    echo [Componentes ja instalados.]
    echo.
)

echo [3/3] A iniciar o servidor e a abrir a aplicacao no navegador...
echo O sistema estara acessivel em: http://localhost:3000
echo.
echo Para fechar a aplicacao quando terminar, feche esta janela.
echo ======================================================================
echo.

start "" cmd /c "timeout /t 3 /nobreak >nul & start http://localhost:3000"

call npm start
if %errorlevel% neq 0 (
    call npx tsx server.ts
)

pause
