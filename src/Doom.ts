/// <reference path="./plugin.d.ts" />
/// <reference path="./system.d.ts" />
/// <reference path="./app.d.ts" />
/// <reference path="./core.d.ts" />

function init() {
    $ui.register((ctx) => {

        const getDoomScript = () => {
            return `
            (function() {
                const ID = "seanime-doom-window";
                if (document.getElementById(ID)) return;

                // --- CONFIGURATION ---
                const RAW_URL = "https://raw.githubusercontent.com/Bas1874/Doom-Seanime/main/DOOM.zip";
                const GAME_URL = "https://corsproxy.io/?" + encodeURIComponent(RAW_URL);
                
                const DB_NAME = "SeanimeDoomCache";
                const STORE_NAME = "files";

                // --- FIXED CONFIGURATION (AUDIO ONLY) ---
                const DOOM_CONFIG = \`
snd_musicdevice		3
snd_sfxdevice		3
snd_sbport		220
snd_sbirq		7
snd_sbdma		1
snd_mport		330
screenblocks		10
use_mouse		1
\`;

                // --- CSS ---
                const style = document.createElement("style");
                style.textContent = \`
                    .doom-window {
                        position: fixed; bottom: 50px; right: 50px;
                        width: 640px; height: 435px;
                        background-color: #111; border: 2px solid #b91c1c;
                        box-shadow: 0 10px 40px rgba(0,0,0,0.9);
                        z-index: 2147483647; display: flex; flex-direction: column;
                        font-family: sans-serif; overflow: hidden; box-sizing: border-box;
                    }
                    .doom-header {
                        height: 35px; background: #b91c1c; display: flex;
                        align-items: center; justify-content: space-between;
                        padding: 0 10px; cursor: grab; user-select: none; flex-shrink: 0;
                    }
                    .doom-title { color: white; font-weight: 900; font-size: 13px; }
                    .doom-controls { display: flex; gap: 4px; align-items: center; }
                    .doom-btn {
                        background: rgba(0,0,0,0.2); border: none; color: white;
                        width: 22px; height: 22px; cursor: pointer;
                        display: flex; align-items: center; justify-content: center;
                    }
                    #d-reset { 
                        width: auto; padding: 0 8px; font-size: 10px; fontWeight: bold;
                        background: #500; margin-right: 10px; border-radius: 4px;
                    }
                    #d-reset:hover { background: #f00; }
                    .doom-content { 
                        position: relative; flex-grow: 1; background: #000; 
                        display: flex; align-items: center; justify-content: center;
                        overflow: hidden;
                    }
                    .status-text { color: #b91c1c; font-weight: bold; text-align: center; font-size: 14px; padding: 20px; }
                    iframe { width: 100%; height: 100%; border: none; display: none; }
                    .doom-window.minimized { height: 35px !important; width: 200px !important; }
                    .doom-window.fullscreen { top: 0 !important; left: 0 !important; width: 100vw !important; height: 100vh !important; border: none; }
                \`;
                document.head.appendChild(style);

                // --- HTML ---
                const win = document.createElement("div");
                win.id = ID;
                win.className = "doom-window";
                win.innerHTML = \`
                    <div class="doom-header">
                        <div class="doom-title">DOOM</div>
                        <div class="doom-controls">
                            <button id="d-reset" title="Redownload">RESET</button>
                            <button id="d-min" class="doom-btn">_</button>
                            <button id="d-max" class="doom-btn">⛶</button>
                            <button id="d-close" class="doom-btn">×</button>
                        </div>
                    </div>
                    <div class="doom-content">
                        <div id="d-status" class="status-text">Initializing...</div>
                        <iframe id="d-frame"></iframe>
                    </div>
                \`;
                document.body.appendChild(win);

                const statusEl = win.querySelector("#d-status");
                const frameEl = win.querySelector("#d-frame");

                // --- DATABASE ---
                function openDB() {
                    return new Promise((resolve, reject) => {
                        const req = indexedDB.open(DB_NAME, 1);
                        req.onupgradeneeded = (e) => e.target.result.createObjectStore(STORE_NAME);
                        req.onsuccess = (e) => resolve(e.target.result);
                        req.onerror = (e) => reject(e);
                    });
                }

                async function getGameData() {
                    const db = await openDB();
                    return new Promise((resolve) => {
                        const tx = db.transaction(STORE_NAME, "readonly");
                        const req = tx.objectStore(STORE_NAME).get("doom_full.zip");
                        req.onsuccess = () => resolve(req.result);
                    });
                }

                async function saveGameData(buffer) {
                    const db = await openDB();
                    const tx = db.transaction(STORE_NAME, "readwrite");
                    tx.objectStore(STORE_NAME).put(buffer, "doom_full.zip");
                }

                async function clearGameData() {
                    const db = await openDB();
                    const tx = db.transaction(STORE_NAME, "readwrite");
                    tx.objectStore(STORE_NAME).delete("doom_full.zip");
                    statusEl.style.display = "block";
                    frameEl.style.display = "none";
                    statusEl.innerText = "Cache cleared. Downloading...";
                    setTimeout(() => initGame(), 500);
                }

                // --- INIT ---
                async function initGame() {
                    try {
                        let gameBuffer = await getGameData();

                        if (gameBuffer) {
                            statusEl.innerText = "Loaded from Local Storage!";
                        } else {
                            statusEl.innerText = "Downloading Doom...";
                            const response = await fetch(GAME_URL);
                            if (!response.ok) throw new Error("Download Error: " + response.status);
                            
                            const type = response.headers.get("content-type");
                            if (type && type.includes("text/html")) throw new Error("Invalid Link: Got HTML.");
                            
                            gameBuffer = await response.arrayBuffer();
                            statusEl.innerText = "Saving...";
                            await saveGameData(gameBuffer);
                        }

                        const blob = new Blob([gameBuffer], { type: "application/zip" });
                        const gameUrl = URL.createObjectURL(blob);

                        const configB64 = btoa(DOOM_CONFIG);

                        // --- PLAYER HTML ---
                        const playerHtml = \`
                            <!doctype html>
                            <html lang="en">
                            <head>
                                <style>
                                    body { margin:0; overflow:hidden; background:#000; display:flex; justify-content:center; align-items:center; width:100vw; height:100vh; font-family: sans-serif; } 
                                    canvas { width: 100vw; height: 100vh; object-fit: fill; image-rendering: pixelated; display:block; }
                                    #overlay { position:absolute; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); display:flex; flex-direction:column; justify-content:center; align-items:center; z-index:10; color: white; }
                                    button { padding:15px 30px; font-size:20px; font-weight:bold; background:#b91c1c; color:white; border:2px solid white; cursor:pointer; margin-top: 20px; }
                                    button:hover { background:#f00; }
                                    table { margin-bottom: 10px; border-spacing: 10px; }
                                    td { font-size: 14px; }
                                    .key { font-weight: bold; color: #fca5a5; text-align: right; }
                                </style>
                                <script src="https://js-dos.com/6.22/current/js-dos.js"></script>
                            </head>
                            <body>
                                <div id="overlay">
                                    <h2 style="margin:0 0 10px 0; color: #b91c1c;">CONTROLS</h2>
                                    <table>
                                        <tr><td class="key">ARROWS</td><td>Move / Turn</td></tr>
                                        <tr><td class="key">CTRL</td><td>Fire Weapon</td></tr>
                                        <tr><td class="key">SPACE</td><td>Open Doors / Switches</td></tr>
                                        <tr><td class="key">SHIFT</td><td>Run</td></tr>
                                    </table>
                                    <button id="start">CLICK TO START</button>
                                </div>
                                <canvas id="canvas"></canvas>
                                <script>
                                    const btn = document.getElementById("start");
                                    const configStr = atob("\${configB64}");

                                    btn.onclick = function() {
                                        document.getElementById("overlay").style.display = "none";
                                        
                                        const AudioContext = window.AudioContext || window.webkitAudioContext;
                                        if (AudioContext) {
                                            const ctx = new AudioContext();
                                            ctx.resume();
                                        }

                                        Dos(document.getElementById("canvas"), { 
                                            wdosboxUrl: "https://js-dos.com/6.22/current/wdosbox.js",
                                            cycles: "auto",
                                            autolock: true,
                                        }).ready(function (fs, main) {
                                            fs.extract("\${gameUrl}").then(function () {
                                                fs.createFile("DEFAULT.CFG", configStr);
                                                main(["-c", "doom.exe"]);
                                            });
                                        });
                                    };
                                    
                                    window.addEventListener('click', () => {
                                        window.focus();
                                        const canvas = document.getElementById("canvas");
                                        if(canvas) canvas.focus();
                                    });
                                </script>
                            </body>
                            </html>
                        \`;

                        frameEl.srcdoc = playerHtml;
                        setTimeout(() => { statusEl.style.display = "none"; frameEl.style.display = "block"; }, 500);

                    } catch (e) {
                        statusEl.innerHTML = "Error: " + e.message + "<br><br>Click RESET.";
                        statusEl.style.color = "red";
                    }
                }

                // --- UI LOGIC ---
                const header = win.querySelector(".doom-header");
                let isDragging = false, dragOffset = {x:0, y:0};

                header.onmousedown = (e) => {
                    if(e.target.tagName === "BUTTON") return;
                    isDragging = true;
                    const r = win.getBoundingClientRect();
                    dragOffset = { x: e.clientX - r.left, y: e.clientY - r.top };
                };
                document.onmousemove = (e) => {
                    if(!isDragging) return;
                    win.style.left = (e.clientX - dragOffset.x) + "px";
                    win.style.top = (e.clientY - dragOffset.y) + "px";
                    win.style.bottom = "auto"; win.style.right = "auto";
                };
                document.onmouseup = () => isDragging = false;

                win.querySelector("#d-min").onclick = () => { win.classList.toggle("minimized"); win.classList.remove("fullscreen"); };
                win.querySelector("#d-max").onclick = () => { win.classList.remove("minimized"); win.classList.toggle("fullscreen"); };
                win.querySelector("#d-close").onclick = () => win.remove();
                win.querySelector("#d-reset").onclick = () => clearGameData();

                initGame();
            })();
            `;
        };

        // Updated Icon URL
        const icon = "https://github.com/Bas1874/Doom-Seanime/blob/main/icons/Doom.png?raw=true";

        const tray = ctx.newTray({
            tooltipText: "Doom",
            iconUrl: icon,
            withContent: false,
        });

        tray.onClick(async () => {
            try {
                const body = await ctx.dom.queryOne("body");
                if (!body) return;
                const script = await ctx.dom.createElement("script");
                script.setText(getDoomScript());
                body.append(script);
                setTimeout(() => script.remove(), 500);
            } catch (e) {}
        });
    });
}
