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
      "The whole team shares enough domain and market knowledge to make deliberate calls on what they're shipping. They can push back on the wrong things and know when something is good enough… they don't need to be told. This is honestly the hardest one to score because teams think they're here until you start asking specific probing questions and then the gaps appear.",
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
  const [scores, setScores] = useState(loadStoredScores);
  const [history, setHistory] = useState(loadStoredHistory);
  const [compareWith, setCompareWith] = useState(null); // { kind: "archetype" | "session", key: string } | null
  const [expanded, setExpanded] = useState(null);
  const [justSaved, setJustSaved] = useState(false);

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
      return a ? { label: a.name, scores: a.scores, color: "#E8A0B8" } : null;
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

  return (
    <div style={{ minHeight: "100vh", background: "#000000", color: "#F693BF", fontFamily: "'Montserrat', system-ui, sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Bungee&family=Montserrat:wght@400;500;600&display=swap'); :root { --fs-display: clamp(28px, 4.4vw, 46px); --fs-stat: 40px; --fs-heading: 18px; --fs-subtitle: 16px; --fs-body: 14px; --fs-label: 11px; --ls-label: 0.08em; --ls-display: -0.01em; } * { box-sizing: border-box; } .mono { font-family: 'Montserrat', system-ui, sans-serif; } .header-font { font-family: 'Bungee', system-ui, sans-serif; } .band-btn { transition: all 0.15s ease; cursor: pointer; } .band-btn:hover { transform: translateY(-1px); } ::selection { background: #F693BF; color: #000000; }`}</style>

      {/* Site header — mirrors cakehurstryan.com */}
      <header style={{ maxWidth: 1040, margin: "0 auto", padding: "20px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <a href="https://cakehurstryan.com/" aria-label="Callum Akehurst-Ryan — home" style={{ display: "inline-flex" }}>
          <img src="/avatar.png" alt="Callum Akehurst-Ryan" width={44} height={44} style={{ borderRadius: "50%", display: "block", border: "1px solid #3A2530" }} />
        </a>
        <nav className="mono" style={{ display: "flex", gap: 22, flexWrap: "wrap", fontSize: "var(--fs-label)", letterSpacing: "var(--ls-label)", textTransform: "uppercase" }}>
          {[["Home", "https://cakehurstryan.com/"], ["About me", "https://cakehurstryan.com/about-me/"], ["Blog posts", "https://cakehurstryan.com/blog-posts/"], ["Talks", "https://cakehurstryan.com/talks/"]].map(([label, href]) => (
            <a key={href} href={href} style={{ color: "#F693BF", textDecoration: "none" }}>{label}</a>
          ))}
        </nav>
      </header>

      {/* Page title + tagline (radar-first: no image band) */}
      <div style={{ maxWidth: 1040, margin: "0 auto", padding: "24px 24px 0" }}>
        <div className="mono" style={{ fontSize: "var(--fs-label)", letterSpacing: "var(--ls-label)", color: "#F693BF", marginBottom: 14, textTransform: "uppercase" }}>
          Engineering diagnostics
        </div>
        <h1 className="header-font" style={{ fontSize: "var(--fs-display)", fontWeight: 400, lineHeight: 1.05, margin: 0, letterSpacing: "var(--ls-display)", color: "#F693BF", textTransform: "uppercase" }}>
          AI Readiness Radar
        </h1>
        <p style={{ fontSize: "var(--fs-subtitle)", fontWeight: 600, color: "#F693BF", margin: "18px 0 0", lineHeight: 1.3, maxWidth: 720 }}>
          AI won't fix a dysfunctional team… it'll expose it
        </p>
        <p style={{ fontSize: "var(--fs-body)", color: "#F693BF", margin: "10px 0 0", maxWidth: 620, lineHeight: 1.6 }}>
          Score your team honestly across five foundational signals before you hand engineers AI agents. Weak
          foundations don't get fixed by faster tooling, they get amplified by it.
        </p>
      </div>

      <main style={{ maxWidth: 1040, margin: "0 auto", padding: "20px 24px 27px", display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
        {/* Chart + summary panel */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 0.9fr)",
            gap: 32,
            background: "#000000",
            border: "1px solid #3A2530",
            borderRadius: 0,
            padding: 24,
          }}
          className="radar-grid"
        >
          <div>
            <div style={{ height: 340 }}>
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={chartData} outerRadius="58%" margin={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <PolarGrid stroke="#F693BF" strokeOpacity={0.35} />
                  <PolarAngleAxis
                    dataKey="signal"
                    tick={(props) => {
                      const { x, y, cx, cy, payload } = props;
                      const dx = x - cx;
                      const dy = y - cy;
                      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                      const offset = 14;
                      const ox = x + (dx / dist) * offset;
                      const oy = y + (dy / dist) * offset;
                      let anchor = "middle";
                      if (dx > 10) anchor = "start";
                      else if (dx < -10) anchor = "end";
                      const value = String(payload.value);
                      const words =
                        value === "CONTEXT & UNDERSTANDING"
                          ? ["CONTEXT &", "UNDERSTANDING"]
                          : value.split(" ");
                      const lineHeight = 13;
                      const startDy = -((words.length - 1) * lineHeight) / 2;
                      return (
                        <text
                          x={ox}
                          y={oy}
                          textAnchor={anchor}
                          dominantBaseline="middle"
                          fill="#F693BF"
                          fontSize={11}
                          fontFamily="'Montserrat', system-ui, sans-serif"
                        >
                          {words.map((word, i) => (
                            <tspan key={i} x={ox} dy={i === 0 ? startDy : lineHeight}>
                              {word}
                            </tspan>
                          ))}
                        </text>
                      );
                    }}
                  />
                  <PolarRadiusAxis
                    angle={90}
                    domain={[0, 4]}
                    tick={{ fill: "#F693BF", fontSize: 11 }}
                    tickCount={5}
                    axisLine={{ stroke: "#F693BF", strokeOpacity: 0.35 }}
                  />
                  <Radar
                    name="You"
                    dataKey="You"
                    stroke="#E5FF3D"
                    fill="#E5FF3D"
                    fillOpacity={0.22}
                    strokeWidth={2}
                    dot={{ r: 3, fill: "#E5FF3D" }}
                  />
                  {compareSeries && (
                    <Radar
                      name={compareSeries.label}
                      dataKey="Compare"
                      stroke={compareSeries.color}
                      fill={compareSeries.color}
                      fillOpacity={0.08}
                      strokeWidth={1.5}
                      strokeDasharray="4 3"
                      dot={{ r: 2, fill: compareSeries.color }}
                    />
                  )}
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div className="compare-row" style={{ display: "flex", gap: 16, marginTop: 8 }}>
              <span className="mono compare-label" style={{ fontSize: "var(--fs-label)", color: "#F693BF", flexShrink: 0, width: 110, paddingTop: 6 }}>
                Compare to:
              </span>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {ARCHETYPES.map((a) => {
                const active = compareWith?.kind === "archetype" && compareWith.key === a.name;
                return (
                  <button
                    key={a.name}
                    onClick={() => setCompareWith(active ? null : { kind: "archetype", key: a.name })}
                    className="mono band-btn"
                    style={{
                      fontSize: "var(--fs-label)",
                      padding: "5px 10px",
                      borderRadius: 0,
                      border: `1px solid ${active ? "#E5FF3D" : "#3A2530"}`,
                      background: active ? "rgba(229,255,61,0.12)" : "transparent",
                      color: active ? "#E5FF3D" : "#F693BF",
                      textTransform: "uppercase",
                    }}
                  >
                    {a.name}
                  </button>
                );
              })}
              </div>
            </div>

            {history.length > 0 ? (
              <div className="compare-row" style={{ display: "flex", gap: 16, marginTop: 8 }}>
                <span className="mono compare-label" style={{ fontSize: "var(--fs-label)", color: "#F693BF", flexShrink: 0, width: 110, paddingTop: 6 }}>
                  Past sessions:
                </span>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                {[...history].reverse().map((h) => {
                  const active = compareWith?.kind === "session" && compareWith.key === h.id;
                  return (
                    <div key={h.id} style={{ display: "flex" }}>
                      <button
                        onClick={() => setCompareWith(active ? null : { kind: "session", key: h.id })}
                        className="mono band-btn"
                        style={{
                          fontSize: "var(--fs-label)",
                          padding: "5px 10px",
                          borderRadius: 0,
                          borderStyle: "solid",
                          borderWidth: "1px 0 1px 1px",
                          borderColor: active ? "#FFFFFF" : "#3A2530",
                          background: active ? "rgba(92,200,255,0.12)" : "transparent",
                          color: active ? "#FFFFFF" : "#F693BF",
                        }}
                      >
                        {formatSessionDate(h.date)} · {average(h.scores).toFixed(1)}
                      </button>
                      <button
                        onClick={() => deleteSession(h.id)}
                        className="mono"
                        title="Delete this session"
                        style={{
                          fontSize: "var(--fs-label)",
                          padding: "5px 8px",
                          borderRadius: 0,
                          border: `1px solid ${active ? "#FFFFFF" : "#3A2530"}`,
                          background: "transparent",
                          color: "#F693BF",
                          cursor: "pointer",
                        }}
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
                <button
                  onClick={clearHistory}
                  className="mono"
                  style={{
                    fontSize: "var(--fs-label)",
                    background: "none",
                    border: "none",
                    color: "#F693BF",
                    cursor: "pointer",
                    textDecoration: "underline",
                    padding: 0,
                    marginLeft: 4,
                  }}
                >
                  Clear history
                </button>
                </div>
              </div>
            ) : (
              <div className="compare-row" style={{ display: "flex", gap: 16, marginTop: 8 }}>
                <span className="mono compare-label" style={{ fontSize: "var(--fs-label)", color: "#F693BF", flexShrink: 0, width: 110, paddingTop: 6 }}>
                  Past sessions:
                </span>
                <div className="mono" style={{ fontSize: "var(--fs-label)", color: "#F693BF", opacity: 0.7, paddingTop: 6 }}>
                  Save your first session to start tracking trends over time.
                </div>
              </div>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", borderLeft: "1px solid #3A2530", paddingLeft: 32 }}>
            <div className="mono" style={{ fontSize: "var(--fs-label)", color: "#F693BF", textTransform: "uppercase", letterSpacing: "var(--ls-label)" }}>
              Overall reading
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginTop: 6 }}>
              <div style={{ fontSize: "var(--fs-stat)", fontWeight: 700, color: band.color }}>
                {avg.toFixed(1)}
                <span style={{ fontSize: "var(--fs-heading)", color: "#F693BF", fontWeight: 500 }}> / 4</span>
              </div>
              <div
                className="mono"
                style={{
                  fontSize: "var(--fs-label)",
                  color: band.color,
                  textTransform: "uppercase",
                  letterSpacing: "var(--ls-label)",
                  border: `1px solid ${band.color}`,
                  borderRadius: 0,
                  padding: "3px 8px",
                }}
              >
                {band.label}
              </div>
            </div>
            {lastSession && (
              <div
                className="mono"
                style={{ fontSize: "var(--fs-label)", color: overallTrend > 0 ? "#E5FF3D" : "#F693BF", opacity: overallTrend === 0 ? 0.6 : 1, marginTop: 8 }}
              >
                {overallTrend > 0 ? "▲" : overallTrend < 0 ? "▼" : "–"} {Math.abs(overallTrend).toFixed(1)} vs last session ({formatSessionDate(lastSession.date)})
              </div>
            )}
            <p style={{ fontSize: "var(--fs-body)", color: "#F693BF", marginTop: 12, lineHeight: 1.6 }}>
              {band.advice}
            </p>
            <div style={{ marginTop: 20, padding: 16, background: "#000000", border: "1px solid #3A2530", borderRadius: 3 }}>
              <div className="mono" style={{ fontSize: "var(--fs-label)", color: "#F693BF", textTransform: "uppercase", letterSpacing: "var(--ls-label)" }}>
                Weakest signal
              </div>
              {allMax ? (
                <>
                  <div style={{ fontSize: "var(--fs-heading)", fontWeight: 600, marginTop: 6, color: "#F693BF", textTransform: "uppercase", letterSpacing: "var(--ls-label)" }}>N/A</div>
                  <div className="mono" style={{ fontSize: "var(--fs-label)", color: "#F693BF", marginTop: 4 }}>
                    Every signal is at maximum · nothing to sort first
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: "var(--fs-heading)", fontWeight: 600, marginTop: 6, color: "#F693BF", textTransform: "uppercase", letterSpacing: "var(--ls-label)" }}>{weak.short}</div>
                  <div className="mono" style={{ fontSize: "var(--fs-label)", color: "#F693BF", marginTop: 4 }}>
                    {BAND_SHORT[scores[weak.key] - 1]} · this is the one to sort first
                  </div>
                </>
              )}
            </div>
          </div>
        </section>

        {/* Signal scoring */}
        <section id="score" style={{ display: "flex", flexDirection: "column", gap: 16, scrollMarginTop: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <div style={{ fontSize: "var(--fs-heading)", fontWeight: 600, color: "#F693BF", textTransform: "uppercase", letterSpacing: "var(--ls-label)" }}>
              Score each signal
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span
                className="mono"
                style={{ fontSize: "var(--fs-label)", color: "#E5FF3D", opacity: justSaved ? 1 : 0, transition: "opacity 0.3s ease" }}
              >
                Saved in this browser
              </span>
              <button
                onClick={saveSession}
                className="mono"
                style={{
                  fontSize: "var(--fs-label)",
                  padding: "5px 10px",
                  borderRadius: 0,
                  border: "1px solid #F693BF",
                  background: "#F693BF",
                  color: "#000000",
                  cursor: "pointer",
                  textTransform: "uppercase",
                }}
              >
                Save session
              </button>
              <button
                onClick={resetScores}
                className="mono"
                style={{
                  fontSize: "var(--fs-label)",
                  padding: "5px 10px",
                  borderRadius: 0,
                  border: "1px solid #3A2530",
                  background: "transparent",
                  color: "#F693BF",
                  cursor: "pointer",
                  textTransform: "uppercase",
                }}
              >
                Reset scores
              </button>
            </div>
          </div>
          {SIGNALS.map((s) => (
            <div
              key={s.key}
              style={{
                background: "#000000",
                border: "1px solid #3A2530",
                borderRadius: 0,
                padding: 24,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
                <div>
                  <h3 style={{ fontSize: "var(--fs-heading)", fontWeight: 600, margin: 0, color: "#F693BF", textTransform: "uppercase", letterSpacing: "var(--ls-label)" }}>{s.short}</h3>
                  <p style={{ fontSize: "var(--fs-body)", color: "#F693BF", margin: "6px 0 0", maxWidth: 520, lineHeight: 1.5 }}>{s.question}</p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {lastSession && (
                    <div
                      className="mono"
                      title={`vs last session (${formatSessionDate(lastSession.date)})`}
                      style={{
                        fontSize: "var(--fs-label)",
                        color: scores[s.key] > lastSession.scores[s.key] ? "#E5FF3D" : "#F693BF",
                        opacity: scores[s.key] === lastSession.scores[s.key] ? 0.5 : 1,
                      }}
                    >
                      {scores[s.key] > lastSession.scores[s.key] ? "▲" : scores[s.key] < lastSession.scores[s.key] ? "▼" : "–"}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginTop: 18 }}>
                {BAND_SHORT.map((label, i) => {
                  const val = i + 1;
                  const active = scores[s.key] === val;
                  return (
                    <button
                      key={val}
                      onClick={() => setScores((prev) => ({ ...prev, [s.key]: val }))}
                      className="band-btn"
                      style={{
                        padding: "10px 8px",
                        borderRadius: 0,
                        border: `1px solid ${active ? "#E5FF3D" : "#3A2530"}`,
                        background: active ? "rgba(229,255,61,0.1)" : "#000000",
                        color: active ? "#E5FF3D" : "#F693BF",
                      }}
                    >
                      <div className="mono" style={{ fontSize: "var(--fs-label)", fontWeight: 600 }}>{val}</div>
                      <div className="mono" style={{ fontSize: "var(--fs-label)", marginTop: 3, opacity: 0.85, textTransform: "uppercase", letterSpacing: "var(--ls-label)" }}>{label}</div>
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => setExpanded(expanded === s.key ? null : s.key)}
                className="mono"
                style={{
                  marginTop: 12,
                  background: "none",
                  border: "none",
                  color: "#F693BF",
                  fontSize: "var(--fs-label)",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                {expanded === s.key ? "Hide band descriptions ↑" : "Show band descriptions ↓"}
              </button>

              {expanded === s.key && (
                <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                  {s.bands.map((bandText, i) => (
                    <div key={i} className="band-desc-row" style={{ display: "flex", gap: 16, fontSize: "var(--fs-body)", color: "#F693BF", lineHeight: 1.5 }}>
                      <span style={{ color: "#F693BF", flexShrink: 0, width: 230, fontWeight: 600 }}>{i + 1} · {BAND_LABELS[i]}</span>
                      <span>{bandText}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </section>

        {/* Positioning note */}
        <div style={{ marginTop: 11 }}>
          <p style={{ fontSize: "var(--fs-body)", color: "#F693BF", lineHeight: 1.6, maxWidth: 720, margin: 0 }}>
            This radar sits underneath frameworks like DORA, TMMi, or Team Topologies… it's a conversation tool, not
            a replacement for them. It tells you if your foundations can take the pace, not whether the AI you've
            added is actually working. Run it as a team exercise: score individually, plot together, and go with the
            lowest score where you disagree.
          </p>
        </div>
      </main>

      {/* Site footer — mirrors cakehurstryan.com */}
      <footer style={{ borderTop: "1px solid #3A2530", marginTop: 8 }}>
        <div className="footer-grid" style={{ maxWidth: 1040, margin: "0 auto", padding: "40px 24px 56px", display: "grid", gridTemplateColumns: "1.5fr 0.8fr 0.8fr", gap: 24 }}>
          <div>
            <div style={{ color: "#F693BF", fontSize: 16, fontWeight: 600, textTransform: "uppercase" }}>
              Callum Akehurst-Ryan
            </div>
            <p style={{ fontSize: "var(--fs-body)", color: "#F693BF", lineHeight: 1.6, marginTop: 14, maxWidth: 460 }}>
              Staff Quality Engineer writing and speaking about testing, quality engineering and AI readiness.
            </p>
            <p style={{ fontSize: "var(--fs-body)", color: "#F693BF", fontStyle: "italic", marginTop: 16 }}>
              © Callum Akehurst-Ryan 2026
            </p>
          </div>
          <div style={{ border: "1px solid #F693BF", padding: 12 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#F693BF", textTransform: "uppercase", marginBottom: 12, textAlign: "right" }}>
              Pages
            </div>
            {[["Home", "https://cakehurstryan.com/"], ["About me", "https://cakehurstryan.com/about-me/"], ["Blog posts", "https://cakehurstryan.com/blog-posts/"], ["Talks", "https://cakehurstryan.com/talks/"]].map(([label, href]) => (
              <a key={href} href={href} className="mono" style={{ display: "block", fontSize: "var(--fs-label)", color: "#F693BF", textTransform: "uppercase", letterSpacing: "var(--ls-label)", textDecoration: "none", padding: "5px 0" }}>
                {label}
              </a>
            ))}
          </div>
          <div style={{ border: "1px solid #F693BF", padding: 12 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#F693BF", textTransform: "uppercase", marginBottom: 12, textAlign: "right" }}>
              Connect
            </div>
            <a href="https://www.linkedin.com/in/cakehurstryan/" className="mono" style={{ display: "block", fontSize: "var(--fs-label)", color: "#F693BF", textTransform: "uppercase", letterSpacing: "var(--ls-label)", textDecoration: "none", padding: "5px 0" }}>
              LinkedIn
            </a>
            <a href="mailto:cal@coada.org.uk" className="mono" style={{ display: "block", fontSize: "var(--fs-label)", color: "#F693BF", textTransform: "uppercase", letterSpacing: "var(--ls-label)", textDecoration: "none", padding: "5px 0" }}>
              Email
            </a>
          </div>
        </div>
      </footer>

      <style>{`
        @media (max-width: 760px) {
          .radar-grid { grid-template-columns: 1fr !important; }
          .radar-grid > div:last-child { border-left: none !important; padding-left: 0 !important; border-top: 1px solid #3A2530; padding-top: 24px; margin-top: 8px; }
          .band-desc-row { flex-direction: column !important; gap: 2px !important; }
          .band-desc-row > span:first-child { width: auto !important; }
          .compare-row { flex-direction: column !important; gap: 6px !important; }
          .compare-label { width: auto !important; padding-top: 0 !important; }
          .footer-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
