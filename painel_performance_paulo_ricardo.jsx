import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Droplet, Flame, Footprints, Zap, TrendingUp, CheckCircle2, Circle,
  Plus, Minus, Wifi, CalendarDays, X, RotateCcw, ChevronDown, ChevronUp, Lock
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from "recharts";

/* ============================= DADOS DO PLANO ============================= */

const TARGETS = {
  kcal: 2200,
  protein: 170,
  carb: 245,
  fat: 60,
};

const MACRO_RATIO = { protein: 0.31, carb: 0.44, fat: 0.25 };

const WATER_TARGET_BASE = 3000;
const WATER_TARGET_TRAINING = 3500;
const WATER_STEP = 250;

const RUN_WEEKLY_GOAL = 3;
const START_WEIGHT = 85;

const MEALS = [
  {
    id: "breakfast",
    label: "Café da Manhã",
    time: "07:00 – 08:00",
    unlock: "07:00",
    kcal: 450,
    options: [
      "3 ovos mexidos + 1 fatia de pão integral + 1 fruta + café sem açúcar",
      "Aveia (3 col. sopa) com leite desnatado + banana + pasta de amendoim (1 col. sopa)",
      "Tapioca (2 col. sopa de goma) com ovo e queijo branco + 1 fruta",
      "Panqueca fit (2 ovos + banana + aveia) + café sem açúcar",
      "Iogurte natural integral + aveia (2 col. sopa) + fruta picada",
    ],
  },
  {
    id: "morningSnack",
    label: "Lanche da Manhã",
    time: "10:00 – 10:30",
    unlock: "10:00",
    kcal: 150,
    options: [
      "Iogurte natural desnatado + canela",
      "1 fruta + castanhas/amêndoas (punhado pequeno)",
      "1 fatia de queijo branco + 2 torradas integrais",
      "1 fruta + 1 fatia de peito de peru",
    ],
  },
  {
    id: "lunch",
    label: "Almoço",
    time: "12:00 – 13:00",
    unlock: "12:00",
    kcal: 600,
    options: [
      "Arroz (4 col. sopa) + feijão (2 col. sopa) + frango grelhado (150g) + salada + azeite",
      "Patinho grelhado (150g) + batata-doce (120g) + legumes salteados",
      "Filé de peixe assado (150g) + arroz integral (4 col. sopa) + brócolis e cenoura",
      "Carne moída magra (150g) + purê de mandioquinha + salada verde",
      "Frango desfiado (150g) + quinoa (4 col. sopa) + legumes grelhados",
    ],
  },
  {
    id: "postWorkout",
    label: "Pós-treino / Lanche da Tarde",
    time: "16:30 – 17:30",
    unlock: "16:30",
    kcal: 300,
    options: [
      "1 scoop de whey protein + 1 banana pequena",
      "Sanduíche natural (pão integral + frango desfiado + folhas verdes)",
      "Vitamina de frutas com leite desnatado",
      "Ovos cozidos (2 unid.) + 1 fruta",
    ],
  },
  {
    id: "dinner",
    label: "Jantar",
    time: "19:30 – 20:30",
    unlock: "19:30",
    kcal: 550,
    options: [
      "Filé de frango grelhado (150g) + arroz integral (3 col. sopa) + legumes assados",
      "Omelete de 3 ovos com espinafre e queijo branco + salada + batata-doce (80g)",
      "Carne magra grelhada (150g) + purê de batata-doce + legumes no vapor",
      "Filé de peixe grelhado (150g) + legumes salteados + salada verde",
      "Sopa proteica de frango desfiado com legumes + torrada integral",
    ],
  },
  {
    id: "supper",
    label: "Ceia (opcional)",
    time: "22:00 – 22:30",
    unlock: "22:00",
    kcal: 150,
    options: [
      "Iogurte natural integral + canela",
      "Meio scoop de whey protein diluído em água",
      "Chá de camomila ou erva-cidreira sem açúcar",
    ],
  },
];

/* ============================= HELPERS ============================= */

const todayStr = () => new Date().toISOString().slice(0, 10);

