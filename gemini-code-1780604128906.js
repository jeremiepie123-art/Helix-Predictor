// ==UserScript==
// @name         Helix Predictor Ultimate Multi-Mode UI & Analytics
// @namespace    http://tampermonkey.net/
// @version      4.9
// @description  Forced state randomization on round state updates for Crash and Mines
// @author       You
// @match        https://bloxflip.com/*
// @run-at       document-end
// @grant        none
// ==/UserScript==

(function(){
'use strict';

const VERSION = '4.9';
const COLS = 3;
const STORE = 'helix_global_settings_v4';

// Dynamic state memories
let picks = [];
let enabled = true;
let lastUrl = location.href;
let autoStarted = false;
let lastCleanState = '';
let lastHadReveal = false;

// CRASH RIGID TELEMETRY
let crashObserver = null;
let lastCrashStateText = '';
let currentPredictedCrashNumber = 1.74;

// MINES RIGID TELEMETRY
let activeMinesPicks = [];
let lastMinesStateSignature = '';
let clickedMinesIndices = new Set();
let clickedTowersRows = new Set();

let settings = loadSettings();

function loadSettings() {
  try {
    return Object.assign({
      algorithm: 'smart',
      n_safe: 8,
      crashTarget: 2.0,
      crashRisk: 'medium',
      minesCount: 3,
      minesRisk: 'safe'
    }, JSON.parse(localStorage.getItem(STORE) || '{}'));
  } catch(e) {
    return {
      algorithm: 'smart', n_safe: 8,
      crashTarget: 2.0, crashRisk: 'medium',
      minesCount: 3, minesRisk: 'safe'
    };
  }
}

function saveSettings() {
  localStorage.setItem(STORE, JSON.stringify(settings));
}

function css(s){const e=document.createElement('style');e.textContent=s;document.head.appendChild(e);}

css(`
@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght=500;700;900&family=Space+Grotesk:wght=400;500;700&display=swap');

#twPanel {
  position: fixed; top: 100px; right: 25px; z-index: 999999999; width: 290px;
  background: linear-gradient(165deg, rgba(6, 15, 38, 0.96) 0%, rgba(2, 8, 24, 0.99) 100%);
  color: #d1f0ff; border: 1px solid rgba(0, 162, 255, 0.35); border-top: 3px solid #0099ff;
  border-radius: 12px; padding: 0; font-family: 'Space Grotesk', sans-serif;
  box-shadow: 0 12px 40px rgba(0, 8, 20, 0.6), 0 0 25px rgba(0, 153, 255, 0.15);
  backdrop-filter: blur(12px); overflow: hidden;
}
#twPanelHeader {
  background: linear-gradient(90deg, rgba(0, 153, 255, 0.08) 0%, rgba(0, 81, 255, 0.02) 100%);
  border-bottom: 1px solid rgba(0, 162, 255, 0.2); padding: 16px 18px;
}
#twPanel h2 {
  margin: 0; font-family: 'Orbitron', sans-serif; font-weight: 800; font-size: 18px;
  letter-spacing: 1.5px; text-transform: uppercase; color: #ffffff; display: flex; align-items: center; gap: 10px;
}
#twPanel .hxSub {
  font-family: 'Orbitron', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 2px; color: #00bdff;
  opacity: 0.8; text-transform: uppercase; margin: 4px 0 0 0;
}
#twPanelBody { padding: 18px; }
#twPanel p { margin: 0 0 12px 0; font-size: 13px; color: #94b5cf; display: flex; justify-content: space-between; align-items: center;}
#twPanel p b { color: #ffffff; font-family: 'Orbitron', sans-serif; font-size: 11px; background: rgba(0, 153, 255, 0.25); padding: 2px 8px; border-radius: 4px; border: 1px solid rgba(0, 153, 255, 0.4); }
#twPanelDivider { height: 1px; background: linear-gradient(90deg, rgba(0, 162, 255, 0.25), transparent); margin: 14px 0; }
#twPanel button {
  width: 100%; padding: 11px 0; border: 1px solid rgba(0, 153, 255, 0.4); border-radius: 6px;
  background: rgba(0, 110, 255, 0.08); color: #63cdff; font-weight: 700; cursor: pointer;
  font-family: 'Orbitron', sans-serif; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;
}
#twPanel button:hover { border-color: #00cdff; color: #ffffff; background: rgba(0, 153, 255, 0.2); }
#twStatusDot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #00e5ff; margin-right: 8px; box-shadow: 0 0 8px #00e5ff; }

/* Prediction Overlay Frames */
.twHL {
  position: fixed; z-index: 999999980; pointer-events: none;
  border: 2px dashed #00bfff; border-radius: 6px;
  box-shadow: 0 0 12px rgba(0, 191, 255, 0.4);
  background: rgba(0, 153, 255, 0.05);
  transition: background 0.15s, border-style 0.15s;
}
.twHL.hx-target-filled {
  border: 2px solid #0066ff !important;
  background: rgba(0, 102, 255, 0.45) !important;
  box-shadow: inset 0 0 15px rgba(0, 153, 255, 0.6), 0 0 15px rgba(0, 102, 255, 0.4) !important;
}

.twHLMines {
  position: absolute; z-index: 99998; pointer-events: none; inset: 0;
  border: 3px dashed #00bfff; border-radius: 8px;
  box-shadow: 0 0 15px rgba(0, 191, 255, 0.5);
  background: rgba(0, 153, 255, 0.05);
}

/* Customizer Panels */
#twSettings { position: fixed; inset: 0; z-index: 1000000000; background: rgba(2, 6, 16, 0.8); display: flex; align-items: center; justify-content: center; font-family: 'Space Grotesk', sans-serif; color: #d1f0ff; backdrop-filter: blur(8px); }
#twSettingsBox { width: 450px; background: linear-gradient(160deg, #040d21, #010612); border: 1px solid rgba(0, 153, 255, 0.3); border-top: 3px solid #00cdff; border-radius: 14px; padding: 25px; }
#twSettingsBox h1 { margin: 0 0 16px; font-family: 'Orbitron', sans-serif; font-size: 18px; color: #fff; }
.twTabs { display: flex; gap: 8px; margin-bottom: 20px; border-bottom: 1px solid rgba(0, 153, 255, 0.2); padding-bottom: 8px;}
.twTabBtn { background: transparent; border: none; color: #8faec4; font-family: 'Orbitron', sans-serif; font-size: 11px; cursor: pointer; padding: 6px 12px; }
.twTabBtn.active { background: rgba(0, 153, 255, 0.15); color: #00cdff; border: 1px solid rgba(0, 153, 255, 0.3); }
.twTabContent { display: none; }
.twTabContent.active { display: block; }
#twSettingsBox label { display: flex; align-items: center; justify-content: space-between; margin: 14px 0; font-size: 14px; }
#twSettingsBox select, #twSettingsBox input { width: 150px; background: rgba(0, 15, 41, 0.7); color: #00cdff; border: 1px solid rgba(0, 153, 255, 0.3); border-radius: 6px; padding: 6px; }
.twConfigFooter { margin-top: 20px; }
#twSettingsSave { float: right; width: 100px; background: #0088ff; color: #fff; border: none; padding: 8px; cursor: pointer; font-family: 'Orbitron', sans-serif; }
#twSettingsClose { float: right; width: 100px; margin-right: 10px; background: rgba(255,255,255,0.05); color: #94b5cf; border: 1px solid rgba(255,255,255,0.1); padding: 8px; cursor: pointer; font-family: 'Orbitron', sans-serif; }
#nxCrashBox, #nxMinesBox { margin-top: 14px; padding: 10px; border: 1px solid rgba(0, 153, 255, 0.15); border-radius: 6px; background: rgba(0, 12, 36, 0.45); font-size: 11px; color: #a2c4de; }
`);

function isTowers(){return location.href.includes('/towers');}
function isCrash(){return location.href.includes('/crash');}
function isMines(){return location.href.includes('/mines');}

function getGamemodeSub() {
  if(isTowers()) return 'Premium Predictor';
  if(isCrash()) return 'Crash Math';
  if(isMines()) return 'Mines ESP';
  return 'System Mode';
}

function clamp(v,min,max){v=Number(v);if(!Number.isFinite(v))v=min;return Math.max(min,Math.min(max,Math.floor(v)));}
function clear(){ document.querySelectorAll('.twHL').forEach(e=>e.remove()); }
function clearMinesESP() { document.querySelectorAll('.twHLMines').forEach(e=>e.remove()); }

function panel() {
 const existingPanel = document.getElementById('twPanel');
 let crashLineHtml = isCrash() ? `<p id="twCrashUiLine">Next Prediction <b style="color:#00ffcc !important; text-shadow: 0 0 8px #00ffcc;">${currentPredictedCrashNumber.toFixed(2)}x</b></p>` : '';

 if(existingPanel){
   const t = document.getElementById('twSubTitle'); if(t) t.textContent = getGamemodeSub();
   ensureModeBoxes();
   const uiLine = document.getElementById('twCrashUiLine');
   if(isCrash()) {
     if(uiLine) {
       uiLine.querySelector('b').innerHTML = `${currentPredictedCrashNumber.toFixed(2)}x`;
     } else {
       const divider = document.getElementById('twPanelDivider');
       if(divider) {
         const p = document.createElement('p'); p.id = 'twCrashUiLine';
         p.innerHTML = `Next Prediction <b style="color:#00ffcc !important; text-shadow: 0 0 8px #00ffcc;">${currentPredictedCrashNumber.toFixed(2)}x</b>`;
         divider.parentNode.insertBefore(p, divider);
       }
     }
   } else if (uiLine) {
     uiLine.remove();
   }
   return;
 }

 const p=document.createElement('div');p.id='twPanel';
 p.innerHTML=`
  <div id="twPanelHeader">
    <h2>Helix Predictor</h2>
    <p class="hxSub" id="twSubTitle">${getGamemodeSub()}</p>
  </div>
  <div id="twPanelBody">
    <p>Status <span><span id="twStatusDot"></span><b>ONLINE</b></span></p>
    <p>Core Engine <b>v${VERSION}</b></p>
    ${crashLineHtml}
    <div id="twPanelDivider"></div>
    <button id="twSet">Control Panel</button>
  </div>`;
 document.body.appendChild(p);
 document.getElementById('twSet').onclick=openSettings;
 ensureModeBoxes();
}

function ensureModeBoxes() {
 const p=document.getElementById('twPanelBody'); if(!p)return;
 const oldCrash=document.getElementById('nxCrashBox'); if(!isCrash()){oldCrash?.remove();} else if(!oldCrash){const b=document.createElement('div');b.id='nxCrashBox';b.textContent='Syncing data...';p.appendChild(b);}
 const oldMines=document.getElementById('nxMinesBox'); if(!isMines()){oldMines?.remove();} else if(!oldMines){const b=document.createElement('div');b.id='nxMinesBox';b.textContent='Mines matrix scanning...';p.appendChild(b);}
}

function openSettings() {
 document.getElementById('twSettings')?.remove();
 const wrap=document.createElement('div');wrap.id='twSettings';
 wrap.innerHTML=`
  <div id="twSettingsBox">
    <h1>Helix Customizer</h1>
    <div class="twTabs">
      <button class="twTabBtn active" data-tab="tab-towers">Towers</button>
      <button class="twTabBtn" data-tab="tab-crash">Crash</button>
      <button class="twTabBtn" data-tab="tab-mines">Mines</button>
    </div>
    <div id="tab-towers" class="twTabContent active">
      <label><span>Processing Algorithm</span><select id="twAlg"><option value="smart">smart</option><option value="knn">knn indexing</option></select></label>
      <label><span>Dynamic Safe Threshold</span><input id="twSafe" type="number" min="1" max="8"></label>
    </div>
    <div id="tab-crash" class="twTabContent"><label><span>Target Multiplier</span><input id="crTarget" type="number" step="0.1"></label><label><span>Probability Weight</span><select id="crRisk"><option value="safe">Conservative</option><option value="medium">Balanced Core</option></select></label></div>
    <div id="tab-mines" class="twTabContent"><label><span>Configured Mines Count</span><input id="mnCount" type="number" min="1" max="24"></label><label><span>Prediction Density</span><select id="mnRisk"><option value="safe">Isolated Clusters</option><option value="spread">Distributed</option></select></label></div>
    <div class="twConfigFooter"><button id="twSettingsSave">Apply</button><button id="twSettingsClose">Cancel</button></div>
  </div>`;
 document.body.appendChild(wrap);
 document.getElementById('twAlg').value = settings.algorithm;
 document.getElementById('twSafe').value = settings.n_safe;
 document.getElementById('crTarget').value = settings.crashTarget;
 document.getElementById('crRisk').value = settings.crashRisk;
 document.getElementById('mnCount').value = settings.minesCount;
 document.getElementById('mnRisk').value = settings.minesRisk;
 wrap.querySelectorAll('.twTabBtn').forEach(t => { t.onclick = () => { wrap.querySelectorAll('.twTabBtn').forEach(b => b.classList.remove('active')); wrap.querySelectorAll('.twTabContent').forEach(c => c.classList.remove('active')); t.classList.add('active'); document.getElementById(t.getAttribute('data-tab')).classList.add('active'); }; });
 document.getElementById('twSettingsClose').onclick = () => wrap.remove();
 document.getElementById('twSettingsSave').onclick = () => {
   settings.algorithm = document.getElementById('twAlg').value;
   settings.n_safe = clamp(settings.n_safe, 1, 8);
   settings.crashTarget = parseFloat(document.getElementById('crTarget').value) || 2.0;
   settings.crashRisk = document.getElementById('crRisk').value;
   settings.minesCount = clamp(document.getElementById('mnCount').value, 1, 24);
   settings.minesRisk = document.getElementById('mnRisk').value;
   saveSettings(); wrap.remove(); forceNewPicks();
 };
}

/* ==========================================
   GLOBAL EVENT LISTENER FOR BUTTON CLICKS
   ========================================== */
document.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const text = (btn.innerText || btn.textContent || '').toLowerCase();
  
  // Intercepting "Start Game", "Join Next Game", "Bet", or "Play" clicks
  if (text.includes('bet') || text.includes('start') || text.includes('join') || text.includes('play')) {
      if (isCrash()) {
          const variationFactor = 1.05 + (Math.random() * 2.80);
          currentPredictedCrashNumber = Math.min(45.00, Math.max(1.08, variationFactor));
          panel(); // Instantly update the Crash UI
      } else if (isMines()) {
          activeMinesPicks = [];
          clickedMinesIndices.clear();
          lastMinesStateSignature = '';
          clearMinesESP(); // The interval engine will auto-generate new picks
      }
  }
});

