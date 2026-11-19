/**
 * SANTA CEIA COM A FAMÍLIA · agendamento pelo site (elloeterno.com.br)
 * Planilha dos resultados: "Ceia - Natal 2026", que espelha a agenda oficial
 * "ADBRÁS SEDE - AGENDA - SANTA CEIA DA FAMÍLIA" (mesmas abas, linhas e colunas).
 *
 * O que faz
 * - GET  ?acao=vagas : devolve, por dia, os horários liberados e quantas salas ainda estão livres em cada um.
 * - POST (agendar)   : grava a família na PRIMEIRA sala livre daquele dia e horário, no mesmo formato da agenda
 *                      ("Nome  - 2 Pessoas      Tel: 11 91234-5678"), pinta a célula de laranja claro e registra
 *                      tudo na aba "Agendamentos" (em ordem de dia e horário, com o texto pronto para colar).
 *   Uma família por sala em cada horário. Se o horário lotar entre a escolha e o envio, responde "lotado".
 *
 * Como passar para a agenda oficial
 *   As abas SALA 01 a SALA 11 têm as mesmas posições da agenda. Copie o intervalo C5:H16 de uma sala e cole no
 *   mesmo lugar da sala correspondente na agenda com Ctrl+Shift+V (colar só os valores, sem mudar as cores de lá).
 *   As reservas que já estavam na agenda foram copiadas para cá, então colar o intervalo não apaga nenhuma delas.
 *   Reserva feita à mão daqui para frente: faça também nesta planilha, senão a próxima colagem apaga.
 *
 * Quais horários aparecem no site (segue a planilha)
 * - Célula com o modelo "Nome  Tel:"  = horário LIBERADO e livre naquela sala.
 * - Célula com nome                   = horário liberado, mas já ocupado naquela sala.
 * - Célula VAZIA                      = horário FECHADO naquela sala.
 *   Para abrir um horário, escreva "Nome Tel:" na célula; para fechar, apague o conteúdo.
 *
 * Como ligar (uma vez)
 * 1. Abra a planilha "Ceia - Natal 2026" → Extensões → Apps Script.
 * 2. Apague o código de exemplo, cole este arquivo inteiro e salve (ícone de disquete).
 * 3. Implantar → Nova implantação → engrenagem → "App da Web".
 *    Executar como: Eu · Quem pode acessar: Qualquer pessoa → Implantar → autorize com a sua conta Google.
 * 4. Copie a URL que termina em /exec e cole em planilhaEndpoint, no topo do index.html do site.
 * Teste: abra a URL /exec no navegador. Deve aparecer {"ok":true,"salas":11,"vagas":{...}}.
 *
 * Mudou este script? Implantar → Gerenciar implantações → lápis → Versão: Nova versão → Implantar.
 * A URL continua a mesma.
 */

const ABA_LOG = "Agendamentos";
const ABA_SALA = /^\s*SALA\s*\d+\s*$/i;
const LINHA_DATAS = 3;      // C3:F3 (terça a sexta) e H3 (sábado) têm as datas
const PRIMEIRA_LINHA = 5;   // primeiro horário da grade
const ULTIMA_LINHA = 17;    // última linha que pode ter horário (a 18 é "OBSERVAÇÕES")
// cada bloco: coluna dos horários e colunas dos dias
const BLOCOS = [
  { colHora: 2, colsDias: [3, 4, 5, 6] },  // B = horários da noite · C a F = terça a sexta
  { colHora: 7, colsDias: [8] },           // G = horários da manhã · H = sábado
];
const COR_SITE = "#FFE3C2";                // célula preenchida pelo site
const SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
// colunas da aba "Agendamentos"
const CAB = ["Dia", "Horário", "Sala", "Nome", "Pessoas", "WhatsApp", "Conversar", "Texto para colar na agenda", "Agendado em", "Origem", "Chave", "ID"];
const C_ = Object.fromEntries(CAB.map((h, i) => [h, i + 1]));

