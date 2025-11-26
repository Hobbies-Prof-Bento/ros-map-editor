(function(){
  const fileInput = document.getElementById('fileInput');
  const imgInfo = document.getElementById('imgInfo');

  const toolBrush = document.getElementById('toolBrush');
  const toolEraser = document.getElementById('toolEraser');
  const toolPan = document.getElementById('toolPan');
  const toolLine = document.getElementById('toolLine');
  const toolRect = document.getElementById('toolRect');
  const colorInput = document.getElementById('color');
  const sizeRange = document.getElementById('sizeRange');
  const sizeVal = document.getElementById('sizeVal');

  const undoBtn = document.getElementById('undoBtn');
  const redoBtn = document.getElementById('redoBtn');
  const clearBtn = document.getElementById('clearBtn');

  const rotL = document.getElementById('rotL');
  const rotR = document.getElementById('rotR');
  const flipH = document.getElementById('flipH');
  const flipV = document.getElementById('flipV');
  // Quick controls
  const zoomInBtn = document.getElementById('zoomInBtn');
  const zoomOutBtn = document.getElementById('zoomOutBtn');
  const rotLeftBtn2 = document.getElementById('rotLeftBtn2');
  const rotRightBtn2 = document.getElementById('rotRightBtn2');

  const gridToggle = document.getElementById('gridToggle');
  const gridSize = document.getElementById('gridSize');
  const gridColor = document.getElementById('gridColor');
  const gridAlpha = document.getElementById('gridAlpha');

  const zoomRange = document.getElementById('zoomRange');
  const zoomVal = document.getElementById('zoomVal');
  const originToggle = document.getElementById('originToggle');
  const exportProhibitions = document.getElementById('exportProhibitions');

  const savePng = document.getElementById('savePng');
  const saveJpeg = document.getElementById('saveJpeg');
  const savePgm = document.getElementById('savePgm');
  const saveYaml = document.getElementById('saveYaml');
  const importMapYaml = document.getElementById('importMapYaml');
  const mapYamlFile = document.getElementById('mapYamlFile');
  const importAreasYaml = document.getElementById('importAreasYaml');
  const areasYamlFile = document.getElementById('areasYamlFile');
  const areasToggle = document.getElementById('areasToggle');
  const pointsJsonFile = document.getElementById('pointsJsonFile');
  const pointsToggle = document.getElementById('pointsToggle');
  const centerOriginBtn = document.getElementById('centerOrigin');
  const downloadLink = document.getElementById('downloadLink');

  const canvas = document.getElementById('canvas');
  const gridCanvas = document.getElementById('gridCanvas');
  const hudCanvas = document.getElementById('hudCanvas');
  const wrapper = document.getElementById('canvasWrapper');
  const workspaceEl = document.querySelector('.workspace');

  // Icon toolbox buttons (optional if present)
  const toolPanBtn = document.getElementById('toolPanBtn');
  const toolBrushBtn = document.getElementById('toolBrushBtn');
  const toolLineBtn = document.getElementById('toolLineBtn');
  const toolRectBtn = document.getElementById('toolRectBtn');
  const toolEraserBtn = document.getElementById('toolEraserBtn');
  const toolUndoBtn = document.getElementById('toolUndoBtn');
  const toolRedoBtn = document.getElementById('toolRedoBtn');

  let baseCanvas = document.createElement('canvas');
  let baseCtx = baseCanvas.getContext('2d');
  let drawCanvas = document.createElement('canvas');
  let drawCtx = drawCanvas.getContext('2d');

  let viewCtx = canvas.getContext('2d');
  let gridCtx = gridCanvas.getContext('2d');
  let hudCtx = hudCanvas.getContext('2d');

  let imageLoaded = false;
  let currentZoom = 1;
  let previewRotationDeg = 0;
  let viewAngleDeg = 0; // rotação apenas de visualização para ângulos arbitrários
  let originalWidth = 0, originalHeight = 0; // resolução original da imagem de entrada

  let currentTool = 'pan';
  let brushColor = colorInput.value;
  let brushSize = parseInt(sizeRange.value, 10) || 8;

  let isDrawing = false;
  let activePointerId = null;
  let lastX = 0, lastY = 0;
  let shapeStart = null; // {x,y} for line/rect tools
  let lastHover = { x: 0, y: 0, valid: false };
  // Pan state
  let isPanning = false;
  let panStartX = 0, panStartY = 0;
  let startPanX = 0, startPanY = 0;
  let panX = 0, panY = 0;

  let undoStack = [];
  let redoStack = [];
  const UNDO_LIMIT = 30;
  let annotations = [];
  let currentPath = null;
  let mapMeta = null;
  let zeroPixel = null;
  let startPixel = null;
  let importedAreasWorld = [];
  let importedAreasPx = [];
  let importedPointsWorld = [];
  let importedPointsPx = [];
  let selectedAreaIndex = -1;
  let isDraggingArea = false;
  let dragStartMap = null;
  let areaOriginalWorld = null;

  sizeRange.addEventListener('input', ()=>{
    brushSize = parseInt(sizeRange.value, 10) || 1;
    sizeVal.textContent = brushSize + ' px';
    drawHUD();
  });

  colorInput.addEventListener('input', ()=>{
    brushColor = colorInput.value;
    drawHUD();
  });
  // Handle <select> color control as well
  colorInput.addEventListener('change', ()=>{
    brushColor = colorInput.value;
    drawHUD();
  });

  function updateToolButtons(){
    const btns = [toolPanBtn, toolBrushBtn, toolLineBtn, toolRectBtn, toolEraserBtn];
    btns.forEach(b=>{ if(b){ b.classList.remove('active'); } });
    const map = { pan: toolPanBtn, brush: toolBrushBtn, line: toolLineBtn, rect: toolRectBtn, eraser: toolEraserBtn };
    const b = map[currentTool];
    if(b) b.classList.add('active');
  }

  function ptSegDist(px, py, x1, y1, x2, y2){
    const vx = x2 - x1, vy = y2 - y1;
    const wx = px - x1, wy = py - y1;
    const len2 = vx*vx + vy*vy;
    let t = 0;
    if(len2 > 1e-6){ t = (wx*vx + wy*vy) / len2; }
    if(t < 0) t = 0; else if(t > 1) t = 1;
    const cx = x1 + t*vx;
    const cy = y1 + t*vy;
    return Math.hypot(px - cx, py - cy);
  }
  function hitTestImportedAreaAt(x, y){
    if(!areasToggle || !areasToggle.checked) return -1;
    if(!importedAreasPx || importedAreasPx.length===0) return -1;
    let best = -1; let bestDist = Infinity;
    const thr = 8;
    for(let idx=0; idx<importedAreasPx.length; idx++){
      const pts = importedAreasPx[idx];
      if(!pts || pts.length<2) continue;
      for(let i=0;i<pts.length-1;i++){
        const d = ptSegDist(x,y, pts[i].x, pts[i].y, pts[i+1].x, pts[i+1].y);
        if(d < bestDist){ bestDist = d; best = idx; }
      }
      if(pts.length>2){
        const a = pts[pts.length-1], b = pts[0];
        const d = ptSegDist(x,y, a.x, a.y, b.x, b.y);
        if(d < bestDist){ bestDist = d; best = idx; }
      }
    }
    return (bestDist <= thr) ? best : -1;
  }

  function parsePointsJson(text){
    try{
      const obj = JSON.parse(String(text||''));
      const arr = Array.isArray(obj?.points) ? obj.points : [];
      const out = [];
      arr.forEach(it=>{
        const name = String(it.dbname ?? it.name ?? '').trim();
        const x = parseFloat(it.dbx ?? it.x);
        const y = parseFloat(it.dby ?? it.y);
        const yawDeg = parseFloat(it.dborientation ?? it.yaw ?? it.theta ?? 0);
        if(Number.isFinite(x) && Number.isFinite(y)) out.push({ name, x, y, yawDeg });
      });
      return out;
    }catch(e){ return []; }
  }

  function parseAreasYaml(text){
    const lines = String(text||'').split(/\r?\n/);
    const items = [];
    const rePt = /\[\s*([-+]?[0-9]*\.?[0-9]+)\s*,\s*([-+]?[0-9]*\.?[0-9]+)\s*\]/g;
    for(const ln of lines){
      if(!/^\s*-\s*/.test(ln)) continue;
      const pts = [];
      let m;
      while((m = rePt.exec(ln))){
        const x = parseFloat(m[1]);
        const y = parseFloat(m[2]);
        if(isFinite(x) && isFinite(y)) pts.push({ x, y });
      }
      if(pts.length >= 2) items.push(pts);
    }
    return items;
  }

  function updateImportedAreasPixels(){
    if(!mapMeta || !imageLoaded){ importedAreasPx = []; return; }
    importedAreasPx = importedAreasWorld.map(arr=> arr.map(p=> mapToPixel(p.x, p.y, mapMeta)));
  }

  function updateImportedPointsPixels(){
    if(!mapMeta || !imageLoaded){ importedPointsPx = []; return; }
    const len = 1;
    importedPointsPx = importedPointsWorld.map(p=>{
      const a = (p.yawDeg||0) * Math.PI/180;
      const p0 = mapToPixel(p.x, p.y, mapMeta);
      const p1 = mapToPixel(p.x + Math.cos(a)*len, p.y + Math.sin(a)*len, mapMeta);
      return { name: p.name, p0, p1 };
    });
  }

  function drawImportedAreas(){
    if(!areasToggle || !areasToggle.checked) return;
    if(!importedAreasPx || importedAreasPx.length===0) return;
    const cx = canvas.width/2, cy = canvas.height/2;
    const theta = viewAngleDeg * Math.PI/180;
    hudCtx.save();
    if(Math.abs(theta) > 0.0001){
      hudCtx.translate(cx, cy);
      hudCtx.rotate(theta);
      hudCtx.translate(-cx, -cy);
    }
    hudCtx.lineWidth = 2;
    hudCtx.strokeStyle = '#ff0000';
    hudCtx.setLineDash([6,4]);
    importedAreasPx.forEach((pts, idx)=>{
      const sel = (idx === selectedAreaIndex);
      hudCtx.lineWidth = sel ? 3 : 2;
      hudCtx.strokeStyle = sel ? '#00ccff' : '#ff0000';
      if(pts.length===2){
        hudCtx.beginPath();
        hudCtx.moveTo(pts[0].x, pts[0].y);
        hudCtx.lineTo(pts[1].x, pts[1].y);
        hudCtx.stroke();
      } else if(pts.length>2){
        hudCtx.beginPath();
        hudCtx.moveTo(pts[0].x, pts[0].y);
        for(let i=1;i<pts.length;i++) hudCtx.lineTo(pts[i].x, pts[i].y);
        hudCtx.closePath();
        hudCtx.stroke();
      }
    });
    hudCtx.setLineDash([]);
    hudCtx.restore();
  }

  function drawImportedPoints(){
    if(!pointsToggle || !pointsToggle.checked) return;
    if(!importedPointsPx || importedPointsPx.length===0) return;
    const cx = canvas.width/2, cy = canvas.height/2;
    const theta = viewAngleDeg * Math.PI/180;
    hudCtx.save();
    if(Math.abs(theta) > 0.0001){
      hudCtx.translate(cx, cy);
      hudCtx.rotate(theta);
      hudCtx.translate(-cx, -cy);
    }
    importedPointsPx.forEach(it=>{
      const x0 = it.p0.x, y0 = it.p0.y;
      const x1 = it.p1.x, y1 = it.p1.y;
      hudCtx.strokeStyle = '#0000ff';
      hudCtx.fillStyle = '#0000ff';
      hudCtx.lineWidth = 2;
      hudCtx.beginPath();
      hudCtx.arc(x0, y0, 4, 0, Math.PI*2);
      hudCtx.fill();
      hudCtx.beginPath();
      hudCtx.moveTo(x0, y0);
      hudCtx.lineTo(x1, y1);
      hudCtx.stroke();
      const vx = x1 - x0, vy = y1 - y0;
      const L = Math.hypot(vx, vy) || 1;
      const ux = vx / L, uy = vy / L;
      const ah = 8;
      const ang = Math.PI/6;
      const rx = ux*Math.cos(ang) - uy*Math.sin(ang);
      const ry = ux*Math.sin(ang) + uy*Math.cos(ang);
      const lx = ux*Math.cos(-ang) - uy*Math.sin(-ang);
      const ly = ux*Math.sin(-ang) + uy*Math.cos(-ang);
      hudCtx.beginPath();
      hudCtx.moveTo(x1, y1);
      hudCtx.lineTo(x1 - rx*ah, y1 - ry*ah);
      hudCtx.moveTo(x1, y1);
      hudCtx.lineTo(x1 - lx*ah, y1 - ly*ah);
      hudCtx.stroke();
      if(it.name){
        hudCtx.font = '12px system-ui';
        hudCtx.strokeStyle = 'rgba(255,255,255,0.95)';
        hudCtx.lineWidth = 3;
        hudCtx.strokeText(it.name, x0 + 6, y0 - 6);
        hudCtx.fillStyle = '#000000';
        hudCtx.fillText(it.name, x0 + 6, y0 - 6);
      }
    });
    hudCtx.restore();
  }

  function drawWorldCoordinates(){
    if(!mapMeta || !lastHover.valid) return;
    const m = pixelToMap(lastHover.x, lastHover.y, mapMeta);
    const text = `x: ${m.x.toFixed(2)} m  y: ${m.y.toFixed(2)} m`;
    const cx = canvas.width/2, cy = canvas.height/2;
    const theta = viewAngleDeg * Math.PI/180;
    hudCtx.save();
    if(Math.abs(theta) > 0.0001){
      hudCtx.translate(cx, cy);
      hudCtx.rotate(theta);
      hudCtx.translate(-cx, -cy);
    }
    const x = lastHover.x + 10;
    const y = lastHover.y - 10;
    hudCtx.font = '12px system-ui';
    hudCtx.fillStyle = 'rgba(0,0,0,0.9)';
    hudCtx.strokeStyle = 'rgba(255,255,255,0.95)';
    hudCtx.lineWidth = 3;
    hudCtx.strokeText(text, x, y);
    hudCtx.fillStyle = '#000000';
    hudCtx.fillText(text, x, y);
    hudCtx.restore();
  }

  function parseMapYaml(text){
    let res = NaN, ox = 0, oy = 0, yaw = 0;
    const mRes = text.match(/resolution\s*:\s*([-+]?[0-9]*\.?[0-9]+)/i);
    if(mRes) res = parseFloat(mRes[1]);
    // origin: [x, y, yaw] OR multi-line list
    let mOrg = text.match(/origin\s*:\s*\[([^\]]+)\]/i);
    if(mOrg){
      const parts = mOrg[1].split(',').map(s=>parseFloat(s.trim())).filter(v=>isFinite(v));
      if(parts.length>=2){ ox = parts[0]; oy = parts[1]; if(parts.length>=3) yaw = parts[2]; }
    } else {
      const mList = text.match(/origin\s*:\s*\n\s*-\s*([^\n]+)\s*\n\s*-\s*([^\n]+)(?:\s*\n\s*-\s*([^\n]+))?/i);
      if(mList){
        const a = parseFloat(mList[1]);
        const b = parseFloat(mList[2]);
        const c = mList[3] !== undefined ? parseFloat(mList[3]) : NaN;
        if(isFinite(a)) ox = a;
        if(isFinite(b)) oy = b;
        if(isFinite(c)) yaw = c;
      }
    }
    // Optional: parse robot start pose if present (non-standard keys)
    let sx = NaN, sy = NaN, syaw = 0;
    const mStart = text.match(/(?:initial_pose|start_pose|robot_start|start)\s*:\s*\([^\[]*\[([^\]]+)\)/i) || text.match(/(?:initial_pose|start_pose|robot_start|start)\s*:\s*\[([^\]]+)\]/i);
    if(mStart){
      const parts = mStart[1].split(',').map(s=>parseFloat(s.trim())).filter(v=>isFinite(v));
      if(parts.length>=2){ sx = parts[0]; sy = parts[1]; if(parts.length>=3) syaw = parts[2]; }
    }
    if(!isFinite(res)) res = 0.05;
    return { resolution: res, originX: ox, originY: oy, originYaw: yaw, startX: sx, startY: sy, startYaw: syaw };
  }
  function setTool(t){
    currentTool = t;
    if(toolPan) toolPan.checked = (t==='pan');
    if(toolBrush) toolBrush.checked = (t==='brush');
    if(toolEraser) toolEraser.checked = (t==='eraser');
    if(toolLine) toolLine.checked = (t==='line');
    if(toolRect) toolRect.checked = (t==='rect');
    updateToolButtons();
    updateWorkspaceCursor();
    drawHUD();
  }

  function drawOriginMarker(){
    if(!mapMeta) return;
    if(originToggle && !originToggle.checked) return;
    const p = startPixel || zeroPixel;
    if(!p) return;
    const x = p.x, y = p.y;
    if(x < 0 || y < 0 || x > canvas.width || y > canvas.height) return;
    const cx = canvas.width/2, cy = canvas.height/2;
    const theta = viewAngleDeg * Math.PI/180;
    hudCtx.save();
    if(Math.abs(theta) > 0.0001){
      hudCtx.translate(cx, cy);
      hudCtx.rotate(theta);
      hudCtx.translate(-cx, -cy);
    }
    hudCtx.strokeStyle = '#000000';
    hudCtx.lineWidth = 2;
    const s = 8;
    hudCtx.beginPath();
    hudCtx.moveTo(x - s, y);
    hudCtx.lineTo(x + s, y);
    hudCtx.moveTo(x, y - s);
    hudCtx.lineTo(x, y + s);
    hudCtx.stroke();
    hudCtx.restore();
  }
  function updateWorkspaceCursor(){
    if(!workspaceEl) return;
    workspaceEl.classList.toggle('grab', currentTool==='pan');
  }
  if (toolPan) toolPan.addEventListener('change', ()=>{ if(toolPan.checked) setTool('pan'); });
  toolBrush.addEventListener('change', ()=>{ if(toolBrush.checked) setTool('brush'); });
  toolEraser.addEventListener('change', ()=>{ if(toolEraser.checked) setTool('eraser'); });
  if (toolLine) toolLine.addEventListener('change', ()=>{ if(toolLine.checked) setTool('line'); });
  if (toolRect) toolRect.addEventListener('change', ()=>{ if(toolRect.checked) setTool('rect'); });
  if (toolPanBtn) toolPanBtn.addEventListener('click', ()=> setTool('pan'));
  if (toolBrushBtn) toolBrushBtn.addEventListener('click', ()=> setTool('brush'));
  if (toolLineBtn) toolLineBtn.addEventListener('click', ()=> setTool('line'));
  if (toolRectBtn) toolRectBtn.addEventListener('click', ()=> setTool('rect'));
  if (toolEraserBtn) toolEraserBtn.addEventListener('click', ()=> setTool('eraser'));

  function setCanvasDims(w, h){
    canvas.width = w; canvas.height = h;
    gridCanvas.width = w; gridCanvas.height = h;
    hudCanvas.width = w; hudCanvas.height = h;
    wrapper.style.width = w + 'px';
    wrapper.style.height = h + 'px';
  }

  function updateTransform(){
    wrapper.style.transformOrigin = 'top left';
    wrapper.style.transform = `translate(${panX}px, ${panY}px) scale(${currentZoom})`;
  }
  function applyZoom(z){
    currentZoom = Math.max(0.1, Math.min(4, z));
    updateTransform();
    zoomVal.textContent = Math.round(currentZoom * 100) + '%';
  }

  zoomRange.addEventListener('input', ()=>{
    applyZoom(parseFloat(zoomRange.value));
  });
  if (zoomInBtn) zoomInBtn.addEventListener('click', ()=>{ zoomRange.value = Math.min(4, (parseFloat(zoomRange.value)||1) + 0.1); applyZoom(parseFloat(zoomRange.value)); });
  if (zoomOutBtn) zoomOutBtn.addEventListener('click', ()=>{ zoomRange.value = Math.max(0.1, (parseFloat(zoomRange.value)||1) - 0.1); applyZoom(parseFloat(zoomRange.value)); });
  function rotatePreview(delta){ previewRotationDeg = ((previewRotationDeg + delta) + 360) % 360; if(previewRotationDeg > 180) previewRotationDeg -= 360; render(); }
  // Quick-controls: rotação em passo configurável (°) pelo input #rotStep
  const rotStepInput = document.getElementById('rotStep');
  function getRotStepRad(sign){
    let val = parseFloat(rotStepInput && rotStepInput.value);
    if(!isFinite(val) || val <= 0) val = 5; // fallback
    val = Math.max(1, Math.min(180, val));
    const rad = (val * Math.PI / 180) * (sign || 1);
    return rad;
  }
  if (rotLeftBtn2) rotLeftBtn2.addEventListener('click', ()=>{
    if(!imageLoaded) return;
    const deg = (rotStepInput && parseFloat(rotStepInput.value)) || 5;
    viewAngleDeg = ((viewAngleDeg - deg) % 360 + 360) % 360;
    if(viewAngleDeg > 180) viewAngleDeg -= 360;
    render();
  });
  if (rotRightBtn2) rotRightBtn2.addEventListener('click', ()=>{
    if(!imageLoaded) return;
    const deg = (rotStepInput && parseFloat(rotStepInput.value)) || 5;
    viewAngleDeg = ((viewAngleDeg + deg) % 360 + 360) % 360;
    if(viewAngleDeg > 180) viewAngleDeg -= 360;
    render();
  });

  function updateInfo(){
    if(!imageLoaded) { imgInfo.textContent = ''; return; }
    imgInfo.textContent = baseCanvas.width + ' x ' + baseCanvas.height + ' px';
  }

  function clearGrid(){
    gridCtx.clearRect(0,0,gridCanvas.width, gridCanvas.height);
  }

  function drawGrid(){
    if(!gridToggle.checked || !imageLoaded){
      gridCanvas.style.display = 'none';
      clearGrid();
      return;
    }
    gridCanvas.style.display = 'block';
    clearGrid();
    const w = gridCanvas.width, h = gridCanvas.height;
    const step = Math.max(5, Math.min(1000, parseInt(gridSize.value, 10) || 50));
    const col = gridColor.value;
    const a = parseFloat(gridAlpha.value);

    gridCtx.save();
    gridCtx.globalAlpha = a;
    gridCtx.strokeStyle = col;
    gridCtx.lineWidth = 1;
    gridCtx.beginPath();
    for(let x=0; x<=w; x+=step){
      gridCtx.moveTo(x+0.5, 0);
      gridCtx.lineTo(x+0.5, h);
    }
    for(let y=0; y<=h; y+=step){
      gridCtx.moveTo(0, y+0.5);
      gridCtx.lineTo(w, y+0.5);
    }
    gridCtx.stroke();
    gridCtx.restore();
  }

  function hudClear(){
    hudCtx.clearRect(0,0,hudCanvas.width, hudCanvas.height);
  }

  function drawBrushCursor(){
    if(!lastHover.valid) return;
    const r = brushSize / 2;
    const cx = canvas.width/2, cy = canvas.height/2;
    const theta = viewAngleDeg * Math.PI/180;
    const x = lastHover.x, y = lastHover.y;
    hudCtx.save();
    if(Math.abs(theta) > 0.0001){
      hudCtx.translate(cx, cy);
      hudCtx.rotate(theta);
      hudCtx.beginPath();
      hudCtx.arc((x - cx) + 0.5, (y - cy) + 0.5, r, 0, Math.PI*2);
    } else {
      hudCtx.beginPath();
      hudCtx.arc(x + 0.5, y + 0.5, r, 0, Math.PI*2);
    }
    hudCtx.strokeStyle = currentTool === 'eraser' ? '#ffffff' : brushColor;
    hudCtx.lineWidth = 1;
    hudCtx.setLineDash(currentTool === 'eraser' ? [4,3] : []);
    hudCtx.stroke();
    hudCtx.restore();
  }

  function drawShapePreview(sx, sy, ex, ey, constrainSquare){
    hudClear();
    const cx = canvas.width/2, cy = canvas.height/2;
    const theta = viewAngleDeg * Math.PI/180;
    hudCtx.save();
    hudCtx.lineWidth = brushSize;
    hudCtx.strokeStyle = brushColor;
    hudCtx.lineCap = 'round';
    hudCtx.lineJoin = 'round';
    if(currentTool === 'line'){
      if(Math.abs(theta) > 0.0001){
        hudCtx.translate(cx, cy);
        hudCtx.rotate(theta);
        sx -= cx; sy -= cy; ex -= cx; ey -= cy;
      }
      hudCtx.beginPath();
      hudCtx.moveTo(sx, sy);
      hudCtx.lineTo(ex, ey);
      hudCtx.stroke();
    } else if(currentTool === 'rect'){
      const cos = Math.cos(theta), sin = Math.sin(theta);
      const sdx = sx - cx, sdy = sy - cy;
      const edx = ex - cx, edy = ey - cy;
      const svx = sdx * cos - sdy * sin + cx;
      const svy = sdx * sin + sdy * cos + cy;
      const evx = edx * cos - edy * sin + cx;
      const evy = edx * sin + edy * cos + cy;
      let x = Math.min(svx, evx);
      let y = Math.min(svy, evy);
      let w = Math.abs(evx - svx);
      let h = Math.abs(evy - svy);
      if(constrainSquare){ const s = Math.max(w, h); w = s; h = s; }
      hudCtx.strokeRect(x, y, w, h);
    }
    hudCtx.restore();
  }

  function drawHUD(){
    hudClear();
    if(!imageLoaded) return;
    drawImportedAreas();
    drawImportedPoints();
    if(isDrawing && (currentTool === 'line' || currentTool === 'rect') && shapeStart && lastHover.valid){
      drawShapePreview(shapeStart.x, shapeStart.y, lastHover.x, lastHover.y, false);
    } else if(currentTool === 'brush' || currentTool === 'eraser'){
      drawBrushCursor();
    }
    drawWorldCoordinates();
  }

  gridToggle.addEventListener('change', drawGrid);
  gridSize.addEventListener('input', drawGrid);
  gridColor.addEventListener('input', drawGrid);
  gridAlpha.addEventListener('input', drawGrid);

  function render(){
    if(!imageLoaded) { viewCtx.clearRect(0,0,canvas.width, canvas.height); hudClear(); return; }
    viewCtx.setTransform(1,0,0,1,0,0);
    viewCtx.clearRect(0,0,canvas.width, canvas.height);
    const theta = viewAngleDeg * Math.PI/180;
    if(Math.abs(theta) > 0.0001){
      const cx = canvas.width/2, cy = canvas.height/2;
      viewCtx.save();
      viewCtx.translate(cx, cy);
      viewCtx.rotate(theta);
      viewCtx.drawImage(baseCanvas, -baseCanvas.width/2, -baseCanvas.height/2);
      viewCtx.drawImage(drawCanvas, -drawCanvas.width/2, -drawCanvas.height/2);
      viewCtx.restore();
    } else {
      viewCtx.drawImage(baseCanvas, 0, 0);
      viewCtx.drawImage(drawCanvas, 0, 0);
    }
    drawHUD();
  }

  function snapshotForUndo(){
    try{
      const snap = drawCtx.getImageData(0,0,drawCanvas.width, drawCanvas.height);
      undoStack.push(snap);
      if(undoStack.length > UNDO_LIMIT) undoStack.shift();
      redoStack.length = 0;
    }catch(e){ /* ignore memory errors */ }
  }

  function undo(){
    if(!imageLoaded || undoStack.length === 0) return;
    try{
      const current = drawCtx.getImageData(0,0,drawCanvas.width, drawCanvas.height);
      const prev = undoStack.pop();
      redoStack.push(current);
      drawCtx.putImageData(prev, 0, 0);
      render();
    }catch(e){ /* ignore */ }
  }

  function redo(){
    if(!imageLoaded || redoStack.length === 0) return;
    try{
      const current = drawCtx.getImageData(0,0,drawCanvas.width, drawCanvas.height);
      const next = redoStack.pop();
      undoStack.push(current);
      drawCtx.putImageData(next, 0, 0);
      render();
    }catch(e){ /* ignore */ }
  }

  undoBtn.addEventListener('click', undo);
  redoBtn.addEventListener('click', redo);

  if(centerOriginBtn){
    centerOriginBtn.addEventListener('click', ()=>{
      if(!mapMeta) return;
      const focus = startPixel || zeroPixel;
      if(!focus) return;
      // Centraliza a origem no viewport: ajusta pan para levar zeroPixel ao centro visível original
      // Como usamos transform em wrapper (translate + scale), basta ajustar panX/panY
      const viewW = (workspaceEl && workspaceEl.clientWidth) || window.innerWidth;
      const viewH = (workspaceEl && workspaceEl.clientHeight) || window.innerHeight;
      const centerX = viewW / 2;
      const centerY = viewH / 2;
      panX = Math.round(centerX - focus.x * currentZoom);
      panY = Math.round(centerY - focus.y * currentZoom);
      updateTransform();
    });
  }

  clearBtn.addEventListener('click', ()=>{
    if(!imageLoaded) return;
    snapshotForUndo();
    drawCtx.clearRect(0,0,drawCanvas.width, drawCanvas.height);
    annotations = [];
    render();
  });

  function clientToImageCoords(e){
    const rect = canvas.getBoundingClientRect();
    let x = (e.clientX - rect.left) / currentZoom;
    let y = (e.clientY - rect.top) / currentZoom;
    const theta = viewAngleDeg * Math.PI/180;
    if(Math.abs(theta) > 0.0001){
      const cx = canvas.width/2, cy = canvas.height/2;
      const dx = x - cx, dy = y - cy;
      const cos = Math.cos(-theta), sin = Math.sin(-theta);
      x = dx * cos - dy * sin + cx;
      y = dx * sin + dy * cos + cy;
    }
    return { x: Math.max(0, Math.min(canvas.width, x)), y: Math.max(0, Math.min(canvas.height, y)) };
  }

  function beginStroke(x, y){
    isDrawing = true;
    drawCtx.lineCap = 'round';
    drawCtx.lineJoin = 'round';
    drawCtx.lineWidth = brushSize;
    if(currentTool === 'eraser'){
      drawCtx.globalCompositeOperation = 'destination-out';
      drawCtx.strokeStyle = 'rgba(0,0,0,1)';
    } else {
      drawCtx.globalCompositeOperation = 'source-over';
      drawCtx.strokeStyle = brushColor;
    }
    drawCtx.beginPath();
    drawCtx.moveTo(x, y);
    lastX = x; lastY = y;
    if(currentTool === 'brush' && brushColor && brushColor.toLowerCase() === '#ff0000'){
      currentPath = [{ x, y }];
    } else {
      currentPath = null;
    }
  }

  function continueStroke(x, y){
    if(!isDrawing) return;
    drawCtx.lineTo(x, y);
    drawCtx.stroke();
    lastX = x; lastY = y;
    render();
    if(currentTool === 'brush' && currentPath){ currentPath.push({ x, y }); }
  }

  function endStroke(){
    if(!isDrawing) return;
    isDrawing = false;
    drawCtx.closePath();
    drawCtx.globalCompositeOperation = 'source-over';
    render();
    if(currentTool === 'brush' && currentPath && currentPath.length > 1 && brushColor && brushColor.toLowerCase() === '#ff0000'){
      const step = Math.max(1, Math.floor(currentPath.length / 50));
      for(let i=0; i<currentPath.length-1; i+=step){
        const a = currentPath[i];
        const b = currentPath[Math.min(i+step, currentPath.length-1)];
        annotations.push({ type: 'line', pts: [ {x:a.x, y:a.y}, {x:b.x, y:b.y} ] });
      }
    }
    currentPath = null;
  }

  canvas.addEventListener('pointerdown', (e)=>{
    if(!imageLoaded) return;
    const {x,y} = clientToImageCoords(e);
    const hitIdx = hitTestImportedAreaAt(x,y);
    if(hitIdx >= 0){
      canvas.setPointerCapture(e.pointerId);
      activePointerId = e.pointerId;
      selectedAreaIndex = hitIdx;
      isDraggingArea = true;
      dragStartMap = pixelToMap(x, y, mapMeta);
      const src = importedAreasWorld[hitIdx] || [];
      areaOriginalWorld = src.map(p=>({ x: p.x, y: p.y }));
      render();
      return;
    } else {
      if(selectedAreaIndex !== -1){ selectedAreaIndex = -1; render(); }
    }
    if(currentTool === 'pan'){
      canvas.setPointerCapture(e.pointerId);
      activePointerId = e.pointerId;
      isPanning = true;
      if(workspaceEl){ workspaceEl.classList.add('grabbing'); }
      panStartX = e.clientX; panStartY = e.clientY;
      startPanX = panX; startPanY = panY;
      return;
    }
    canvas.setPointerCapture(e.pointerId);
    activePointerId = e.pointerId;
    if(currentTool === 'brush' || currentTool === 'eraser'){
      snapshotForUndo();
      beginStroke(x,y);
    } else if(currentTool === 'line' || currentTool === 'rect'){
      snapshotForUndo();
      isDrawing = true;
      shapeStart = { x, y };
    }
  });

  canvas.addEventListener('pointermove', (e)=>{
    if(!imageLoaded) return;
    if(isDraggingArea && e.pointerId === activePointerId){
      const {x,y} = clientToImageCoords(e);
      const cur = pixelToMap(x, y, mapMeta);
      const dx = cur.x - (dragStartMap ? dragStartMap.x : 0);
      const dy = cur.y - (dragStartMap ? dragStartMap.y : 0);
      if(selectedAreaIndex >= 0 && areaOriginalWorld){
        const moved = areaOriginalWorld.map(p=>({ x: p.x + dx, y: p.y + dy }));
        importedAreasWorld[selectedAreaIndex] = moved;
        updateImportedAreasPixels();
        render();
      }
      return;
    }
    if(currentTool === 'pan' && isPanning && e.pointerId === activePointerId){
      const dx = e.clientX - panStartX;
      const dy = e.clientY - panStartY;
      panX = startPanX + dx;
      panY = startPanY + dy;
      updateTransform();
      return;
    }
    const {x,y} = clientToImageCoords(e);
    lastHover = { x, y, valid: true };
    if(isDrawing && e.pointerId === activePointerId){
      if(currentTool === 'brush' || currentTool === 'eraser'){
        continueStroke(x,y);
      } else if(currentTool === 'line' || currentTool === 'rect'){
        drawShapePreview(shapeStart.x, shapeStart.y, x, y, e.shiftKey);
      }
    } else {
      drawHUD();
    }
  });

  function cancelStroke(){
    if(activePointerId !== null){
      try { if(canvas.hasPointerCapture && canvas.hasPointerCapture(activePointerId)) canvas.releasePointerCapture(activePointerId); } catch(e){}
    }
    isDrawing = false; activePointerId = null; drawCtx.globalCompositeOperation = 'source-over';
    if(workspaceEl){ workspaceEl.classList.remove('grabbing'); }
    isPanning = false;
  }

  canvas.addEventListener('pointerup', (e)=>{
    if(e.pointerId === activePointerId){
      if(isDraggingArea){
        isDraggingArea = false;
        dragStartMap = null;
        areaOriginalWorld = null;
        cancelStroke();
        return;
      }
      if(currentTool === 'pan'){
        cancelStroke();
        return;
      }
      if(currentTool === 'brush' || currentTool === 'eraser'){
        endStroke();
        cancelStroke();
      } else if(currentTool === 'line' || currentTool === 'rect'){
        if(shapeStart){
          const {x,y} = clientToImageCoords(e);
          drawCtx.save();
          drawCtx.globalCompositeOperation = 'source-over';
          drawCtx.lineWidth = brushSize;
          drawCtx.strokeStyle = brushColor;
          drawCtx.lineCap = 'round';
          drawCtx.lineJoin = 'round';
          if(currentTool === 'line'){
            drawCtx.beginPath();
            drawCtx.moveTo(shapeStart.x, shapeStart.y);
            drawCtx.lineTo(x, y);
            drawCtx.stroke();
            if(brushColor && brushColor.toLowerCase() === '#ff0000'){
              annotations.push({ type: 'line', pts: [ {x:shapeStart.x, y:shapeStart.y}, {x, y} ] });
            }
          } else {
            let sx = shapeStart.x, sy = shapeStart.y;
            let ex = x, ey = y;
            const cx = canvas.width/2, cy = canvas.height/2;
            const theta = viewAngleDeg * Math.PI/180;
            const cos = Math.cos(theta), sin = Math.sin(theta);
            const sdx = sx - cx, sdy = sy - cy;
            const edx = ex - cx, edy = ey - cy;
            const svx = sdx * cos - sdy * sin + cx;
            const svy = sdx * sin + sdy * cos + cy;
            const evx = edx * cos - edy * sin + cx;
            const evy = edx * sin + edy * cos + cy;
            let rx = Math.min(svx, evx);
            let ry = Math.min(svy, evy);
            let rw = Math.abs(evx - svx);
            let rh = Math.abs(evy - svy);
            if(e.shiftKey){ const s = Math.max(rw, rh); rw = s; rh = s; }
            drawCtx.save();
            drawCtx.globalCompositeOperation = 'source-over';
            drawCtx.lineWidth = brushSize;
            drawCtx.strokeStyle = brushColor;
            drawCtx.lineCap = 'round';
            drawCtx.lineJoin = 'round';
            drawCtx.translate(cx, cy);
            drawCtx.rotate(-theta);
            drawCtx.translate(-cx, -cy);
            drawCtx.strokeRect(rx, ry, rw, rh);
            drawCtx.restore();
            if(brushColor && brushColor.toLowerCase() === '#ff0000'){
              const c = Math.cos(-theta), s = Math.sin(-theta);
              const ptsV = [
                { x: rx,      y: ry      },
                { x: rx+rw,   y: ry      },
                { x: rx+rw,   y: ry+rh   },
                { x: rx,      y: ry+rh   }
              ];
              const ptsI = ptsV.map(p=>{
                const dx = p.x - cx, dy = p.y - cy;
                return { x: dx * c - dy * s + cx, y: dx * s + dy * c + cy };
              });
              annotations.push({ type: 'polygon', pts: ptsI });
            }
          }
          drawCtx.restore();
          shapeStart = null;
          isDrawing = false;
          hudClear();
          render();
        }
        cancelStroke();
      }
    }
  });
  canvas.addEventListener('pointercancel', (e)=>{ if(e.pointerId === activePointerId){ isDraggingArea = false; dragStartMap = null; areaOriginalWorld = null; shapeStart = null; isDrawing = false; hudClear(); cancelStroke(); }});
  canvas.addEventListener('pointerleave', (e)=>{ if(e.pointerId === activePointerId){ if(currentTool==='brush'||currentTool==='eraser'){ endStroke(); } isDraggingArea = false; dragStartMap = null; areaOriginalWorld = null; shapeStart = null; isDrawing = false; hudClear(); cancelStroke(); }});

  window.addEventListener('keydown', (e)=>{
    const tag = (e.target && e.target.tagName) ? String(e.target.tagName).toUpperCase() : '';
    if(tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.isComposing) return;
    if((e.key === 'Delete' || e.key === 'Backspace') && selectedAreaIndex >= 0){
      if(importedAreasWorld && importedAreasWorld[selectedAreaIndex]){
        importedAreasWorld.splice(selectedAreaIndex, 1);
        selectedAreaIndex = -1;
        updateImportedAreasPixels();
        render();
        e.preventDefault();
      }
    }
  });

  function resetStacks(){ undoStack.length = 0; redoStack.length = 0; }

  function setAllDims(w,h){
    baseCanvas.width = w; baseCanvas.height = h;
    drawCanvas.width = w; drawCanvas.height = h;
    setCanvasDims(w,h);
  }

  function loadFromImage(img){
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    originalWidth = w; originalHeight = h;
    setAllDims(w,h);
    baseCtx.drawImage(img, 0, 0, w, h);
    drawCtx.clearRect(0,0,w,h);
    imageLoaded = true;
    resetStacks();
    applyZoom(parseFloat(zoomRange.value));
    updateInfo();
    render();
    drawGrid();
    updateZeroPixel();
  }

  function parsePGM(buffer){
    const u8 = new Uint8Array(buffer);
    let p = 0;
    const isWs = (c)=> c===9||c===10||c===13||c===32;
    function skipWs(){
      while(p<u8.length){ if(u8[p]===35){ while(p<u8.length && u8[p]!==10) p++; } else if(isWs(u8[p])){ p++; } else break; }
    }
    function readToken(){
      skipWs();
      let s = '';
      while(p<u8.length && !isWs(u8[p]) && u8[p]!==35){ s += String.fromCharCode(u8[p++]); }
      return s;
    }
    const magic = readToken();
    if(magic!=='P5' && magic!=='P2') throw new Error('not pgm');
    const w = parseInt(readToken(),10);
    const h = parseInt(readToken(),10);
    const maxv = parseInt(readToken(),10);
    if(!isFinite(w)||!isFinite(h)||!isFinite(maxv)||w<=0||h<=0) throw new Error('bad header');
    const gray = new Uint8Array(w*h);
    if(magic==='P5'){
      if(isWs(u8[p])) p++;
      if(maxv<=255){
        for(let i=0;i<w*h && p<u8.length;i++,p++) gray[i] = u8[p];
      } else {
        for(let i=0;i<w*h && p+1<u8.length;i++,p+=2){ const v = (u8[p]<<8)|u8[p+1]; gray[i] = Math.max(0,Math.min(255, Math.round(v/257))); }
      }
    } else {
      for(let i=0;i<w*h;i++){ const t = readToken(); if(!t) break; const v = parseFloat(t); const g = Math.round((v/maxv)*255); gray[i] = Math.max(0,Math.min(255,g)); }
    }
    return { width:w, height:h, gray };
  }

  function loadFromPGM(pgm){
    const w = pgm.width, h = pgm.height;
    originalWidth = w; originalHeight = h;
    setAllDims(w,h);
    const imgData = baseCtx.createImageData(w,h);
    const d = imgData.data;
    const g = pgm.gray;
    for(let i=0,j=0;i<g.length;i++,j+=4){ const v = g[i]; d[j]=v; d[j+1]=v; d[j+2]=v; d[j+3]=255; }
    baseCtx.putImageData(imgData,0,0);
    drawCtx.clearRect(0,0,w,h);
    imageLoaded = true;
    resetStacks();
    applyZoom(parseFloat(zoomRange.value));
    updateInfo();
    render();
    drawGrid();
    updateZeroPixel();
  }

  fileInput.addEventListener('change', ()=>{
    const f = fileInput.files && fileInput.files[0];
    if(!f) return;
    const name = (f.name||'').toLowerCase();
    if(name.endsWith('.pgm')){
      const reader = new FileReader();
      reader.onload = ()=>{ try{ const pgm = parsePGM(reader.result); loadFromPGM(pgm); }catch(e){} };
      reader.readAsArrayBuffer(f);
    } else {
      const url = URL.createObjectURL(f);
      const img = new Image();
      img.decode ? img.decode().catch(()=>{}) : null;
      img.onload = ()=>{ loadFromImage(img); URL.revokeObjectURL(url); };
      img.onerror = ()=>{ URL.revokeObjectURL(url); };
      img.src = url;
    }
  });

  function rotateCanvas90(srcCanvas, dir){
    const w = srcCanvas.width, h = srcCanvas.height;
    const out = document.createElement('canvas');
    out.width = h; out.height = w;
    const ctx = out.getContext('2d');
    ctx.save();
    if(dir === 'R'){
      ctx.translate(h, 0);
      ctx.rotate(Math.PI/2);
    } else {
      ctx.translate(0, w);
      ctx.rotate(-Math.PI/2);
    }
    ctx.drawImage(srcCanvas, 0, 0);
    ctx.restore();
    return out;
  }
  function rotateArbitrary(srcCanvas, angleRad){
    const w = srcCanvas.width, h = srcCanvas.height;
    const cos = Math.abs(Math.cos(angleRad));
    const sin = Math.abs(Math.sin(angleRad));
    const newW = Math.max(1, Math.round(w * cos + h * sin));
    const newH = Math.max(1, Math.round(w * sin + h * cos));
    const out = document.createElement('canvas');
    out.width = newW; out.height = newH;
    const ctx = out.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.translate(newW/2, newH/2);
    ctx.rotate(angleRad);
    ctx.drawImage(srcCanvas, -w/2, -h/2);
    ctx.restore();
    return out;
  }

  // Unify rotation behavior so header and quick-controls follow the same path
  function commitRotation(angleRad){
    if(!imageLoaded) return;
    cancelStroke();
    baseCanvas = rotateArbitrary(baseCanvas, angleRad);
    drawCanvas = rotateArbitrary(drawCanvas, angleRad);
    previewRotationDeg = 0;
    afterGeometryChange();
  }

  function flipCanvas(srcCanvas, axis){
    const w = srcCanvas.width, h = srcCanvas.height;
    const out = document.createElement('canvas');
    out.width = w; out.height = h;
    const ctx = out.getContext('2d');
    ctx.save();
    if(axis === 'H'){
      ctx.translate(w, 0); ctx.scale(-1, 1);
    } else {
      ctx.translate(0, h); ctx.scale(1, -1);
    }
    ctx.drawImage(srcCanvas, 0, 0);
    ctx.restore();
    return out;
  }

  function afterGeometryChange(){
    baseCtx = baseCanvas.getContext('2d');
    drawCtx = drawCanvas.getContext('2d');
    setCanvasDims(baseCanvas.width, baseCanvas.height);
    resetStacks();
    updateInfo();
    render();
    drawGrid();
    panX = 0; panY = 0;
    updateTransform();
    isDrawing = false;
    activePointerId = null;
    lastHover = { x: 0, y: 0, valid: false };
    viewAngleDeg = 0;
    annotations = [];
    setTool(currentTool);
    updateZeroPixel();
  }

  rotR.addEventListener('click', ()=>{
    if(!imageLoaded) return;
    viewAngleDeg = ((viewAngleDeg + 90) % 360 + 360) % 360;
    if(viewAngleDeg > 180) viewAngleDeg -= 360;
    render();
  });
  rotL.addEventListener('click', ()=>{
    if(!imageLoaded) return;
    viewAngleDeg = ((viewAngleDeg - 90) % 360 + 360) % 360;
    if(viewAngleDeg > 180) viewAngleDeg -= 360;
    render();
  });
  flipH.addEventListener('click', ()=>{
    if(!imageLoaded) return;
    baseCanvas = flipCanvas(baseCanvas, 'H');
    drawCanvas = flipCanvas(drawCanvas, 'H');
    afterGeometryChange();
  });
  flipV.addEventListener('click', ()=>{
    if(!imageLoaded) return;
    baseCanvas = flipCanvas(baseCanvas, 'V');
    drawCanvas = flipCanvas(drawCanvas, 'V');
    afterGeometryChange();
  });

  if (toolUndoBtn) toolUndoBtn.addEventListener('click', ()=> undo());
  if (toolRedoBtn) toolRedoBtn.addEventListener('click', ()=> redo());

  function exportComposite(type, quality){
    if(!imageLoaded) return;
    const mime = type === 'jpeg' ? 'image/jpeg' : 'image/png';
    const q = type === 'jpeg' ? (quality || 0.92) : undefined;

    // 1) Compor base + draw no tamanho atual (após qualquer rotação/flip)
    const compW = baseCanvas.width, compH = baseCanvas.height;
    const comp = document.createElement('canvas');
    comp.width = compW; comp.height = compH;
    const cctx = comp.getContext('2d');
    cctx.imageSmoothingEnabled = false;
    cctx.drawImage(baseCanvas, 0, 0);
    const includeOverlay = !!(exportProhibitions && exportProhibitions.checked);
    if(includeOverlay){
      const tmp = document.createElement('canvas');
      tmp.width = drawCanvas.width; tmp.height = drawCanvas.height;
      const tctx = tmp.getContext('2d');
      tctx.drawImage(drawCanvas, 0, 0);
      try{
        const img = tctx.getImageData(0,0,tmp.width,tmp.height);
        const data = img.data;
        for(let i=0;i<data.length;i+=4){
          const a = data[i+3];
          if(a!==0){ data[i]=0; data[i+1]=0; data[i+2]=0; }
        }
        tctx.putImageData(img,0,0);
      }catch(e){ }
      cctx.drawImage(tmp, 0, 0);
    } else {
      const tmp = document.createElement('canvas');
      tmp.width = drawCanvas.width; tmp.height = drawCanvas.height;
      const tctx = tmp.getContext('2d');
      tctx.drawImage(drawCanvas, 0, 0);
      try{
        const img = tctx.getImageData(0,0,tmp.width,tmp.height);
        const data = img.data;
        for(let i=0;i<data.length;i+=4){
          const r = data[i], g = data[i+1], b = data[i+2], a = data[i+3];
          if(a!==0 && r>=200 && g<=50 && b<=50){ data[i+3]=0; }
        }
        tctx.putImageData(img,0,0);
      }catch(e){ }
      cctx.drawImage(tmp, 0, 0);
    }

    // 2) Criar saída no tamanho ORIGINAL e centralizar o composto (corta/exibe bordas conforme necessário)
    const out = document.createElement('canvas');
    out.width = originalWidth; out.height = originalHeight;
    const octx = out.getContext('2d');
    octx.imageSmoothingEnabled = false;
    // fundo cinza para áreas não preenchidas (PNG e JPEG)
    octx.fillStyle = '#cdcdcd';
    octx.fillRect(0,0,out.width,out.height);
    const dx = Math.round((originalWidth - compW)/2);
    const dy = Math.round((originalHeight - compH)/2);
    // export sempre na orientação original (ignorar rotação de visualização)
    // drawImage aceita dx/dy negativos; canvas faz o recorte automaticamente
    octx.drawImage(comp, dx, dy);

    return out.toDataURL(mime, q);
  }

  function triggerDownload(dataUrl, suggested){
    downloadLink.href = dataUrl;
    downloadLink.download = suggested || 'image-edited.' + (dataUrl.includes('image/png')?'png':'jpg');
    downloadLink.click();
  }

  function pixelToMap(x, y, meta){
    const res = Math.max(1e-9, meta.resolution);
    const ox = meta.originX || 0;
    const oy = meta.originY || 0;
    const yaw = meta.originYaw || 0;
    const ix = x * res;
    const iy = (baseCanvas.height - y) * res;
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const rx = ix * c - iy * s;
    const ry = ix * s + iy * c;
    return { x: ox + rx, y: oy + ry };
  }

  function mapToPixel(wx, wy, meta){
    const res = Math.max(1e-9, meta.resolution);
    const ox = meta.originX || 0;
    const oy = meta.originY || 0;
    const yaw = meta.originYaw || 0;
    const rx = wx - ox;
    const ry = wy - oy;
    const c = Math.cos(-yaw), s = Math.sin(-yaw);
    const ix = rx * c - ry * s;
    const iy = rx * s + ry * c;
    const x = ix / res;
    const y = baseCanvas.height - (iy / res);
    return { x, y };
  }

  function updateZeroPixel(){
    if(mapMeta && imageLoaded){
      const res = Math.max(1e-9, mapMeta.resolution);
      const x = (-mapMeta.originX) / res;
      const y = baseCanvas.height + (mapMeta.originY / res);
      zeroPixel = { x, y };
      if(Number.isFinite(mapMeta.startX) && Number.isFinite(mapMeta.startY)){
        const p = mapToPixel(mapMeta.startX, mapMeta.startY, mapMeta);
        startPixel = p;
      } else {
        startPixel = null;
      }
      updateImportedAreasPixels();
      updateImportedPointsPixels();
    } else {
      zeroPixel = null;
      startPixel = null;
      importedAreasPx = [];
      importedPointsPx = [];
    }
  }

  

  function buildYamlFromAnnotations(ann, meta){
    let out = 'prohibition_areas:\n';
    const fmt = (v)=> Number.isFinite(v) ? v.toFixed(2) : '0.00';
    ann.forEach(a=>{
      const pts = a.pts.map(p=>{
        const m = pixelToMap(p.x, p.y, meta);
        return `[${fmt(m.x)}, ${fmt(m.y)}]`;
      }).join(', ');
      out += `  - [${pts}]\n`;
    });
    return out;
  }

  function buildYamlCombined(ann, importedWorld, meta){
    let out = 'prohibition_areas:\n';
    const fmt = (v)=> Number.isFinite(v) ? v.toFixed(2) : '0.00';
    if(Array.isArray(importedWorld)){
      importedWorld.forEach(arr=>{
        const pts = (arr||[]).map(p=> `[${fmt(p.x)}, ${fmt(p.y)}]`).join(', ');
        if(pts) out += `  - [${pts}]\n`;
      });
    }
    ann.forEach(a=>{
      const pts = a.pts.map(p=>{
        const m = pixelToMap(p.x, p.y, meta);
        return `[${fmt(m.x)}, ${fmt(m.y)}]`;
      }).join(', ');
      out += `  - [${pts}]\n`;
    });
    return out;
  }

  if (saveYaml) saveYaml.addEventListener('click', ()=>{
    if(!imageLoaded){ return; }
    let meta = mapMeta;
    if(!meta){
      const res = parseFloat(prompt('Resolution (m/pixel) from map.yaml', '0.05') || '0.05');
      const ox = parseFloat(prompt('Origin X (m) from map.yaml', '0') || '0');
      const oy = parseFloat(prompt('Origin Y (m) from map.yaml', '0') || '0');
      const yaw = parseFloat(prompt('Origin yaw (rad) from map.yaml', '0') || '0');
      meta = { resolution: res, originX: ox, originY: oy, originYaw: yaw };
    }
    const yaml = buildYamlCombined(annotations, importedAreasWorld, meta);
    const blob = new Blob([yaml], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    triggerDownload(url, 'prohibition_areas.yaml');
    setTimeout(()=> URL.revokeObjectURL(url), 1000);
  });

  if(importMapYaml && mapYamlFile){
    importMapYaml.addEventListener('click', ()=>{ mapYamlFile.value = ''; mapYamlFile.click(); });
    mapYamlFile.addEventListener('change', ()=>{
      const f = mapYamlFile.files && mapYamlFile.files[0];
      if(!f) return;
      const reader = new FileReader();
      reader.onload = ()=>{ try{ mapMeta = parseMapYaml(String(reader.result||'')); updateZeroPixel(); render(); }catch(e){} };
      reader.readAsText(f);
    });
  }

  if(areasYamlFile){
    areasYamlFile.addEventListener('change', ()=>{
      const f = areasYamlFile.files && areasYamlFile.files[0];
      if(!f) return;
      const reader = new FileReader();
      reader.onload = ()=>{ try{ importedAreasWorld = parseAreasYaml(String(reader.result||'')); updateImportedAreasPixels(); render(); }catch(e){} };
      reader.readAsText(f);
    });
  }
  if(areasToggle){ areasToggle.addEventListener('change', ()=>{ render(); }); }

  if(pointsJsonFile){
    pointsJsonFile.addEventListener('change', ()=>{
      const f = pointsJsonFile.files && pointsJsonFile.files[0];
      if(!f) return;
      const reader = new FileReader();
      reader.onload = ()=>{ try{ importedPointsWorld = parsePointsJson(String(reader.result||'')); updateImportedPointsPixels(); render(); }catch(e){} };
      reader.readAsText(f);
    });
  }
  if(pointsToggle){ pointsToggle.addEventListener('change', ()=>{ render(); }); }

  savePng.addEventListener('click', ()=>{
    const data = exportComposite('png');
    if(data) triggerDownload(data, 'image-edited.png');
  });
  saveJpeg.addEventListener('click', ()=>{
    const data = exportComposite('jpeg', 1);
    if(data) triggerDownload(data, 'image-edited.jpg');
  });

  function exportCompositePgmBlob(){
    if(!imageLoaded) return null;
    const compW = baseCanvas.width, compH = baseCanvas.height;
    const comp = document.createElement('canvas');
    comp.width = compW; comp.height = compH;
    const cctx = comp.getContext('2d');
    cctx.imageSmoothingEnabled = false;
    cctx.drawImage(baseCanvas, 0, 0);
    const includeOverlay = !!(exportProhibitions && exportProhibitions.checked);
    if(includeOverlay){
      const tmp = document.createElement('canvas');
      tmp.width = drawCanvas.width; tmp.height = drawCanvas.height;
      const tctx = tmp.getContext('2d');
      tctx.drawImage(drawCanvas, 0, 0);
      try{
        const img = tctx.getImageData(0,0,tmp.width,tmp.height);
        const data = img.data;
        for(let i=0;i<data.length;i+=4){ const a = data[i+3]; if(a!==0){ data[i]=0; data[i+1]=0; data[i+2]=0; } }
        tctx.putImageData(img,0,0);
      }catch(e){}
      cctx.drawImage(tmp, 0, 0);
    } else {
      const tmp = document.createElement('canvas');
      tmp.width = drawCanvas.width; tmp.height = drawCanvas.height;
      const tctx = tmp.getContext('2d');
      tctx.drawImage(drawCanvas, 0, 0);
      try{
        const img = tctx.getImageData(0,0,tmp.width,tmp.height);
        const data = img.data;
        for(let i=0;i<data.length;i+=4){ const r=data[i], g=data[i+1], b=data[i+2], a=data[i+3]; if(a!==0 && r>=200 && g<=50 && b<=50){ data[i+3]=0; } }
        tctx.putImageData(img,0,0);
      }catch(e){}
      cctx.drawImage(tmp, 0, 0);
    }
    const out = document.createElement('canvas');
    out.width = originalWidth; out.height = originalHeight;
    const octx = out.getContext('2d');
    octx.imageSmoothingEnabled = false;
    octx.fillStyle = '#cdcdcd';
    octx.fillRect(0,0,out.width,out.height);
    const dx = Math.round((originalWidth - compW)/2);
    const dy = Math.round((originalHeight - compH)/2);
    octx.drawImage(comp, dx, dy);
    const img = octx.getImageData(0,0,out.width,out.height);
    const data = img.data;
    const gray = new Uint8Array(out.width*out.height);
    for(let i=0,j=0;i<gray.length;i++,j+=4){ gray[i] = Math.max(0,Math.min(255, Math.round(0.299*data[j] + 0.587*data[j+1] + 0.114*data[j+2]))); }
    const enc = new TextEncoder();
    const head = enc.encode(`P5\n${out.width} ${out.height}\n255\n`);
    return new Blob([head, gray], { type: 'image/x-portable-graymap' });
  }

  if(savePgm){
    savePgm.addEventListener('click', ()=>{
      const blob = exportCompositePgmBlob();
      if(!blob) return;
      const url = URL.createObjectURL(blob);
      triggerDownload(url, 'image-edited.pgm');
      setTimeout(()=> URL.revokeObjectURL(url), 1000);
    });
  }

  // Init
  applyZoom(parseFloat(zoomRange.value));
  updateInfo();
  setTool('pan');

  // Load default local map.yaml (fallback to defaults if not found)
  async function loadDefaultMapMeta(){
    try{
      const resp = await fetch('./map.yaml', { cache: 'no-store' });
      if(resp.ok){
        const txt = await resp.text();
        mapMeta = parseMapYaml(txt);
      } else {
        mapMeta = { resolution: 0.025, originX: 0, originY: 0, originYaw: 0 };
      }
    }catch(e){
      mapMeta = { resolution: 0.025, originX: 0, originY: 0, originYaw: 0 };
    }
    updateZeroPixel();
    render();
  }
  loadDefaultMapMeta();

  // Position quick-controls below header dynamically
  const quickControls = document.querySelector('.quick-controls');
  const toolbarEl = document.querySelector('.toolbar');
  const toolboxEl = document.querySelector('.toolbox');
  function positionQuickControls(){
    if(!quickControls || !toolbarEl) return;
    const h = toolbarEl.getBoundingClientRect().height || 72;
    quickControls.style.top = (Math.round(h) + 16) + 'px';
    // posicionar à esquerda da toolbox com folga
    if(toolboxEl){
      const tbRect = toolboxEl.getBoundingClientRect();
      const distRight = (parseInt(getComputedStyle(toolboxEl).right,10) || 16);
      const gap = 12;
      const rightPx = distRight + Math.round(tbRect.width) + gap;
      quickControls.style.right = rightPx + 'px';
    }
  }
  window.addEventListener('resize', positionQuickControls);
  positionQuickControls();
})();
