"use strict";
/* ============================================================
   ticket.js — หน้า 4 : ตั๋วเดินทาง
   แสดงผลรวม Weight ของทุก Edge บน Shortest Path (คำตอบสุดท้ายของ Dijkstra)
   ============================================================ */
(function () {
  Common.mountShell(4);
  const $ = s => document.querySelector(s);
  const esc = Common.esc;
  const { from, to, r } = Common.params();

  if (!from || !to || from === to) {
    $("#empty").hidden = false;
    $("#content").hidden = true;
    $("#routebar").hidden = true;
    return;
  }

  const plan = planRoute(buildStateGraph(graph), from, to, CRITERIA[r].fn, false);

  $("#routebar").innerHTML = `
    <span class="cities">${PLACES[from].emoji} ${esc(PLACES[from].name)} → ${PLACES[to].emoji} ${esc(PLACES[to].name)}</span>
    <span class="badge">${CRITERIA[r].label}</span>`;
  $("#back").href = Common.url("detail.html", { from, to, r });

  /* ---------- ตารางค่าโดยสาร ---------- */
  let rows = "", n = 0;
  plan.legs.forEach((l, i) => {
    if (i > 0 && l.transferBefore) {
      rows += `<tr><td></td><td colspan="2" class="muted">🔁 เปลี่ยนโหมดที่ ${esc(PLACES[l.from].short)}</td>
               <td class="num">${l.transferBefore.time}</td><td class="num">0</td></tr>`;
    }
    n++;
    const m = MODES[l.mode];
    rows += `<tr><td>${n}</td><td>${m.emoji} ${esc(m.name)}</td>
      <td>${esc(PLACES[l.from].short)} → ${esc(PLACES[l.to].short)}</td>
      <td class="num">${l.time}</td><td class="num">${l.fare}</td></tr>`;
  });
  $("#fares").innerHTML = rows;

  /* สะสม Weight ทีละ Edge บน Path (Total Weight = Σ w(e)) */
  let totalFare = 0, totalTime = 0;
  plan.edgePath.forEach(e => { totalFare += e.fare; totalTime += e.time; });
  /* วิธีเขียนแบบ functional เพื่อยืนยันว่าได้ค่าเดียวกัน */
  const viaReduce = plan.legs.reduce((sum, leg) => sum + leg.fare, 0);
  const same = totalFare === viaReduce && totalFare === plan.totalFare;

  $("#sumTime").textContent = totalTime;
  $("#sumFare").textContent = totalFare.toLocaleString("th-TH");
  $("#check").textContent = same
    ? `✓ ตรวจสอบแล้ว: ผลรวมที่สะสมทีละ Edge (${totalFare} บาท) เท่ากับผลรวมด้วย reduce และเท่ากับค่าโดยสารที่ Dijkstra ให้ในหน้า 2`
    : "⚠ ผลรวมไม่ตรงกัน กรุณาตรวจสอบข้อมูล";

  /* ---------- ออกตั๋ว ---------- */
  const hash = s => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  const now = new Date();
  const dayKey = now.toISOString().slice(0, 10);
  const seed = hash(`${from}|${to}|${r}|${dayKey}`);
  const code = "SKL-" + seed.toString(36).toUpperCase().padStart(6, "0").slice(-6);

  $("#buy").addEventListener("click", () => {
    $("#ticketSec").hidden = false;
    $("#buy").disabled = true;
    $("#buy").textContent = "ซื้อตั๋วแล้ว";
    $("#tDate").textContent = "วันที่เดินทาง " + now.toLocaleDateString("th-TH", { dateStyle: "long" });
    $("#tRoute").textContent = `${PLACES[from].short} → ${PLACES[to].short}`;
    $("#tInfo").innerHTML = `
      <li><b>เกณฑ์เส้นทาง</b><span>${CRITERIA[r].label}</span></li>
      <li><b>ขั้นตอน</b><span>${plan.legs.map(l => MODES[l.mode].emoji + " " + esc(MODES[l.mode].name)).join(" → ")}</span></li>
      <li><b>เวลารวม</b><span>${Common.fmtTime(totalTime)}</span></li>
      <li><b>ค่าโดยสารรวม</b><span><b>${totalFare.toLocaleString("th-TH")} บาท</b></span></li>`;
    $("#tCode").textContent = code;
    drawQR(seed);
    $("#ticketSec").scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  });
  $("#print").addEventListener("click", () => window.print());

  /* QR จำลอง: มุมทั้งสามเป็น Finder pattern ส่วนที่เหลือสุ่มจาก seed (ไม่ใช่ QR จริง) */
  function drawQR(seed) {
    const N = 25, S = 8, cv = $("#qr"), ctx = cv.getContext("2d");
    let a = seed;
    const rnd = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, N * S, N * S);
    ctx.fillStyle = "#10313A";
    const inFinder = (x, y) => (x < 8 && y < 8) || (x >= N - 8 && y < 8) || (x < 8 && y >= N - 8);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (!inFinder(x, y) && rnd() > 0.52) ctx.fillRect(x * S, y * S, S, S);
    }
    [[0, 0], [N - 7, 0], [0, N - 7]].forEach(([ox, oy]) => {
      ctx.fillStyle = "#10313A"; ctx.fillRect(ox * S, oy * S, 7 * S, 7 * S);
      ctx.fillStyle = "#fff";    ctx.fillRect((ox + 1) * S, (oy + 1) * S, 5 * S, 5 * S);
      ctx.fillStyle = "#10313A"; ctx.fillRect((ox + 2) * S, (oy + 2) * S, 3 * S, 3 * S);
    });
  }
})();