/* ==========================================
   CRASH MODULE - FIXED INTER-ROUND TELEMETRY RESET
   ========================================== */
function getCrashStateContextText() {
  const contextEl = document.querySelector('[class*="crash-game__multiplier-container"], [class*="MultiplierContainer"], [class*="crash__info"]');
  return contextEl ? (contextEl.innerText || contextEl.textContent || '').trim().toLowerCase() : '';
}

function hookCrashMutationObserver() {
  if (crashObserver) return;
  const targetGameContainer = document.querySelector('[class*="gameLayoutColumnRight"], [class*="game-layout"], .game-layout');
  if (!targetGameContainer) return;

  crashObserver = new MutationObserver(() => {
    const currentStatusText = getCrashStateContextText();
    if (currentStatusText && currentStatusText !== lastCrashStateText) {
      // Secondary fallback randomize if the game auto-starts without clicking
      if (currentStatusText.includes('waiting') || currentStatusText.includes('starts in')) {
         const variationFactor = 1.05 + (Math.random() * 2.80);
         currentPredictedCrashNumber = Math.min(45.00, Math.max(1.08, variationFactor));
         panel();
      }
      lastCrashStateText = currentStatusText;
    }
  });

  crashObserver.observe(targetGameContainer, { childList: true, subtree: true, characterData: true });
  lastCrashStateText = getCrashStateContextText();
}