const fmtShort = (iso) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}`;
};

const emptyDay = () => ({
  meals: {},
  water: 0,
  whey: { post: false, ceia: false },
});

async function storageGet(key, fallback, shared = false) {
  try {
    const res = await window.storage.get(key, shared);
    if (!res) return fallback;
    return JSON.parse(res.value);
  } catch {
    return fallback;
  }
}
async function storageSet(key, value, shared = false) {
  try {
    await window.storage.set(key, JSON.stringify(value), shared);
    return true;
  } catch {
    return false;
  }
}

/* ============================= COMPONENTE ============================= */

export default function PerformanceApp() {
  const [ready, setReady] = useState(false);
  const [date] = useState(todayStr());
  const [day, setDay] = useState(emptyDay());
  const [activeDays, setActiveDays] = useState([]);
  const [weightLog, setWeightLog] = useState([]);
  const [runsLog, setRunsLog] = useState([]);
  const [openMeal, setOpenMeal] = useState(null);
  const [customMeal, setCustomMeal] = useState(null);
  const [customDraft, setCustomDraft] = useState({ desc: "", kcal: "" });
  const [showRunForm, setShowRunForm] = useState(false);
  const [showWeightForm, setShowWeightForm] = useState(false);
  const [runDraft, setRunDraft] = useState({ duration: "", distance: "" });
  const [weightDraft, setWeightDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [now, setNow] = useState(new Date());

  /* -------- relógio (reavalia horários liberados a cada minuto) -------- */
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  const isUnlocked = useCallback((meal) => {
    const [h, m] = meal.unlock.split(":").map(Number);
    const unlockTime = new Date(now);
    unlockTime.setHours(h, m, 0, 0);
    return now >= unlockTime;
  }, [now]);

  const timeUntil = (meal) => {
    const [h, m] = meal.unlock.split(":").map(Number);
    const unlockTime = new Date(now);
    unlockTime.setHours(h, m, 0, 0);
    const diffMs = unlockTime - now;
    const diffMin = Math.round(diffMs / 60000);
    if (diffMin >= 60) {
      const hrs = Math.floor(diffMin / 60);
      const mins = diffMin % 60;
      return `libera em ${hrs}h${mins ? ` ${mins}min` : ""}`;
    }
    return `libera em ${diffMin} min`;
  };

  /* -------- carregar dados -------- */
  useEffect(() => {
    (async () => {
      const [d, active, wlog, rlog] = await Promise.all([
        storageGet(`day:${todayStr()}`, emptyDay()),
        storageGet("active-days", []),
        storageGet("weight-log", []),
        storageGet("runs-log", []),
      ]);
      setDay(d);
      setActiveDays(active);
      setWeightLog(wlog);
      setRunsLog(rlog);
      setReady(true);
    })();
  }, []);

  /* -------- persistir dia -------- */
  const persistDay = useCallback(async (nextDay) => {
    setDay(nextDay);
    setSaving(true);
    const anyDone = Object.values(nextDay.meals).some((m) => m?.done);
    setActiveDays((prevActive) => {
      const set = new Set(prevActive);
      if (anyDone) set.add(date);
      else set.delete(date);
      const arr = Array.from(set);
      storageSet("active-days", arr);
      return arr;
    });
    await storageSet(`day:${date}`, nextDay);
    setSaving(false);
  }, [date]);

  /* -------- ações refeições -------- */
  const selectOption = (meal, idx) => {
    if (!isUnlocked(meal)) return;
    const next = {
      ...day,
      meals: { ...day.meals, [meal.id]: { option: idx, done: true } },
    };
    persistDay(next);
    setOpenMeal(null);
  };

  const undoMeal = (mealId) => {
    const nextMeals = { ...day.meals };
    delete nextMeals[mealId];
    persistDay({ ...day, meals: nextMeals });
  };

  const saveCustomFood = (meal) => {
    const kcalVal = Number(customDraft.kcal);
    if (!customDraft.desc.trim() || !kcalVal || kcalVal <= 0) return;
    const next = {
      ...day,
      meals: {
        ...day.meals,
        [meal.id]: { custom: true, desc: customDraft.desc.trim(), kcal: kcalVal, done: true },
      },
    };
    persistDay(next);
    setCustomMeal(null);
    setCustomDraft({ desc: "", kcal: "" });
    setOpenMeal(null);
  };

  /* -------- água -------- */
  const trainedToday = runsLog.some((r) => r.date === date);
  const waterTarget = trainedToday ? WATER_TARGET_TRAINING : WATER_TARGET_BASE;

  const addWater = (delta) => {
    const next = Math.max(0, Math.min(waterTarget + 1000, day.water + delta));
    persistDay({ ...day, water: next });
  };

  /* -------- whey -------- */
  const toggleWhey = (key) => {
    persistDay({ ...day, whey: { ...day.whey, [key]: !day.whey[key] } });
  };

  /* -------- corrida -------- */
  const saveRun = async () => {
    const entry = {
      date,
      duration: runDraft.duration ? Number(runDraft.duration) : null,
      distance: runDraft.distance ? Number(runDraft.distance) : null,
    };
    const next = [...runsLog.filter((r) => r.date !== date), entry].sort((a, b) =>
      a.date < b.date ? 1 : -1
    );
    setRunsLog(next);
    await storageSet("runs-log", next);
    setShowRunForm(false);
    setRunDraft({ duration: "", distance: "" });
  };

  const removeRun = async (idx) => {
    const next = runsLog.filter((_, i) => i !== idx);
    setRunsLog(next);
    await storageSet("runs-log", next);
  };

  /* -------- peso -------- */
  const saveWeight = async () => {
    const kg = Number(weightDraft);
    if (!kg || kg <= 0) return;
    const next = [...weightLog.filter((w) => w.date !== date), { date, kg }].sort((a, b) =>
      a.date < b.date ? -1 : 1
    );
    setWeightLog(next);
    await storageSet("weight-log", next);
    setShowWeightForm(false);
    setWeightDraft("");
  };

  /* -------- reset -------- */
  const resetToday = () => {
    if (window.confirm("Limpar todos os dados de hoje (refeições, água, whey)?")) {
      persistDay(emptyDay());
    }
  };

  /* ============================= CÁLCULOS ============================= */

  const doneMeals = MEALS.filter((m) => day.meals[m.id]?.done).map((m) => {
    const state = day.meals[m.id];
    const kcal = state?.custom ? state.kcal : m.kcal;
    return { ...m, kcal };
  });
  const kcalConsumed = doneMeals.reduce((s, m) => s + m.kcal, 0);
  const macrosConsumed = doneMeals.reduce(
    (acc, m) => {
      acc.protein += (m.kcal * MACRO_RATIO.protein) / 4;
      acc.carb += (m.kcal * MACRO_RATIO.carb) / 4;
      acc.fat += (m.kcal * MACRO_RATIO.fat) / 9;
      return acc;
    },
    { protein: 0, carb: 0, fat: 0 }
  );

  const kcalPct = Math.min(100, Math.round((kcalConsumed / TARGETS.kcal) * 100));
  const waterPct = Math.min(100, Math.round((day.water / waterTarget) * 100));

  const streak = useMemo(() => {
    const set = new Set(activeDays);
    let count = 0;
    let cursor = new Date();
    // se hoje ainda não tem progresso, streak conta a partir de ontem
    if (!set.has(todayStr())) cursor.setDate(cursor.getDate() - 1);
    while (true) {
      const iso = cursor.toISOString().slice(0, 10);
      if (set.has(iso)) {
        count += 1;
        cursor.setDate(cursor.getDate() - 1);
      } else break;
    }
    return count;
  }, [activeDays]);

  const weekRuns = useMemo(() => {
    const now = new Date();
    const day0 = now.getDay(); // 0 = domingo
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((day0 + 6) % 7));
    monday.setHours(0, 0, 0, 0);
    return runsLog.filter((r) => new Date(r.date + "T00:00:00") >= monday);
  }, [runsLog]);

  const currentWeight = weightLog.length ? weightLog[weightLog.length - 1].kg : START_WEIGHT;
  const weightDelta = (currentWeight - START_WEIGHT).toFixed(1);

  const chartData = useMemo(() => {
    const base = [{ date: "início", kg: START_WEIGHT }];
    return base.concat(weightLog.map((w) => ({ date: fmtShort(w.date), kg: w.kg })));
  }, [weightLog]);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Bom dia";
    if (h < 18) return "Boa tarde";
    return "Boa noite";
  })();

  if (!ready) {
    return (
      <div className="pr-app pr-loading">
        <style>{CSS}</style>
        <div className="pr-spinner" />
        <span>Carregando painel…</span>
      </div>
    );
  }

  return (
    <div className="pr-app">
      <style>{CSS}</style>

      {/* HEADER */}
      <div className="pr-header">
        <div>
          <div className="pr-eyebrow">PAINEL DE PERFORMANCE</div>
          <h1>{greeting}, Paulo Ricardo</h1>
          <div className="pr-date">
            <CalendarDays size={14} />
            {new Date().toLocaleDateString("pt-BR", {
              weekday: "long",
              day: "2-digit",
              month: "long",
            })}
          </div>
        </div>
        <div className="pr-streak">
          <Wifi size={18} className="pr-streak-icon" />
          <div>
            <div className="pr-streak-num">{streak}</div>
            <div className="pr-streak-label">dias seguidos</div>
          </div>
        </div>
      </div>

      {/* TOP GRID: RING + STATS */}
      <div className="pr-top-grid">
        <div className="pr-card pr-ring-card">
          <div className="pr-radar">
            <svg viewBox="0 0 200 200" className="pr-radar-svg">
              <circle cx="100" cy="100" r="90" className="pr-radar-ring" />
              <circle cx="100" cy="100" r="65" className="pr-radar-ring" />
              <circle cx="100" cy="100" r="40" className="pr-radar-ring" />
              <g className="pr-radar-sweep-group">
                <path d="M100 100 L100 10 A90 90 0 0 1 172 60 Z" className="pr-radar-sweep" />
              </g>
              <circle
                cx="100" cy="100" r="90"
                className="pr-radar-progress"
                style={{
                  strokeDasharray: `${(kcalPct / 100) * 565.5} 565.5`,
                }}
              />
            </svg>
            <div className="pr-radar-center">
              <div className="pr-radar-num">{kcalConsumed}</div>
              <div className="pr-radar-den">/ {TARGETS.kcal} kcal</div>
            </div>
          </div>
          <div className="pr-macro-bars">
            <MacroBar label="P" value={macrosConsumed.protein} target={TARGETS.protein} color="var(--c-protein)" />
            <MacroBar label="C" value={macrosConsumed.carb} target={TARGETS.carb} color="var(--c-carb)" />
            <MacroBar label="G" value={macrosConsumed.fat} target={TARGETS.fat} color="var(--c-fat)" />
          </div>
        </div>

        <div className="pr-stats-col">
          <div className="pr-card pr-stat">
            <div className="pr-stat-icon" style={{ background: "rgba(56,189,248,0.15)", color: "var(--c-cyan)" }}>
              <TrendingUp size={16} />
            </div>
            <div>
              <div className="pr-stat-num">{currentWeight} kg</div>
              <div className="pr-stat-label">
                {weightDelta > 0 ? "+" : ""}{weightDelta} kg desde o início
              </div>
            </div>
          </div>
          <div className="pr-card pr-stat">
            <div className="pr-stat-icon" style={{ background: "rgba(251,146,60,0.15)", color: "var(--c-amber)" }}>
              <Footprints size={16} />
            </div>
            <div>
              <div className="pr-stat-num">{weekRuns.length} / {RUN_WEEKLY_GOAL}</div>
              <div className="pr-stat-label">corridas essa semana</div>
            </div>
          </div>
          <div className="pr-card pr-stat">
            <div className="pr-stat-icon" style={{ background: "rgba(45,212,191,0.15)", color: "var(--c-teal)" }}>
              <Droplet size={16} />
            </div>
            <div>
              <div className="pr-stat-num">{(day.water / 1000).toFixed(2)} L</div>
              <div className="pr-stat-label">de {(waterTarget / 1000).toFixed(1)} L hoje</div>
            </div>
          </div>
        </div>
      </div>

      {/* GRID PRINCIPAL */}
      <div className="pr-main-grid">
        {/* COLUNA REFEIÇÕES */}
        <div className="pr-col">
          <SectionTitle text="Checklist de Refeições" />
          {MEALS.map((meal) => {
            const state = day.meals[meal.id];
            const open = openMeal === meal.id;
            const unlocked = isUnlocked(meal);
            const showingCustomForm = customMeal === meal.id;
            const chosenText = state?.done
              ? state.custom
                ? `${state.desc} · ${state.kcal} kcal (registrado por você)`
                : meal.options[state.option]
              : null;
            return (
              <div className={`pr-meal ${state?.done ? "is-done" : ""} ${!unlocked && !state?.done ? "is-locked" : ""}`} key={meal.id}>
                <button
                  className="pr-meal-head"
                  onClick={() => setOpenMeal(open ? null : meal.id)}
                >
                  <div className="pr-meal-check">
                    {state?.done ? (
                      <CheckCircle2 size={19} className="pr-check-on" />
                    ) : unlocked ? (
                      <Circle size={19} className="pr-check-off" />
                    ) : (
                      <Lock size={16} className="pr-check-locked" />
                    )}
                  </div>
                  <div className="pr-meal-info">
                    <div className="pr-meal-label">{meal.label}</div>
                    <div className="pr-meal-time">
                      {meal.time} · ~{meal.kcal} kcal
                      {!unlocked && !state?.done && (
                        <span className="pr-lock-badge">{timeUntil(meal)}</span>
                      )}
                    </div>
                    {chosenText && <div className="pr-meal-chosen">{chosenText}</div>}
                  </div>
                  {open ? <ChevronUp size={16} className="pr-chev" /> : <ChevronDown size={16} className="pr-chev" />}
                </button>
                {open && (
                  <div className="pr-meal-body">
                    {!unlocked && !state?.done ? (
                      <div className="pr-locked-notice">
                        <Lock size={13} /> Essa refeição libera às {meal.unlock} — {timeUntil(meal)}.
                      </div>
                    ) : (
                      <>
                        {meal.options.map((opt, idx) => (
                          <button
                            key={idx}
                            className={`pr-option ${state?.option === idx && state?.done && !state?.custom ? "is-selected" : ""}`}
                            onClick={() => selectOption(meal, idx)}
                          >
                            <span className="pr-option-tag">OPÇÃO {idx + 1}</span>
                            {opt}
                          </button>
                        ))}

                        {!showingCustomForm ? (
                          <button
                            className={`pr-option pr-option-custom ${state?.custom ? "is-selected" : ""}`}
                            onClick={() => { setCustomMeal(meal.id); setCustomDraft({ desc: state?.custom ? state.desc : "", kcal: state?.custom ? String(state.kcal) : "" }); }}
                          >
                            <span className="pr-option-tag pr-option-tag-alt">OUTRO</span>
                            Comi outra coisa — registrar manualmente
                          </button>
                        ) : (
                          <div className="pr-inline-form">
                            <input
                              type="text" placeholder="O que você comeu?"
                              value={customDraft.desc}
                              onChange={(e) => setCustomDraft({ ...customDraft, desc: e.target.value })}
                            />
                            <input
                              type="number" placeholder="Calorias aproximadas (kcal)"
                              value={customDraft.kcal}
                              onChange={(e) => setCustomDraft({ ...customDraft, kcal: e.target.value })}
                            />
                            <div className="pr-inline-actions">
                              <button className="pr-btn-primary" onClick={() => saveCustomFood(meal)}>Salvar</button>
                              <button className="pr-btn-ghost" onClick={() => setCustomMeal(null)}>Cancelar</button>
                            </div>
                          </div>
                        )}

                        {state?.done && (
                          <button className="pr-undo" onClick={() => undoMeal(meal.id)}>
                            <X size={13} /> Desmarcar refeição
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* COLUNA WIDGETS */}
        <div className="pr-col">
          <SectionTitle text="Água" />
          <div className="pr-card">
            <div className="pr-water-row">
              <button className="pr-round-btn" onClick={() => addWater(-WATER_STEP)}>
                <Minus size={16} />
              </button>
              <div className="pr-water-mid">
                <div className="pr-water-num">{(day.water / 1000).toFixed(2)} L</div>
                <div className="pr-progress-bar">
                  <div className="pr-progress-fill" style={{ width: `${waterPct}%`, background: "var(--c-cyan)" }} />
                </div>
                <div className="pr-water-sub">
                  Meta {trainedToday ? "de treino" : "padrão"}: {(waterTarget / 1000).toFixed(1)} L
                </div>
              </div>
              <button className="pr-round-btn" onClick={() => addWater(WATER_STEP)}>
                <Plus size={16} />
              </button>
            </div>
          </div>

          <SectionTitle text="Suplementação" />
          <div className="pr-card pr-whey-card">
            <div className="pr-whey-note">Whey Protein · 1 scoop (≈25-30g) diluído em água ou leite desnatado</div>
            <label className="pr-checkline">
              <input type="checkbox" checked={day.whey.post} onChange={() => toggleWhey("post")} />
              <span>Tomei o whey pós-treino</span>
            </label>
            <label className="pr-checkline">
              <input type="checkbox" checked={day.whey.ceia} onChange={() => toggleWhey("ceia")} />
              <span>Tomei meio scoop na ceia (opcional)</span>
            </label>
          </div>

          <SectionTitle text="Corridas" />
          <div className="pr-card">
            <div className="pr-progress-bar" style={{ marginBottom: 10 }}>
              <div
                className="pr-progress-fill"
                style={{ width: `${Math.min(100, (weekRuns.length / RUN_WEEKLY_GOAL) * 100)}%`, background: "var(--c-amber)" }}
              />
            </div>
            <div className="pr-run-list">
              {runsLog.slice(0, 5).map((r, idx) => (
                <div className="pr-run-item" key={idx}>
                  <Footprints size={14} className="pr-run-icon" />
                  <span className="pr-run-date">{fmtShort(r.date)}</span>
                  <span className="pr-run-detail">
                    {r.duration ? `${r.duration} min` : ""}{r.duration && r.distance ? " · " : ""}{r.distance ? `${r.distance} km` : ""}
                    {!r.duration && !r.distance ? "registrada" : ""}
                  </span>
                  <button className="pr-run-remove" onClick={() => removeRun(idx)}><X size={12} /></button>
                </div>
              ))}
              {!runsLog.length && <div className="pr-empty">Nenhuma corrida registrada ainda.</div>}
            </div>

            {!showRunForm ? (
              <button className="pr-btn-outline" onClick={() => setShowRunForm(true)}>
                <Plus size={14} /> Registrar corrida de hoje
              </button>
            ) : (
              <div className="pr-inline-form">
                <input
                  type="number" placeholder="Duração (min)" value={runDraft.duration}
                  onChange={(e) => setRunDraft({ ...runDraft, duration: e.target.value })}
                />
                <input
                  type="number" placeholder="Distância (km)" value={runDraft.distance}
                  onChange={(e) => setRunDraft({ ...runDraft, distance: e.target.value })}
                />
                <div className="pr-inline-actions">
                  <button className="pr-btn-primary" onClick={saveRun}>Salvar</button>
                  <button className="pr-btn-ghost" onClick={() => setShowRunForm(false)}>Cancelar</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* PESO */}
      <SectionTitle text="Evolução de Peso" />
      <div className="pr-card">
        <div className="pr-weight-top">
          <div>
            <div className="pr-weight-num">{currentWeight} kg</div>
            <div className="pr-weight-sub">Início: {START_WEIGHT} kg · Variação: {weightDelta > 0 ? "+" : ""}{weightDelta} kg</div>
          </div>
          {!showWeightForm ? (
            <button className="pr-btn-outline" onClick={() => setShowWeightForm(true)}>
              <Plus size={14} /> Registrar peso de hoje
            </button>
          ) : (
            <div className="pr-inline-form pr-inline-form-row">
              <input
                type="number" placeholder="Peso (kg)" value={weightDraft}
                onChange={(e) => setWeightDraft(e.target.value)}
              />
              <button className="pr-btn-primary" onClick={saveWeight}>Salvar</button>
              <button className="pr-btn-ghost" onClick={() => setShowWeightForm(false)}>Cancelar</button>
            </div>
          )}
        </div>
        <div className="pr-chart-wrap">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
              <YAxis domain={["dataMin - 2", "dataMax + 2"]} tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--text)" }} />
              <ReferenceLine y={START_WEIGHT} stroke="var(--text-muted)" strokeDasharray="4 4" />
              <Line type="monotone" dataKey="kg" stroke="var(--c-cyan)" strokeWidth={2.5} dot={{ r: 3, fill: "var(--c-cyan)" }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="pr-footer">
        <span>{saving ? "Salvando…" : "Dados salvos automaticamente neste dispositivo"}</span>
        <button className="pr-reset" onClick={resetToday}><RotateCcw size={12} /> Limpar hoje</button>
      </div>
    </div>
  );
}

/* ============================= SUBCOMPONENTES ============================= */

function SectionTitle({ text }) {
  return (
    <div className="pr-section-title">
      <span className="pr-dot" />
      <h2>{text}</h2>
    </div>
  );
}

function MacroBar({ label, value, target, color }) {
  const pct = Math.min(100, Math.round((value / target) * 100));
  return (
    <div className="pr-macro-item">
      <div className="pr-macro-top">
        <span className="pr-macro-label" style={{ color }}>{label}</span>
        <span className="pr-macro-val">{Math.round(value)}/{target}g</span>
      </div>
      <div className="pr-progress-bar sm">
        <div className="pr-progress-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

/* ============================= CSS ============================= */

const CSS = `
.pr-app {
  --bg: #0a0f1a;
  --surface: #121a2c;
  --surface-2: #182238;
  --border: #223049;
  --text: #e6edf7;
  --text-muted: #8291ab;
  --c-cyan: #38bdf8;
  --c-amber: #fb923c;
  --c-teal: #2dd4bf;
  --c-protein: #60a5fa;
  --c-carb: #fb923c;
  --c-fat: #f472b6;
  --c-green: #34d399;

  background: var(--bg);
  color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  padding: 22px;
  border-radius: 16px;
  max-width: 980px;
  margin: 0 auto;
  box-sizing: border-box;
}
.pr-app * { box-sizing: border-box; }

