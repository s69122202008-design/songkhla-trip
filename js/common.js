"use strict";
/* ============================================================
   common.js — ส่วนที่ใช้ร่วมกันทุกหน้า (โครงเว็บเดียวกัน)
   - Header/Footer + ตัวบอกขั้นตอน 4 หน้า
   - อ่าน/สร้าง query string (from, to, r)
   - วาดแผนที่กราฟด้วย SVG
   ============================================================ */
const Common = (function () {
  const STEPS = [
    { page: "index.html",  label: "ค้นหา" },
    { page: "routes.html", label: "เลือกเส้นทาง" },
    { page: "detail.html", label: "รายละเอียด" },
    { page: "ticket.html", label: "ตั๋ว" }
  ];

  /* อ่านพารามิเตอร์ และตรวจว่าเป็น Vertex ที่มีอยู่จริง */
  function params() {
    const p = new URLSearchParams(location.search);
    const from = PLACES[p.get("from")] ? p.get("from") : null;
    const to = PLACES[p.get("to")] ? p.get("to") : null;
    const r = CRITERIA[p.get("r")] ? p.get("r") : "best";
    return { from, to, r };
  }
  function url(page, o) {
    const q = new URLSearchParams();
    if (o.from) q.set("from", o.from);
    if (o.to) q.set("to", o.to);
    if (o.r) q.set("r", o.r);
    const s = q.toString();
    return page + (s ? "?" + s : "");
  }

  function mountShell(step) {
    const p = params();
    const ready = p.from && p.to && p.from !== p.to;
    const links = STEPS.map((s, i) => {
      const cur = i + 1 === step ? ' aria-current="page"' : "";
      const dis = i > 0 && !ready && i + 1 !== step ? ' aria-disabled="true"' : "";
      const href = i === 0 ? url(s.page, p) : url(s.page, p);
      return `<li><a href="${href}"${cur}${dis}><span class="n">${i + 1}</span><span class="t">${s.label}</span></a></li>`;
    }).join("");
    const head = document.getElementById("shell-header");
    if (head) head.innerHTML = `
      <div class="wrap">
        <a class="brand" href="index.html">
          <img src="assets/logo.svg" alt="" width="44" height="44">
          <span><b>ไปสงขลา</b><small>Songkhla Trip Planner</small></span>
        </a>
        <nav aria-label="ขั้นตอนการวางแผน"><ol class="steps">${links}</ol></nav>
      </div>`;
    const foot = document.getElementById("shell-footer");
    if (foot) foot.innerHTML = `
      <div class="wrap">
        <p><b>ไปสงขลา</b> — เว็บตัวอย่างโครงงานรายวิชาคณิตศาสตร์ดิสครีตสำหรับนักศึกษาเทคโนโลยีสารสนเทศ
        (Graph Theory และ Tree)</p>
        <p class="small">เวลา ค่าโดยสาร และเส้นทางทั้งหมดเป็นข้อมูลจำลองเพื่อการสาธิต ไม่ใช่ข้อมูลจริงของผู้ให้บริการรายใด
        ตั๋วที่ออกให้ใช้งานจริงไม่ได้</p>
      </div>`;
  }

  const fmtTime = m => {
    const h = Math.floor(m / 60), r = Math.round(m % 60);
    return h ? `${h} ชม. ${r ? r + " นาที" : ""}`.trim() : `${r} นาที`;
  };
  const fmtBaht = n => `${Math.round(n).toLocaleString("th-TH")} บาท`;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  /* ---------- แผนที่กราฟ (SVG) ----------
     opts.legs        : ขาของเส้นทางที่เลือก (ไฮไลต์เป็นสีของโหมด)
     opts.from / to   : จุดต้นทาง / ปลายทาง
     opts.weights     : แสดงน้ำหนักของทุก Edge
     opts.order       : ลำดับการเยี่ยมชมของ BFS/DFS (แสดงเลขกำกับ)
     opts.treeParent  : parent ของแต่ละจุดใน BFS/DFS tree (วาดเส้นประ) */
  function drawMap(svg, opts = {}) {
    const W = 760, H = 540;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "แผนที่กราฟของสถานที่ท่องเที่ยวและเส้นทางเดินทางในหาดใหญ่และสงขลา");

    // รวม Edge ที่เป็นคู่เดียวกัน (หลายโหมด) ให้เป็นเส้นเดียวบนแผนที่
    const pairs = {};
    EDGES.forEach(([a, b, mode, t, f]) => {
      const k = [a, b].sort().join("~");
      (pairs[k] = pairs[k] || { a, b, t: [], f: [] });
      pairs[k].t.push(t); pairs[k].f.push(f);
    });
    const range = arr => { const lo = Math.min(...arr), hi = Math.max(...arr); return lo === hi ? lo : lo + "–" + hi; };

    let s = `
      <rect width="${W}" height="${H}" rx="18" fill="#E3EEE9"/>
      <path d="M720 0 H760 V420 H700 Q650 300 668 230 Q690 120 720 0Z" fill="#B9DCE2"/>
      <path d="M350 62 Q420 22 520 52 Q562 112 532 166 Q452 212 382 172 Q330 122 350 62Z" fill="#C9E4E8"/>
      <text x="730" y="100" font-size="13" fill="#2b6a75" text-anchor="middle" transform="rotate(90 730 100)">อ่าวไทย</text>
      <text x="440" y="190" font-size="12" fill="#2b6a75" text-anchor="middle">ทะเลสาบสงขลา</text>`;

    // Edge ทั้งหมด (จาง ๆ)
    Object.values(pairs).forEach(e => {
      const A = PLACES[e.a], B = PLACES[e.b];
      s += `<line x1="${A.x}" y1="${A.y}" x2="${B.x}" y2="${B.y}" stroke="#9FB8B4" stroke-width="2.2" stroke-dasharray="${opts.legs ? "5 5" : "0"}"/>`;
    });

    // BFS/DFS tree edges
    if (opts.treeParent && opts.order) {
      opts.order.forEach(v => {
        const p = opts.treeParent[v];
        if (p) s += `<line x1="${PLACES[p].x}" y1="${PLACES[p].y}" x2="${PLACES[v].x}" y2="${PLACES[v].y}" stroke="#2F5D9E" stroke-width="5" stroke-linecap="round"/>`;
      });
    }

    // เส้นทางที่เลือก
    const onPath = new Set();
    if (opts.legs) {
      opts.legs.forEach(leg => {
        for (let i = 0; i < leg.places.length - 1; i++) {
          const A = PLACES[leg.places[i]], B = PLACES[leg.places[i + 1]];
          s += `<line x1="${A.x}" y1="${A.y}" x2="${B.x}" y2="${B.y}" stroke="${MODES[leg.mode].color}" stroke-width="8" stroke-linecap="round"/>`;
        }
        leg.places.forEach(p => onPath.add(p));
      });
    }

    // น้ำหนักของ Edge
    if (opts.weights) {
      Object.values(pairs).forEach(e => {
        const A = PLACES[e.a], B = PLACES[e.b];
        const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;
        s += `<text x="${mx}" y="${my}" text-anchor="middle" font-size="10.5" fill="#10313A" stroke="#E3EEE9" stroke-width="4" paint-order="stroke">${range(e.t)}น. · ${range(e.f)}฿</text>`;
      });
    }

    // Vertex
    const visitNo = {};
    (opts.order || []).forEach((v, i) => { visitNo[v] = i + 1; });
    Object.keys(PLACES).forEach(id => {
      const P = PLACES[id];
      let ring = "#9FB8B4";
      if (onPath.has(id)) ring = "#0B4F5C";
      if (id in visitNo) ring = "#2F5D9E";
      if (id === opts.from) ring = "#2F5D9E";
      if (id === opts.to) ring = "#E2553B";
      const w = (id === opts.from || id === opts.to || onPath.has(id) || id in visitNo) ? 4 : 2.5;
      s += `<g>
        <circle cx="${P.x}" cy="${P.y}" r="17" fill="#fff" stroke="${ring}" stroke-width="${w}"/>
        <text x="${P.x}" y="${P.y + 6}" text-anchor="middle" font-size="16">${P.emoji}</text>
        <text x="${P.x}" y="${P.y + 35}" text-anchor="middle" font-size="12.5" font-weight="500" fill="#10313A" stroke="#E3EEE9" stroke-width="4" paint-order="stroke">${esc(P.short)}</text>`;
      if (id === opts.from) s += `<text x="${P.x}" y="${P.y - 24}" text-anchor="middle" font-size="12" font-weight="600" fill="#2F5D9E" stroke="#E3EEE9" stroke-width="4" paint-order="stroke">ต้นทาง</text>`;
      if (id === opts.to) s += `<text x="${P.x}" y="${P.y - 24}" text-anchor="middle" font-size="12" font-weight="600" fill="#E2553B" stroke="#E3EEE9" stroke-width="4" paint-order="stroke">ปลายทาง</text>`;
      if (id in visitNo) s += `<circle cx="${P.x + 16}" cy="${P.y - 14}" r="10" fill="#E2553B"/><text x="${P.x + 16}" y="${P.y - 10}" text-anchor="middle" font-size="11.5" font-weight="600" fill="#fff">${visitNo[id]}</text>`;
      s += `</g>`;
    });
    svg.innerHTML = s;
  }

  function modeLegendHTML() {
    return Object.keys(MODES).map(k => `<span><i style="background:${MODES[k].color}"></i>${MODES[k].emoji} ${MODES[k].name}</span>`).join("");
  }

  return { params, url, mountShell, fmtTime, fmtBaht, esc, drawMap, modeLegendHTML };
})();