function updateCrashMath() {
  if(!isCrash()) { if(crashObserver) { crashObserver.disconnect(); crashObserver = null; } return; }
  hookCrashMutationObserver();

  const box = document.getElementById('nxCrashBox');
  if(box) box.textContent = `CRASH TELEMETRY\nStatic Round Prediction: ${currentPredictedCrashNumber.toFixed(2)}x`;
  panel();
}

/* ==========================================
   MINES MODULE - BOUNDARY RESET SCAN ENGINE
   ========================================== */
function getMinesStateSignatureString(tiles) {
  return tiles.map(t => {
    const isOver = t.disabled || t.getAttribute('disabled') || t.classList.toString().toLowerCase().includes('revealed') || t.querySelector('img');
    return isOver ? '1' : '0';
  }).join('');
}

function runMinesESP() {
  if(!isMines()) { clearMinesESP(); activeMinesPicks = []; clickedMinesIndices.clear(); lastMinesStateSignature = ''; return; }
  const box = document.getElementById('nxMinesBox');

  const gridContainer = document.querySelector('[class*="gameLayoutColumnRight"], [class*="game-layout-module-scss-module__naXBaW__gameLayoutColumnRight"]');
  const tileElements = gridContainer ? [...gridContainer.querySelectorAll('button, div[style*="cursor"]')].filter(el => { const r = el.getBoundingClientRect(); return r.width > 20 && Math.abs(r.width - r.height) < 5; }) : [];

  if (tileElements.length === 0) { activeMinesPicks = []; clickedMinesIndices.clear(); lastMinesStateSignature = ''; return; }

  const currentSig = getMinesStateSignatureString(tileElements);
  const activeRevealedOrDisabledCount = tileElements.filter(tile => tile.disabled || tile.getAttribute('disabled') || tile.classList.toString().toLowerCase().includes('revealed') || tile.querySelector('img')).length;

  // SYSTEM STATE DETECTION: If the board went entirely clean, force structural cache re-roll
  if ((activeRevealedOrDisabledCount === 0 && lastMinesStateSignature.includes('1'))) {
     if (activeMinesPicks.length > 0 || clickedMinesIndices.size > 0 || lastMinesStateSignature !== currentSig) {
         activeMinesPicks = [];
         clickedMinesIndices.clear();
         clearMinesESP();
     }
  }
  lastMinesStateSignature = currentSig;

  tileElements.forEach((tile, idx) => {
    if(!tile.hasAttribute('data-hx-listening')) {
      tile.setAttribute('data-hx-listening', 'true');
      const clickAction = () => {
         clickedMinesIndices.add(idx);
      };
      tile.addEventListener('mousedown', clickAction);
      tile.addEventListener('touchstart', clickAction);
    }
  });

  // Track operational tile filters
  activeMinesPicks = activeMinesPicks.filter(idx => {
    const tile = tileElements[idx]; if(!tile) return false;
    return !(tile.disabled || tile.getAttribute('disabled') || tile.classList.toString().toLowerCase().includes('revealed') || tile.querySelector('img'));
  });

  // Re-roll fresh layout allocations instantly if the collection pipeline drops down to empty parameters
  const targetCount = clamp(settings.minesCount, 1, 24);
  if (activeMinesPicks.length === 0 && activeRevealedOrDisabledCount === 0) {
    const availableCleanIndices = [];
    tileElements.forEach((tile, index) => { availableCleanIndices.push(index); });
    while (activeMinesPicks.length < targetCount && availableCleanIndices.length > 0) {
      const selectedRand = Math.floor(Math.random() * availableCleanIndices.length);
      activeMinesPicks.push(availableCleanIndices[selectedRand]);
      availableCleanIndices.splice(selectedRand, 1);
    }
  }

  clearMinesESP();
  activeMinesPicks.forEach(idx => {
     const targetTile = tileElements[idx];
     if (targetTile) {
         if (getComputedStyle(targetTile).position === 'static') targetTile.style.position = 'relative';
         if (!targetTile.querySelector('.twHLMines')) {
             const overlay = document.createElement('div');
             overlay.className = 'twHLMines';
             targetTile.appendChild(overlay);
         }
     }
  });
  if(box) box.textContent = `MINES TELEMETRY\nStatic Multi-Lock Vectors Running`;
}