.pr-loading {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 12px; min-height: 300px; color: var(--text-muted); font-size: 13px;
}
.pr-spinner {
  width: 28px; height: 28px; border-radius: 50%;
  border: 3px solid var(--border); border-top-color: var(--c-cyan);
  animation: pr-spin 0.8s linear infinite;
}
@keyframes pr-spin { to { transform: rotate(360deg); } }

.pr-header {
  display: flex; justify-content: space-between; align-items: flex-start;
  margin-bottom: 20px; flex-wrap: wrap; gap: 14px;
}
.pr-eyebrow {
  font-size: 10px; letter-spacing: 2px; color: var(--c-cyan); font-weight: 700; margin-bottom: 6px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
.pr-header h1 { font-size: 22px; font-weight: 700; margin: 0 0 6px 0; }
.pr-date {
  display: flex; align-items: center; gap: 6px; color: var(--text-muted); font-size: 12.5px; text-transform: capitalize;
}
.pr-streak {
  display: flex; align-items: center; gap: 10px;
  background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 10px 16px;
}
.pr-streak-icon { color: var(--c-green); }
.pr-streak-num { font-size: 18px; font-weight: 700; font-family: ui-monospace, monospace; line-height: 1; }
.pr-streak-label { font-size: 9.5px; color: var(--text-muted); text-transform: uppercase; letter-spacing: .5px; margin-top: 2px; }

.pr-card {
  background: var(--surface); border: 1px solid var(--border); border-radius: 14px;
  padding: 16px; margin-bottom: 12px;
}

.pr-top-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 8px; }
@media (max-width: 640px) { .pr-top-grid { grid-template-columns: 1fr; } }

