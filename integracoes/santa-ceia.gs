/**
 * SANTA CEIA COM A FAMÍLIA · agendamento pelo site (elloeterno.com.br)
 * Planilha dos resultados: "Ceia - Natal 2026" (uma aba só: "Agendamentos").
 *
 * O que faz
 * - POST (agendar)   : acrescenta a família na aba "Agendamentos", em ordem de dia e horário, com o
 *                      "Texto para colar na agenda" no mesmo formato da agenda oficial
 *                      ("Nome  - 2 Pessoas      Tel: 11 91234-5678").
 * - GET  ?acao=vagas : devolve quantas famílias já marcaram cada dia e horário. Quando um horário chega ao
 *                      LIMITE (uma família por sala), o site mostra o horário riscado e não deixa escolher.
 *
 * Como passar para a agenda oficial
 *   Copie o "Texto para colar na agenda" e cole na sala livre daquele dia e horário. Depois marque a caixa
 *   "Na agenda?" (a linha fica verde) para saber o que já foi passado.
 *
 * Como ligar (uma vez)
 * 1. Abra a planilha "Ceia - Natal 2026" → Extensões → Apps Script.
 * 2. Apague o código de exemplo, cole este arquivo inteiro e salve (ícone de disquete).
 * 3. Implantar → Nova implantação → engrenagem → "App da Web".
 *    Executar como: Eu · Quem pode acessar: Qualquer pessoa → Implantar → autorize com a sua conta Google.
 * 4. Copie a URL que termina em /exec e cole em planilhaEndpoint, no topo do index.html do site.
 * Teste: abra a URL /exec no navegador. Deve aparecer {"ok":true,"limite":11,"ocupados":{...}}.
 *
 * Mudou este script? Implantar → Gerenciar implantações → lápis → Versão: Nova versão → Implantar.
 * A URL continua a mesma.
 */

const ABA = "Agendamentos";
const LIMITE = 11;   // famílias por horário (uma por sala). Mude aqui se precisar.
// dias e horários aceitos (iguais aos do site e da agenda)
const NOITE = ["19:00", "19:20", "19:40", "20:00", "20:20", "20:40", "21:00", "21:20", "21:40", "22:00"];
const HORARIOS = {
  "2026-12-01": NOITE, "2026-12-02": NOITE, "2026-12-03": NOITE, "2026-12-04": NOITE,
  "2026-12-05": ["08:00", "08:20", "08:40", "09:00", "09:20", "09:40", "10:00", "10:20", "10:40", "11:00", "11:20"],
};
const SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
// "Agendado em", "Chave" e "ID" ficam ocultas na planilha (servem para ordenar e conferir)
const CAB = ["Na agenda?", "Dia", "Horário", "Nome", "Pessoas", "WhatsApp", "Conversar", "Texto para colar na agenda", "Agendado em", "Chave", "ID"];
const COL = Object.fromEntries(CAB.map((h, i) => [h, i + 1]));

function doGet(e) {
  try {
    const cache = CacheService.getScriptCache();
    const salvo = cache.get("ocupados");
    if (salvo) return json_(JSON.parse(salvo));
    const res = { ok: true, limite: LIMITE, ocupados: contar_(), atualizado: new Date().toISOString() };
    cache.put("ocupados", JSON.stringify(res), 20);
    return json_(res);
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function doPost(e) {
  let p;
  try {
    p = JSON.parse((e && e.postData && e.postData.contents) || "{}");
  } catch (_) {
    return json_({ ok: false, error: "dados" });
  }
  const nome = limpar_(p.nome, 100);
  const zap = String(p.whatsapp || "").replace(/\D/g, "").slice(-11);
  const pessoas = Math.max(1, Math.min(30, parseInt(p.pessoas, 10) || 1));
  const data = String(p.data || "");
  const hora = String(p.hora || "");
  if (nome.length < 3 || zap.length < 10) return json_({ ok: false, error: "dados" });
  if (!HORARIOS[data] || HORARIOS[data].indexOf(hora) < 0) return json_({ ok: false, error: "horario" });

  const cache = CacheService.getScriptCache();
  const chaveId = p.id ? "ag_" + String(p.id).replace(/[^\w-]/g, "").slice(0, 60) : "";
  if (chaveId) {
    const anterior = cache.get(chaveId); // o mesmo envio chegou de novo (clique duplo, internet caiu)
    if (anterior) return json_(Object.assign(JSON.parse(anterior), { repetido: true }));
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) return json_({ ok: false, error: "ocupado" });
  try {
    const sh = aba_();
    const chave = data + " " + hora;
    const linhas = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, CAB.length).getValues() : [];
    if (linhas.some((l) => digitos_(l[COL["WhatsApp"] - 1]).slice(-11) === zap && chaveTexto_(l[COL["Chave"] - 1]) === chave)) {
      return json_({ ok: true, data: data, hora: hora, repetido: true });
    }
    const ja = linhas.filter((l) => chaveTexto_(l[COL["Chave"] - 1]) === chave).length;
    if (ja >= LIMITE) return json_({ ok: false, error: "lotado" });

    const res = { ok: true, data: data, hora: hora };
    if (p.teste) {
      res.teste = true; // teste de ligação: não grava nada
    } else {
      registrar_(sh, { nome: nome, zap: zap, pessoas: pessoas, data: data, hora: hora, id: String(p.id || "").slice(0, 60) });
      SpreadsheetApp.flush();
      cache.remove("ocupados");
    }
    if (chaveId) cache.put(chaveId, JSON.stringify(res), 900);
    return json_(res);
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

/** Quantas famílias já marcaram cada dia e horário: { "2026-12-01": { "19:00": 3 } } */
function contar_() {
  const sh = aba_();
  const out = {};
  if (sh.getLastRow() < 2) return out;
  sh.getRange(2, COL["Chave"], sh.getLastRow() - 1, 1).getValues().forEach(([k]) => {
    const m = chaveTexto_(k).match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})$/);
    if (!m) return;
    out[m[1]] = out[m[1]] || {};
    out[m[1]][m[2]] = (out[m[1]][m[2]] || 0) + 1;
  });
  return out;
}

