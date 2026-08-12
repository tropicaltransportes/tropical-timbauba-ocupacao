import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  Building2,
  CalendarDays,
  ChevronRight,
  CircleHelp,
  Info,
  RefreshCw,
  Settings2,
} from "lucide-react";
import "./styles.css";
import { REGULAR_ROUTES, VARIABLE_ROUTES, routeFamilyFor } from "./routeConfig";

const CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQmSWb0xEiK2x69xJMwkqgk70fkDoFWP5S20fIGw-eOCah9IvXpnc_0b39WVMRQwuBAKbxZ7NlctTum/pub?gid=408305749&single=true&output=csv";

const demoRows = [
  ["101", "Timbaúba / Recife (PE-041)", "41", "50", "82%"],
  ["105", "Timbaúba / Carpina (PE-095)", "40", "60", "67%"],
  ["103", "Timbaúba / Aliança (TI Joana Bezerra)", "28", "52", "54%"],
  ["102", "Timbaúba / Abreu e Lima (TI PE-15)", "23", "50", "46%"],
  ["107", "Timbaúba / Itambé (TIP)", "15", "48", "31%"],
  ["104", "Timbaúba / Tracunhaém (TI Macaxeira)", "11", "45", "24%"],
  ["106", "Timbaúba / Ferreiros (Joana Bezerra)", "8", "45", "18%"],
].map(([route, label, used, capacity, occupancy]) => ({
  route,
  label,
  used: Number(used),
  capacity: Number(capacity),
  occupancy: Number(occupancy.replace("%", "")),
}));

function parseCsv(text) {
  const rows = [];
  let row = [],
    cell = "",
    quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i],
      next = text[i + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  if (cell || row.length) {
    row.push(cell.trim());
    rows.push(row);
  }
  return rows;
}

const normalize = (value = "") =>
  value
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
const pick = (object, names) => {
  const key = Object.keys(object).find((item) =>
    names.some((name) => normalize(item).includes(normalize(name))),
  );
  return key ? object[key] : "";
};
const toNumber = (value) =>
  Number(
    String(value ?? "")
      .replace("%", "")
      .replace(/\./g, "")
      .replace(",", ".")
      .replace(/[^0-9.-]/g, ""),
  ) || 0;
const parseTimestamp = (value = "") => {
  const match = String(value).match(
    /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/,
  );
  return match
    ? new Date(
        Number(match[3]),
        Number(match[2]) - 1,
        Number(match[1]),
        Number(match[4]),
        Number(match[5]),
        Number(match[6]),
      )
    : null;
};
const formatDate = (date) => (date ? date.toLocaleDateString("pt-BR") : "");
const formatTime = (date) =>
  date
    ? date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : "";

function rowsFromCsv(text) {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const headers = rows[0];
  return rows
    .slice(1)
    .map((values) =>
      Object.fromEntries(
        headers.map((header, index) => [header, values[index] ?? ""]),
      ),
    );
}

function transformRows(raw) {
  const allowedRoutes = new Set([
    ...REGULAR_ROUTES.map((item) => item.route),
    ...VARIABLE_ROUTES.flatMap((item) => item.aliases),
  ]);
  const timbauba = raw.filter(
    (row) =>
      normalize(pick(row, ["contrato"])) === "timbauba" &&
      allowedRoutes.has(
        String(pick(row, ["rota"]))
          .trim()
          .toUpperCase(),
      ),
  );
  const latestByRoute = new Map();

  timbauba.forEach((row) => {
    const sourceRoute = String(pick(row, ["rota"]) || "")
      .trim()
      .toUpperCase();
    const route = routeFamilyFor(sourceRoute);
    const timestamp = parseTimestamp(
      pick(row, ["carimbo de data/hora", "data e hora", "timestamp"]),
    );
    if (!route || !timestamp) return;
    const current = latestByRoute.get(route);
    if (!current || timestamp > current.timestamp)
      latestByRoute.set(route, { row, timestamp, route });
  });

  return [...latestByRoute.values()]
    .sort((a, b) => a.route.localeCompare(b.route, "pt-BR", { numeric: true }))
    .map(({ row, timestamp, route }, index) => {
      const regularConfig = REGULAR_ROUTES.find((item) => item.route === route);
      const variableConfig = VARIABLE_ROUTES.find(
        (item) => item.route === route,
      );
      const used = toNumber(
        pick(row, ["passageiros transportados", "passageiros"]),
      );
      const capacity =
        regularConfig?.capacity || variableConfig?.capacity || 48;
      return {
        route,
        label: regularConfig
          ? `Rota regular · veículo ${regularConfig.vehicle}`
          : variableConfig.label,
        used,
        capacity,
        occupancy: Math.min(100, Math.round((used / capacity) * 100)),
        timestamp,
        vehicle: pick(row, ["veículo", "veiculo"]),
        direction:
          pick(row, ["sentido do percurso", "sentido"]) ||
          "Leitura mais recente",
        category: regularConfig ? "regular" : "variable",
        city: regularConfig?.city || variableConfig?.city || "",
        driver: pick(row, ["condutor", "motorista"]) || "Não informado",
        stops: regularConfig?.stops || null,
      };
    })
    .filter((row) => row.used >= 0);
}