/* ==========================================
   TOWERS MODULE - STABLE BOX INTERACTION LOOKUP
   ========================================== */
function findGrid(){
 const game=document.querySelector('[class*="towersGame"]'); if(!game)return [];
 let rows=[...game.querySelectorAll('[class*="towersGameRow"]')].filter(r=>{const x=r.getBoundingClientRect();return x.width>0&&x.height>0});
 rows.sort((a,b)=>a.getBoundingClientRect().top-b.getBoundingClientRect().top);
 const grid=[];for(const r of rows){let tiles=getTiles(r);if(tiles.length >= 3){tiles=tiles.slice(0,3).sort((a,b)=>a.getBoundingClientRect().left-b.getBoundingClientRect().left);grid.push(tiles);}}return grid;
}
function getTiles(row){
 const containers=[...row.querySelectorAll('[class*="towersGameRowContainer"]')].filter(e=>{const r=e.getBoundingClientRect();return r.width>10});if(containers.length>=3)return containers;
 return [...row.children].filter(e=>{const r=e.getBoundingClientRect();return r.width>10});
}
function targetRect(tile){ return tile.getBoundingClientRect(); }
function tileNum(tile){return((tile.innerText||tile.textContent||'').match(/\d+\.\d{2}/)||[''])[0];}
function revealedCount(grid){let n=0;for(const row of grid){for(const tile of row){if(!tileNum(tile))n++;}}return n;}
function cleanBoardState(grid){return grid.map(r=>r.map(tileNum).join(',')).join('|');}

