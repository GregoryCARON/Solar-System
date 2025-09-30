(function () {
    'use strict';
    // 1) Lock context menu / right clic / long-press
    const stop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        return false;
    };
    // Context menu (right click / long-press)
    window.addEventListener('contextmenu', stop, {capture: true});
    // Long-press (mobile browser)
    window.addEventListener('touchstart', function (e) {
        if (e.touches && e.touches.length > 1) return; // multi-touch : laisser passer
        this._lpTimer && clearTimeout(this._lpTimer);
        this._lpTimer = setTimeout(() => stop(e), 400);
    }, {passive: false, capture: true});
    window.addEventListener('touchend', function () {
        this._lpTimer && clearTimeout(this._lpTimer);
    }, {capture: true});
    // Disable drag & select in events
    window.addEventListener('dragstart', stop, {capture: true});
    window.addEventListener('selectstart', stop, {capture: true});
    // Copier / Cut / Paste : Locked
    ['copy', 'cut', 'paste'].forEach(type => {
        window.addEventListener(type, stop, {capture: true});
    });
    // 2) Lock shortcuts (multi-OS)
    //    F12, Ctrl/Cmd+Shift+I/J/C, Ctrl/Cmd+U, Ctrl/Cmd+S, Ctrl/Cmd+P,
    //    Ctrl/Cmd+Shift+K (Firefox), Ctrl/Cmd+Shift+E, etc.
    const isMeta = (e) => e.ctrlKey || e.metaKey; // Ctrl (Windows/Linux) or Cmd (macOS)
    window.addEventListener('keydown', function (e) {
        const k = e.key?.toLowerCase();

        if (e.key === 'F12' || e.keyCode === 123) return stop(e); // F12 (DevTools)
        if (isMeta(e) && !e.shiftKey && !e.altKey && k === 'u') return stop(e); // Ctrl/Cmd + U (View Source)
        if (isMeta(e) && !e.shiftKey && !e.altKey && k === 's') return stop(e); // Ctrl/Cmd + S (Save)
        if (isMeta(e) && !e.shiftKey && !e.altKey && k === 'p') return stop(e); // Ctrl/Cmd + P (Print)
        if (isMeta(e) && e.shiftKey && ['i', 'j', 'c', 'k', 'e', 'p', 's'].includes(k)) return stop(e); // Ctrl/Cmd + Shift + I / J / C (DevTools, console)
        if (isMeta(e) && e.shiftKey && k === 'k') return stop(e); // Ctrl/Cmd + Shift + K (Console Firefox)
        if (isMeta(e) && e.shiftKey && k === 'e') return stop(e); // Ctrl/Cmd + Shift + E (Network)
        if (isMeta(e) && e.shiftKey && k === 'c') return stop(e); // Ctrl/Cmd + Shift + C (Inspect element)
        if (isMeta(e) && e.shiftKey && k === 'j') return stop(e); // Ctrl/Cmd + Shift + J (Console Chrome)
        if (isMeta(e) && e.shiftKey && (k === 'p' || k === 's')) return stop(e); // Ctrl/Cmd + Shift + P / S (Command palette / save as)
        if (e.key === 'PrintScreen') return stop(e); // PrintScreen : non standard
    }, {capture: true});
    // 3) iFrame : lock override
    // Option prudente : Lock in loop
    const rearmHandlers = () => {
        const ensure = (type) => {
            window.addEventListener(type, stop, {capture: true});
        };
        ['contextmenu', 'dragstart', 'selectstart', 'copy', 'cut', 'paste'].forEach(ensure);
    };
    setInterval(rearmHandlers, 2000);
    document.addEventListener('click', function (e) {
        // bouton milieu (2) ou ctrl/shift-clic pour nouvel onglet/fenêtre
        if (e.button === 1 || e.ctrlKey || e.shiftKey || e.metaKey) return stop(e);
    }, {capture: true});
})();