function doGet(e) {
  try {
    const cache = CacheService.getScriptCache();
    const salvo = cache.get("vagas");
    if (salvo) return json_(JSON.parse(salvo));
    const m = mapa_();
    const vagas = {};
    Object.keys(m.horarios).forEach((k) => {
      const [data, hora] = k.split("|");
      (vagas[data] = vagas[data] || {})[hora] = (m.livres[k] || []).length;
    });
    const res = { ok: true, salas: m.salas.length, vagas: vagas, atualizado: new Date().toISOString() };
    cache.put("vagas", JSON.stringify(res), 20);
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
  if (nome.length < 3 || zap.length < 10 || !/^\d{4}-\d{2}-\d{2}$/.test(data) || !/^\d{2}:\d{2}$/.test(hora)) {
    return json_({ ok: false, error: "dados" });
  }

  const cache = CacheService.getScriptCache();
  const chaveId = p.id ? "ag_" + String(p.id).replace(/[^\w-]/g, "").slice(0, 60) : "";
  if (chaveId) {
    const anterior = cache.get(chaveId); // o mesmo envio chegou de novo (clique duplo, internet caiu)
    if (anterior) return json_(Object.assign(JSON.parse(anterior), { repetido: true }));
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) return json_({ ok: false, error: "ocupado" });
  try {
    const m = mapa_();
    const chave = data + "|" + hora;
    if (!m.horarios[chave]) return json_({ ok: false, error: "horario" });

    const ja = jaAgendado_(zap, data, hora);
    if (ja) return json_({ ok: true, sala: ja, data: data, hora: hora, repetido: true });

    const livres = m.livres[chave] || [];
    if (!livres.length) return json_({ ok: false, error: "lotado" });

    const alvo = livres[0];
    const res = { ok: true, sala: alvo.sala, data: data, hora: hora };
    if (p.teste) {
      res.teste = true; // teste de ligação: não grava nada
    } else {
      const texto = textoAgenda_(nome, pessoas, zap);
      const quando = Utilities.formatDate(new Date(), m.tz, "dd/MM/yyyy HH:mm");
      alvo.sheet.getRange(alvo.linha, alvo.coluna).setValue(texto).setBackground(COR_SITE)
        .setNote("Agendado pelo site em " + quando);
      registrar_({ nome: nome, zap: zap, pessoas: pessoas, data: data, hora: hora, sala: alvo.sala, texto: texto,
        origem: limpar_(p.origem, 80), id: String(p.id || "").slice(0, 60) });
      SpreadsheetApp.flush();
      cache.remove("vagas");
    }
    if (chaveId) cache.put(chaveId, JSON.stringify(res), 900);
    return json_(res);
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

/** Mesmo formato das células da agenda: "Nome  - 2 Pessoas      Tel: 11 91234-5678" */
function textoAgenda_(nome, pessoas, zap) {
  return nome + "  - " + pessoas + (pessoas === 1 ? " Pessoa" : " Pessoas") + " ".repeat(27) + "Tel: " + formatarTel_(zap);
}

/** Lê todas as salas: quais horários estão liberados em cada dia e quais salas estão livres em cada um. */
function mapa_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = ss.getSpreadsheetTimeZone() || "America/Sao_Paulo";
  const salas = ss.getSheets().filter((sh) => ABA_SALA.test(sh.getName()))
    .sort((a, b) => numeroSala_(a.getName()) - numeroSala_(b.getName()));
  const horarios = {};
  const livres = {};
  salas.forEach((sh) => {
    const vals = sh.getRange(1, 1, ULTIMA_LINHA, 8).getValues();
    const txt = sh.getRange(1, 1, ULTIMA_LINHA, 8).getDisplayValues();
    BLOCOS.forEach((b) => {
      b.colsDias.forEach((col) => {
        const d = vals[LINHA_DATAS - 1][col - 1];
        if (!(d instanceof Date)) return;
        const data = Utilities.formatDate(d, tz, "yyyy-MM-dd");
        for (let r = PRIMEIRA_LINHA; r <= ULTIMA_LINHA; r++) {
          const hora = hora_(txt[r - 1][b.colHora - 1]);
          const celula = txt[r - 1][col - 1];
          if (!hora || vazia_(celula)) continue;  // célula vazia = horário fechado nesta sala
          const chave = data + "|" + hora;
          horarios[chave] = true;                 // liberado (livre ou já ocupado)
          if (modelo_(celula)) {
            (livres[chave] = livres[chave] || []).push({ sheet: sh, sala: sh.getName().trim(), linha: r, coluna: col });
          }
        }
      });
    });
  });
  return { tz: tz, salas: salas, horarios: horarios, livres: livres };
}

/** "19h", "19h20", "8h", "19:20" ou "19:20:00" → "19:20" */
function hora_(t) {
  const m = String(t || "").trim().match(/^(\d{1,2})\s*(?:h|:)\s*(\d{2})?/i);
  if (!m) return "";
  const h = parseInt(m[1], 10);
  const mi = m[2] ? parseInt(m[2], 10) : 0;
  if (h > 23 || mi > 59) return "";
  return ("0" + h).slice(-2) + ":" + ("0" + mi).slice(-2);
}

function vazia_(t) {
  return String(t || "").trim() === "";
}

/** livre = só o modelo "Nome   Tel:" (horário liberado e ainda sem família) */
function modelo_(t) {
  const s = String(t || "").replace(/\s+/g, " ").trim().toLowerCase();
  return /^nome\s*:?\s*(tel(efone)?\s*:?)?$/.test(s);
}

function numeroSala_(nome) {
  const m = String(nome).match(/\d+/);
  return m ? parseInt(m[0], 10) : 999;
}

function abaLog_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(ABA_LOG);
  if (!sh) {
    sh = ss.insertSheet(ABA_LOG, 0);
    sh.getRange(1, 1, 1, CAB.length).setValues([CAB]).setFontWeight("bold")
      .setBackground("#000000").setFontColor("#FF8B01").setHorizontalAlignment("center");
    sh.setFrozenRows(1);
    sh.hideColumns(C_["Chave"], 2);
  }
  return sh;
}

/** Mesmo WhatsApp, mesmo dia e horário já agendado pelo site? Devolve a sala. */
function jaAgendado_(zap, data, hora) {
  const sh = abaLog_();
  if (sh.getLastRow() < 2) return "";
  const linhas = sh.getRange(2, 1, sh.getLastRow() - 1, CAB.length).getValues();
  const tel = formatarTel_(zap);
  for (let i = linhas.length - 1; i >= 0; i--) {
    const l = linhas[i];
    if (String(l[C_["WhatsApp"] - 1]) === tel && String(l[C_["Chave"] - 1]) === data + " " + hora) return String(l[C_["Sala"] - 1]);
  }
  return "";
}

/** Registra na aba "Agendamentos" e mantém a lista em ordem de dia e horário. */
function registrar_(a) {
  const sh = abaLog_();
  const d = new Date(a.data + "T12:00:00-03:00");
  const dia = SEMANA[d.getUTCDay()] + ", " + a.data.slice(8, 10) + "/" + a.data.slice(5, 7);
  const hora = a.hora.slice(0, 2).replace(/^0/, "") + "h" + (a.hora.slice(3) === "00" ? "" : a.hora.slice(3));
  const linha = [dia, hora, a.sala, a.nome, a.pessoas, formatarTel_(a.zap), "", a.texto, new Date(), a.origem, a.data + " " + a.hora, a.id];
  sh.appendRow(linha);
  const r = sh.getLastRow();
  sh.getRange(r, C_["Agendado em"]).setNumberFormat("dd/MM/yyyy HH:mm");
  sh.getRange(r, C_["Conversar"]).setRichTextValue(SpreadsheetApp.newRichTextValue()
    .setText("Abrir conversa").setLinkUrl("https://wa.me/55" + a.zap).build());
  if (r > 2) sh.getRange(2, 1, r - 1, CAB.length).sort([{ column: C_["Chave"], ascending: true }, { column: C_["Agendado em"], ascending: true }]);
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

/** Rode pelo editor para conferir o que o script enxerga (Executar → testarLeitura → ver o registro). */
function testarLeitura() {
  const m = mapa_();
  const resumo = {};
  Object.keys(m.horarios).sort().forEach((k) => { resumo[k] = (m.livres[k] || []).length; });
  Logger.log("Salas: " + m.salas.map((s) => s.getName()).join(", "));
  Logger.log(JSON.stringify(resumo, null, 1));
}
