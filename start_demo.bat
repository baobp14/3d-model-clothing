@echo off
chcp 65001 > nul
title N&B Fashion - Khởi Động Demo Nhanh

echo ========================================================
echo   KHỞI ĐỘNG HỆ THỐNG N&B FASHION ĐỂ DEMO
echo ========================================================
echo.
echo 1. Khởi động Backend FastAPI (Port 8000)...
start "N&B Backend (FastAPI)" cmd /k "cd /d C:\thuchanh\DoAnTotNghiep-dev\backend && .venv\Scripts\python -m uvicorn app.main:app --port 8000 --reload"

echo 2. Khởi động Frontend React (Port 5173)...
start "N&B Frontend (Vite)" cmd /k "cd /d C:\thuchanh\DoAnTotNghiep-dev\frontend && npm run dev"

echo.
echo Đang chờ dịch vụ khởi động trong 4 giây...
timeout /t 4 > nul

echo 3. Mở trang web demo trên trình duyệt...
start http://localhost:5173

echo 4. Mở slide thuyết trình PowerPoint...
start "" "C:\thuchanh\DoAnTotNghiep-dev\BaoCao_PhanMem_NB_Fashion_FullAnh.pptx"

echo.
echo ========================================================
echo   HỆ THỐNG ĐÃ SẴN SÀNG ĐỂ BÁO CÁO VÀ DEMO!
echo   - Local Web: http://localhost:5173
echo   - Slide PPT: BaoCao_PhanMem_NB_Fashion_FullAnh.pptx
echo ========================================================
pause