(() => {
    if (!window.THREE) {
        const w = document.createElement('div');
        w.className = 'warn';
        w.textContent = 'Three.js loading failed (CDN ?)';
        document.body.appendChild(w);
        return;
    }

    /* ---------- Rendering ---------- */
    const container = document.getElementById('app');
    const renderer = new THREE.WebGLRenderer({antialias: true});
    renderer.setSize(innerWidth, innerHeight);
    renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.6;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    /* ---------- Caméra + controls ---------- */
    const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 50000);
    const cam = {yaw: -0.8, pitch: -0.35, dist: 1200, target: new THREE.Vector3(0, 0, 0)};
    let __topView = false;
    let __savedOrbit = null; // { yaw, pitch, dist, target }

    function updateCamera() {
        const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw), cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
        const fwd = new THREE.Vector3(-sy * cp, sp, -cy * cp).normalize();
        const eye = cam.target.clone().addScaledVector(fwd, -cam.dist);
        camera.position.copy(eye);
        camera.lookAt(cam.target);
    }

    updateCamera();

    let dragging = false, mode = 'orbit', lx = 0, ly = 0, rmbDown = false;
    renderer.domElement.addEventListener('pointerdown', e => {
        dragging = true;
        lx = e.clientX;
        ly = e.clientY;
        rmbDown = (e.button === 2);
        mode = (e.button === 2 || e.ctrlKey) ? 'pan' : 'orbit';
        renderer.domElement.setPointerCapture(e.pointerId);
    });
    renderer.domElement.addEventListener('contextmenu', e => e.preventDefault());
    renderer.domElement.addEventListener('pointerup', e => {
        dragging = false;
        if (e.button === 2) rmbDown = false;
        renderer.domElement.releasePointerCapture(e.pointerId);
    });
    renderer.domElement.addEventListener('pointermove', e => {
        if (!dragging) return;
        const dx = e.clientX - lx, dy = e.clientY - ly;
        lx = e.clientX;
        ly = e.clientY;
        if (mode === 'orbit') {
            cam.yaw += dx * 0.005;
            cam.pitch += dy * 0.005;
            cam.pitch = Math.max(-1.45, Math.min(1.45, cam.pitch));
        } else {
            const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw), cp = Math.cos(cam.pitch);
            const right = new THREE.Vector3(cy, 0, -sy).normalize();
            const up = new THREE.Vector3().crossVectors(right, new THREE.Vector3(-sy * cp, Math.sin(cam.pitch), -cy * cp)).normalize();
            const scale = (2 * cam.dist * Math.tan(camera.fov * Math.PI / 360)) / innerHeight;
            cam.target.addScaledVector(right, -dx * scale);
            cam.target.addScaledVector(up, dy * scale);
        }
        updateCamera();
    });
    renderer.domElement.addEventListener('wheel', e => {
        if (rmbDown) { // vue du dessus immédiate
            cam.pitch = -Math.PI / 2 + 1e-3;
        }
        cam.dist *= (e.deltaY > 0 ? 1.12 : 0.89);
        cam.dist = Math.max(150, Math.min(4000, cam.dist));
        updateCamera();
    }, {passive: false});

    // bouton + touche T
    document.getElementById('topBtn').onclick = () => {
        //cam.pitch = -Math.PI / 2 + 1e-3;
        //updateCamera();
        const btn = document.getElementById('topBtn');

        if (!__topView) {
            // -> Vue du dessus : on sauvegarde l’orbite actuelle
            __savedOrbit = {
                yaw: cam.yaw,
                pitch: cam.pitch,
                dist: cam.dist,
                target: cam.target.clone()
            };
            cam.pitch = -Math.PI / 2 + 1e-3; // top-down
            __topView = true;
            btn.textContent = 'Orbital View';
            btn.title = 'Go To Orbital View';
        } else {
            // <- Retour vue orbitale (restaure l’état)
            if (__savedOrbit) {
                cam.yaw = __savedOrbit.yaw;
                cam.pitch = __savedOrbit.pitch;
                cam.dist = __savedOrbit.dist;
                cam.target.copy(__savedOrbit.target);
            } else {
                // fallback si aucun snapshot (valeurs par défaut de ta scène)
                cam.yaw = -0.8;
                cam.pitch = -0.35;
                cam.dist = 1200;
                cam.target.set(0, 0, 0);
            }
            __topView = false;
            btn.textContent = 'Top View';
            btn.title = 'Go To Top View';
        }

        updateCamera();
    };
    window.addEventListener('keydown', (e) => {
        if (e.key.toLowerCase() === 't') {
            const isTop = Math.abs(cam.pitch + Math.PI / 2) < 0.05;
            cam.pitch = isTop ? -0.35 : -Math.PI / 2 + 1e-3;
            updateCamera();
        }
    });

    /* ---------- Lumières ---------- */
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const sunLight = new THREE.PointLight(0xffffff, 2.2, 0, 2);
    sunLight.position.set(0, 0, 0);
    scene.add(sunLight);

    /* ---------- Soleil ---------- */
    const SUN_R = 30; // Mercure reste largement hors du Soleil
    scene.add(new THREE.Mesh(
        new THREE.SphereGeometry(SUN_R, 48, 32),
        new THREE.MeshPhysicalMaterial({color: 0xffcc33, emissive: 0xffb733, emissiveIntensity: 1.6, roughness: 0.45})
    ));

    /* ---------- Outils textures ---------- */
    function solid(hex, w = 512, h = 256) {
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#' + hex.toString(16).padStart(6, '0');
        ctx.fillRect(0, 0, w, h);
        const t = new THREE.CanvasTexture(c);
        t.colorSpace = THREE.SRGBColorSpace;
        return t;
    }

    function bands(aHex, bHex, w = 512, h = 256) {
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const ctx = c.getContext('2d');
        const g = ctx.createLinearGradient(0, 0, 0, h);
        const ca = '#' + aHex.toString(16).padStart(6, '0'), cb = '#' + bHex.toString(16).padStart(6, '0');
        for (let i = 0; i <= 12; i++) {
            g.addColorStop(i / 12, i % 2 ? cb : ca);
        }
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        const t = new THREE.CanvasTexture(c);
        t.colorSpace = THREE.SRGBColorSpace;
        return t;
    }

    function marble(w = 512, h = 256) {
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const ctx = c.getContext('2d');
        const img = ctx.createImageData(w, h), d = img.data;
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
            const u = x / w, v = y / h;
            const m = Math.sin(u * 20) + Math.sin(v * 18) + Math.sin((u + v) * 12);
            const sea = Math.max(0, 1 - (m * 0.25 + 0.5));
            const r = sea * 60 + (1 - sea) * 50, g = sea * 120 + (1 - sea) * 170, b = sea * 200 + (1 - sea) * 90;
            const i = (y * w + x) * 4;
            d[i] = r;
            d[i + 1] = g;
            d[i + 2] = b;
            d[i + 3] = 255;
        }
        ctx.putImageData(img, 0, 0);
        const t = new THREE.CanvasTexture(c);
        t.colorSpace = THREE.SRGBColorSpace;
        return t;
    }

    const deg = THREE.MathUtils.degToRad;

    /* ---------- Data planets & orbitals parameters ---------- */
    const AU = 160; // 1 UA
    const SIZE = 22;  // rayon Terre visuel
    const inc = {
        mercury: 7.00,
        venus: 3.39,
        earth: 0.00,
        mars: 1.85,
        jupiter: 1.30,
        saturn: 2.49,
        uranus: 0.77,
        neptune: 1.77
    }; // i (deg)
    const ecc = {
        mercury: 0.206,
        venus: 0.007,
        earth: 0.017,
        mars: 0.093,
        jupiter: 0.049,
        saturn: 0.056,
        uranus: 0.046,
        neptune: 0.009
    };
    const nodes = {
        mercury: 48.331,
        venus: 76.680,
        earth: -11.261,
        mars: 49.558,
        jupiter: 100.464,
        saturn: 113.665,
        uranus: 74.006,
        neptune: 131.784
    }; // Ω (deg)

    const B = [
        {id: 'mercury', label: 'Mercury', a: 0.387, period: 87.97, size: 0.383, map: solid(0xb0b0b0)},
        {id: 'venus', label: 'Venus', a: 0.723, period: 224.70, size: 0.949, map: solid(0xc9a66b)},
        {id: 'earth', label: 'Earth', a: 1.000, period: 365.256, size: 1.000, map: marble()},
        {id: 'mars', label: 'Mars', a: 1.524, period: 686.98, size: 0.532, map: solid(0xe57373)},
        {id: 'jupiter', label: 'Jupiter', a: 5.203, period: 4332.59, size: 11.21, map: bands(0xe5d7c6, 0xb79f84)},
        {id: 'saturn', label: 'Saturn', a: 9.537, period: 10759.22, size: 9.45, map: bands(0xe6d799, 0xbfa874)},
        {id: 'uranus', label: 'Uranus', a: 19.191, period: 30685.4, size: 4.01, map: solid(0x80deea)},
        {id: 'neptune', label: 'Neptune', a: 30.068, period: 60190.0, size: 3.88, map: solid(0x90caf9)}
    ];


    /* ---------- Orbits (3D Lines) ---------- */
    function orbitLine(a, b, tiltDeg = 0, ascNodeDeg = 0) {
        const pts = [];
        const steps = 512;
        for (let i = 0; i <= steps; i++) {
            const t = i / steps * Math.PI * 2;
            pts.push(new THREE.Vector3(a * Math.cos(t), 0, b * Math.sin(t)));
        }
        const g = new THREE.BufferGeometry().setFromPoints(pts);
        const m = new THREE.LineBasicMaterial({color: 0x606060, transparent: true, opacity: 0.6});
        const line = new THREE.LineLoop(g, m);
        line.rotation.y = deg(ascNodeDeg);
        line.rotation.z = deg(tiltDeg);
        return line;
    }

    /* ---------- Planets + labels ---------- */
    const labelsLayer = document.getElementById('labels');
    const showLabels = document.getElementById('showLabels');
    const labelMap = new Map();

    const bodies = B.map(p => {
        const a = p.a * AU;
        const e = ecc[p.id] || 0;
        const b = a * Math.sqrt(1 - e * e);
        const size = Math.max(6, p.size * SIZE);

        // oriented ellipse: rotation Ω then inclinaison i
        const rot = new THREE.Euler(0, deg(nodes[p.id] || 0), deg(inc[p.id] || 0), 'XYZ');

        const mesh = new THREE.Mesh(
            new THREE.SphereGeometry(size, 36, 24),
            new THREE.MeshStandardMaterial({map: p.map, roughness: 0.7, metalness: 0.0})
        );
        scene.add(mesh);

        const line = orbitLine(a, b, inc[p.id] || 0, nodes[p.id] || 0);
        scene.add(line);

        const el = document.createElement('div');
        el.className = 'label';
        el.textContent = p.label;
        labelsLayer.appendChild(el);
        labelMap.set(mesh, el);

        const phase0 = Math.random() * Math.PI * 2;
        return {mesh, a, b, size, rot, period: p.period, phase0};
    });

    /* =======================
       REAL SCALE MODE (sizes)
       + automatic capping of the Sun to never encompass Mercury
       ======================= */
    (function () {
        if (window.__realScaleInit) return;
        window.__realScaleInit = true;

        const uiRoot = document.getElementById('ui');
        if (!uiRoot) return;

        // Sun
        let sunMesh = null, sunPosLen = Infinity;
        scene.traverse(o => {
            if (!o.isMesh) return;
            const gp = o.geometry && o.geometry.parameters;
            if (gp && typeof gp.radius === 'number') {
                const p = o.getWorldPosition(new THREE.Vector3());
                const l = p.length();
                if (l < sunPosLen) {
                    sunPosLen = l;
                    sunMesh = o;
                }
            }
        });

        // Bases Earth/Sun
        const earthIdx = B.findIndex(p => p.id === 'earth');
        const earthBody = bodies[earthIdx >= 0 ? earthIdx : 0];
        const earthBaseRadiusPx = earthBody.size;                    // rayon visuel Terre de TA scène
        const sunBaseRadiusPx = (sunMesh?.geometry?.parameters?.radius) || 30;

        let chk = document.getElementById('realScaleChk');
        let rng = document.getElementById('realScaleRange');
        let valEl = document.getElementById('realScaleVal');

        // Fallback if no UI : create (dev)
        if (!chk || !rng || !valEl) {
            const group = document.createElement('span');
            group.style.cssText = 'display:inline-flex;align-items:center;gap:8px;margin-left:12px';

            const lblChk = document.createElement('label');
            chk = document.createElement('input');
            chk.type = 'checkbox';
            chk.id = 'realScaleChk';
            lblChk.appendChild(chk);
            lblChk.appendChild(document.createTextNode(' Échelle réelle'));

            const lblRange = document.createElement('label');
            lblRange.style.marginLeft = '12px';
            lblRange.append(' × tailles ');
            rng = document.createElement('input');
            rng.type = 'range';
            rng.min = '0.02';
            rng.max = '1.00';
            rng.step = '0.01';
            rng.value = '0.20';
            rng.id = 'realScaleRange';
            valEl = document.createElement('span');
            valEl.id = 'realScaleVal';
            valEl.textContent = rng.value;
            lblRange.appendChild(rng);
            lblRange.appendChild(valEl);

            group.appendChild(lblChk);
            group.appendChild(lblRange);
            uiRoot.insertBefore(group, uiRoot.lastElementChild);
        }

        // UI State
        let realScaleOn = !!chk.checked;
        let mag = parseFloat(rng.value || '0.20');

        function applyRealScale() {
            if (!realScaleOn) {
                // OFF => put *everything* back to original visual state (including sun)
                bodies.forEach(b => b.mesh.scale.setScalar(1));
                if (sunMesh) sunMesh.scale.setScalar(1);
                if (valEl) valEl.textContent = (isFinite(mag) ? mag : 0).toFixed(2).replace(/\.00$/, '');
                return;
            }

            // ON : Planets scaling × mag
            const kPlanets = mag;
            bodies.forEach((b, i) => {
                const realInEarthR = (B[i] && typeof B[i].size === 'number') ? B[i].size : (b.size / earthBaseRadiusPx);
                const desired = realInEarthR * earthBaseRadiusPx * kPlanets;
                const s = desired / b.size;
                b.mesh.scale.setScalar(s);
            });

            // Sun: Never reach Mercury's perihelion
            const aMerc = (B.find(p => p.id === 'mercury')?.a || 0.387) * AU;
            const eMerc = ecc['mercury'] || 0;
            const qMerc = aMerc * (1 - eMerc);        // Minumum Mercury distance
            const margin = 0.58;                      // keeps empty visual
            const maxMagSun = (qMerc * margin) / (109 * earthBaseRadiusPx);

            const magSun = Math.min(mag, maxMagSun);

            if (sunMesh) {
                const desiredSun = 109 * earthBaseRadiusPx * magSun;
                const sSun = desiredSun / sunBaseRadiusPx;
                sunMesh.scale.setScalar(sSun);
            }

            if (valEl) {
                const capped = mag > (isFinite(maxMagSun) ? maxMagSun : mag);
                valEl.textContent = (isFinite(mag) ? mag : 0).toFixed(2).replace(/\.00$/, '') + (capped ? ' (limited)' : '');
            }
        }

        // Bind
        chk.onchange = () => {
            realScaleOn = chk.checked;
            applyRealScale();
        };
        rng.oninput = () => {
            mag = parseFloat(rng.value || '0');
            applyRealScale();
        };

        // Init
        applyRealScale();
    })();

    /* ---------- UI ---------- */
    const ui = {
        pause: document.getElementById('pause'),
        speed: document.getElementById('speed'),
        speedVal: document.getElementById('speedVal'),
        showOrbits: document.getElementById('showOrbits'),
        fps: document.getElementById('fps')
    };
    let running = true, simDays = 0, speed = +ui.speed.value;
    ui.pause.onclick = () => {
        running = !running;
        ui.pause.textContent = running ? '⏸︎ Pause' : '▶ Resume';
    };
    ui.speed.oninput = () => {
        speed = +ui.speed.value;
        ui.speedVal.textContent = String(+speed.toFixed(1)).replace(/\.0$/, '');
    };
    ui.showOrbits.onchange = () => {
        scene.traverse(o => {
            if (o.isLine) o.visible = ui.showOrbits.checked;
        });
    };

    /* ---------- Resize ---------- */
    function resize() {
        const w = innerWidth, h = innerHeight;
        renderer.setSize(w, h);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
    }

    addEventListener('resize', resize);
    resize();

    function placeLabel(obj, sizePx) {
        const world = obj.getWorldPosition(new THREE.Vector3());
        const proj = world.clone().project(camera);
        const x = (proj.x * 0.5 + 0.5) * innerWidth;
        const y = (-proj.y * 0.5 + 0.5) * innerHeight - (sizePx + 12);
        const el = labelMap.get(obj);
        if (showLabels.checked) {
            el.style.display = 'block';
            el.style.left = x + 'px';
            el.style.top = y + 'px';
        } else el.style.display = 'none';
    }

    /* ---------- Loop ---------- */
    let last = performance.now(), fpsCnt = 0, fpsLast = performance.now();

    function tick(now) {
        requestAnimationFrame(tick);
        const dt = (now - last) / 1000;
        last = now;
        if (running) simDays += dt * speed;

        // Params ellipse + orientation (Ω, i)
        bodies.forEach(b => {
            const w = (Math.PI * 2) / b.period;
            const th = w * simDays + b.phase0;
            const pos = new THREE.Vector3(b.a * Math.cos(th), 0, b.b * Math.sin(th)).applyEuler(b.rot);
            b.mesh.position.copy(pos);
        });

        renderer.render(scene, camera);
        bodies.forEach(b => placeLabel(b.mesh, b.size));

        fpsCnt++;
        const d = now - fpsLast;
        if (d >= 500) {
            ui.fps.textContent = "FPS: " + Math.round((fpsCnt * 1000) / d);
            fpsCnt = 0;
            fpsLast = now;
        }
    }

    requestAnimationFrame(tick);
})();
