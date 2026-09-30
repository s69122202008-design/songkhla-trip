"use strict";
/* ============================================================
   routes.js — หน้า 2 : เลือกเส้นทาง
   ใช้ Weighted Graph + Dijkstra 3 รอบ ด้วยนิยาม Weight ต่างกัน (เวลา / ค่าโดยสาร / ผสม)
   ============================================================ */
(function () {
  Common.mountShell(2);
  const $ = s => document.querySelector(s);
  const esc = Common.esc;
  const { from, to } = Common.params();

  if (!from || !to || from === to) {
    $("#empty").hidden = false;
    $("#content").hidden = true;
    $("#routebar").hidden = true;
    return;
  }

  /* ---------- คำนวณ Dijkstra 3 รอบ ---------- */
  const sg = buildStateGraph(graph);
  const plans = {};
  Object.keys(CRITERIA).forEach(k => { plans[k] = planRoute(sg, from, to, CRITERIA[k].fn, true); });

  $("#routebar").innerHTML = `
    <span class="cities">${PLACES[from].emoji} ${esc(PLACES[from].name)} → ${PLACES[to].emoji} ${esc(PLACES[to].name)}</span>
    <a class="btn ghost small" href="${Common.url("index.html", { from, to })}">เปลี่ยนสถานที่</a>`;

  /* ---------- การ์ดเส้นทาง (รวมเส้นทางที่ซ้ำกัน) ---------- */
  const sig = p => p.legs.map(l => l.mode + ":" + l.places.join(">")).join("|");
  const groups = [];
  Object.keys(CRITERIA).forEach(k => {
    const g = groups.find(x => x.sig === sig(plans[k]));
    if (g) g.keys.push(k); else groups.push({ sig: sig(plans[k]), keys: [k], plan: plans[k] });
  });
  const badgeCls = { fast: "coral", cheap: "sea", best: "" };

  $("#routes").innerHTML = groups.map(g => {
    const p = g.plan, k = g.keys[0];
    const badges = g.keys.map(x => `<span class="badge ${badgeCls[x]}">${CRITERIA[x].label}</span>`).join("");
    const chips = p.legs.map(l => `<span class="leg-chip" style="border-color:${MODES[l.mode].color}">
        ${MODES[l.mode].emoji} ${esc(PLACES[l.from].short)} → ${esc(PLACES[l.to].short)}
        <span class="muted">· ${l.time} นาที · ${l.fare} บาท</span></span>`).join("");
    return `<article class="card route ${k}">
      <div class="badges">${badges}</div>
      <div class="kpis">
        <div class="kpi"><b>${Common.fmtTime(p.totalTime)}</b><span>เวลารวม</span></div>
        <div class="kpi"><b>${p.totalFare.toLocaleString("th-TH")} บาท</b><span>ค่าโดยสารรวม</span></div>
        <div class="kpi"><b>${p.transfers} ครั้ง</b><span>เปลี่ยนโหมด</span></div>
      </div>
      <div class="legchips">${chips}</div>
      <div class="small muted">ผ่าน: ${p.places.map(x => esc(PLACES[x].short)).join(" → ")}</div>
      <a class="btn go" href="${Common.url("detail.html", { from, to, r: k })}">ดูรายละเอียดเส้นทางนี้</a>
    </article>`;
  }).join("");

  $("#dupnote").textContent = groups.length === 3
    ? "ทั้ง 3 เกณฑ์ได้เส้นทางต่างกัน เพราะ Shortest Path ขึ้นอยู่กับว่านิยาม Weight เป็นเวลา ค่าโดยสาร หรือแบบผสม"
    : groups.length === 1
      ? "ทั้ง 3 เกณฑ์ให้เส้นทางเดียวกัน เพราะสำหรับคู่สถานที่นี้ไม่มีทางเลือกที่ดีกว่าในเกณฑ์ใดเลย"
      : "บางเกณฑ์ให้เส้นทางเดียวกัน จึงรวมเป็นการ์ดเดียวโดยแสดงหลายป้ายกำกับ";

  /* ---------- Vertex / Edge / Weight ---------- */
  const pairKeys = new Set(EDGES.map(e => [e[0], e[1]].sort().join("~")));
  $("#defs").innerHTML = `
    <div class="card"><h3>Vertex (จุดยอด)</h3>
      <p class="small" style="margin:0">สถานที่ 1 แห่ง — มี <b>${Object.keys(PLACES).length}</b> จุด เช่น สนามบินหาดใหญ่ หาดสมิหลา เกาะยอ
      (ในขั้นคำนวณ แยกเป็น "สถานที่ + โหมด" เพื่อนับการเปลี่ยนโหมด รวม ${Object.keys(sg).length} จุด)</p></div>
    <div class="card"><h3>Edge (เส้นเชื่อม)</h3>
      <p class="small" style="margin:0">ช่วงเดินทางตรงระหว่างสถานที่ที่ติดกัน — มี <b>${pairKeys.size}</b> คู่สถานที่
      และ <b>${EDGES.length}</b> ทางเลือกเมื่อแยกตามโหมด เป็น Edge ไม่มีทิศทาง</p></div>
    <div class="card"><h3>Weight (น้ำหนัก 2 ค่า)</h3>
      <p class="small" style="margin:0">เวลา (นาที) และค่าโดยสาร (บาท) ของแต่ละ Edge มี Edge พิเศษ
      "เปลี่ยนโหมด" ที่สถานที่เดียวกัน (+${TRANSFER_TIME} นาที, 0 บาท)</p></div>
    <div class="card"><h3>Path & Shortest Path</h3>
      <p class="small" style="margin:0">Path คือลำดับ Vertex ที่เดินตาม Edge ได้ Shortest Path คือ Path ที่ผลรวม Weight ต่ำสุด
      ตามนิยามของ Weight ที่เลือก</p></div>`;

  /* ---------- ตารางการทำงานของ Dijkstra ---------- */
  const stName = s => { const [p, m] = s.split("|"); return `${PLACES[p].short} (${MODES[m].name})`; };
  const num = n => Number.isFinite(n) ? String(Math.round(n * 10) / 10) : "∞";
  let active = "fast";
  $("#tabs").innerHTML = Object.keys(CRITERIA).map(k =>
    `<button type="button" role="tab" data-k="${k}" aria-selected="${k === active}">${CRITERIA[k].label}</button>`).join("");
  $("#tabs").addEventListener("click", e => {
    const b = e.target.closest("button[data-k]"); if (!b) return;
    active = b.dataset.k; renderTrace();
  });
  function renderTrace() {
    document.querySelectorAll("#tabs button").forEach(b => b.setAttribute("aria-selected", b.dataset.k === active));
    const p = plans[active];
    $("#formula").innerHTML = `นิยาม Weight ที่ใช้ตอน Relax: <code>${esc(CRITERIA[active].formula)}</code>`;
    $("#trace").innerHTML = p.trace.map(r => `
      <tr class="${r.done ? "done" : ""}">
        <td class="num">${r.step}</td>
        <td>${esc(stName(r.u))}${r.done ? " — ถึงปลายทาง ✓" : ""}</td>
        <td class="num">${num(r.dist)}</td>
        <td>${r.updates.length
          ? r.updates.map(u => `${esc(stName(u.to))}: ${num(u.old)} → <b>${num(u.now)}</b>`).join("<br>")
          : '<span class="muted">—</span>'}</td>
      </tr>`).join("");
    $("#traceResult").innerHTML = `<b>ผลลัพธ์ (${CRITERIA[active].label}):</b> Path = ` +
      p.places.map(x => esc(PLACES[x].short)).join(" → ") +
      ` | Total Weight ตามเกณฑ์ ≈ ${num(p.cost)} | เวลา ${p.totalTime} นาที | ค่าโดยสาร ${p.totalFare} บาท`;
  }
  renderTrace();

  /* ---------- Adjacency List (แสดงเป็นโค้ด) ---------- */
  const simple = Object.keys(graph).map(v => `  ${v}: [${neighborsOf(graph, v).map(x => `"${x}"`).join(", ")}]`).join(",\n");
  const sample = graph.HATYAI.slice(0, 6).map(e =>
    `  { to: "${e.to}", mode: "${e.mode}", time: ${e.time}, fare: ${e.fare} }`).join(",\n");
  $("#adj").textContent =
`// Adjacency List แบบไม่มี Weight (ใช้กับ BFS / DFS)
const graph = {
${simple}
};

// Adjacency List แบบมี Weight (ใช้กับ Dijkstra) — ตัวอย่าง graph.HATYAI
graph.HATYAI = [
${sample},
  ...
];`;
})();