function makePicks(rowCount){
  picks=[]; let prev;
  for(let i=0; i<rowCount; i++){
    let c=Math.floor(Math.random()*COLS);
    if(prev!==undefined && c===prev) c=(c+1)%COLS;
    picks.push(c); prev=c;
  }
}
function forceNewPicks(){
  enabled=true; autoStarted=true;
  if(isTowers()) { const g=findGrid(); if(!g.length)return; makePicks(g.length); lastCleanState=cleanBoardState(g); clickedTowersRows.clear(); draw(); }
  else if(isMines()) { activeMinesPicks = []; clickedMinesIndices.clear(); lastMinesStateSignature = ''; runMinesESP(); }
}

function draw(){
 clear(); if(!isTowers()||!enabled)return;
 const g=findGrid(); if(!g.length||!picks.length)return;
 const nSafe=clamp(settings.n_safe,1,Math.min(8,g.length));
 const start=Math.max(0,g.length-nSafe);

 for(let r=start; r<g.length; r++){
  const pickedCol = picks[r]??0;
  const tile=g[r][pickedCol]; if(!tile)continue;

  if(!tile.hasAttribute('data-hx-listening')) {
     tile.setAttribute('data-hx-listening', 'true');
     const towerClickAction = () => { clickedTowersRows.add(r); draw(); };
     tile.addEventListener('mousedown', towerClickAction);
     tile.addEventListener('touchstart', towerClickAction);
  }

  const b=targetRect(tile),w=74,h=34,box=document.createElement('div');
  box.className = clickedTowersRows.has(r) ? 'twHL hx-target-filled' : 'twHL';
  box.style.left=`${b.left+b.width/2-w/2}px`;box.style.top=`${b.top+b.height/2-h/2}px`;box.style.width=`${w}px`;box.style.height=`${h}px`;
  document.body.appendChild(box);
 }
}