.pr-ring-card { display: flex; align-items: center; gap: 18px; }
.pr-radar { position: relative; width: 130px; height: 130px; flex-shrink: 0; }
.pr-radar-svg { width: 100%; height: 100%; transform: rotate(-90deg); }
.pr-radar-ring { fill: none; stroke: var(--border); stroke-width: 1; }
.pr-radar-progress {
  fill: none; stroke: var(--c-cyan); stroke-width: 6; stroke-linecap: round;
  transition: stroke-dasharray 0.5s ease;
}
.pr-radar-sweep { fill: var(--c-cyan); opacity: 0.06; transform-origin: 100px 100px; animation: pr-sweep 4s linear infinite; }
@keyframes pr-sweep { to { transform: rotate(360deg); } }
.pr-radar-center {
  position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;
}
.pr-radar-num { font-size: 22px; font-weight: 700; font-family: ui-monospace, monospace; }
.pr-radar-den { font-size: 10.5px; color: var(--text-muted); }
.pr-macro-bars { flex: 1; display: flex; flex-direction: column; gap: 10px; }
.pr-macro-top { display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 4px; }
.pr-macro-label { font-weight: 700; }
.pr-macro-val { color: var(--text-muted); font-family: ui-monospace, monospace; }

.pr-progress-bar { height: 8px; background: var(--surface-2); border-radius: 6px; overflow: hidden; }
.pr-progress-bar.sm { height: 6px; }
.pr-progress-fill { height: 100%; border-radius: 6px; transition: width 0.4s ease; }

