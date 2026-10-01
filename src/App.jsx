import React, { useState, useMemo, useEffect } from "react";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from "recharts";

const SIGNALS = [
  {
    key: "context",
    short: "Context & understanding",
    question: "Does the team actually understand what \"good enough\" means for this product?",
    bands: [
      "Pure feature factory. The team builds what it gets told without any grasp of the why (who wants it and what's good enough). AI in this environment just produces more of the wrong thing.",
      "Some people get it but it's uneven. The \"why\" is understood by Product manager but the engineers don't so only Product can sign things off; this gap means AI starts making decisions based on incomplete context.",
      "Most of the team understands product direction, customers, and trade-offs and can explain why things are built. Good enough is a shared concept and not a moving target.",
      "The whole team shares enough domain and market knowledge to make deliberate calls on what they're shipping. They can push back on the wrong things and know when something is good enough… they don't need to be told.",
    ],
  },
  {
    key: "standards",
    short: "Codified standards",
    question: "Has the team actually written down what good looks like?",
    bands: [
      "Good lives in peoples heads (usually the person who's been there the longest) and nothing is written down. There's zero consistency, asking people what the standards are will result in five different answers, depending on who you ask.",
      "Something exists, a README, maybe a DoD that somebody wrote years ago but they're stale, scattered or just don't show how the team really works now.",
      "Most of the important stuff is written down (DoD, coding/testing practices, NFRs, key architecture decisions) are up to date and actually get referenced in reviews. That last part matters more than people think.",
      "Standards are living, version-controlled documents that are owned by the team when things change. They're specific enough that an agent summary of the document reflects the actual ways of working. This is the bar you need for AI development to really work.",
    ],
  },
  {
    key: "feedback",
    short: "Feedback loops",
    question: "Does the pipeline catch failures before a customer does?",
    bands: [
      "Failures get found in production or by a customer.",
      "Tests exist but you can't trust them. They're slow, flakey or out of date meaning that people have started skipping them or not running the suite. Nobody investigates failures anymore so nobody cares about red status reports. A test suite nobody trusts is almost worse than having no tests!",
      "Automated tests run on the pipeline (inner and outer loop) with reasonable coverage and people actually pay attention when things fail. There's basic observability in production.",
      "Fast, trusted feedback from story reviews all the way through to production monitoring. Failures surface in minutes and teams swarm on fixing failures and flakey tests as a standard practice (rather than ignoring them and hoping for the best). This is what lets AI development move at pace safely, without quietly breaking things.",
    ],
  },
  {
    key: "reviews",
    short: "Trusted reviews",
    question: "Do reviews actually catch issues, or are they rubber-stamped for speed?",
    bands: [
      "Merges happen on trust; rubber stamped for speed or because the reviewer was the person who raised the merge request. Nobody is checking anything meaningfully.",
      "Reviews happen but are inconsistent. Maybe one person does most of the good reviews and everyone else approves things in less than a minute. Or it might be that reviews take so long to happen (no one is picking them up) that it creates a bottleneck that cancels out any speed gains.",
      "Reviews reliably catch real issues against agreed standards and turnaround at a reasonable pace. Reviews are low ego… it's about what works and the agreed standards, not whose idea it was.",
      "Reviews are fast, pragmatic and trusted enough to scale. The team knows that what gets merged has been properly looked at. This matters more than anything else with AI development because human in the loop is your most meaningful control.",
    ],
  },
  {
    key: "ownership",
    short: "Quality ownership",
    question: "Is quality a whole-team concern, or does it get thrown over the wall?",
    bands: [
      "Quality is someone else's problem. Engineers build something and then it gets thrown over the wall, waiting for someone to tell them what's broken (usually by a siloed QA team or a customer).",
      "Some engineers own their testing but it's patchy and there's still an assumption that QA will catch bugs.",
      "Quality is genuinely a whole team concern; engineers own their own testing and there's psychological safety to raise issues without it becoming the blame game. Nobody is waiting to be told when something needs fixing because they already know.",
      "Quality is built in by default, the team knows what guardrails to embed into agents and skills. There's no gatekeeper safety net phase because it isn't needed… it has been handled upstream!",
    ],
  },
];

