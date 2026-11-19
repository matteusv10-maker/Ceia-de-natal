/* Santa Ceia da Família · agendamento (elloeterno.com.br)
   - calendário do mês com os dias do evento destacados; ao tocar no dia aparecem os horários daquele dia
     (de 20 em 20 minutos, a partir de window.CEIA no topo do index.html)
   - envia o agendamento para a planilha da agenda (Apps Script) e mostra a confirmação com a sala
   - horário que já lotou na planilha (11 famílias) aparece riscado e não pode ser escolhido */
(() => {
  "use strict";

  const C = window.CEIA || {};
  const $ = (s, el = document) => el.querySelector(s);
  const DUR = Number(C.duracaoMin) || 20;
  const endpoint = String(C.planilhaEndpoint || "").trim();
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

  const pad = (n) => String(n).padStart(2, "0");
  const rotuloHora = (h) => { const [a, b] = h.split(":"); return `${Number(a)}h${b === "00" ? "" : b}`; };
  const diaMes = (iso) => { const [, m, d] = iso.split("-"); return `${Number(d)}/${Number(m)}`; };
  const diaExtenso = (iso) => { const [, m, d] = iso.split("-"); return `${Number(d)} de ${MESES[Number(m) - 1]}`; };

  // horários liberados de cada dia (lista do index.html; com a planilha ligada, vale a lista que vem dela)
  const DIAS = (C.dias || []).map((d) => ({
    ...d,
    horarios: (Array.isArray(d.horarios) ? d.horarios : String(d.horarios || "").split(/[\s,]+/))
      .filter((h) => /^\d{2}:\d{2}$/.test(h)),
  }));

  const form = $("[data-form]");
  const nome = $("#nome");
  const whats = $("#whats");
  const pessoas = $("#pessoas");
  const calEl = $("[data-cal]");
  const horasEl = $("[data-horas]");
  const horasTitulo = $("[data-horas-titulo]");
  const horasVazio = $("[data-horas-vazio]");
  const resumo = $("[data-resumo]");
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

  // ---------- calendário ----------
  const montarCalendario = () => {
    if (!DIAS.length) return;
    const [ano, mes] = DIAS[0].data.split("-").map(Number);
    $("[data-cal-mes]").innerHTML = `${MESES[mes - 1].charAt(0).toUpperCase()}${MESES[mes - 1].slice(1)} <b>${ano}</b>`;
    const inicio = new Date(Date.UTC(ano, mes - 1, 1)).getUTCDay();
    const total = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
    for (let i = 0; i < inicio; i++) calEl.appendChild(document.createElement("span"));
    for (let dia = 1; dia <= total; dia++) {
      const iso = `${ano}-${pad(mes)}-${pad(dia)}`;
      const ev = DIAS.find((d) => d.data === iso);
      if (!ev) {
        const s = document.createElement("span");
        s.className = "cal__dia";
        s.setAttribute("aria-hidden", "true");
        s.textContent = dia;
        calEl.appendChild(s);
        continue;
      }
      const lab = document.createElement("label");
      lab.className = "cal__dia";
      const inp = document.createElement("input");
      inp.type = "radio";
      inp.name = "dia";
      inp.value = iso;
      inp.setAttribute("aria-label", `${ev.semana}, ${diaExtenso(iso)}`);
      lab.append(inp, document.createTextNode(String(dia)));
      calEl.appendChild(lab);
    }
  };
  montarCalendario();

  const diaAtual = () => {
    const r = form.querySelector('input[name="dia"]:checked');
    return r ? DIAS.find((d) => d.data === r.value) : null;
  };
  const horaAtual = () => {
    const r = form.querySelector('input[name="hora"]:checked');
    return r ? r.value : "";
  };

  // horários liberados na planilha e quantas salas ainda estão livres em cada um:
  // { "2026-12-01": { "19:00": 10, "19:20": 0, ... } } (0 = lotado; horário que não aparece = fechado)
  let planilha = null;
  const horasDoDia = (d) => (planilha ? Object.keys(planilha[d.data] || {}).sort() : d.horarios);
  const lotado = (d, h) => !!(planilha && planilha[d.data] && planilha[d.data][h] === 0);

  // marca o selecionado também por classe (para navegadores sem :has)
  const marcarSelecionados = () => {
    form.querySelectorAll(".cal__dia input, .hora input").forEach((i) => i.parentElement.classList.toggle("is-on", i.checked));
  };

  const renderHoras = () => {
    const d = diaAtual();
    const antes = horaAtual();
    horasEl.innerHTML = "";
    if (!d) {
      horasTitulo.textContent = "Horário";
      horasVazio.textContent = "Toque em um dia do calendário para ver os horários.";
      horasVazio.hidden = false;
      horasEl.hidden = true;
      atualizarResumo();
      return;
    }
    horasTitulo.innerHTML = `Horários <small>${d.semana}, ${diaExtenso(d.data)}</small>`;
    const lista = horasDoDia(d);
    lista.forEach((h) => {
      const cheio = lotado(d, h);
      const lab = document.createElement("label");
      lab.className = `hora${cheio ? " is-cheio" : ""}`;
      const inp = document.createElement("input");
      inp.type = "radio";
      inp.name = "hora";
      inp.value = h;
      inp.disabled = cheio;
      inp.setAttribute("aria-label", `${rotuloHora(h)}${cheio ? ", lotado" : ""}`);
      if (h === antes && !cheio) inp.checked = true;
      lab.append(inp, document.createTextNode(rotuloHora(h)));
      horasEl.appendChild(lab);
    });
    horasVazio.textContent = lista.length ? "" : "Não há horários liberados neste dia.";
    horasVazio.hidden = lista.length > 0;
    horasEl.hidden = !lista.length;
    marcarSelecionados();
    atualizarResumo();
  };

  const atualizarResumo = () => {
    const d = diaAtual();
    const h = horaAtual();
    if (!d || !h) { resumo.hidden = true; return; }
    resumo.innerHTML = `Você escolheu <b>${d.semana.toLowerCase()}, ${diaExtenso(d.data)}</b>, às <b>${rotuloHora(h)}</b>.`;
    resumo.hidden = false;
  };

  const marcarDiasLotados = () => {
    calEl.querySelectorAll('input[name="dia"]').forEach((inp) => {
      const d = DIAS.find((x) => x.data === inp.value);
      const lista = horasDoDia(d);
      const tudo = !lista.length || lista.every((h) => lotado(d, h));
      inp.disabled = tudo;
      inp.parentElement.classList.toggle("is-cheio", tudo);
      inp.setAttribute("aria-label", `${d.semana}, ${diaExtenso(d.data)}${tudo ? ", lotado" : ""}`);
      if (tudo && inp.checked) inp.checked = false;
    });
  };

  calEl.addEventListener("change", () => {
    $("#dia-erro").hidden = true;
    $("#hora-erro").hidden = true;
    marcarSelecionados();
    renderHoras();
    lerPlanilha(false);
  });
  horasEl.addEventListener("change", () => {
    $("#hora-erro").hidden = true;
    marcarSelecionados();
    atualizarResumo();
  });

  // ---------- horários liberados e lotados (planilha) ----------
  let lidoEm = 0;
  let lendo = null;
  const lerPlanilha = (forcar) => {
    if (!endpoint) return Promise.resolve();
    if (!forcar && Date.now() - lidoEm < 45000) return Promise.resolve();
    if (lendo) return lendo;
    lendo = (async () => {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 15000);
      try {
        const url = `${endpoint}${endpoint.includes("?") ? "&" : "?"}acao=vagas&t=${Date.now()}`;
        const r = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
        const j = await r.json();
        if (j && j.ok && j.vagas && typeof j.vagas === "object") {
          planilha = j.vagas;
          lidoEm = Date.now();
          marcarDiasLotados();
          marcarSelecionados();
          renderHoras();
        }
      } catch (_) {
        /* sem a leitura a página continua funcionando: a planilha confere a vaga no envio */
      } finally {
        clearTimeout(t);
        lendo = null;
      }
    })();
    return lendo;
  };

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
    if (!d) erros.push(calEl.querySelector("input:not(:disabled)") || calEl);

    if (d) {
      const h = horaAtual();
      $("#hora-erro").hidden = !!h;
      if (!h) erros.push(horasEl.querySelector("input:not(:disabled)") || horasEl);
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
        return;
      }
      if (j.error === "lotado") {
        if (!planilha) planilha = {};
        if (!planilha[d.data]) planilha[d.data] = Object.fromEntries(d.horarios.map((x) => [x, 1]));
        planilha[d.data][h] = 0;
        const inp = horasEl.querySelector(`input[value="${h}"]`);
        if (inp) inp.checked = false;
        marcarDiasLotados();
        renderHoras();
        mostrarStatus(`O horário das ${rotuloHora(h)} acabou de lotar. Escolha outro horário.`);
        lerPlanilha(true);
        const livre = horasEl.querySelector("input:not(:disabled)");
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

  function mostrarOk({ primeiroNome, data, hora, sala }) {
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
  }

  $("[data-ok-again]").addEventListener("click", () => {
    form.reset();
    [nome, whats, pessoas].forEach((el) => el.setAttribute("aria-invalid", "false"));
    marcarSelecionados();
    renderHoras();
    statusEl.hidden = true;
    ok.hidden = true;
    form.hidden = false;
    nome.focus();
    lerPlanilha(true);
  });

  renderHoras();
  lerPlanilha(true);
})();