.pr-stats-col { display: flex; flex-direction: column; gap: 10px; }
.pr-stat { display: flex; align-items: center; gap: 12px; margin-bottom: 0; flex: 1; }
.pr-stat-icon { width: 34px; height: 34px; border-radius: 9px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.pr-stat-num { font-size: 16px; font-weight: 700; font-family: ui-monospace, monospace; line-height: 1.2; }
.pr-stat-label { font-size: 10.5px; color: var(--text-muted); }

.pr-main-grid { display: grid; grid-template-columns: 1.3fr 1fr; gap: 20px; }
@media (max-width: 760px) { .pr-main-grid { grid-template-columns: 1fr; } }
.pr-col { display: flex; flex-direction: column; }

.pr-section-title { display: flex; align-items: center; gap: 8px; margin: 6px 0 10px 0; }
.pr-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--c-cyan); }
.pr-section-title h2 { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; color: var(--text); }

.pr-meal { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; margin-bottom: 8px; overflow: hidden; }
.pr-meal.is-done { border-color: rgba(52,211,153,0.4); }
.pr-meal.is-locked { opacity: 0.6; }
.pr-check-locked { color: var(--text-muted); }
.pr-lock-badge {
  display: inline-block; margin-left: 6px; font-size: 9px; color: var(--c-amber);
  background: rgba(251,146,60,0.12); padding: 1px 6px; border-radius: 20px; font-weight: 700;
}
.pr-locked-notice {
  display: flex; align-items: center; gap: 7px; font-size: 12px; color: var(--text-muted);
  background: var(--surface-2); padding: 10px 12px; border-radius: 9px;
}
.pr-option-custom { border-style: dashed; color: var(--text-muted); }
.pr-option-tag-alt { color: var(--c-amber); background: rgba(251,146,60,0.12); }
.pr-meal-head {
  width: 100%; display: flex; align-items: center; gap: 10px; padding: 12px 14px;
  background: transparent; border: none; cursor: pointer; text-align: left; color: var(--text);
}
.pr-check-on { color: var(--c-green); }
.pr-check-off { color: var(--text-muted); }
.pr-meal-info { flex: 1; min-width: 0; }
.pr-meal-label { font-size: 13.5px; font-weight: 700; }
.pr-meal-time { font-size: 10.5px; color: var(--text-muted); margin-top: 1px; }
.pr-meal-chosen { font-size: 11px; color: var(--c-cyan); margin-top: 4px; }
.pr-chev { color: var(--text-muted); flex-shrink: 0; }
.pr-meal-body { padding: 4px 14px 14px 14px; display: flex; flex-direction: column; gap: 6px; }
.pr-option {
  text-align: left; background: var(--surface-2); border: 1px solid var(--border); border-radius: 9px;
  padding: 9px 12px; font-size: 12px; color: var(--text); cursor: pointer; display: flex; gap: 8px; align-items: flex-start;
}
.pr-option.is-selected { border-color: var(--c-cyan); background: rgba(56,189,248,0.08); }
.pr-option-tag {
  font-size: 8.5px; font-weight: 700; color: var(--c-cyan); background: rgba(56,189,248,0.12);
  padding: 2px 6px; border-radius: 4px; white-space: nowrap; flex-shrink: 0; margin-top: 1px;
}
.pr-undo {
  align-self: flex-start; display: flex; align-items: center; gap: 5px; background: none; border: none;
  color: var(--text-muted); font-size: 11px; cursor: pointer; padding: 4px 2px;
}