/** Chave "AAAA-MM-DD HH:MM". A planilha transforma esse texto em data e hora; aqui ele volta a ser texto. */
function chaveTexto_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, fuso_(), "yyyy-MM-dd HH:mm");
  return String(v || "").trim();
}
let fusoCache_ = "";
function fuso_() {
  return fusoCache_ || (fusoCache_ = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone());
}
function digitos_(v) {
  return String(v || "").replace(/\D/g, "");
}

/** Mesmo formato das células da agenda: "Nome  - 2 Pessoas      Tel: 11 91234-5678" */
function textoAgenda_(nome, pessoas, zap) {
  return nome + "  - " + pessoas + (pessoas === 1 ? " Pessoa" : " Pessoas") + " ".repeat(27) + "Tel: " + formatarTel_(zap);
}

function aba_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(ABA);
  if (!sh) {
    sh = ss.insertSheet(ABA, 0);
    sh.getRange(1, 1, 1, CAB.length).setValues([CAB]).setFontWeight("bold")
      .setBackground("#000000").setFontColor("#FF8B01").setHorizontalAlignment("center");
    sh.setFrozenRows(1);
    sh.hideColumns(COL["Agendado em"], 3);
  }
  return sh;
}

/** Acrescenta a família e mantém a lista em ordem de dia e horário. */
function registrar_(sh, a) {
  const d = new Date(a.data + "T12:00:00-03:00");
  const dia = SEMANA[d.getUTCDay()] + ", " + a.data.slice(8, 10) + "/" + a.data.slice(5, 7);
  const hora = a.hora.slice(0, 2).replace(/^0/, "") + "h" + (a.hora.slice(3) === "00" ? "" : a.hora.slice(3));
  // o apóstrofo guarda a chave como texto (sem ele, a planilha vira data e a contagem por horário falha)
  const linha = [false, dia, hora, a.nome, a.pessoas, formatarTel_(a.zap), "", textoAgenda_(a.nome, a.pessoas, a.zap),
    new Date(), "'" + a.data + " " + a.hora, a.id];
  sh.appendRow(linha);
  const r = sh.getLastRow();
  sh.getRange(r, COL["Na agenda?"]).insertCheckboxes();
  sh.getRange(r, COL["Agendado em"]).setNumberFormat("dd/MM/yyyy HH:mm");
  sh.getRange(r, COL["Conversar"]).setRichTextValue(SpreadsheetApp.newRichTextValue()
    .setText("Abrir conversa").setLinkUrl("https://wa.me/55" + a.zap).build());
  if (r > 2) sh.getRange(2, 1, r - 1, CAB.length).sort([{ column: COL["Chave"], ascending: true }, { column: COL["Agendado em"], ascending: true }]);
}

function formatarTel_(d) {
  if (d.length === 11) return d.slice(0, 2) + " " + d.slice(2, 7) + "-" + d.slice(7);
  if (d.length === 10) return d.slice(0, 2) + " " + d.slice(2, 6) + "-" + d.slice(6);
  return d;
}

// evita que alguém grave fórmulas na planilha (ex.: "=IMPORTXML(...)")
function limpar_(valor, max) {
  const t = String(valor || "").replace(/\s+/g, " ").trim().slice(0, max);
  return /^[=+\-@]/.test(t) ? "'" + t : t;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
