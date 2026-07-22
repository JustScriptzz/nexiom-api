// ---------- Typed console response ----------
(function typeResponse() {
  const target = document.getElementById("typedResponse");
  if (!target) return;
  const text = "still here. what do you need?";
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (reduceMotion) {
    target.textContent = text;
    return;
  }

  let i = 0;
  function step() {
    if (i <= text.length) {
      target.textContent = text.slice(0, i);
      i++;
      setTimeout(step, 28);
    }
  }
  setTimeout(step, 900);
})();

// ---------- Quickstart tabs ----------
(function tabs() {
  const tabButtons = document.querySelectorAll(".tab");
  const panels = document.querySelectorAll(".code-block");
  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const target = btn.dataset.tab;
      panels.forEach((p) => {
        p.classList.toggle("hidden", p.dataset.panel !== target);
      });
    });
  });
})();

// ---------- Route visualization loop ----------
(function routeViz() {
  const wrap = document.getElementById("routeviz");
  if (!wrap) return;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const inPacket = wrap.querySelector(".rv-line-in .rv-packet");
  const outPacket = document.getElementById("rvOutPacket");
  const outLabel = wrap.querySelector(".rv-you-out");
  const paths = Array.from(wrap.querySelectorAll(".rv-path"));

  if (reduceMotion) {
    // Show a static, settled state instead of animating
    paths[0].querySelector(".rv-endpoint").classList.add("lit");
    outLabel.classList.add("show");
    return;
  }

  function resetPaths() {
    paths.forEach((p) => {
      p.classList.remove("rv-fail");
      const line = p.querySelector(".rv-line");
      const packet = p.querySelector(".rv-packet");
      const endpoint = p.querySelector(".rv-endpoint");
      packet.classList.remove("run");
      endpoint.classList.remove("lit", "down");
      void line.offsetWidth; // restart guard
    });
    outLabel.classList.remove("show");
    outPacket.classList.remove("run");
  }

  async function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

  async function cycle() {
    resetPaths();

    // packet travels from "you" into nexiom
    inPacket.classList.add("run");
    await wait(1100);

    // pick which path fails this round (rotate for variety)
    const failIndex = cycle.turn % paths.length;
    cycle.turn = (cycle.turn || 0) + 1;

    paths.forEach((p, idx) => {
      const packet = p.querySelector(".rv-packet");
      const endpoint = p.querySelector(".rv-endpoint");
      if (idx === failIndex) {
        endpoint.classList.add("down");
      } else if (idx === (failIndex + 1) % paths.length) {
        packet.classList.add("run");
        endpoint.classList.add("lit");
      }
    });

    await wait(1300);

    outPacket.classList.add("run");
    await wait(900);
    outLabel.classList.add("show");

    await wait(1800);
  }

  async function loop() {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      await cycle();
    }
  }

  loop();
})();
