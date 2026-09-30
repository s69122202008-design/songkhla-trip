"use strict";
/* ============================================================
   detail.js — หน้า 3 : รายละเอียดการเดินทาง
   แปลง Path จาก Dijkstra เป็นข้อความอ่านง่าย + วาดกราฟ + ท่องกราฟด้วย BFS/DFS
   ============================================================ */
(function () {
  Common.mountShell(3);
  const $ = s => document.querySelector(s);
  const esc = Common.esc;
  const { from, to, r } = Common.params();

  if (!from || !to || from === to) {
    $("#empty").hidden = false;
    $("#content").hidden = true;
    $("#routebar").hidden = true;
    return;
  }

  const sg = buildStateGraph(graph);
  const plan = planRoute(sg, from, to, CRITERIA[r].fn, false);

  $("#routebar").innerHTML = `
    <span class="cities">${PLACES[from].emoji} ${esc(PLACES[from].name)} → ${PLACES[to].emoji} ${esc(PLACES[to].name)}</span>
    <a class="btn ghost small" href="${Common.url("routes.html", { from, to })}">กลับไปเปรียบเทียบ</a>`;

  /* ---------- เลือกดูตามเกณฑ์ ---------- */
  $("#rtabs").innerHTML = Object.keys(CRITERIA).map(k =>
    `<button type="button" role="tab" data-k="${k}" aria-selected="${k === r}">${CRITERIA[k].label}</button>`).join("");
  $("#rtabs").addEventListener("click", e => {
    const b = e.target.closest("button[data-k]"); if (!b || b.dataset.k === r) return;
    location.href = Common.url("detail.html", { from, to, r: b.dataset.k });
  });
  $("#buy").href = Common.url("ticket.html", { from, to, r });

  /* ---------- ขั้นตอนเป็นช่วง ๆ ---------- */
  let html = "";
  plan.legs.forEach((l, i) => {
    if (i > 0 && l.transferBefore) {
      html += `<li class="swap-row">🔁 เปลี่ยนโหมดเดินทางที่ ${esc(PLACES[l.from].short)} (+${l.transferBefore.time} นาที)</li>`;
    }
    const m = MODES[l.mode];
    html += `<li class="leg">
      <div class="ico" style="background:${m.color}" aria-hidden="true">${m.emoji}</div>
      <div>
        <b>${esc(m.name)}</b><br>
        ${esc(PLACES[l.from].name)} → ${esc(PLACES[l.to].name)}
        <div class="small muted">${l.hops} ช่วง: ${l.places.map(p => esc(PLACES[p].short)).join(" → ")}</div>
      </div>
      <div class="meta"><b>${l.time} นาที</b>${l.fare} บาท</div>
    </li>`;
  });
  $("#legs").innerHTML = html;
  $("#totals").innerHTML = `
    <div class="kpi"><b>${Common.fmtTime(plan.totalTime)}</b><span>เวลารวม</span></div>
    <div class="kpi"><b>${plan.totalFare.toLocaleString("th-TH")} บาท</b><span>ค่าโดยสารรวม</span></div>
    <div class="kpi"><b>${plan.transfers} ครั้ง</b><span>เปลี่ยนโหมด</span></div>`;

  /* ---------- แผนที่กราฟ ---------- */
  const map = $("#map");
  const draw = () => Common.drawMap(map, { legs: plan.legs, from, to, weights: $("#wt").checked });
  $("#wt").addEventListener("change", draw);
  draw();
  $("#mapLegend").innerHTML = Common.modeLegendHTML();

  /* ---------- Path ---------- */
  const pl = plan.places;
  $("#pathline").innerHTML = pl.map((p, i) => {
    const cls = i === 0 ? "start" : i === pl.length - 1 ? "end" : "";
    return `<span class="v ${cls}"><sub style="font-size:.7em">v${i}</sub> ${esc(PLACES[p].short)}</span>`;
  }).join('<span class="arrow">→</span>');
  $("#pathtext").textContent =
    `Path นี้มี ${pl.length} Vertex และเดินตาม ${pl.length - 1} Edge — หมายถึงลำดับสถานที่ที่ต้องผ่านตั้งแต่ต้นทางถึงปลายทาง ` +
    `โดยคู่สถานที่ที่อยู่ติดกันทุกคู่มีถนนหรือทางเดินเชื่อมกันจริงในกราฟ`;
  $("#statepath").textContent = plan.statePath.map((s, i) => {
    const [p, m] = s.split("|");
    return `v${i} = ${p} | ${m}`;
  }).join("\n");

  /* ---------- BFS / DFS ---------- */
  const map2 = $("#map2");
  let timer = null;
  Common.drawMap(map2, { from, to });

  function renderOut(kind, res, n) {
    const order = res.order.slice(0, n);
    Common.drawMap(map2, { from, to, order, treeParent: res.parent });
    const name = v => esc(PLACES[v].short);
    if (kind === "bfs") {
      const by = {};
      order.forEach(v => { (by[res.level[v]] = by[res.level[v]] || []).push(v); });
      $("#exTitle").textContent = `BFS — เยี่ยมแล้ว ${order.length}/${res.order.length} แห่ง`;
      $("#exOut").innerHTML = Object.keys(by).map(l =>
        `<div><b>ห่างต้นทาง ${l} ช่วง:</b> ${by[l].map(name).join(", ")}</div>`).join("");
    } else {
      $("#exTitle").textContent = `DFS — เยี่ยมแล้ว ${order.length}/${res.order.length} แห่ง`;
      $("#exOut").innerHTML = order.map((v, i) =>
        `<div>${i + 1}. ${"&nbsp;&nbsp;".repeat(res.level[v])}${name(v)}</div>`).join("");
    }
    if (n >= res.order.length) {
      const hops = res.level[to];
      $("#exOut").innerHTML += `<hr style="border:0;border-top:1px solid var(--line);margin:8px 0"><div>` +
        (kind === "bfs"
          ? `ไปถึง ${name(to)} ด้วยจำนวนช่วงน้อยที่สุด <b>${hops} ช่วง</b> (BFS ไม่สนใจเวลาและค่าโดยสาร — ต่างจาก Dijkstra ที่ใช้ Weight)`
          : `DFS ไปถึง ${name(to)} ที่ความลึก ${hops} แต่ไม่ได้รับประกันว่าเป็นทางสั้นที่สุด`) + `</div>`;
    }
  }
  document.querySelectorAll("[data-ex]").forEach(b => b.addEventListener("click", () => {
    clearInterval(timer);
    const k = b.dataset.ex;
    if (k === "reset") {
      Common.drawMap(map2, { from, to });
      $("#exTitle").textContent = "ยังไม่ได้เริ่มท่องกราฟ";
      $("#exOut").textContent = 'กดปุ่ม "เริ่ม BFS" หรือ "เริ่ม DFS"';
      return;
    }
    const res = k === "bfs" ? bfs(graph, from) : dfs(graph, from);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { renderOut(k, res, res.order.length); return; }
    let n = 0;
    timer = setInterval(() => {
      n++;
      renderOut(k, res, n);
      if (n >= res.order.length) clearInterval(timer);
    }, 550);
  }));
})();
