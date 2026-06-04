// 免费版取色器：支持缩放、拖拽、取色锁定、收集板（无限颜色）、像素网格
document.addEventListener('DOMContentLoaded', function() {
    const uploadArea = document.getElementById('uploadArea');
    const imageUpload = document.getElementById('imageUpload');
    const previewArea = document.getElementById('previewArea');
    const canvas = document.getElementById('previewCanvas');
    const ctx = canvas.getContext('2d');
    const clearBtn = document.getElementById('clearBtn');
    const colorPalette = document.getElementById('colorPalette');
    const resultArea = document.getElementById('resultArea');

    // -------------------- 收集板数据（无限制） --------------------
    let colorCollection = [];
    let collectionContainer = null;

    // 创建收集板UI
    function createCollectionUI() {
        const collectionDiv = document.createElement('div');
        collectionDiv.id = 'colorCollectionPanel';
        collectionDiv.style.marginTop = '30px';
        collectionDiv.style.borderTop = '1px solid #e2e8f0';
        collectionDiv.style.paddingTop = '20px';
        collectionDiv.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <h3 style="font-size: 1.2rem;">📋 颜色收集板</h3>
                <button id="clearCollectionBtn" style="background: #ef4444; color: white; border: none; padding: 6px 12px; border-radius: 20px; cursor: pointer;">清空全部</button>
            </div>
            <div id="collectionList" style="display: flex; flex-wrap: wrap; gap: 12px; max-height: 200px; overflow-y: auto; padding: 5px;"></div>
        `;
        resultArea.appendChild(collectionDiv);
        collectionContainer = document.getElementById('collectionList');
        document.getElementById('clearCollectionBtn').addEventListener('click', () => {
            colorCollection = [];
            renderCollection();
        });
    }

    function renderCollection() {
        if (!collectionContainer) return;
        if (colorCollection.length === 0) {
            collectionContainer.innerHTML = '<div style="color: #94a3b8; width: 100%; text-align: center;">单击图片添加颜色</div>';
            return;
        }
        collectionContainer.innerHTML = '';
        colorCollection.forEach((item, idx) => {
            const { hex, r, g, b } = item;
            const colorCard = document.createElement('div');
            colorCard.className = 'collection-item';
            colorCard.style.cssText = `
                display: flex;
                align-items: center;
                gap: 8px;
                background: #f8fafc;
                border-radius: 12px;
                padding: 6px 12px 6px 6px;
                cursor: pointer;
                transition: 0.1s;
                border: 1px solid #e2e8f0;
            `;
            // 单击收集板中的颜色可以复制
            colorCard.addEventListener('click', (e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(hex);
                showToast(`已复制 ${hex}`);
            });
            // 删除按钮
            const delBtn = document.createElement('span');
            delBtn.textContent = '✖';
            delBtn.style.cssText = `
                margin-left: 4px;
                cursor: pointer;
                color: #94a3b8;
                font-size: 12px;
                padding: 2px;
            `;
            delBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                colorCollection.splice(idx, 1);
                renderCollection();
            });
            colorCard.innerHTML = `
                <div style="width: 28px; height: 28px; background: ${hex}; border-radius: 6px; border: 1px solid #cbd5e1;"></div>
                <span style="font-family: monospace; font-size: 0.85rem;">${hex}</span>
            `;
            colorCard.appendChild(delBtn);
            collectionContainer.appendChild(colorCard);
        });
    }

    function addColorToCollection(color) {
        const { hex } = color;
        // 可选：去重（若要去重，取消下面注释）
        // const exists = colorCollection.some(item => item.hex === hex);
        // if (!exists) {
        //     colorCollection.push({ ...color });
        //     renderCollection();
        // } else {
        //     showToast('该颜色已在收集板中');
        // }
        colorCollection.push({ ...color });
        renderCollection();
        showToast(`已添加 ${hex}`);
    }

    // -------------------- 取色器核心 --------------------
    let img = null;
    let imgWidth = 0, imgHeight = 0;
    let zoom = 1.0;
    let offsetX = 0, offsetY = 0;
    let isDragging = false;
    let dragStart = { x: 0, y: 0 };
    let dragStartOffset = { x: 0, y: 0 };
    let lockedColor = null;
    let previewColor = null;
    let showPixelGrid = false;

    const gridToggle = document.getElementById('pixelGridToggle');
    if (gridToggle) {
        gridToggle.addEventListener('change', (e) => {
            showPixelGrid = e.target.checked;
            drawImage();
        });
    }

    let offCanvas = null;
    let offCtx = null;
    function getImageColor(imgX, imgY) {
        if (!offCanvas) {
            offCanvas = document.createElement('canvas');
            offCtx = offCanvas.getContext('2d');
        }
        offCanvas.width = imgWidth;
        offCanvas.height = imgHeight;
        offCtx.drawImage(img, 0, 0);
        const pixel = offCtx.getImageData(imgX, imgY, 1, 1).data;
        const [r, g, b] = pixel;
        const hex = '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
        return { hex, r, g, b };
    }

    function screenToImageCoord(screenX, screenY) {
        if (!img) return null;
        const imgX = (screenX - offsetX) / zoom;
        const imgY = (screenY - offsetY) / zoom;
        if (imgX >= 0 && imgX < imgWidth && imgY >= 0 && imgY < imgHeight) {
            return { x: imgX, y: imgY };
        }
        return null;
    }

    function drawImage() {
        if (!img) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.imageSmoothingEnabled = false;
        const drawWidth = imgWidth * zoom;
        const drawHeight = imgHeight * zoom;
        ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);

        const GRID_THRESHOLD = 4;
        if (showPixelGrid && zoom > GRID_THRESHOLD) {
            const gridStep = zoom;
            ctx.save();
            ctx.beginPath();
            ctx.strokeStyle = 'rgba(128, 128, 128, 0.6)';
            ctx.lineWidth = 1;
            let startX = offsetX % gridStep;
            let startY = offsetY % gridStep;
            if (startX < 0) startX += gridStep;
            if (startY < 0) startY += gridStep;
            for (let x = startX; x < canvas.width; x += gridStep) {
                const drawX = Math.floor(x) + 0.5;
                ctx.moveTo(drawX, 0);
                ctx.lineTo(drawX, canvas.height);
            }
            for (let y = startY; y < canvas.height; y += gridStep) {
                const drawY = Math.floor(y) + 0.5;
                ctx.moveTo(0, drawY);
                ctx.lineTo(canvas.width, drawY);
            }
            ctx.stroke();
            ctx.restore();
        }
    }

    function updateColorDisplay() {
        let color = lockedColor || previewColor;
        if (!color) {
            colorPalette.innerHTML = '<div style="text-align: center; color: #94a3b8;">鼠标移动到图片上预览颜色，单击锁定</div>';
            return;
        }
        const { hex, r, g, b } = color;
        colorPalette.innerHTML = `
            <div style="text-align: center;">
                <div style="width: 100px; height: 100px; background: ${hex}; margin: 0 auto 15px; border-radius: 16px;"></div>
                <div style="font-size: 1.5rem; font-family: monospace;">${hex}</div>
                <div>rgb(${r}, ${g}, ${b})</div>
                ${!lockedColor ? '<div style="font-size:0.8rem; color:#f59e0b;">🔍 预览模式（单击锁定）</div>' : '<div style="font-size:0.8rem; color:#10b981;">🔒 已锁定（单击图片重新锁定）</div>'}
                <button id="copyCurrentColor" style="margin-top: 10px; padding: 6px 20px; background: #3b82f6; color: white; border: none; border-radius: 24px;">复制颜色</button>
            </div>
        `;
        const copyBtn = document.getElementById('copyCurrentColor');
        if (copyBtn) {
            copyBtn.onclick = () => {
                const copyHex = hex;
                if (copyHex) {
                    navigator.clipboard.writeText(copyHex);
                    showToast(`已复制 ${copyHex}`);
                }
            };
        }
    }

    function showToast(msg) {
        let t = document.querySelector('.toast');
        if (t) t.remove();
        t = document.createElement('div');
        t.className = 'toast';
        t.textContent = msg;
        document.body.appendChild(t);
        setTimeout(() => t.remove(), 2000);
    }

    function onMouseMove(e) {
        if (!img) return;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const canvasX = (e.clientX - rect.left) * scaleX;
        const canvasY = (e.clientY - rect.top) * scaleY;
        const imgCoord = screenToImageCoord(canvasX, canvasY);
        if (imgCoord) {
            const color = getImageColor(imgCoord.x, imgCoord.y);
            previewColor = color;
            if (!lockedColor) updateColorDisplay();
        } else {
            previewColor = null;
            if (!lockedColor) updateColorDisplay();
        }
    }

    function onCanvasClick(e) {
        if (!img) return;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const canvasX = (e.clientX - rect.left) * scaleX;
        const canvasY = (e.clientY - rect.top) * scaleY;
        const imgCoord = screenToImageCoord(canvasX, canvasY);
        if (imgCoord) {
            const color = getImageColor(imgCoord.x, imgCoord.y);
            if (lockedColor && lockedColor.hex === color.hex) {
                // 如果单击同一个颜色，则解锁
                lockedColor = null;
                previewColor = color;
                updateColorDisplay();
                showToast('已解锁');
            } else {
                lockedColor = color;
                previewColor = color;
                updateColorDisplay();
                // 添加到收集板
                addColorToCollection(color);
            }
        }
    }

    function onWheel(e) {
        e.preventDefault();
        if (!img) return;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const mouseCanvasX = (e.clientX - rect.left) * scaleX;
        const mouseCanvasY = (e.clientY - rect.top) * scaleY;
        const imgCoordBefore = screenToImageCoord(mouseCanvasX, mouseCanvasY);
        if (!imgCoordBefore) return;
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        let newZoom = zoom * delta;
        newZoom = Math.min(Math.max(newZoom, 0.1), 100);
        if (newZoom === zoom) return;
        zoom = newZoom;
        offsetX = mouseCanvasX - imgCoordBefore.x * zoom;
        offsetY = mouseCanvasY - imgCoordBefore.y * zoom;
        drawImage();
    }

    function onMouseDown(e) {
        if (!img) return;
        isDragging = true;
        dragStart.x = e.clientX;
        dragStart.y = e.clientY;
        dragStartOffset.x = offsetX;
        dragStartOffset.y = offsetY;
        canvas.style.cursor = 'grabbing';
        e.preventDefault();
    }
    function onMouseUp() {
        if (!isDragging) return;
        isDragging = false;
        canvas.style.cursor = 'crosshair';
    }
    function onMouseDrag(e) {
        if (!isDragging || !img) return;
        const dx = e.clientX - dragStart.x;
        const dy = e.clientY - dragStart.y;
        offsetX = dragStartOffset.x + dx;
        offsetY = dragStartOffset.y + dy;
        drawImage();
    }

    function handleImage(file) {
        const reader = new FileReader();
        reader.onload = function(ev) {
            const image = new Image();
            image.onload = function() {
                img = image;
                imgWidth = img.width;
                imgHeight = img.height;
                canvas.width = imgWidth;
                canvas.height = imgHeight;
                canvas.style.width = '100%';
                canvas.style.height = 'auto';
                zoom = 1.0;
                offsetX = 0;
                offsetY = 0;
                drawImage();
                lockedColor = null;
                previewColor = null;
                updateColorDisplay();
                previewArea.style.display = 'block';
                uploadArea.style.display = 'none';
                resultArea.style.display = 'block';
                canvas.addEventListener('mousemove', onMouseMove);
                canvas.addEventListener('click', onCanvasClick);
                canvas.addEventListener('wheel', onWheel, { passive: false });
                canvas.addEventListener('mousedown', onMouseDown);
                window.addEventListener('mousemove', onMouseDrag);
                window.addEventListener('mouseup', onMouseUp);
                if (!collectionContainer) createCollectionUI();
                else renderCollection();
                // 清空旧收集板数据
                colorCollection = [];
                renderCollection();
            };
            image.src = ev.target.result;
        };
        reader.readAsDataURL(file);
    }

    function clearCanvas() {
        if (img) {
            canvas.removeEventListener('mousemove', onMouseMove);
            canvas.removeEventListener('click', onCanvasClick);
            canvas.removeEventListener('wheel', onWheel);
            canvas.removeEventListener('mousedown', onMouseDown);
            window.removeEventListener('mousemove', onMouseDrag);
            window.removeEventListener('mouseup', onMouseUp);
        }
        img = null;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        previewArea.style.display = 'none';
        uploadArea.style.display = 'block';
        resultArea.style.display = 'none';
        imageUpload.value = '';
        lockedColor = null;
        previewColor = null;
        colorPalette.innerHTML = '';
        colorCollection = [];
        if (collectionContainer) renderCollection();
    }

    uploadArea.addEventListener('click', () => imageUpload.click());
    imageUpload.addEventListener('change', (e) => {
        if (e.target.files[0]) handleImage(e.target.files[0]);
    });
    clearBtn.addEventListener('click', clearCanvas);
    uploadArea.addEventListener('dragover', (e) => e.preventDefault());
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) handleImage(file);
    });
});