/**
 * ⏰ 𝒀𝑨𝑲𝑨𝑴𝒀 - LEMBRETES AGENDADOS
 * A IA agenda lembretes via criar_lembrete; o sistema dispara a mensagem
 * no chat na hora marcada (e re-agenda pendentes ao reiniciar).
 */

const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'data', 'lembretes.json');
let sender = null;

function load() {
  try {
    if (fs.existsSync(FILE)) return JSON.parse(fs.readFileSync(FILE));
  } catch (e) {}
  return [];
}

function save(list) {
  try { fs.writeFileSync(FILE, JSON.stringify(list, null, 2)); } catch (e) {}
}

function setSender(fn) { sender = fn; }

function parseQuando(quando) {
  const s = String(quando || '').trim();
  // ISO 8601: "2026-08-04T15:30:00"
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d;
  // relativo: "10min", "2h", "30s"
  const m = s.match(/^(\d+)\s*(s|sec|seg|m|min|h|hora|horas)$/i);
  if (m) {
    const n = parseInt(m[1]);
    const unit = m[2].toLowerCase();
    const now = Date.now();
    if (unit[0] === 's') return new Date(now + n * 1000);
    if (unit[0] === 'm') return new Date(now + n * 60000);
    return new Date(now + n * 3600000);
  }
  return null;
}

function scheduleLembrete(chatId, texto, quando) {
  const at = typeof quando === 'object' && quando instanceof Date ? quando : parseQuando(quando);
  if (!at || isNaN(at.getTime())) {
    return { erro: 'Data/hora inválida. Use formato ISO (ex: 2026-08-04T15:30:00) ou relativo (ex: 10min, 2h).' };
  }
  const list = load().filter(l => l.id);
  const item = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    chatId: String(chatId),
    texto: String(texto || '').slice(0, 900),
    quando: at.toISOString(),
  };
  list.push(item);
  save(list);
  armTimer(item);
  return { agendado: true, id: item.id, quando: at.toISOString() };
}

function cancellLembreteNotUsed() {}

function armTimer(item) {
  const delay = new Date(item.quando).getTime() - Date.now();
  const time = setTimeout(() => {
    fire(item);
  }, Math.max(0, delay));
  time.unref && time.unref();
}

function fire(item) {
  const list = load();
  const rest = list.filter(l => l.id !== item.id);
  save(rest);
  if (sender) {
    try {
      sender(item.chatId, `⏰ • *LEMBRETE*\n\n${item.texto}`);
    } catch (e) {}
  }
}

function listLembretes() {
  const now = Date.now();
  return load()
    .filter(l => new Date(l.quando).getTime() > now)
    .map(l => ({ id: l.id, chatId: l.chatId, texto: l.texto.slice(0, 60), quando: l.quando }));
}

function cancelLembrete(id) {
  const list = load();
  const rest = list.filter(l => l.id !== id);
  save(rest);
  return list.length !== rest.length;
}

function reschedulePending() {
  const now = Date.now();
  const pending = load().filter(l => new Date(l.quando).getTime() > now);
  save(load().filter(l => new Date(l.quando).getTime() <= now));
  for (const item of pending) armTimer(item);
  return pending.length;
}

module.exports = { setSender, scheduleLembrete, listLembretes, cancelLembrete, reschedulePending };