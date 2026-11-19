/* Santa Ceia da Família · agendamento (elloeterno.com.br)
   - monta os dias e os horários de cada dia (de 20 em 20 minutos) a partir de window.CEIA (topo do index.html)
   - mostra quantas salas ainda estão livres em cada horário (lidas da planilha da agenda) e trava os lotados
   - envia o agendamento para a planilha (Apps Script) e mostra a confirmação com a sala */
(() => {
  "use strict";

  const C = window.CEIA || {};
  const $ = (s, el = document) => el.querySelector(s);
  const DUR = Number(C.duracaoMin) || 20;
  const endpoint = String(C.planilhaEndpoint || "").trim();
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const pad = (n) => String(n).padStart(2, "0");
  const aMin = (h) => { const [a, b] = h.split(":").map(Number); return a * 60 + b; };
  const aHora = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
  const rotuloHora = (h) => { const [a, b] = h.split(":"); return `${Number(a)}h${b === "00" ? "" : b}`; };
  const diaMes = (iso) => { const [, m, d] = iso.split("-"); return `${Number(d)}/${Number(m)}`; };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // horários de cada dia: do início até o fim, de 20 em 20 minutos (igual à agenda das salas)
  const DIAS = (C.dias || []).map((d) => {
    const horarios = [];
    for (let t = aMin(d.inicio); t + DUR <= aMin(d.fim); t += DUR) horarios.push(aHora(t));
    return { ...d, horarios };
  });

  const form = $("[data-form]");
  const nome = $("#nome");
  const whats = $("#whats");
  const pessoas = $("#pessoas");
  const daysEl = $("[data-days]");
  const timesWrap = $("[data-times-wrap]");
  const timesEl = $("[data-times]");
  const timesHint = $("[data-times-hint]");
  const statusEl = $("[data-status]");
  const submitBtn = $("[data-submit]");
  const submitLabel = $("[data-submit-label]");
  const ok = $("[data-ok]");

  const maps = $("[data-maps]");
  if (maps) {
    if (C.mapsLink) maps.href = C.mapsLink;
    else maps.removeAttribute("href");
    if (C.local) maps.textContent = C.local;
  }

  // ---------- dias ----------
  DIAS.forEach((d) => {
    const lab = document.createElement("label");
    lab.className = "chip day";
    lab.innerHTML =
      `<input type="radio" name="dia" value="${esc(d.data)}" aria-label="${esc(d.semana)}, ${diaMes(d.data)}">` +
      `<span class="chip__box"><span class="chip__a">${esc(d.curto)}</span><span class="chip__b">${diaMes(d.data)}</span></span>`;
    daysEl.appendChild(lab);
  });

  const diaAtual = () => {
    const r = form.querySelector('input[name="dia"]:checked');
    return r ? DIAS.find((d) => d.data === r.value) : null;
  };
  const horaAtual = () => {
    const r = form.querySelector('input[name="hora"]:checked');
    return r ? r.value : "";
  };

  // ---------- vagas (planilha) ----------
  let vagas = null;
  let vagasEm = 0;
  let buscando = null;

  const carregarVagas = (forcar) => {
    if (!endpoint) return Promise.resolve();
    if (!forcar && vagas && Date.now() - vagasEm < 45000) return Promise.resolve();
    if (buscando) return buscando;
    buscando = (async () => {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 15000);
      try {
        const url = `${endpoint}${endpoint.includes("?") ? "&" : "?"}acao=vagas&t=${Date.now()}`;
        const r = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
        const j = await r.json();
        if (j && j.ok && j.vagas) {
          vagas = j.vagas;
          vagasEm = Date.now();
          atualizarDias();
          renderHorarios();
        }
      } catch (_) {
        /* sem as vagas a página continua funcionando: a planilha confere a vaga no envio */
      } finally {
        clearTimeout(t);
        buscando = null;
      }
    })();
    return buscando;
  };

  const livresNoDia = (d) => {
    const v = vagas && vagas[d.data];
    if (!v) return null;
    return d.horarios.reduce((s, h) => s + (typeof v[h] === "number" ? v[h] : 0), 0);
  };

  const atualizarDias = () => {
    daysEl.querySelectorAll('input[name="dia"]').forEach((inp) => {
      const d = DIAS.find((x) => x.data === inp.value);
      const total = livresNoDia(d);
      const lotado = total === 0;
      inp.disabled = lotado;
      if (lotado && inp.checked) inp.checked = false;
      const b = inp.parentElement.querySelector(".chip__b");
      b.textContent = lotado ? "lotado" : diaMes(d.data);
      inp.setAttribute("aria-label", `${d.semana}, ${diaMes(d.data)}${lotado ? ", lotado" : ""}`);
    });
  };

  // ---------- horários do dia escolhido ----------
  const renderHorarios = () => {
    const d = diaAtual();
    if (!d) { timesWrap.hidden = true; return; }
    const v = vagas && vagas[d.data];
    const escolhido = horaAtual();
    timesHint.textContent = `· ${d.semana.toLowerCase()}, ${diaMes(d.data)}`;
    timesEl.classList.toggle("times--sem-vagas", !v);
    timesEl.innerHTML = "";
    d.horarios.forEach((h) => {
      const livres = v && typeof v[h] === "number" ? v[h] : null;
      const lotado = livres === 0;
      const sub = livres === null ? "" : lotado ? "lotado" : `${livres} ${livres === 1 ? "vaga" : "vagas"}`;
      const lab = document.createElement("label");
      lab.className = "chip time";
      lab.innerHTML =
        `<input type="radio" name="hora" value="${h}"${lotado ? " disabled" : ""} aria-label="${rotuloHora(h)}${sub ? `, ${sub}` : ""}">` +
        `<span class="chip__box"><span class="chip__a">${rotuloHora(h)}</span>${sub ? `<span class="chip__b">${sub}</span>` : ""}</span>`;
      if (h === escolhido && !lotado) lab.querySelector("input").checked = true;
      timesEl.appendChild(lab);
    });
    timesWrap.hidden = false;
  };

  daysEl.addEventListener("change", () => {
    $("#dia-erro").hidden = true;
    $("#hora-erro").hidden = true;
    renderHorarios();
    carregarVagas(false);
  });
  timesEl.addEventListener("change", () => { $("#hora-erro").hidden = true; });

  // ---------- campos ----------
  whats.addEventListener("input", () => {
    let d = whats.value.replace(/\D/g, "");
    if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
    d = d.slice(0, 11);
    let out = d;
    if (d.length > 2) out = `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length > 6) {
      const corte = d.length === 11 ? 7 : 6;
      out = `(${d.slice(0, 2)}) ${d.slice(2, corte)}-${d.slice(corte)}`;
    }
    whats.value = out;
  });

  const marcar = (el, errEl, ruim) => {
    el.setAttribute("aria-invalid", ruim ? "true" : "false");
    errEl.hidden = !ruim;
  };
  [[nome, "#nome-erro"], [whats, "#whats-erro"], [pessoas, "#pessoas-erro"]].forEach(([el, sel]) => {
    el.addEventListener(el.tagName === "SELECT" ? "change" : "input", () => {
      if (el.getAttribute("aria-invalid") === "true") marcar(el, $(sel), false);
    });
  });

  const validar = () => {
    const erros = [];
    const n = nome.value.trim().replace(/\s+/g, " ");
    const nomeRuim = n.length < 5 || n.split(" ").length < 2;
    marcar(nome, $("#nome-erro"), nomeRuim);
    if (nomeRuim) erros.push(nome);

    const dig = whats.value.replace(/\D/g, "");
    const zapRuim = !(dig.length === 10 || dig.length === 11);
    marcar(whats, $("#whats-erro"), zapRuim);
    if (zapRuim) erros.push(whats);

    const pRuim = !pessoas.value;
    marcar(pessoas, $("#pessoas-erro"), pRuim);
    if (pRuim) erros.push(pessoas);

    const d = diaAtual();
    $("#dia-erro").hidden = !!d;
    if (!d) erros.push(daysEl.querySelector("input:not(:disabled)") || daysEl);

    if (d) {
      const h = horaAtual();
      $("#hora-erro").hidden = !!h;
      if (!h) erros.push(timesEl.querySelector("input:not(:disabled)") || timesEl);
    }
    return erros;
  };

  // ---------- envio ----------
  const novoId = () => (window.crypto && crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);
  let idEnvio = novoId();

  const params = new URLSearchParams(location.search);
  let refHost = "";
  try { refHost = document.referrer ? new URL(document.referrer).hostname : ""; } catch (_) { /* referrer inválido */ }
  const origem = (params.get("ref") || params.get("utm_source") || refHost || "direto").slice(0, 80);

  const mostrarStatus = (msg, info) => {
    statusEl.textContent = msg;
    statusEl.classList.toggle("status--info", !!info);
    statusEl.hidden = false;
  };

  const carregandoBtn = (on) => {
    submitBtn.disabled = on;
    submitLabel.textContent = on ? "Agendando…" : "Agendar minha família";
    const icon = submitBtn.querySelector(".btn__icon, .spinner");
    if (on && icon && !icon.classList.contains("spinner")) {
      const sp = document.createElement("span");
      sp.className = "spinner";
      sp.setAttribute("aria-hidden", "true");
      sp.dataset.icon = icon.outerHTML;
      icon.replaceWith(sp);
    } else if (!on && icon && icon.classList.contains("spinner")) {
      icon.outerHTML = icon.dataset.icon;
    }
  };

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    statusEl.hidden = true;
    const erros = validar();
    if (erros.length) { erros[0].focus(); return; }

    const d = diaAtual();
    const h = horaAtual();
    const primeiroNome = nome.value.trim().split(/\s+/)[0];
    if (form.site.value) { mostrarOk({ primeiroNome, data: d.data, hora: h, sala: "" }); return; } // robô

    if (!endpoint) {
      mostrarStatus("O agendamento abre em instantes. Tente de novo daqui a pouco.", true);
      return;
    }

    const dados = {
      acao: "agendar",
      id: idEnvio,
      nome: nome.value.trim().replace(/\s+/g, " "),
      whatsapp: whats.value.replace(/\D/g, ""),
      pessoas: Number(pessoas.value),
      data: d.data,
      hora: h,
      origem,
      pagina: location.href.split("#")[0].split("?")[0],
      enviadoEm: new Date().toISOString(),
    };

    carregandoBtn(true);
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 25000);
    try {
      // text/plain evita a pré-verificação de CORS, que o Apps Script não responde
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(dados),
        signal: ctrl.signal,
      });
      const j = await res.json().catch(() => null);
      if (!j) throw new Error("sem resposta");
      if (j.ok) {
        mostrarOk({ primeiroNome, data: j.data || d.data, hora: j.hora || h, sala: j.sala || "" });
        idEnvio = novoId();
        if (vagas && vagas[d.data] && typeof vagas[d.data][h] === "number" && !j.repetido) vagas[d.data][h] = Math.max(0, vagas[d.data][h] - 1);
        return;
      }
      if (j.error === "lotado") {
        mostrarStatus(`O horário das ${rotuloHora(h)} acabou de lotar. Escolha outro horário.`);
        await carregarVagas(true);
        const livre = timesEl.querySelector("input:not(:disabled)");
        if (livre) livre.focus();
        return;
      }
      if (j.error === "dados" || j.error === "horario") {
        mostrarStatus("Confira o nome, o WhatsApp, o dia e o horário e tente de novo.");
        return;
      }
      throw new Error(j.error || "erro");
    } catch (_) {
      mostrarStatus("Não conseguimos agendar agora. Confira sua internet e tente de novo.");
    } finally {
      clearTimeout(t);
      carregandoBtn(false);
    }
  });

  // ---------- confirmação ----------
  const z = (dt) => dt.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

  const mostrarOk = ({ primeiroNome, data, hora, sala }) => {
    const d = DIAS.find((x) => x.data === data) || diaAtual();
    const ini = new Date(`${data}T${hora}:00-03:00`);
    const fim = new Date(ini.getTime() + DUR * 60000);
    const quando = `${d.semana}, ${diaMes(data)} · ${rotuloHora(hora)}`;
    const salaTxt = sala ? `Sala ${String(sala).replace(/^sala\s*/i, "")}` : "";
    const onde = [C.local, C.endereco].filter(Boolean).join(" · ");

    $("[data-ok-nome]").textContent = primeiroNome ? `, ${primeiroNome}` : "";
    $("[data-ok-quando]").textContent = quando;
    const salaEl = $("[data-ok-sala]");
    salaEl.textContent = salaTxt;
    salaEl.hidden = !salaTxt;
    $("[data-ok-local]").textContent = onde;

    const titulo = `${C.evento || "Santa Ceia da Família"} · AD Brás`;
    const detalhes = `${C.evento || "Santa Ceia da Família"}${salaTxt ? ` (${salaTxt})` : ""}. ${C.siteUrl || ""}`;
    const gcal = new URL("https://calendar.google.com/calendar/render");
    gcal.searchParams.set("action", "TEMPLATE");
    gcal.searchParams.set("text", titulo);
    gcal.searchParams.set("dates", `${z(ini)}/${z(fim)}`);
    gcal.searchParams.set("location", onde);
    gcal.searchParams.set("details", detalhes);
    $("[data-ok-gcal]").href = gcal.toString();

    const icsTxt = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Ello Eterno//Santa Ceia//PT-BR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      `UID:${idEnvio}@elloeterno.com.br`,
      `DTSTAMP:${z(new Date())}`,
      `DTSTART:${z(ini)}`,
      `DTEND:${z(fim)}`,
      `SUMMARY:${titulo.replace(/[,;]/g, "\\$&")}`,
      `LOCATION:${onde.replace(/[,;]/g, "\\$&")}`,
      `DESCRIPTION:${detalhes.replace(/[,;]/g, "\\$&")}`,
      "BEGIN:VALARM", "TRIGGER:-PT2H", "ACTION:DISPLAY", "DESCRIPTION:Santa Ceia da Família", "END:VALARM",
      "END:VEVENT", "END:VCALENDAR",
    ].join("\r\n");
    const ics = $("[data-ok-ics]");
    if (ics.dataset.url) URL.revokeObjectURL(ics.dataset.url);
    ics.dataset.url = URL.createObjectURL(new Blob([icsTxt], { type: "text/calendar;charset=utf-8" }));
    ics.href = ics.dataset.url;

    const texto = `Nossa família vai participar da ${C.evento || "Santa Ceia da Família"} na AD Brás: ${d.semana.toLowerCase()}, ${diaMes(data)}, às ${rotuloHora(hora)}${salaTxt ? ` (${salaTxt.toLowerCase()})` : ""}. Agende a sua família também: ${C.siteUrl || location.href.split("#")[0]}`;
    $("[data-ok-share]").href = `https://wa.me/?text=${encodeURIComponent(texto)}`;

    form.hidden = true;
    ok.hidden = false;
    ok.focus({ preventScroll: true });
    ok.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
  };

  $("[data-ok-again]").addEventListener("click", () => {
    form.reset();
    [nome, whats, pessoas].forEach((el) => el.setAttribute("aria-invalid", "false"));
    timesWrap.hidden = true;
    timesEl.innerHTML = "";
    statusEl.hidden = true;
    ok.hidden = true;
    form.hidden = false;
    nome.focus();
    carregarVagas(true);
  });

  carregarVagas(true);
})();
