import React, { useState, useMemo } from "react";
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
    color: "#E5FF3D",
    advice: "This is what an AI-ready team looks like. Keep reassessing periodically, gaps can creep back in.",
  };
}

export default function App() {
  const [scores, setScores] = useState({
    standards: 2,
    feedback: 2,
    reviews: 2,
    ownership: 2,
    context: 2,
  });
  const [compareArchetype, setCompareArchetype] = useState(null);
  const [expanded, setExpanded] = useState(null);

  const chartData = useMemo(
    () =>
      SIGNALS.map((s) => ({
        signal: s.short.toUpperCase(),
        You: scores[s.key],
        ...(compareArchetype ? { [compareArchetype]: ARCHETYPES.find((a) => a.name === compareArchetype).scores[s.key] } : {}),
      })),
    [scores, compareArchetype]
  );

  const avg = average(scores);
  const weak = weakestSignal(scores);
  const band = overallBand(avg);
  const allHigh = Object.values(scores).every((v) => v >= 3);

  return (
    <div style={{ minHeight: "100vh", background: "#000000", color: "#F693BF", fontFamily: "Arial, Helvetica, sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Bungee&family=IBM+Plex+Mono:wght@400;500;600&display=swap'); * { box-sizing: border-box; } .mono { font-family: 'IBM Plex Mono', monospace; } .header-font { font-family: 'Bungee', system-ui, sans-serif; } .band-btn { transition: all 0.15s ease; cursor: pointer; } .band-btn:hover { transform: translateY(-1px); } ::selection { background: #E5FF3D; color: #000000; }`}</style>

      {/* Hero */}
      <header style={{ padding: "56px 24px 32px", maxWidth: 1040, margin: "0 auto", position: "relative" }}>
        <div className="mono" style={{ fontSize: 12, letterSpacing: "0.12em", color: "#F693BF", marginBottom: 16, textTransform: "uppercase" }}>
          Callum Akehurst-Ryan · Engineering diagnostics
        </div>
        <h1 className="header-font" style={{ fontSize: "clamp(28px, 4.4vw, 46px)", fontWeight: 400, lineHeight: 1.15, margin: 0, letterSpacing: "-0.01em", color: "#F693BF" }}>
          AI won't fix a dysfunctional team…
          <br />
          <span style={{ color: "#F693BF" }}>it'll expose it</span>
        </h1>
        <p style={{ fontSize: 17, color: "#F693BF", maxWidth: 620, marginTop: 20, lineHeight: 1.6 }}>
          Score your team honestly across five foundational signals before you hand engineers AI agents. Weak
          foundations don't get fixed by faster tooling, they get amplified by it.
        </p>
      </header>

      <main style={{ maxWidth: 1040, margin: "0 auto", padding: "0 24px 80px", display: "grid", gridTemplateColumns: "1fr", gap: 32 }}>
        {/* Chart + summary panel */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 0.9fr)",
            gap: 32,
            background: "#000000",
            border: "1px solid #3A2530",
            borderRadius: 4,
            padding: 32,
          }}
          className="radar-grid"
        >
          <div>
            <div style={{ height: 380 }}>
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
                          fontFamily="Arial, Helvetica, sans-serif"
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
                    tick={{ fill: "#F693BF", fontSize: 10 }}
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
                  {compareArchetype && (
                    <Radar
                      name={compareArchetype}
                      dataKey={compareArchetype}
                      stroke="#E8A0B8"
                      fill="#E8A0B8"
                      fillOpacity={0.08}
                      strokeWidth={1.5}
                      strokeDasharray="4 3"
                      dot={{ r: 2, fill: "#E8A0B8" }}
                    />
                  )}
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
              <span className="mono" style={{ fontSize: 11, color: "#F693BF", alignSelf: "center", marginRight: 4 }}>
                Compare to:
              </span>
              {ARCHETYPES.map((a) => (
                <button
                  key={a.name}
                  onClick={() => setCompareArchetype(compareArchetype === a.name ? null : a.name)}
                  className="mono band-btn"
                  style={{
                    fontSize: 11,
                    padding: "5px 10px",
                    borderRadius: 3,
                    border: `1px solid ${compareArchetype === a.name ? "#E5FF3D" : "#3A2530"}`,
                    background: compareArchetype === a.name ? "rgba(229,255,61,0.12)" : "transparent",
                    color: compareArchetype === a.name ? "#E5FF3D" : "#F693BF",
                    textTransform: "uppercase",
                  }}
                >
                  {a.name}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", borderLeft: "1px solid #3A2530", paddingLeft: 32 }}>
            <div className="mono" style={{ fontSize: 11, color: "#F693BF", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Overall reading
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginTop: 6 }}>
              <div style={{ fontSize: 40, fontWeight: 700, color: allHigh ? "#E5FF3D" : band.color }}>
                {avg.toFixed(1)}
                <span style={{ fontSize: 18, color: "#F693BF", fontWeight: 500 }}> / 4</span>
              </div>
              <div
                className="mono"
                style={{
                  fontSize: 12,
                  color: band.color,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  border: `1px solid ${band.color}`,
                  borderRadius: 3,
                  padding: "3px 8px",
                }}
              >
                {band.label}
              </div>
            </div>
            <p style={{ fontSize: 14, color: "#F693BF", marginTop: 12, lineHeight: 1.6 }}>
              {band.advice}
            </p>
            <div style={{ marginTop: 20, padding: 16, background: "#000000", border: "1px solid #3A2530", borderRadius: 3 }}>
              <div className="mono" style={{ fontSize: 10, color: "#E5FF3D", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Weakest signal
              </div>
              <div style={{ fontSize: 16, fontWeight: 600, marginTop: 6, color: "#F693BF", textTransform: "uppercase", letterSpacing: "0.02em" }}>{weak.short}</div>
              <div className="mono" style={{ fontSize: 11, color: "#F693BF", marginTop: 4 }}>
                {BAND_SHORT[scores[weak.key] - 1]} · this is the one to sort first
              </div>
            </div>
          </div>
        </section>

        {/* Signal scoring */}
        <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="mono" style={{ fontSize: 12, color: "#F693BF", textTransform: "uppercase", letterSpacing: "0.1em" }}>
            Score each signal
          </div>
          {SIGNALS.map((s) => (
            <div
              key={s.key}
              style={{
                background: "#000000",
                border: "1px solid #3A2530",
                borderRadius: 4,
                padding: 24,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 600, margin: 0, color: "#F693BF", textTransform: "uppercase", letterSpacing: "0.02em" }}>{s.short}</h3>
                  <p style={{ fontSize: 14, color: "#F693BF", margin: "6px 0 0", maxWidth: 520, lineHeight: 1.5 }}>{s.question}</p>
                </div>
                <div className="mono" style={{ fontSize: 13, color: "#E5FF3D", whiteSpace: "nowrap" }}>
                  {BAND_SHORT[scores[s.key] - 1]}
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
                        borderRadius: 3,
                        border: `1px solid ${active ? "#E5FF3D" : "#3A2530"}`,
                        background: active ? "rgba(229,255,61,0.1)" : "#000000",
                        color: active ? "#E5FF3D" : "#F693BF",
                      }}
                    >
                      <div className="mono" style={{ fontSize: 11 }}>{val}</div>
                      <div style={{ fontSize: 10, marginTop: 3, opacity: 0.85 }}>{label}</div>
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
                  fontSize: 12,
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                {expanded === s.key ? "Hide band descriptions ↑" : "Show band descriptions ↓"}
              </button>

              {expanded === s.key && (
                <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                  {s.bands.map((bandText, i) => (
                    <div key={i} style={{ display: "flex", gap: 10, fontSize: 13, color: "#F693BF", lineHeight: 1.5 }}>
                      <span className="mono" style={{ color: "#F693BF", flexShrink: 0 }}>{i + 1} · {BAND_LABELS[i]}</span>
                      <span>{bandText}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </section>

        {/* Footer note */}
        <footer style={{ borderTop: "1px solid #3A2530", paddingTop: 24, marginTop: 8 }}>
          <p style={{ fontSize: 13, color: "#F693BF", lineHeight: 1.6, maxWidth: 640 }}>
            This radar sits underneath frameworks like DORA, TMMi, or Team Topologies… it's a conversation tool, not
            a replacement for them. It tells you if your foundations can take the pace, not whether the AI you've
            added is actually working. Run it as a team exercise: score individually, plot together, and go with
            the lowest score where you disagree.
          </p>
          <p className="mono" style={{ fontSize: 11, color: "#F693BF", marginTop: 16 }}>
            Framework by Callum Akehurst-Ryan · cakehurstryan.com
          </p>
        </footer>
      </main>

      <style>{`
        @media (max-width: 760px) {
          .radar-grid { grid-template-columns: 1fr !important; }
          .radar-grid > div:last-child { border-left: none !important; padding-left: 0 !important; border-top: 1px solid #3A2530; padding-top: 24px; margin-top: 8px; }
        }
      `}</style>
    </div>
  );
}