function statusFor(value) {
  if (value > 95) return ["Crítica", "critical"];
  if (value > 80) return ["Alta", "high"];
  if (value > 60) return ["Atenção", "attention"];
  return ["Confortável", "comfortable"];
}

function App() {
  const [rows, setRows] = useState(demoRows);
  const [activeTab, setActiveTab] = useState("Ocupação Timbaúba");
  const [selectedDate, setSelectedDate] = useState(formatDate(new Date()));
  const [updatedAt, setUpdatedAt] = useState("--:--");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState(
    "Consultando automaticamente a planilha publicada…",
  );
  const [expandedRoutes, setExpandedRoutes] = useState(() => new Set());
  const [selectedOccupancyRoute, setSelectedOccupancyRoute] = useState(null);

  const summary = useMemo(() => {
    const regular = rows.filter((row) => row.category === "regular");
    const variable = rows.filter((row) => row.category === "variable");
    const totalUsed = regular.reduce((sum, row) => sum + row.used, 0);
    const totalCapacity = regular.reduce((sum, row) => sum + row.capacity, 0);
    const variableUsed = variable.reduce((sum, row) => sum + row.used, 0);
    const variableCapacity = variable.reduce(
      (sum, row) => sum + row.capacity,
      0,
    );
    const average = totalCapacity
      ? Math.round((totalUsed / totalCapacity) * 100)
      : 0;
    const overallUsed = totalUsed + variableUsed;
    const overallCapacity = totalCapacity + variableCapacity;
    return {
      totalUsed,
      totalCapacity,
      average,
      variableUsed,
      variableCapacity,
      overallUsed,
      overallCapacity,
      comfortable: regular.filter((r) => r.occupancy <= 60).length,
      attention: regular.filter((r) => r.occupancy > 60 && r.occupancy <= 80)
        .length,
      high: regular.filter((r) => r.occupancy > 80 && r.occupancy <= 95).length,
      critical: regular.filter((r) => r.occupancy > 95).length,
    };
  }, [rows]);

  async function refresh() {
    setLoading(true);
    setNotice("Consultando a planilha pública…");
    try {
      const response = await fetch(`${CSV_URL}&t=${Date.now()}`);
      if (!response.ok) throw new Error("Falha ao consultar a planilha");
      const parsed = transformRows(rowsFromCsv(await response.text()));
      if (!parsed.length)
        throw new Error("Nenhum registro de Timbaúba encontrado");
      const latestTimestamp = parsed.reduce(
        (latest, row) => (row.timestamp > latest ? row.timestamp : latest),
        parsed[0].timestamp,
      );
      setRows(parsed);
      setNotice(
        "Dados atualizados a partir do CSV filtrado de Timbaúba. As rotas regulares usam a capacidade definida no roteiro; J03, P06 e P08 são exibidas separadamente.",
      );
      setSelectedDate(formatDate(latestTimestamp));
      setUpdatedAt(formatTime(latestTimestamp));
    } catch (error) {
      setNotice(
        "Não foi possível ler a planilha agora. Exibindo a última leitura disponível.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <img
          className="logo logo-light"
          src={`${import.meta.env.BASE_URL}assets/tropical-white.png`}
          alt="Tropical Transportes"
        />
        <div className="sidebar-label">MONITOR OPERACIONAL</div>
        <nav>
          {[
            ["Ocupação Timbaúba", Activity],
            ["Rotas", Building2],
            ["Sobre os dados", CircleHelp],
          ].map(([label, Icon]) => (
            <button
              key={label}
              className={activeTab === label ? "nav-item active" : "nav-item"}
              onClick={() => setActiveTab(label)}
            >
              <Icon size={19} strokeWidth={2.1} />
              <span>{label}</span>
              {activeTab === label && (
                <ChevronRight size={16} className="nav-arrow" />
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span>Fonte dos dados</span>
          <strong>Google Sheets</strong>
          <small>
            CSV publicado pela
            <br />
            Tropical Transportes
          </small>
        </div>
      </aside>
      <main className="main-content">
        <header className="topbar">
          <div className="topbar-title">
            <Building2 size={20} />
            <strong>OPERAÇÃO TIMBAÚBA</strong>
            <i></i>
            <span>Monitor público de ocupação</span>
          </div>
          <button className="refresh-top" onClick={refresh} disabled={loading}>
            <RefreshCw size={18} className={loading ? "spin" : ""} /> Atualizar
            dados
          </button>
        </header>
        <section className="content">
          <div className="update-line">
            <span>
              <span className="status-dot"></span>Dados atualizados em{" "}
              <strong>
                {selectedDate} {updatedAt}
              </strong>{" "}
              <em>(há poucos instantes)</em>
            </span>
          </div>
          <div className="heading-row">
            <div>
              <p className="eyebrow">VISÃO OPERACIONAL</p>
              <h1>Timbaúba — ocupação atual</h1>
              <p className="subtitle">
                Acompanhe a ocupação das rotas regulares e consulte
                separadamente as configurações variáveis da operação.
              </p>
            </div>
            <div className="date-control">
              <CalendarDays size={17} />
              <label>
                Data de referência<strong>{selectedDate}</strong>
              </label>
            </div>
          </div>
          {activeTab === "Ocupação Timbaúba" && (
            <section className="occupancy-directory panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">ACOMPANHAMENTO OPERACIONAL</p>
                  <h2>Ocupação por rota</h2>
                  <p className="panel-intro">
                    Rotas ordenadas da maior para a menor ocupação. Selecione
                    uma rota para consultar o condutor e a data da leitura.
                  </p>
                </div>
                <Info size={17} />
              </div>
              <div className="occupancy-list">
                {[...rows]
                  .sort((a, b) => b.occupancy - a.occupancy)
                  .map((row, index) => {
                    const [, kind] = statusFor(row.occupancy);
                    const selected = selectedOccupancyRoute === row.route;
                    return (
                      <div
                        className={`occupancy-item ${selected ? "selected" : ""}`}
                        key={`occupancy-${row.route}`}
                      >
                        <button
                          type="button"
                          className="occupancy-row"
                          onClick={() =>
                            setSelectedOccupancyRoute(
                              selected ? null : row.route,
                            )
                          }
                        >
                          <span className="line-number">{index + 1}</span>
                          <span className="occupancy-route-label">
                            <strong>{row.route}</strong>
                            <small>{row.city || "Cidade não informada"}</small>
                          </span>
                          <div className="compare-bar">
                            <span
                              className={`bar-fill ${kind}`}
                              style={{ width: `${row.occupancy}%` }}
                            ></span>
                          </div>
                          <b className={`occupancy-percent ${kind}`}>
                            {row.occupancy}%
                          </b>
                          <ChevronRight
                            size={17}
                            className={selected ? "rotate-90" : ""}
                          />
                        </button>
                        {selected && (
                          <div className="occupancy-detail">
                            <span>
                              <small>Condutor</small>
                              <strong>{row.driver}</strong>
                            </span>
                            <span>
                              <small>Data da informação</small>
                              <strong>{formatDate(row.timestamp)}</strong>
                            </span>
                            <span>
                              <small>Horário da leitura</small>
                              <strong>{formatTime(row.timestamp)}</strong>
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </section>
          )}
          {false && activeTab === "Ocupação Timbaúba" && (
            <>
              <section className="overview-card">
                <div className="gauge-block">
                  <div
                    className="gauge"
                    style={{ "--gauge": `${summary.average * 1.8}deg` }}
                  >
                    <div className="gauge-value">{summary.average}%</div>
                  </div>
                  <div className="gauge-caption">
                    <strong>Ocupação das rotas regulares</strong>
                    <span>
                      {summary.totalUsed.toLocaleString("pt-BR")} passageiros{" "}
                      <i>/</i> {summary.totalCapacity.toLocaleString("pt-BR")}{" "}
                      lugares
                    </span>
                    <small>Indicador principal da operação estruturada</small>
                  </div>
                </div>
                <div className="divider"></div>
                <div className="situation">
                  <h3>SITUAÇÃO DAS ROTAS REGULARES</h3>
                  {[
                    [
                      "comfortable",
                      "Confortável (até 60%)",
                      summary.comfortable,
                    ],
                    ["attention", "Atenção (61% a 80%)", summary.attention],
                    ["high", "Alta ocupação (81% a 95%)", summary.high],
                    ["critical", "Crítica (acima de 95%)", summary.critical],
                  ].map(([key, label, count]) => (
                    <div className="situation-row" key={key}>
                      <span className={`legend-dot ${key}`}></span>
                      <span>{label}</span>
                      <b>
                        {count} {count === 1 ? "rota" : "rotas"}
                      </b>
                    </div>
                  ))}
                  <div className="variable-note">
                    <strong>Rotas variáveis: J03, P06 e P08</strong>
                    <span>
                      Essas rotas têm baixa demanda esperada e configuração
                      sujeita a mudanças. Por isso, são demonstradas
                      separadamente e não compõem o indicador principal.
                    </span>
                    <b>
                      {summary.variableUsed.toLocaleString("pt-BR")} passageiros{" "}
                      <i>/</i>{" "}
                      {summary.variableCapacity.toLocaleString("pt-BR")} lugares
                    </b>
                  </div>
                </div>
              </section>
              <section className="lower-grid">
                <div className="line-list panel">
                  <div className="panel-heading">
                    <h2>ROTAS DA OPERAÇÃO</h2>
                    <Settings2 size={17} />
                  </div>
                  {rows.map((row, index) => {
                    const [, kind] = statusFor(row.occupancy);
                    return (
                      <button
                        className={
                          index === 0 ? "line-row selected" : "line-row"
                        }
                        key={`${row.route}-${index}`}
                      >
                        <span className="line-number">{index + 1}</span>
                        <span className="line-name">
                          <strong>
                            {row.route}{" "}
                            <small
                              className={
                                row.category === "variable"
                                  ? "route-badge variable"
                                  : "route-badge"
                              }
                            >
                              {row.category === "variable"
                                ? "VARIÁVEL"
                                : "REGULAR"}
                            </small>
                          </strong>
                          <small>{row.label}</small>
                        </span>
                        <b className={`line-percent ${kind}`}>
                          {row.occupancy}%
                        </b>
                        <ChevronRight size={17} />
                      </button>
                    );
                  })}
                </div>
                <div className="comparison panel">
                  <div className="panel-heading">
                    <h2>OCUPAÇÃO POR ROTA</h2>
                    <Info size={17} />
                  </div>
                  {[...rows]
                    .sort((a, b) => b.occupancy - a.occupancy)
                    .map((row) => {
                      const [, kind] = statusFor(row.occupancy);
                      return (
                        <div
                          className={`compare-row ${row.category === "variable" ? "variable-row" : ""}`}
                          key={`compare-${row.route}`}
                        >
                          <span className="compare-label">
                            <strong>{row.route}</strong>
                            <span>
                              {row.category === "variable"
                                ? "Configuração variável"
                                : `Veículo ${row.vehicle}`}
                            </span>
                          </span>
                          <div className="compare-bar">
                            <span
                              className={`bar-fill ${kind}`}
                              style={{ width: `${row.occupancy}%` }}
                            ></span>
                          </div>
                          <b className={kind}>{row.occupancy}%</b>
                        </div>
                      );
                    })}
                  <div className="legend">
                    <span>
                      <i className="comfortable"></i>Confortável (até 60%)
                    </span>
                    <span>
                      <i className="attention"></i>Atenção (61% a 80%)
                    </span>
                    <span>
                      <i className="high"></i>Alta (81% a 95%)
                    </span>
                    <span>
                      <i className="critical"></i>Crítica (acima de 95%)
                    </span>
                  </div>
                </div>
              </section>
            </>
          )}
          {activeTab === "Rotas" && (
            <section className="route-directory">
              <div className="directory-heading">
                <div>
                  <p className="eyebrow">REFERÊNCIA OPERACIONAL</p>
                  <h2>Rotas da operação Timbaúba</h2>
                  <p>
                    Consulte o veículo, a ocupação atual e todos os pontos de
                    embarque previstos no roteiro vigente.
                  </p>
                </div>
                <div className="directory-summary">
                  <strong>{REGULAR_ROUTES.length} rotas regulares</strong>
                  <span>
                    J03, P06 e P08 aparecem separadamente como configurações
                    variáveis.
                  </span>
                </div>
              </div>
              <div className="route-cards">
                {[
                  ...REGULAR_ROUTES.map((item) => ({
                    ...item,
                    category: "regular",
                  })),
                  ...VARIABLE_ROUTES.map((item) => ({
                    ...item,
                    category: "variable",
                  })),
                ].map((route) => {
                  const live = rows.find((row) => row.route === route.route);
                  const expanded = expandedRoutes.has(route.route);
                  const [, kind] = live
                    ? statusFor(live.occupancy)
                    : ["Sem leitura", "comfortable"];
                  return (
                    <article
                      className={`route-card ${route.category === "variable" ? "variable" : ""} ${expanded ? "expanded" : ""}`}
                      key={route.route}
                    >
                      <div className="route-card-top">
                        <div>
                          <span className="route-code">{route.route}</span>
                          <span className="route-city">{route.city}</span>
                          <span
                            className={`route-badge ${route.category === "variable" ? "variable" : ""}`}
                          >
                            {route.category === "variable"
                              ? "VARIÁVEL"
                              : "REGULAR"}
                          </span>
                        </div>
                        {live ? (
                          <strong className={`route-occupancy ${kind}`}>
                            {live.occupancy}%
                          </strong>
                        ) : (
                          <strong className="route-occupancy empty">—</strong>
                        )}
                      </div>
                      <div className="route-meta">
                        <span>
                          <b>Veículo</b>{" "}
                          {route.category === "variable"
                            ? "configuração variável"
                            : route.vehicle}
                        </span>
                        <span>
                          <b>
                            {route.category === "variable"
                              ? "Referência"
                              : "Capacidade"}
                          </b>{" "}
                          {route.capacity} lugares
                        </span>
                      </div>
                      {route.category === "regular" ? (
                        <>
                          <div className="route-path">
                            <span>
                              <b>Partida</b>Garagem Tropical
                            </span>
                            <span>
                              <b>Destino</b>Timbaúba S.A.
                            </span>
                          </div>
                          <button
                            className="route-toggle"
                            type="button"
                            aria-expanded={expanded}
                            onClick={() =>
                              setExpandedRoutes((current) => {
                                const next = new Set(current);
                                next.has(route.route)
                                  ? next.delete(route.route)
                                  : next.add(route.route);
                                return next;
                              })
                            }
                          >
                            {expanded
                              ? "Ocultar pontos e horários"
                              : `Ver ${route.stopCount} pontos e horários`}
                            <ChevronRight
                              size={16}
                              className={expanded ? "rotate-90" : ""}
                            />
                          </button>
                          {expanded && (
                            <div className="stops-list">
                              {route.stops.map((stop) => (
                                <div
                                  className="stop-row"
                                  key={`${route.route}-${stop.number}-${stop.time}`}
                                >
                                  <span className="stop-number">
                                    {stop.number}
                                  </span>
                                  <span className="stop-name">{stop.name}</span>
                                  <time>{stop.time}</time>
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="variable-description">
                          <strong>Configuração variável</strong>
                          <span>
                            Baixa demanda esperada e roteiro sujeito a
                            alterações operacionais.
                          </span>
                        </div>
                      )}
                      <div className="route-card-footer">
                        <span>
                          {live
                            ? `${live.used} passageiros transportados`
                            : "Sem leitura atual"}
                        </span>
                        <small>
                          Atualização:{" "}
                          {live
                            ? `${formatDate(live.timestamp)} às ${formatTime(live.timestamp)}`
                            : "aguardando dados"}
                        </small>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}
          {activeTab === "Sobre os dados" && (
            <section className="placeholder panel">
              <p className="eyebrow">AVISO AO CONTRATANTE</p>
              <h2>Versão experimental</h2>
              <p>
                Este painel está em versão experimental e deverá passar por
                alterações, ajustes e melhorias ao longo da evolução da
                operação.
              </p>
              <p>
                Os dados apresentados são baseados na leitura mais recente
                disponível e podem sofrer atualizações conforme os roteiros e os
                registros operacionais forem revisados.
              </p>
              <button
                className="back-button"
                onClick={() => setActiveTab("Ocupação Timbaúba")}
              >
                Voltar para ocupação
              </button>
            </section>
          )}
          <div className="data-note">
            <Info size={19} />
            <span>
              <strong>Sobre os dados</strong>
              <br />
              {notice}
            </span>
          </div>
        </section>
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