.pr-water-row { display: flex; align-items: center; gap: 14px; }
.pr-round-btn {
  width: 34px; height: 34px; border-radius: 50%; border: 1px solid var(--border); background: var(--surface-2);
  color: var(--text); display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0;
}
.pr-water-mid { flex: 1; }
.pr-water-num { font-size: 17px; font-weight: 700; font-family: ui-monospace, monospace; margin-bottom: 6px; }
.pr-water-sub { font-size: 10.5px; color: var(--text-muted); margin-top: 5px; }

.pr-whey-card { display: flex; flex-direction: column; gap: 10px; }
.pr-whey-note { font-size: 11px; color: var(--text-muted); background: var(--surface-2); padding: 8px 10px; border-radius: 8px; }
.pr-checkline { display: flex; align-items: center; gap: 8px; font-size: 12.5px; cursor: pointer; }
.pr-checkline input { width: 15px; height: 15px; accent-color: var(--c-cyan); }

.pr-run-list { display: flex; flex-direction: column; gap: 6px; margin-bottom: 10px; }
.pr-run-item { display: flex; align-items: center; gap: 8px; font-size: 12px; background: var(--surface-2); padding: 7px 10px; border-radius: 8px; }
.pr-run-icon { color: var(--c-amber); flex-shrink: 0; }
.pr-run-date { font-family: ui-monospace, monospace; color: var(--text-muted); flex-shrink: 0; }
.pr-run-detail { flex: 1; color: var(--text); }
.pr-run-remove { background: none; border: none; color: var(--text-muted); cursor: pointer; }
.pr-empty { font-size: 11.5px; color: var(--text-muted); padding: 6px 0; }

