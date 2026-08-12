import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Activity, Building2, CalendarDays, ChevronRight, CircleHelp, FileText, Info, LineChart, RefreshCw, Settings2 } from 'lucide-react';
import './styles.css';

const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQmSWb0xEiK2x69xJMwkqgk70fkDoFWP5S20fIGw-eOCah9IvXpnc_0b39WVMRQwuBAKbxZ7NlctTum/pub?gid=0&single=true&output=csv';
const REFERENCE_CAPACITY = 48;

const demoRows = [
  ['101', 'Timbaúba / Recife (PE-041)', '41', '50', '82%'],
  ['105', 'Timbaúba / Carpina (PE-095)', '40', '60', '67%'],
  ['103', 'Timbaúba / Aliança (TI Joana Bezerra)', '28', '52', '54%'],
  ['102', 'Timbaúba / Abreu e Lima (TI PE-15)', '23', '50', '46%'],
  ['107', 'Timbaúba / Itambé (TIP)', '15', '48', '31%'],
  ['104', 'Timbaúba / Tracunhaém (TI Macaxeira)', '11', '45', '24%'],
  ['106', 'Timbaúba / Ferreiros (Joana Bezerra)', '8', '45', '18%'],
].map(([route, label, used, capacity, occupancy]) => ({ route, label, used: Number(used), capacity: Number(capacity), occupancy: Number(occupancy.replace('%', '')) }));

function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i], next = text[i + 1];
    if (char === '"' && quoted && next === '"') { cell += '"'; i += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) { row.push(cell.trim()); cell = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) { if (char === '\r' && next === '\n') i += 1; row.push(cell.trim()); if (row.some(Boolean)) rows.push(row); row = []; cell = ''; }
    else cell += char;
  }
  if (cell || row.length) { row.push(cell.trim()); rows.push(row); }
  return rows;
}

const normalize = (value = '') => value.toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const pick = (object, names) => { const key = Object.keys(object).find((item) => names.some((name) => normalize(item).includes(normalize(name)))); return key ? object[key] : ''; };
const toNumber = (value) => Number(String(value ?? '').replace('%', '').replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, '')) || 0;
const parseTimestamp = (value = '') => {
  const match = String(value).match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/);
  return match ? new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]), Number(match[4]), Number(match[5]), Number(match[6])) : null;
};
const formatDate = (date) => date ? date.toLocaleDateString('pt-BR') : '';
const formatTime = (date) => date ? date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';

function rowsFromCsv(text) {
  const rows = parseCsv(text); if (rows.length < 2) return [];
  const headers = rows[0];
  return rows.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])));
}

function transformRows(raw) {
  const timbauba = raw.filter((row) => normalize(pick(row, ['contrato'])) === 'timbauba');
  const latestByRoute = new Map();

  timbauba.forEach((row) => {
    const route = String(pick(row, ['rota']) || '').trim();
    const timestamp = parseTimestamp(pick(row, ['carimbo de data/hora', 'data e hora', 'timestamp']));
    if (!route || !timestamp) return;
    const current = latestByRoute.get(route);
    if (!current || timestamp > current.timestamp) latestByRoute.set(route, { row, timestamp });
  });

  return [...latestByRoute.values()].sort((a, b) => a.row.Rota.localeCompare(b.row.Rota, 'pt-BR', { numeric: true })).map(({ row, timestamp }, index) => {
    const route = String(pick(row, ['rota']) || `Linha ${index + 1}`).trim();
    const used = toNumber(pick(row, ['passageiros transportados', 'passageiros']));
    const capacity = REFERENCE_CAPACITY;
    return {
      route,
      label: `${pick(row, ['sentido do percurso', 'sentido']) || 'Leitura mais recente'} · ${pick(row, ['nome do condutor', 'condutor']) || 'Condutor não informado'}`,
      used,
      capacity,
      occupancy: Math.min(100, Math.round((used / capacity) * 100)),
      timestamp,
      vehicle: pick(row, ['veículo', 'veiculo']),
    };
  }).filter((row) => row.used >= 0);
}