const BAND_LABELS = [
  "No maturity (nothing happening)",
  "Low (getting started)",
  "Moderate (getting there)",
  "High (living and breathing)",
];

const BAND_SHORT = ["No maturity", "Low", "Moderate", "High"];

const ARCHETYPES = [
  { name: "Startup engineering team", scores: { standards: 3, feedback: 3, reviews: 3, ownership: 3, context: 2 } },
  { name: "Feature factory", scores: { standards: 4, feedback: 2, reviews: 3, ownership: 2, context: 2 } },
  { name: "Solo / rockstar developer", scores: { standards: 2, feedback: 3, reviews: 2, ownership: 3, context: 4 } },
  { name: "Product development team", scores: { standards: 3, feedback: 4, reviews: 3, ownership: 4, context: 3 } },
];

function average(scores) {
  const vals = Object.values(scores);
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function weakestSignal(scores) {
  let min = Infinity;
  let key = null;
  for (const s of SIGNALS) {
    if (scores[s.key] < min) {
      min = scores[s.key];
      key = s.key;
    }
  }
  return SIGNALS.find((s) => s.key === key);
}

function overallBand(avg) {
  if (avg < 1.5)
    return {
      label: "No maturity",
      color: "#F693BF",
      advice:
        "Don't hand this team AI agents yet. Fix the basics first, get one signal written down and referenced, before you touch tooling.",
    };
  if (avg < 2.5)
    return {
      label: "Low maturity",
      color: "#F693BF",
      advice:
        "There's something here but it's patchy. Pick your weakest signal and get it to Moderate before AI usage scales up.",
    };
  if (avg < 3.5)
    return {
      label: "Moderate maturity",
      color: "#F693BF",
      advice:
        "You've got real foundations. Worth checking your weakest signal specifically, that's where AI will find the cracks first.",
    };
  return {
    label: "High maturity",
    color: "#F693BF",
    advice: "This is what an AI-ready team looks like. Keep reassessing periodically, gaps can creep back in.",
  };
}

const STORAGE_KEY = "ai-readiness-radar:scores";

const DEFAULT_SCORES = {
  standards: 2,
  feedback: 2,
  reviews: 2,
  ownership: 2,
  context: 2,
};

function loadStoredScores() {
  if (typeof window === "undefined") return DEFAULT_SCORES;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SCORES;
    const parsed = JSON.parse(raw);
    const isValid = SIGNALS.every((s) => Number.isInteger(parsed[s.key]) && parsed[s.key] >= 1 && parsed[s.key] <= 4);
    return isValid ? parsed : DEFAULT_SCORES;
  } catch {
    return DEFAULT_SCORES;
  }
}

const HISTORY_STORAGE_KEY = "ai-readiness-radar:history";

function isValidScores(scores) {
  return Boolean(scores) && SIGNALS.every((s) => Number.isInteger(scores[s.key]) && scores[s.key] >= 1 && scores[s.key] <= 4);
}

function loadStoredHistory() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry) => entry && typeof entry.id === "string" && typeof entry.date === "string" && isValidScores(entry.scores));
  } catch {
    return [];
  }
}