.pr-btn-outline {
  display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%;
  background: transparent; border: 1px dashed var(--border); color: var(--c-cyan);
  padding: 9px; border-radius: 9px; font-size: 12px; cursor: pointer; font-weight: 600;
}
.pr-inline-form { display: flex; flex-direction: column; gap: 8px; }
.pr-inline-form-row { flex-direction: row; align-items: center; }
.pr-inline-form input {
  background: var(--surface-2); border: 1px solid var(--border); border-radius: 8px; padding: 8px 10px;
  color: var(--text); font-size: 12.5px; width: 100%;
}
.pr-inline-actions { display: flex; gap: 8px; }
.pr-btn-primary {
  background: var(--c-cyan); color: #06202f; border: none; padding: 8px 14px; border-radius: 8px;
  font-size: 12.5px; font-weight: 700; cursor: pointer;
}
.pr-btn-ghost { background: none; border: none; color: var(--text-muted); font-size: 12.5px; cursor: pointer; }

.pr-weight-top { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 8px; }
.pr-weight-num { font-size: 22px; font-weight: 700; font-family: ui-monospace, monospace; }
.pr-weight-sub { font-size: 11px; color: var(--text-muted); margin-top: 2px; }
.pr-chart-wrap { margin-top: 6px; }

.pr-footer {
  display: flex; justify-content: space-between; align-items: center; margin-top: 8px;
  font-size: 10.5px; color: var(--text-muted); padding-top: 10px; border-top: 1px dashed var(--border);
}
.pr-reset { display: flex; align-items: center; gap: 5px; background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 10.5px; }
`;