function statusFor(value) {
  if (value > 95) return ['Crítica', 'critical'];
  if (value > 80) return ['Alta', 'high'];
  if (value > 60) return ['Atenção', 'attention'];
  return ['Confortável', 'comfortable'];
}

function App() {
  const [rows, setRows] = useState(demoRows);
  const [activeTab, setActiveTab] = useState('Ocupação Timbaúba');
  const [selectedDate, setSelectedDate] = useState(formatDate(new Date()));
  const [updatedAt, setUpdatedAt] = useState('--:--');
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('Consultando automaticamente a planilha publicada…');

  const summary = useMemo(() => {
    const totalUsed = rows.reduce((sum, row) => sum + row.used, 0);
    const totalCapacity = rows.reduce((sum, row) => sum + row.capacity, 0);
    const average = Math.round(rows.reduce((sum, row) => sum + row.occupancy, 0) / Math.max(rows.length, 1));
    return { totalUsed, totalCapacity, average, comfortable: rows.filter((r) => r.occupancy <= 60).length, attention: rows.filter((r) => r.occupancy > 60 && r.occupancy <= 80).length, high: rows.filter((r) => r.occupancy > 80 && r.occupancy <= 95).length, critical: rows.filter((r) => r.occupancy > 95).length };
  }, [rows]);

  async function refresh() {
    setLoading(true); setNotice('Consultando a planilha pública…');
    try {
      const response = await fetch(`${CSV_URL}&t=${Date.now()}`);
      if (!response.ok) throw new Error('Falha ao consultar a planilha');
      const parsed = transformRows(rowsFromCsv(await response.text()));
      if (!parsed.length) throw new Error('Nenhum registro de Timbaúba encontrado');
      const latestTimestamp = parsed.reduce((latest, row) => row.timestamp > latest ? row.timestamp : latest, parsed[0].timestamp);
      setRows(parsed); setNotice(`Dados atualizados a partir do CSV normalizado. Capacidade de referência: ${REFERENCE_CAPACITY} lugares por veículo.`); setSelectedDate(formatDate(latestTimestamp)); setUpdatedAt(formatTime(latestTimestamp));
    } catch (error) {
      setNotice('Não foi possível ler a planilha agora. Exibindo a última leitura disponível.');
    } finally { setLoading(false); }
  }

  useEffect(() => { refresh(); }, []);

  return <div className="app-shell">
    <aside className="sidebar">
      <img className="logo logo-light" src="/assets/tropical-white.png" alt="Tropical Transportes" />
      <div className="sidebar-label">MONITOR OPERACIONAL</div>
      <nav>{[['Ocupação Timbaúba', Activity], ['Linhas', Building2], ['Relatórios', FileText], ['Sobre os dados', CircleHelp]].map(([label, Icon]) => <button key={label} className={activeTab === label ? 'nav-item active' : 'nav-item'} onClick={() => setActiveTab(label)}><Icon size={19} strokeWidth={2.1} /><span>{label}</span>{activeTab === label && <ChevronRight size={16} className="nav-arrow" />}</button>)}</nav>
      <div className="sidebar-footer"><span>Fonte dos dados</span><strong>Google Sheets</strong><small>CSV publicado pela<br />Tropical Transportes</small><a href={CSV_URL} target="_blank" rel="noreferrer">Saiba mais</a></div>
    </aside>
    <main className="main-content">
      <header className="topbar"><div className="topbar-title"><Building2 size={20} /><strong>OPERAÇÃO TIMBAÚBA</strong><i></i><span>Monitor público de ocupação</span></div><button className="refresh-top" onClick={refresh} disabled={loading}><RefreshCw size={18} className={loading ? 'spin' : ''} /> Atualizar dados</button></header>
      <section className="content">
        <div className="update-line"><span><span className="status-dot"></span>Dados atualizados em <strong>{selectedDate} {updatedAt}</strong> <em>(há poucos instantes)</em></span></div>
        <div className="heading-row"><div><p className="eyebrow">VISÃO OPERACIONAL</p><h1>Timbaúba — ocupação atual</h1><p className="subtitle">Acompanhe a utilização das linhas da operação e identifique rapidamente onde existe maior pressão de lotação.</p></div><div className="date-control"><CalendarDays size={17} /><label>Data de referência<strong>{selectedDate}</strong></label></div></div>
        {activeTab === 'Ocupação Timbaúba' && <>
          <section className="overview-card"><div className="gauge-block"><div className="gauge" style={{ '--gauge': `${summary.average * 1.8}deg` }}><div className="gauge-value">{summary.average}%</div></div><div className="gauge-caption"><strong>da capacidade total</strong><span>{summary.totalUsed.toLocaleString('pt-BR')} passageiros / {summary.totalCapacity.toLocaleString('pt-BR')} lugares</span></div></div><div className="divider"></div><div className="situation"><h3>SITUAÇÃO GERAL</h3>{[['comfortable', 'Confortável (até 60%)', summary.comfortable], ['attention', 'Atenção (61% a 80%)', summary.attention], ['high', 'Alta ocupação (81% a 95%)', summary.high], ['critical', 'Crítica (acima de 95%)', summary.critical]].map(([key, label, count]) => <div className="situation-row" key={key}><span className={`legend-dot ${key}`}></span><span>{label}</span><b>{count} {count === 1 ? 'linha' : 'linhas'}</b></div>)}</div></section>
          <section className="lower-grid"><div className="line-list panel"><div className="panel-heading"><h2>SELECIONE UMA LINHA</h2><Settings2 size={17} /></div>{rows.map((row, index) => { const [, kind] = statusFor(row.occupancy); return <button className={index === 0 ? 'line-row selected' : 'line-row'} key={`${row.route}-${index}`}><span className="line-number">{index + 1}</span><span className="line-name"><strong>{row.route}</strong><small>{row.label}</small></span><b className={`line-percent ${kind}`}>{row.occupancy}%</b><ChevronRight size={17} /></button> })}<button className="see-all">Ver todas as linhas <ChevronRight size={16} /></button></div><div className="comparison panel"><div className="panel-heading"><h2>COMPARATIVO DE OCUPAÇÃO POR LINHA</h2><Info size={17} /></div>{[...rows].sort((a, b) => b.occupancy - a.occupancy).map((row) => { const [, kind] = statusFor(row.occupancy); return <div className="compare-row" key={`compare-${row.route}`}><span className="compare-label"><strong>{row.route}</strong><span>{row.label}</span></span><div className="compare-bar"><span className={`bar-fill ${kind}`} style={{ width: `${row.occupancy}%` }}></span></div><b className={kind}>{row.occupancy}%</b></div> })}<div className="legend"><span><i className="comfortable"></i>Confortável (até 60%)</span><span><i className="attention"></i>Atenção (61% a 80%)</span><span><i className="high"></i>Alta (81% a 95%)</span><span><i className="critical"></i>Crítica (acima de 95%)</span></div></div></section>
        </>}
        {activeTab !== 'Ocupação Timbaúba' && <section className="placeholder panel"><p className="eyebrow">ÁREA EM PREPARAÇÃO</p><h2>{activeTab}</h2><p>Esta área será disponibilizada em uma próxima etapa do monitor operacional.</p><button className="back-button" onClick={() => setActiveTab('Ocupação Timbaúba')}>Voltar para ocupação</button></section>}
        <div className="data-note"><Info size={19} /><span><strong>Sobre os dados</strong><br />{notice}</span></div>
      </section>
    </main>
  </div>;
}

createRoot(document.getElementById('root')).render(<App />);
