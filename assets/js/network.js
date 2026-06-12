/* ==========================================================================
   EXAFABS Living Network -- raw WebGL particle network. No dependencies.
   Nodes drift and breathe, nearest-neighbour links fade like routed traffic,
   bright "packets" travel along edges. Cursor is a gravity well; fast moves
   and taps send ripples. FPS governor sheds load below 45fps. Exposes
   window.ExafabsNetwork.attach(canvas) -> controller | null.
   ========================================================================== */
(function () {
  'use strict';

  var VERT_POINT = [
    'attribute vec2 aPos;',
    'attribute float aSize;',
    'attribute float aAlpha;',
    'uniform vec2 uRes;',
    'varying float vAlpha;',
    'void main() {',
    '  vec2 c = (aPos / uRes) * 2.0 - 1.0;',
    '  gl_Position = vec4(c.x, -c.y, 0.0, 1.0);',
    '  gl_PointSize = aSize;',
    '  vAlpha = aAlpha;',
    '}'
  ].join('\n');

  var FRAG_POINT = [
    'precision mediump float;',
    'uniform vec3 uColor;',
    'varying float vAlpha;',
    'void main() {',
    '  float r = length(gl_PointCoord - vec2(0.5));',
    '  float a = smoothstep(0.5, 0.1, r) * vAlpha;',
    '  gl_FragColor = vec4(uColor * a, a);',
    '}'
  ].join('\n');

  var VERT_LINE = [
    'attribute vec2 aPos;',
    'attribute float aAlpha;',
    'uniform vec2 uRes;',
    'varying float vAlpha;',
    'void main() {',
    '  vec2 c = (aPos / uRes) * 2.0 - 1.0;',
    '  gl_Position = vec4(c.x, -c.y, 0.0, 1.0);',
    '  vAlpha = aAlpha;',
    '}'
  ].join('\n');

  var FRAG_LINE = [
    'precision mediump float;',
    'uniform vec3 uColor;',
    'varying float vAlpha;',
    'void main() { gl_FragColor = vec4(uColor * vAlpha, vAlpha); }'
  ].join('\n');

  function compile(gl, type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { gl.deleteShader(s); return null; }
    return s;
  }

  function program(gl, vsSrc, fsSrc) {
    var vs = compile(gl, gl.VERTEX_SHADER, vsSrc);
    var fs = compile(gl, gl.FRAGMENT_SHADER, fsSrc);
    if (!vs || !fs) return null;
    var p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { gl.deleteProgram(p); return null; }
    return p;
  }

  function attach(canvas, opts) {
    opts = opts || {};
    var gl;
    try {
      var ctxOpts = { alpha: true, antialias: false, depth: false, stencil: false, premultipliedAlpha: true };
      gl = canvas.getContext('webgl2', ctxOpts) || canvas.getContext('webgl', ctxOpts) || canvas.getContext('experimental-webgl', ctxOpts);
    } catch (e) { gl = null; }
    if (!gl) return null;

    // Software rasterizers (SwiftShader/llvmpipe) burn seconds of main-thread
    // time on first draw -- those machines get the static SVG network instead.
    // window.__XF_FORCE_GL is a test hook for headless verification runs.
    try {
      if (window.__XF_FORCE_GL !== true) {
        var dbg = gl.getExtension('WEBGL_debug_renderer_info');
        var rend = String(dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
        if (/swiftshader|software|llvmpipe|softpipe|basic render driver/i.test(rend)) return null;
      }
    } catch (e) {}

    var pointProg, lineProg, pLoc, lLoc, ptBuf, lnBuf, pkBuf;

    function buildGL() {
      pointProg = program(gl, VERT_POINT, FRAG_POINT);
      lineProg = program(gl, VERT_LINE, FRAG_LINE);
      if (!pointProg || !lineProg) return false;
      pLoc = {
        aPos: gl.getAttribLocation(pointProg, 'aPos'),
        aSize: gl.getAttribLocation(pointProg, 'aSize'),
        aAlpha: gl.getAttribLocation(pointProg, 'aAlpha'),
        uRes: gl.getUniformLocation(pointProg, 'uRes'),
        uColor: gl.getUniformLocation(pointProg, 'uColor')
      };
      lLoc = {
        aPos: gl.getAttribLocation(lineProg, 'aPos'),
        aAlpha: gl.getAttribLocation(lineProg, 'aAlpha'),
        uRes: gl.getUniformLocation(lineProg, 'uRes'),
        uColor: gl.getUniformLocation(lineProg, 'uColor')
      };
      ptBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, ptBuf);
      gl.bufferData(gl.ARRAY_BUFFER, ptData.byteLength, gl.DYNAMIC_DRAW);
      lnBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, lnBuf);
      gl.bufferData(gl.ARRAY_BUFFER, lnData.byteLength, gl.DYNAMIC_DRAW);
      pkBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, pkBuf);
      gl.bufferData(gl.ARRAY_BUFFER, pkData.byteLength, gl.DYNAMIC_DRAW);
      gl.disable(gl.DEPTH_TEST);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      return true;
    }

    var isCoarse = false;
    try { isCoarse = window.matchMedia('(pointer: coarse)').matches; } catch (e) {}
    var small = window.innerWidth < 768;
    var mobile = isCoarse || small;

    var DPR = Math.min(window.devicePixelRatio || 1, 2);
    var CAP = mobile ? 800 : 2600;       // particle capacity
    var MIN_N = mobile ? 320 : 600;      // governor floor
    var MAX_LINKS = 2;                   // per-node edge cap -- keeps the field airy

    var n = CAP;
    var linkDist = (mobile ? 58 : 60) * DPR;
    var targetPackets = mobile ? 4 : 9;

    // Simulation state
    var pos = new Float32Array(CAP * 2);
    var vel = new Float32Array(CAP * 2);
    var home = new Float32Array(CAP * 2);
    var phase = new Float32Array(CAP);
    var size = new Float32Array(CAP);
    var baseA = new Float32Array(CAP);

    // GPU staging
    var ptData = new Float32Array(CAP * 4);                  // x,y,size,alpha
    var lnData = new Float32Array(CAP * MAX_LINKS * 6);      // 2 verts * (x,y,a)
    var pkData = new Float32Array(24 * 4);
    var edges = new Int32Array(CAP * MAX_LINKS * 2);
    var edgeCount = 0;
    var linkCnt = new Uint8Array(CAP);

    if (!buildGL()) return null;

    var W = 0, H = 0;
    var gridHeads = null, gridNext = new Int32Array(CAP), gridCols = 0, gridRows = 0, cell = 1;

    function sizeGrid() {
      cell = Math.max(24, linkDist);
      gridCols = Math.max(1, Math.ceil(W / cell));
      gridRows = Math.max(1, Math.ceil(H / cell));
      gridHeads = new Int32Array(gridCols * gridRows);
    }

    function resize() {
      var w = canvas.clientWidth || canvas.parentNode.clientWidth || window.innerWidth;
      var h = canvas.clientHeight || canvas.parentNode.clientHeight || window.innerHeight;
      var nw = Math.max(2, Math.round(w * DPR));
      var nh = Math.max(2, Math.round(h * DPR));
      if (nw === W && nh === H) return;
      var sx = W > 0 ? nw / W : 0, sy = H > 0 ? nh / H : 0;
      W = nw; H = nh;
      canvas.width = W; canvas.height = H;
      gl.viewport(0, 0, W, H);
      if (sx > 0) {
        for (var i = 0; i < CAP; i++) {
          pos[i * 2] *= sx; pos[i * 2 + 1] *= sy;
          home[i * 2] *= sx; home[i * 2 + 1] *= sy;
        }
      }
      sizeGrid();
    }

    function scatter() {
      for (var i = 0; i < CAP; i++) {
        var x = Math.random() * W;
        var y = Math.random() * H;
        home[i * 2] = x; home[i * 2 + 1] = y;
        pos[i * 2] = x; pos[i * 2 + 1] = y;
        vel[i * 2] = 0; vel[i * 2 + 1] = 0;
        phase[i] = Math.random() * Math.PI * 2;
        var hub = Math.random() < 0.06;
        size[i] = (hub ? 3.1 + Math.random() * 1.2 : 1.4 + Math.random() * 1.1) * DPR;
        baseA[i] = hub ? 0.85 : 0.3 + Math.random() * 0.4;
      }
    }

    resize();
    scatter();

    // Pointer state (device px)
    var px = -1e5, py = -1e5, pActive = false;
    var lastPX = 0, lastPY = 0, lastPT = 0, lastRipple = 0;
    var ripples = []; // {x,y,r,age,life}

    function toLocal(e) {
      var r = canvas.getBoundingClientRect();
      return { x: (e.clientX - r.left) * DPR, y: (e.clientY - r.top) * DPR };
    }

    function onMove(e) {
      var p = toLocal(e);
      px = p.x; py = p.y; pActive = true;
      var now = performance.now();
      if (lastPT > 0) {
        var dt = now - lastPT;
        if (dt > 0) {
          var sp = Math.hypot(p.x - lastPX, p.y - lastPY) / dt; // device px / ms
          if (sp > 1.6 * DPR && now - lastRipple > 320) {
            lastRipple = now;
            ripples.push({ x: p.x, y: p.y, r: 0, age: 0, life: 1.1 });
          }
        }
      }
      lastPX = p.x; lastPY = p.y; lastPT = now;
    }
    function onLeave() { pActive = false; px = -1e5; py = -1e5; }
    function onTouch(e) {
      if (!e.touches || !e.touches.length) return;
      var p = toLocal(e.touches[0]);
      ripples.push({ x: p.x, y: p.y, r: 0, age: 0, life: 1.2 });
    }

    // Packets travelling along edges
    var packets = []; // {a,b,t,sp,hops,fade}

    function neighborsOf(node, except) {
      var out = [];
      for (var e = 0; e < edgeCount; e++) {
        var a = edges[e * 2], b = edges[e * 2 + 1];
        if (a === node && b !== except) out.push(b);
        else if (b === node && a !== except) out.push(a);
        if (out.length >= 6) break;
      }
      return out;
    }

    function spawnPacket() {
      if (edgeCount === 0) return;
      var e = (Math.random() * edgeCount) | 0;
      packets.push({
        a: edges[e * 2], b: edges[e * 2 + 1],
        t: 0, sp: 0.55 + Math.random() * 0.8,
        hops: 2 + ((Math.random() * 4) | 0), fade: 1
      });
    }

    function stepPackets(dt) {
      while (packets.length < targetPackets && edgeCount > 0) spawnPacket();
      for (var i = packets.length - 1; i >= 0; i--) {
        var k = packets[i];
        k.t += k.sp * dt;
        if (k.t >= 1) {
          if (k.hops > 0) {
            var nb = neighborsOf(k.b, k.a);
            if (nb.length) {
              k.a = k.b; k.b = nb[(Math.random() * nb.length) | 0];
              k.t = 0; k.hops--;
              continue;
            }
          }
          k.fade -= dt * 3;
          k.t = 1;
          if (k.fade <= 0) packets.splice(i, 1);
        }
      }
    }

    // FPS governor
    var ema = 60, lastCheck = 0;
    function govern(now) {
      if (now - lastCheck < 2500) return;
      lastCheck = now;
      if (ema < 45 && n > MIN_N) {
        n = Math.max(MIN_N, (n * 0.8) | 0);
        linkDist = Math.max(38 * DPR, linkDist * 0.94);
        targetPackets = Math.max(2, targetPackets - 2);
        sizeGrid();
      }
    }

    var t = 0;
    var staticMode = false;

    function step(dt) {
      t += dt;
      var breath = 1 + 0.035 * Math.sin(t * 0.45);
      var cx = W * 0.5, cy = H * 0.5;
      var R = 175 * DPR, R2 = R * R;
      var i, ix, iy;

      for (i = ripples.length - 1; i >= 0; i--) {
        var rp = ripples[i];
        rp.age += dt;
        rp.r += 560 * DPR * dt;
        if (rp.age > rp.life) ripples.splice(i, 1);
      }

      for (i = 0; i < n; i++) {
        ix = i * 2; iy = ix + 1;
        var hx = cx + (home[ix] - cx) * breath + Math.sin(t * 0.5 + phase[i] * 3.1) * 9 * DPR;
        var hy = cy + (home[iy] - cy) * breath + Math.cos(t * 0.62 + phase[i] * 2.3) * 9 * DPR;
        vel[ix] += (hx - pos[ix]) * 0.013;
        vel[iy] += (hy - pos[iy]) * 0.013;

        if (pActive) {
          var dx = px - pos[ix], dy = py - pos[iy];
          var d2 = dx * dx + dy * dy;
          if (d2 < R2 && d2 > 1) {
            var d = Math.sqrt(d2);
            var f = (1 - d / R);
            f = f * f * 0.95;
            vel[ix] += (dx / d) * f;
            vel[iy] += (dy / d) * f;
          }
        }

        for (var r = 0; r < ripples.length; r++) {
          var rr = ripples[r];
          var rdx = pos[ix] - rr.x, rdy = pos[iy] - rr.y;
          var rd = Math.sqrt(rdx * rdx + rdy * rdy) || 1;
          var band = Math.abs(rd - rr.r);
          if (band < 52 * DPR) {
            var rf = (1 - band / (52 * DPR)) * (1 - rr.age / rr.life) * 2.3;
            vel[ix] += (rdx / rd) * rf;
            vel[iy] += (rdy / rd) * rf;
          }
        }

        vel[ix] *= 0.885;
        vel[iy] *= 0.885;
        pos[ix] += vel[ix] * dt * 60;
        pos[iy] += vel[iy] * dt * 60;
      }
    }

    function buildEdges() {
      gridHeads.fill(-1);
      var i, c;
      for (i = 0; i < n; i++) {
        var gx = Math.min(gridCols - 1, Math.max(0, (pos[i * 2] / cell) | 0));
        var gy = Math.min(gridRows - 1, Math.max(0, (pos[i * 2 + 1] / cell) | 0));
        c = gy * gridCols + gx;
        gridNext[i] = gridHeads[c];
        gridHeads[c] = i;
      }
      linkCnt.fill(0);
      edgeCount = 0;
      var ld2 = linkDist * linkDist;
      var lv = 0;
      var maxEdges = (CAP * MAX_LINKS) | 0;
      // unique-pair neighbour cells: self, E, SW, S, SE
      var OFF = [0, 0, 1, 0, -1, 1, 0, 1, 1, 1];
      for (var gy2 = 0; gy2 < gridRows; gy2++) {
        for (var gx2 = 0; gx2 < gridCols; gx2++) {
          var head = gridHeads[gy2 * gridCols + gx2];
          if (head < 0) continue;
          for (var o = 0; o < 5; o++) {
            var nx = gx2 + OFF[o * 2], ny = gy2 + OFF[o * 2 + 1];
            if (nx < 0 || ny < 0 || nx >= gridCols || ny >= gridRows) continue;
            var sameCell = o === 0;
            for (i = head; i >= 0; i = gridNext[i]) {
              if (linkCnt[i] >= MAX_LINKS) continue;
              var j = sameCell ? gridNext[i] : gridHeads[ny * gridCols + nx];
              for (; j >= 0; j = gridNext[j]) {
                if (linkCnt[i] >= MAX_LINKS) break;
                if (linkCnt[j] >= MAX_LINKS) continue;
                var dx = pos[i * 2] - pos[j * 2];
                var dy = pos[i * 2 + 1] - pos[j * 2 + 1];
                var d2 = dx * dx + dy * dy;
                if (d2 < ld2 && edgeCount < maxEdges) {
                  var d = Math.sqrt(d2);
                  var flick = staticMode ? 0.6 : 0.55 + 0.45 * Math.sin(t * 1.6 + (i * 0.37 + j * 0.61));
                  var a = (1 - d / linkDist) * 0.26 * flick;
                  lnData[lv++] = pos[i * 2]; lnData[lv++] = pos[i * 2 + 1]; lnData[lv++] = a;
                  lnData[lv++] = pos[j * 2]; lnData[lv++] = pos[j * 2 + 1]; lnData[lv++] = a;
                  edges[edgeCount * 2] = i; edges[edgeCount * 2 + 1] = j;
                  edgeCount++;
                  linkCnt[i]++; linkCnt[j]++;
                }
              }
            }
          }
        }
      }
      return lv;
    }

    function render() {
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      var lv = buildEdges();

      // Lines
      if (lv > 0) {
        gl.useProgram(lineProg);
        gl.uniform2f(lLoc.uRes, W, H);
        gl.uniform3f(lLoc.uColor, 0.235, 0.95, 0.706);
        gl.bindBuffer(gl.ARRAY_BUFFER, lnBuf);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, lnData.subarray(0, lv));
        gl.enableVertexAttribArray(lLoc.aPos);
        gl.vertexAttribPointer(lLoc.aPos, 2, gl.FLOAT, false, 12, 0);
        gl.enableVertexAttribArray(lLoc.aAlpha);
        gl.vertexAttribPointer(lLoc.aAlpha, 1, gl.FLOAT, false, 12, 8);
        gl.drawArrays(gl.LINES, 0, lv / 3);
      }

      // Nodes
      var pv = 0;
      for (var i = 0; i < n; i++) {
        ptData[pv++] = pos[i * 2];
        ptData[pv++] = pos[i * 2 + 1];
        ptData[pv++] = size[i];
        ptData[pv++] = staticMode ? baseA[i] * 0.95 : baseA[i] * (0.72 + 0.28 * Math.sin(t * 1.3 + phase[i] * 7));
      }
      gl.useProgram(pointProg);
      gl.uniform2f(pLoc.uRes, W, H);
      gl.uniform3f(pLoc.uColor, 0.235, 0.95, 0.706);
      gl.bindBuffer(gl.ARRAY_BUFFER, ptBuf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, ptData.subarray(0, pv));
      gl.enableVertexAttribArray(pLoc.aPos);
      gl.vertexAttribPointer(pLoc.aPos, 2, gl.FLOAT, false, 16, 0);
      gl.enableVertexAttribArray(pLoc.aSize);
      gl.vertexAttribPointer(pLoc.aSize, 1, gl.FLOAT, false, 16, 8);
      gl.enableVertexAttribArray(pLoc.aAlpha);
      gl.vertexAttribPointer(pLoc.aAlpha, 1, gl.FLOAT, false, 16, 12);
      gl.drawArrays(gl.POINTS, 0, n);

      // Packets (brighter, additive)
      if (packets.length) {
        var kv = 0;
        for (var p = 0; p < packets.length && kv < pkData.length - 4; p++) {
          var k = packets[p];
          var ax = pos[k.a * 2], ay = pos[k.a * 2 + 1];
          var bx = pos[k.b * 2], by = pos[k.b * 2 + 1];
          var tt = k.t < 0.5 ? 2 * k.t * k.t : 1 - Math.pow(-2 * k.t + 2, 2) / 2;
          pkData[kv++] = ax + (bx - ax) * tt;
          pkData[kv++] = ay + (by - ay) * tt;
          pkData[kv++] = 6.5 * DPR;
          pkData[kv++] = 0.95 * k.fade;
        }
        gl.blendFunc(gl.ONE, gl.ONE);
        gl.uniform3f(pLoc.uColor, 0.75, 1.0, 0.9);
        gl.bindBuffer(gl.ARRAY_BUFFER, pkBuf);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, pkData.subarray(0, kv));
        gl.enableVertexAttribArray(pLoc.aPos);
        gl.vertexAttribPointer(pLoc.aPos, 2, gl.FLOAT, false, 16, 0);
        gl.enableVertexAttribArray(pLoc.aSize);
        gl.vertexAttribPointer(pLoc.aSize, 1, gl.FLOAT, false, 16, 8);
        gl.enableVertexAttribArray(pLoc.aAlpha);
        gl.vertexAttribPointer(pLoc.aAlpha, 1, gl.FLOAT, false, 16, 12);
        gl.drawArrays(gl.POINTS, 0, kv / 4);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      }
    }

    // Main loop with visibility gating
    var running = false, rafId = 0, lastT = 0;
    var inView = true, docVisible = !document.hidden;

    function frame(now) {
      rafId = 0;
      if (!running) return;
      if (!inView || !docVisible) { lastT = 0; return; } // resumes via observers
      var dt = lastT ? (now - lastT) / 1000 : 1 / 60;
      lastT = now;
      if (dt > 0.1) dt = 0.1;
      var fps = 1 / Math.max(dt, 1e-4);
      ema += (Math.min(fps, 120) - ema) * 0.04;
      govern(now);
      step(dt);
      stepPackets(dt);
      render();
      rafId = requestAnimationFrame(frame);
    }

    function kick() {
      if (running && !rafId && inView && docVisible) {
        lastT = 0;
        rafId = requestAnimationFrame(frame);
      }
    }

    var io = null;
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver(function (entries) {
        var last = entries[entries.length - 1];
        inView = last ? last.isIntersecting : true;
        kick();
      });
      io.observe(canvas);
    }
    document.addEventListener('visibilitychange', function () {
      docVisible = !document.hidden;
      kick();
    });

    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('mouseout', onLeave, { passive: true });
    window.addEventListener('touchstart', onTouch, { passive: true });

    var wasRunning = false;
    canvas.addEventListener('webglcontextlost', function (e) {
      e.preventDefault();
      wasRunning = running;
      running = false;
      if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
      document.documentElement.classList.remove('webgl-on');
    });
    canvas.addEventListener('webglcontextrestored', function () {
      if (buildGL()) {
        gl.viewport(0, 0, W, H);
        document.documentElement.classList.add('webgl-on');
        if (staticMode) {
          render(); // reduced motion: repaint the calm frame, stay stopped
        } else {
          running = wasRunning;
          kick();
        }
      }
    });

    return {
      start: function () {
        if (running) return;
        running = true;
        kick();
      },
      stop: function () {
        running = false;
        if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
      },
      /* Seed every particle along a screen-space line (CSS px) and let it
         burst outward into the field -- the preloader hand-off. */
      seedLine: function (x0, y0, x1, y1) {
        var r = canvas.getBoundingClientRect();
        var ax = (x0 - r.left) * DPR, ay = (y0 - r.top) * DPR;
        var bx = (x1 - r.left) * DPR, by = (y1 - r.top) * DPR;
        for (var i = 0; i < CAP; i++) {
          var f = Math.random();
          pos[i * 2] = ax + (bx - ax) * f + (Math.random() - 0.5) * 6 * DPR;
          pos[i * 2 + 1] = ay + (by - ay) * f + (Math.random() - 0.5) * 6 * DPR;
          vel[i * 2] = (Math.random() - 0.5) * 14;
          vel[i * 2 + 1] = (Math.random() - 0.5) * 22;
        }
        packets.length = 0;
      },
      rippleAt: function (x, y) {
        var r = canvas.getBoundingClientRect();
        ripples.push({ x: (x - r.left) * DPR, y: (y - r.top) * DPR, r: 0, age: 0, life: 1.2 });
      },
      /* prefers-reduced-motion: settle the field, paint one calm frame, stop. */
      staticFrame: function () {
        staticMode = true;
        for (var s = 0; s < 140; s++) { step(1 / 60); }
        render();
        running = false;
      },
      isMobile: mobile
    };
  }

  window.ExafabsNetwork = { attach: attach };
})();
