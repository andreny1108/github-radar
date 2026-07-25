@echo off
chcp 65001 >nul
cd /d "%~dp0"
title GitHub Radar

echo.
echo   🛰️  GitHub Radar - AI 与开发工具项目发现站
echo   ============================================
echo.

if not exist node_modules (
    echo   首次运行，正在安装依赖（约 1-2 分钟）...
    call npm install
    if errorlevel 1 (
        echo.
        echo   ❌ 依赖安装失败，请检查网络（可能需要开梯子）
        pause
        exit /b 1
    )
    echo.
)

if not exist public\data\repos.json (
    echo   还没有数据，正在生成...
    echo.
    if not exist data\repos.json (
        echo   [1/3] 抓取 GitHub 数据（约 10-15 分钟，请耐心等待）...
        call npm run fetch
        if errorlevel 1 goto :fetchfail
        echo.
        echo   [2/3] Claude 分类与中文摘要...
        call npm run classify
        echo.
    )
    echo   [3/3] 生成前端数据...
    call npm run data
    echo.
)

echo   启动中，浏览器会自动打开 http://localhost:5173
echo   关闭这个窗口即可停止服务
echo.
call npm run dev
goto :eof

:fetchfail
echo.
echo   ❌ 抓取失败。常见原因：
echo      1. 梯子没开，连不上 GitHub
echo      2. .env 里的 GH_API_TOKEN 过期了
echo         去 https://github.com/settings/personal-access-tokens 重新生成
echo.
pause