// crypto.randomUUID only exists in a secure context (https / localhost).
// On plain http the app still needs unique ids, so fall back gracefully.
function makeId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function formatSessionDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export default function App() {
  // Start from defaults (matching what the server prerenders, since there's
  // no localStorage at build time) and load any real saved data after mount.
  // Reading localStorage synchronously during initial render would make the
  // client's first paint diverge from the prerendered HTML and break hydration.
  const [scores, setScores] = useState(DEFAULT_SCORES);
  const [history, setHistory] = useState([]);
  const [compareWith, setCompareWith] = useState(null); // { kind: "archetype" | "session", key: string } | null
  const [expanded, setExpanded] = useState({});
  const [menuOpen, setMenuOpen] = useState(false);
  // Size the radar from its container so the labels always have room.
  const chartRef = React.useRef(null);
  const [chartW, setChartW] = useState(0);
  useEffect(() => {
    const el = chartRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setChartW(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    setScores(loadStoredScores());
    setHistory(loadStoredHistory());
  }, []);

  // Recharts' ResponsiveContainer measures the DOM via ResizeObserver after
  // mount, so it renders differently on the server (no layout) than on the
  // client's first paint. Gating it behind a mount flag keeps the server
  // markup and the client's initial render identical (an empty placeholder),
  // so the chart only appears after hydration - never part of the diff.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(scores));
    setJustSaved(true);
    const timer = setTimeout(() => setJustSaved(false), 1200);
    return () => clearTimeout(timer);
  }, [scores]);

  const resetScores = () => {
    setScores(DEFAULT_SCORES);
    window.localStorage.removeItem(STORAGE_KEY);
  };

  const saveSession = () => {
    const entry = { id: makeId(), date: new Date().toISOString(), scores };
    const next = [...history, entry];
    setHistory(next);
    window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(next));
  };

  const deleteSession = (id) => {
    const next = history.filter((h) => h.id !== id);
    setHistory(next);
    window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(next));
    if (compareWith?.kind === "session" && compareWith.key === id) setCompareWith(null);
  };

  const clearHistory = () => {
    setHistory([]);
    window.localStorage.removeItem(HISTORY_STORAGE_KEY);
    if (compareWith?.kind === "session") setCompareWith(null);
  };

  const compareSeries = useMemo(() => {
    if (!compareWith) return null;
    if (compareWith.kind === "archetype") {
      const a = ARCHETYPES.find((a) => a.name === compareWith.key);
      return a ? { label: a.name, scores: a.scores, color: "#FFFFFF" } : null;
    }
    const session = history.find((h) => h.id === compareWith.key);
    return session ? { label: formatSessionDate(session.date), scores: session.scores, color: "#FFFFFF" } : null;
  }, [compareWith, history]);

  const chartData = useMemo(
    () =>
      SIGNALS.map((s) => ({
        signal: s.short.toUpperCase(),
        You: scores[s.key],
        ...(compareSeries ? { Compare: compareSeries.scores[s.key] } : {}),
      })),
    [scores, compareSeries]
  );

  const avg = average(scores);
  const weak = weakestSignal(scores);
  const band = overallBand(avg);
  const allMax = Object.values(scores).every((v) => v >= 4);
  const lastSession = history.length > 0 ? history[history.length - 1] : null;
  const overallTrend = lastSession ? avg - average(lastSession.scores) : null;

  const NAV = [
    ["Home", "https://cakehurstryan.com/"],
    ["Blog", "https://cakehurstryan.com/blog-posts/"],
    ["Talks", "https://cakehurstryan.com/talks/"],
    ["AI Readiness Radar", "https://radar.cakehurstryan.com/"],
  ];
  const CONTACT = [
    ["LinkedIn", "https://www.linkedin.com/in/cakehurstryan/"],
    ["Email", "mailto:cal@coada.org.uk"],
    ["Subscribe", "https://cakehurstryan.com/#subscribe"],
  ];
  const compareValue = compareWith ? `${compareWith.kind}:${compareWith.key}` : "";
  const onCompareChange = (e) => {
    const v = e.target.value;
    if (!v) return setCompareWith(null);
    const i = v.indexOf(":");
    setCompareWith({ kind: v.slice(0, i), key: v.slice(i + 1) });
  };
  const toggleLevels = (key) => setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  const trendMark = (d) => (d > 0 ? "▲" : d < 0 ? "▼" : "");
  const radius = Math.max(40, Math.min(chartW / 2 - 112, 220));
  const roundedTrend = overallTrend === null ? null : Math.round(overallTrend * 10) / 10;

  return (
    <div className="page">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* Header: same as Blog and Talks */}
      <header className="hdr">
        <h1 className="bungee title">AI Readiness Radar</h1>
        <nav className="nav" aria-label="Main">
          {NAV.map(([label, href]) => (
            <a key={href} className="tl" href={href} aria-current={label === "AI Readiness Radar" ? "page" : undefined}>
              {label}
            </a>
          ))}
        </nav>
        <button
          type="button"
          className="ctl menu-btn"
          aria-expanded={menuOpen}
          aria-controls="menu"
          aria-pressed={menuOpen}
          onClick={() => setMenuOpen((o) => !o)}
        >
          Menu
        </button>
      </header>
      {menuOpen && (
        <div className="menu" id="menu" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="menu-top">
            <button type="button" className="ctl" aria-pressed="true" onClick={() => setMenuOpen(false)}>
              Close
            </button>
          </div>
          <nav aria-label="Main">
            {NAV.map(([label, href]) => (
              <a key={href} className="tl menu-link" href={href} aria-current={label === "AI Readiness Radar" ? "page" : undefined}>
                {label}
              </a>
            ))}
          </nav>
          <div className="menu-contact">
            {CONTACT.map(([label, href]) => (
              <a key={href} className="tl" href={href}>
                {label}
              </a>
            ))}
          </div>
        </div>
      )}

      <main>
        {/* Intro: the title lockup pattern */}
        <div className="intro">
          <p className="h2">AI won’t fix a dysfunctional team… it’ll expose it</p>
          <div className="rule" />
          <p className="x">
            Score your team honestly across five foundational signals before you hand engineers AI agents. Weak
            foundations don’t get fixed by faster tooling, they get amplified by it.
          </p>
        </div>

        {/* The tool: a black section, yellow on the chart only */}
        <section className="tool" aria-label="Your reading">
          <div className="chart" ref={chartRef} style={{ height: radius * 2 + 100 }}>
            {mounted && chartW > 0 && (
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={chartData} outerRadius={radius} margin={{ top: 0, bottom: 0, left: 0, right: 0 }}>
                  <PolarGrid stroke="#F693BF" strokeOpacity={0.5} />
                  <PolarAngleAxis
                    dataKey="signal"
                    tick={(props) => {
                      const { x, y, cx, cy, payload } = props;
                      const dx = x - cx;
                      const dy = y - cy;
                      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                      const ox = x + (dx / dist) * 16;
                      const oy = y + (dy / dist) * 16;
                      let anchor = "middle";
                      if (dx > 10) anchor = "start";
                      else if (dx < -10) anchor = "end";
                      const words = String(payload.value).split(" ");
                      const half = Math.ceil(words.length / 2);
                      const lines = [words.slice(0, half).join(" "), words.slice(half).join(" ")].filter(Boolean);
                      const lh = 15;
                      const startDy = -((lines.length - 1) * lh) / 2;
                      return (
                        <text x={ox} y={oy} textAnchor={anchor} dominantBaseline="middle" fill="#F693BF" fontSize={12} letterSpacing="0.06em" fontFamily="'Montserrat', system-ui, sans-serif">
                          {lines.map((line, i) => (
                            <tspan key={i} x={ox} dy={i === 0 ? startDy : lh}>
                              {line}
                            </tspan>
                          ))}
                        </text>
                      );
                    }}
                  />
                  <PolarRadiusAxis domain={[0, 4]} tickCount={5} tick={false} axisLine={false} />
                  {compareSeries && (
                    <Radar name={compareSeries.label} dataKey="Compare" stroke="#F693BF" fill="none" fillOpacity={0} strokeWidth={2} strokeDasharray="6 5" dot={false} isAnimationActive={false} />
                  )}
                  <Radar name="You" dataKey="You" stroke="#E5FF3D" fill="#E5FF3D" fillOpacity={0.15} strokeWidth={3} dot={{ r: 5, fill: "#E5FF3D", stroke: "none" }} />
                </RadarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="read">
            <p className="d">Overall reading</p>
            <p className="h2 reading">
              {avg.toFixed(1)} / 4 · {band.label}
            </p>
            <p className="d trend">
              {lastSession
                ? roundedTrend === 0
                  ? `No change vs last session (${formatSessionDate(lastSession.date)})`
                  : `${trendMark(roundedTrend)} ${Math.abs(roundedTrend).toFixed(1)} vs last session (${formatSessionDate(lastSession.date)})`
                : "\u00a0"}
            </p>
            <p className="x">{band.advice}</p>
            <div className="weak">
              <p className="d">Weakest signal</p>
              {allMax ? (
                <>
                  <p className="t">None</p>
                  <p className="d">Every signal is at High</p>
                </>
              ) : (
                <>
                  <p className="t">{weak.short}</p>
                  <p className="d">{BAND_SHORT[scores[weak.key] - 1]} - this is the one to sort first</p>
                </>
              )}
            </div>
          </div>

          <div className="bar">
            <div className="key">
              <span className="d you">
                <i aria-hidden="true" />
                Your team
              </span>
              <label className="sel">
                <span className="sel-label">
                  <i className="dash" aria-hidden="true" />
                  Compare
                </span>
                <select value={compareValue} onChange={onCompareChange}>
                  <option value="">Nothing</option>
                  <optgroup label="Team archetypes">
                    {ARCHETYPES.map((a) => (
                      <option key={a.name} value={`archetype:${a.name}`}>
                        {a.name}
                      </option>
                    ))}
                  </optgroup>
                  {history.length > 0 && (
                    <optgroup label="Saved sessions">
                      {[...history].reverse().map((h) => (
                        <option key={h.id} value={`session:${h.id}`}>
                          {formatSessionDate(h.date)} · {average(h.scores).toFixed(1)}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </label>
            </div>
            <div className="actions">
              <span className="d saved" role="status" aria-live="polite">
                {justSaved ? "Saved in this browser" : ""}
              </span>
              {compareWith?.kind === "session" && (
                <button type="button" className="ctl" onClick={() => deleteSession(compareWith.key)}>
                  Delete session
                </button>
              )}
              <button type="button" className="ctl" onClick={saveSession}>
                Save session
              </button>
              <button type="button" className="ctl reset" onClick={resetScores}>
                Reset scores
              </button>
            </div>
          </div>
        </section>
        <p className="d cap">
          Read the full <a href="https://cakehurstryan.com/2026/06/12/ai-readiness-radar/">blog post about AI readiness</a>
        </p>

        {/* Score each signal */}
        <section className="sig" id="score" aria-labelledby="score-h">
          <h2 className="h2" id="score-h">
            Score each signal
          </h2>
          <div className="rule" />
          {SIGNALS.map((s) => {
            const open = !!expanded[s.key];
            const delta = lastSession ? scores[s.key] - lastSession.scores[s.key] : null;
            return (
              <div key={s.key} className="e" id={`signal-${s.key}`}>
                <h3 className="t">
                  {s.short}
                  {lastSession && delta !== 0 && (
                    <span className="d delta" title={`vs last session (${formatSessionDate(lastSession.date)})`}>
                      {trendMark(delta)}
                    </span>
                  )}
                </h3>
                <p className="x q" id={`q-${s.key}`}>
                  {s.question}
                </p>
                <div className="levels" role="radiogroup" aria-labelledby={`q-${s.key}`}>
                  {BAND_SHORT.map((label, i) => {
                    const val = i + 1;
                    const active = scores[s.key] === val;
                    return (
                      <button
                        key={val}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        className={`ctl${active ? " on" : ""}`}
                        onClick={() => setScores((prev) => ({ ...prev, [s.key]: val }))}
                      >
                        {val} {label}
                      </button>
                    );
                  })}
                </div>
                <button type="button" className="conc" aria-expanded={open} aria-controls={`lv-${s.key}`} onClick={() => toggleLevels(s.key)}>
                  <span className="d">Level descriptions</span>
                  <svg className={`car${open ? " up" : ""}`} viewBox="0 0 16 16" aria-hidden="true">
                    <polyline points="2,5 8,11 14,5" fill="none" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                </button>
                {open && (
                  <div className="descs" id={`lv-${s.key}`}>
                    {s.bands.map((text, i) => (
                      <div key={i}>
                        <p className="d lvn">
                          {i + 1} {BAND_SHORT[i]}
                        </p>
                        <p className="x">{text}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </section>

        <div className="note">
          <p className="x">
            This radar sits underneath frameworks like DORA, TMMi, or Team Topologies… it’s a conversation tool, not a
            replacement for them. It tells you if your foundations can take the pace, not whether the AI you’ve added is
            actually working. Run it as a team exercise: score individually, plot together, and go with the lowest score
            where you disagree.
          </p>
        </div>
      </main>

      {/* Footer: same as cakehurstryan.com */}
      <footer className="foot">
        <p className="d">© Callum Akehurst-Ryan 2026</p>
        <nav className="foot-links" aria-label="Contact">
          {CONTACT.map(([label, href]) => (
            <a key={href} className="tl" href={href}>
              {label}
            </a>
          ))}
        </nav>
      </footer>
    </div>
  );
}

const CSS = `
:root{--pink:#F693BF;--black:#000;--y:#E5FF3D;--gut:48px;--sec:48px}
*{box-sizing:border-box}
html,body{margin:0}
body{background:var(--pink)}
::selection{background:#000;color:var(--pink)}
.page{min-height:100vh;background:var(--pink);color:#000;font-family:'Montserrat',system-ui,sans-serif}
.page p,.page h1,.page h2,.page h3{margin:0}
.page a{color:inherit}
.page :focus-visible{outline:2px solid currentColor;outline-offset:2px}
.bungee{font-family:'Bungee',system-ui,sans-serif;font-weight:400;line-height:.84;margin:0 0 0 -.058em;text-transform:uppercase}
.h2{font-weight:700;font-size:28px;line-height:1.1;letter-spacing:.04em;text-transform:uppercase}
.t{font-size:20px;font-weight:600;line-height:1.2}
.x{font-size:16px;line-height:1.5}
.d{font-size:12px;letter-spacing:.06em;text-transform:uppercase;line-height:1.35}
.tl{font-size:16px;letter-spacing:.04em;text-transform:uppercase;text-decoration:none;min-height:44px;display:inline-flex;align-items:center}
.tl:hover,.tl:focus-visible,.tl[aria-current]{text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:6px}
.ctl{font-family:inherit;color:inherit;background:transparent;border:1px solid currentColor;border-radius:0;height:48px;padding:0 16px;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;cursor:pointer;white-space:nowrap}
.ctl.on,.ctl[aria-pressed="true"]{background:#000;color:var(--pink);border-color:#000}
.rule{border-top:1px solid currentColor;margin-top:8px}

.hdr{display:flex;justify-content:space-between;align-items:center;gap:24px;padding:24px var(--gut)}
.title{font-size:56px}
.nav{display:flex;gap:32px;white-space:nowrap}
.menu-btn{display:none}
.menu{position:fixed;inset:0;z-index:10;background:var(--pink);color:#000;padding:16px var(--gut) 32px;display:flex;flex-direction:column;overflow:auto}
.menu-top{display:flex;justify-content:flex-end}
.menu nav{display:flex;flex-direction:column;gap:8px;margin-top:24px}
.menu-link{font-size:28px;min-height:56px}
.menu-contact{margin-top:auto;display:flex;flex-wrap:wrap;gap:0 24px;padding-top:32px}

.intro{padding:24px var(--gut) 0}
.intro .x{margin-top:8px}

.tool{margin-top:var(--sec);background:#000;color:var(--pink);padding:24px var(--gut);display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);column-gap:48px;align-items:center}
.chart{min-width:0}
.read .reading{margin-top:8px}
.read .trend{margin-top:8px}
.read .x{margin-top:8px}
.weak{margin-top:24px;padding:24px 0;border-top:1px solid var(--pink);border-bottom:1px solid var(--pink)}
.weak .t{margin:8px 0}
.bar{grid-column:1/-1;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);column-gap:48px;align-items:center;margin-top:24px}
.key{display:flex;align-items:center;justify-content:space-between;gap:24px}
.you i{display:inline-block;width:24px;border-top:3px solid var(--y);vertical-align:middle;margin-right:8px}
.sel{display:flex;height:48px;border:1px solid currentColor;flex:0 1 380px;min-width:0}
.sel-label{display:flex;align-items:center;padding:0 16px;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;border-right:1px solid currentColor;white-space:nowrap}
.sel-label .dash{display:inline-block;width:20px;border-top:2px dashed var(--pink);margin-right:8px}
.sel select{flex:1;min-width:0;appearance:none;-webkit-appearance:none;background:transparent url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpolyline points='2,5 8,11 14,5' fill='none' stroke='%23F693BF' stroke-width='1.5'/%3E%3C/svg%3E") right 16px center/16px no-repeat;color:inherit;border:0;border-radius:0;font:inherit;font-size:16px;padding:0 44px 0 16px;cursor:pointer}
.sel select option,.sel select optgroup{background:#000;color:var(--pink)}
.actions{display:flex;justify-content:flex-end;align-items:center;gap:8px;flex-wrap:wrap}
.actions .reset{margin-left:16px}
.saved{margin-right:8px}
.cap{padding:8px var(--gut) 0;text-align:right}
.cap a{text-decoration:underline;text-underline-offset:3px}

.sig{padding:var(--sec) var(--gut) 0}
.e{padding:24px 0;border-bottom:1px solid #000}
.e:last-of-type{border-bottom:0}
.e .delta{margin-left:12px;vertical-align:middle}
.e .q{margin-top:8px}
.levels{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:16px}
.levels .ctl{width:100%}
.conc{margin-top:8px;display:inline-flex;gap:8px;align-items:center;min-height:44px;padding:0;background:none;border:0;color:inherit;font-family:inherit;cursor:pointer}
.car{width:16px;height:16px;transition:transform .15s ease}
.car.up{transform:rotate(180deg)}
.descs{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:8px}
.descs .lvn{display:none}

.note{padding:var(--sec) var(--gut) 0}
.foot{margin-top:var(--sec);border-top:1px solid #000;padding:24px var(--gut) 32px;display:flex;justify-content:space-between;align-items:center;gap:24px}
.foot-links{display:flex;gap:32px}

@media (max-width: 1399px){
  .nav{display:none}
  .menu-btn{display:inline-flex}
}
@media (max-width: 1023px){
  .tool{display:flex;flex-direction:column;align-items:stretch}
  .chart{order:1}
  .bar{display:contents}
  .key{order:2;margin-top:16px}
  .read{order:3;margin-top:32px}
  .actions{order:4;margin-top:24px;justify-content:flex-start}
  .saved{order:3;flex-basis:100%;margin:8px 0 0;min-height:16px}
}
@media (max-width: 879px){
  :root{--gut:16px;--sec:40px}
  .hdr{padding:16px var(--gut)}
  .title{font-size:32px}
  .h2{font-size:20px}
  .menu-link{font-size:28px}
  .key{flex-direction:column;align-items:stretch;gap:16px}
  .sel{flex:none}
  .levels{grid-template-columns:1fr 1fr}
  .descs{grid-template-columns:1fr;gap:16px}
  .descs .lvn{display:block;font-weight:700;margin-bottom:4px}
  .foot{flex-direction:column-reverse;align-items:stretch;padding-top:0}
  .foot-links{flex-direction:column;gap:0}
  .foot-links .tl{min-height:56px;border-bottom:1px solid #000}
  .foot .d{padding-top:24px}
}
`;