function autoDraw(){
 if(!isTowers())return;
 const g=findGrid();if(!g.length)return;
 const reveal=revealedCount(g);const cleanSig=cleanBoardState(g);

 if(!autoStarted){autoStarted=true;enabled=true;makePicks(g.length);lastCleanState=cleanSig;lastHadReveal=reveal>0;clickedTowersRows.clear();draw();return;}
 if(reveal>0){lastHadReveal=true;draw();return;}
 if(lastHadReveal && reveal===0){makePicks(g.length);lastCleanState=cleanSig;lastHadReveal=false;clickedTowersRows.clear();draw();return;}
 if(!lastHadReveal && lastCleanState && cleanSig!==lastCleanState){makePicks(g.length);lastCleanState=cleanSig;clickedTowersRows.clear();draw();return;}
 draw();
}

function resetPage(){
  clear(); clearMinesESP();
  if(crashObserver) { crashObserver.disconnect(); crashObserver = null; }
  picks=[]; activeMinesPicks=[]; clickedMinesIndices.clear(); clickedTowersRows.clear();
  lastMinesStateSignature=''; autoStarted=false; lastCleanState=''; lastCrashStateText='';
  document.getElementById('twSettings')?.remove();
}

// Main Operational Loops
setTimeout(()=>{panel();autoDraw();updateCrashMath();runMinesESP();},1000);
addEventListener('resize',draw);addEventListener('scroll',draw,true);
setInterval(()=>{
 if(location.href!==lastUrl){lastUrl=location.href;resetPage();setTimeout(()=>{panel();autoDraw();updateCrashMath();runMinesESP();},700);return;}
 panel();autoDraw();updateCrashMath();runMinesESP();
},400);
})();