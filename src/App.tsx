import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

// ---- types ----
type WaveType = "sine" | "square" | "saw" | "triangle";
type NoteName =
  | "C" | "C#" | "Db" | "D" | "D#" | "Eb" | "E"
  | "F" | "F#" | "Gb" | "G" | "G#" | "Ab" | "A" | "A#" | "Bb" | "B";

const N = 2048;

// ---- audio / wavetable ----
// Band-limited waveforms using additive synthesis to avoid aliasing
const MAX_HARMONICS = 48; // Limit harmonics for clean sound

function makeWavetable(type: WaveType, n: number): number[] {
  const out = new Array<number>(n).fill(0);

  for (let i = 0; i < n; i++) {
    const t = i / n;
    const phase = 2 * Math.PI * t;
    let v = 0;

    switch (type) {
      case "sine":
        v = Math.sin(phase);
        break;

      case "square":
        // Band-limited square: sum of odd harmonics (1, 3, 5, ...)
        // square(t) = (4/π) * Σ sin((2k-1)ωt) / (2k-1)
        for (let k = 1; k <= MAX_HARMONICS; k += 2) {
          v += Math.sin(k * phase) / k;
        }
        v *= 4 / Math.PI;
        break;

      case "saw":
        // Band-limited saw: sum of all harmonics with alternating sign
        // saw(t) = (2/π) * Σ (-1)^(k+1) * sin(kωt) / k
        for (let k = 1; k <= MAX_HARMONICS; k++) {
          v += Math.pow(-1, k + 1) * Math.sin(k * phase) / k;
        }
        v *= 2 / Math.PI;
        break;

      case "triangle":
        // Band-limited triangle: sum of odd harmonics with alternating sign
        // triangle(t) = (8/π²) * Σ (-1)^((k-1)/2) * sin(kωt) / k²
        for (let k = 1; k <= MAX_HARMONICS; k += 2) {
          const sign = Math.pow(-1, (k - 1) / 2);
          v += sign * Math.sin(k * phase) / (k * k);
        }
        v *= 8 / (Math.PI * Math.PI);
        break;
    }
    out[i] = v;
  }

  // Normalize to [-1, 1]
  let maxAbs = 0;
  for (const sample of out) {
    maxAbs = Math.max(maxAbs, Math.abs(sample));
  }
  if (maxAbs > 0) {
    for (let i = 0; i < n; i++) {
      out[i] /= maxAbs;
    }
  }

  return out;
}

async function setWavetable(samples: number[]) {
  await invoke("set_wavetable", { samples });
}
async function setChord(freqs: number[]) {
  await invoke("set_chord", { freqs });
}
async function allNotesOff() {
  await invoke("all_notes_off");
}
async function setMasterGain(gain: number) {
  await invoke("set_master_gain", { gain });
}

// ---- pitch ----
function freqFromA4(refA4Hz: number, semitoneFromA4: number): number {
  return refA4Hz * Math.pow(2, semitoneFromA4 / 12);
}
function semitoneFromA4OfNote4(note: NoteName): number {
  const map: Record<NoteName, number> = {
    "A": 0, "A#": 1, "Bb": 1,
    "B": 2,
    "C": 3,
    "C#": 4, "Db": 4,
    "D": 5,
    "D#": 6, "Eb": 6,
    "E": 7,
    "F": 8,
    "F#": 9, "Gb": 9,
    "G": 10,
    "G#": 11, "Ab": 11,
  };
  return map[note];
}
function intervalToSemitones(interval: string): number | null {
  const m = interval.trim().match(/^([b#]*)(\d+)$/);
  if (!m) return null;

  const acc = m[1];
  const deg = Number(m[2]);

  const base: Record<number, number> = {
    1: 0, 2: 2, 3: 4, 4: 5, 5: 7, 6: 9, 7: 11,
    8: 12, 9: 14, 10: 16, 11: 17, 12: 19, 13: 21,
  };
  if (!(deg in base)) return null;

  let delta = 0;
  for (const c of acc) {
    if (c === "b") delta -= 1;
    if (c === "#") delta += 1;
  }
  return base[deg] + delta;
}

// ---- UI data ----
const NOTE_OPTIONS: NoteName[] = [
  "C", "C#", "Db", "D", "D#", "Eb", "E", "F", "F#", "Gb", "G", "G#", "Ab", "A", "A#", "Bb", "B"
];

const INTERVAL_CHOICES = [
  "1", "b2", "2", "#2",
  "b3", "3",
  "4", "#4",
  "b5", "5", "#5",
  "b6", "6",
  "bb7", "b7", "7",
  "8",
  "b9", "9", "#9",
  "11", "#11",
  "b13", "13",
] as const;
type IntervalChoice = typeof INTERVAL_CHOICES[number];

const WAVE_ICONS: Record<WaveType, React.ReactNode> = {
  sine: (
    <svg viewBox="0 0 32 16" className="w-8 h-4">
      <path d="M0 8 Q8 0, 16 8 T32 8" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  ),
  square: (
    <svg viewBox="0 0 32 16" className="w-8 h-4">
      <path d="M0 12 L0 4 L16 4 L16 12 L32 12" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  ),
  saw: (
    <svg viewBox="0 0 32 16" className="w-8 h-4">
      <path d="M0 12 L16 4 L16 12 L32 4" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  ),
  triangle: (
    <svg viewBox="0 0 32 16" className="w-8 h-4">
      <path d="M0 12 L8 4 L24 12 L32 4" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  ),
};

function cn(...xs: Array<string | false | undefined>) {
  return xs.filter(Boolean).join(" ");
}

// ---- Components ----
function Card({ title, children, accent = "cyan" }: {
  title: string;
  children: React.ReactNode;
  accent?: "cyan" | "magenta" | "purple";
}) {
  const accentColors = {
    cyan: "from-cyan-400/20 via-transparent",
    magenta: "from-pink-500/20 via-transparent",
    purple: "from-purple-500/20 via-transparent",
  };

  return (
    <section className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#12121a]">
      {/* Top gradient accent */}
      <div className={cn(
        "absolute inset-x-0 top-0 h-px bg-gradient-to-r to-transparent",
        accentColors[accent]
      )} />

      <div className="p-5">
        <h3 className="mb-4 text-xs font-medium uppercase tracking-[0.2em] text-white/40">
          {title}
        </h3>
        {children}
      </div>
    </section>
  );
}

function WaveButton({ wave, active, onClick }: {
  wave: WaveType;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative flex flex-col items-center gap-2 rounded-xl border p-4 transition-all duration-200",
        active
          ? "border-cyan-400 bg-cyan-400/20 text-cyan-400 shadow-[0_0_20px_rgba(0,255,242,0.3)]"
          : "border-white/[0.08] bg-white/[0.02] text-white/40 hover:border-white/20 hover:bg-white/[0.04] hover:text-white/60"
      )}
    >
      {WAVE_ICONS[wave]}
      <span className="text-[10px] font-medium uppercase tracking-wider">{wave}</span>
      {active && (
        <>
          <div className="absolute -inset-px rounded-xl bg-cyan-400/10 blur-md" />
          <div className="absolute -top-px left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-cyan-400" />
        </>
      )}
    </button>
  );
}

function IntervalButton({ interval, active, onClick }: {
  interval: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative flex items-center justify-center rounded-lg border-2 px-3 py-2.5 font-['JetBrains_Mono'] text-sm font-medium transition-all duration-200",
        active
          ? "border-emerald-400 bg-emerald-400 text-black shadow-[0_0_20px_rgba(52,211,153,0.5)]"
          : "border-white/10 bg-white/[0.03] text-white/40 hover:border-white/25 hover:bg-white/[0.06] hover:text-white/70"
      )}
    >
      <span className="relative z-10">{interval}</span>
      {active && (
        <div className="absolute -inset-1 rounded-xl bg-emerald-400/30 blur-md" />
      )}
    </button>
  );
}

function PresetButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-full border border-white/[0.08] bg-white/[0.02] px-4 py-1.5 text-xs font-medium text-white/50 transition-all hover:border-purple-400/30 hover:bg-purple-400/10 hover:text-purple-400"
    >
      {label}
    </button>
  );
}

// ---- Main App ----
export default function App() {
  const [wave, setWave] = useState<WaveType>("sine");
  const [refA4, setRefA4] = useState(440.0);
  const [root, setRoot] = useState<NoteName>("A");
  const [gain, setGain] = useState(0.2);

  const [selected, setSelected] = useState<Set<IntervalChoice>>(
    () => new Set<IntervalChoice>(["1", "3", "5"])
  );
  const [playing, setPlaying] = useState(false);

  const table = useMemo(() => makeWavetable(wave, N), [wave]);
  useEffect(() => { setWavetable(table).catch(console.error); }, [table]);
  useEffect(() => { setMasterGain(gain).catch(console.error); }, [gain]);

  const freqs = useMemo(() => {
    const semitoneRoot = semitoneFromA4OfNote4(root);
    const rootFreq = freqFromA4(refA4, semitoneRoot);

    const semis: number[] = [];
    for (const it of selected) {
      const s = intervalToSemitones(it);
      if (s != null) semis.push(s);
    }
    const raw = semis.map((s) => rootFreq * Math.pow(2, s / 12)).sort((a, b) => a - b);

    const uniq: number[] = [];
    const eps = 0.05;
    for (const f of raw) {
      if (uniq.length === 0 || Math.abs(uniq[uniq.length - 1] - f) > eps) uniq.push(f);
    }
    return uniq;
  }, [selected, root, refA4]);

  const play = async () => {
    setPlaying(true);
    await setChord(freqs);
  };
  const stop = async () => {
    setPlaying(false);
    await allNotesOff();
  };

  useEffect(() => {
    if (playing) setChord(freqs).catch(console.error);
  }, [playing, freqs]);

  // Space toggle
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat) {
        e.preventDefault();
        if (playing) {
          stop().catch(console.error);
        } else {
          play().catch(console.error);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [playing, freqs]);

  const toggle = (it: IntervalChoice) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(it)) next.delete(it);
      else next.add(it);
      return next;
    });
  };

  const setPreset = (name: "maj" | "min" | "dom7" | "maj7" | "sus4") => {
    const next = new Set<IntervalChoice>();
    next.add("1");
    if (name === "maj") { next.add("3"); next.add("5"); }
    if (name === "min") { next.add("b3"); next.add("5"); }
    if (name === "dom7") { next.add("3"); next.add("5"); next.add("b7"); }
    if (name === "maj7") { next.add("3"); next.add("5"); next.add("7"); }
    if (name === "sus4") { next.add("4"); next.add("5"); }
    setSelected(next);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0a0a0f]">
      {/* Background effects */}
      <div className="pointer-events-none fixed inset-0">
        {/* Gradient orbs */}
        <div className="absolute -left-32 -top-32 h-[500px] w-[500px] rounded-full bg-cyan-500/10 blur-[120px]" />
        <div className="absolute -right-32 top-1/3 h-[400px] w-[400px] rounded-full bg-pink-500/10 blur-[120px]" />
        <div className="absolute -bottom-32 left-1/3 h-[500px] w-[500px] rounded-full bg-purple-500/8 blur-[120px]" />

        {/* Grid pattern */}
        <div className="absolute inset-0 grid-pattern opacity-50" />

        {/* Noise texture */}
        <div className="noise absolute inset-0" />
      </div>

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-5xl p-6">
        {/* Header */}
        <header className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Logo */}
            <div className={cn(
              "relative flex h-12 w-12 items-center justify-center rounded-xl",
              "bg-gradient-to-br from-cyan-400 via-purple-500 to-pink-500",
              playing && "pulse-playing"
            )}>
              <svg viewBox="0 0 24 24" className="h-6 w-6 text-white" fill="currentColor">
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
              </svg>
              {playing && (
                <div className="absolute -inset-1 rounded-xl bg-gradient-to-br from-cyan-400 via-purple-500 to-pink-500 opacity-50 blur-lg" />
              )}
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-white">p5-tuner</h1>
              <p className="text-xs text-white/40">Wavetable Chord Synthesizer</p>
            </div>
          </div>

          {/* Play button */}
          <div className="flex items-center gap-4">
            <div className="hidden items-center gap-2 text-xs text-white/40 sm:flex">
              <kbd className="rounded-md border border-white/10 bg-white/5 px-2 py-1 font-['JetBrains_Mono'] text-[10px]">
                SPACE
              </kbd>
              <span>to toggle</span>
            </div>

            <button
              onClick={playing ? stop : play}
              className={cn(
                "relative overflow-hidden rounded-xl px-6 py-3 text-sm font-semibold transition-all duration-300",
                playing
                  ? "bg-gradient-to-r from-pink-500 to-rose-500 text-white glow-magenta"
                  : "bg-gradient-to-r from-cyan-400 to-cyan-500 text-black glow-cyan hover:from-cyan-300 hover:to-cyan-400"
              )}
            >
              <span className="relative z-10">{playing ? "■ Stop" : "▶ Play"}</span>
            </button>
          </div>
        </header>

        {/* Main grid */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Waveform Card */}
          <Card title="Oscillator" accent="cyan">
            {/* Current selection indicator */}
            <div className="mb-4 flex items-center gap-3 rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-4 py-2">
              <span className="text-cyan-400">{WAVE_ICONS[wave]}</span>
              <span className="font-['JetBrains_Mono'] text-sm font-medium uppercase text-cyan-400">
                {wave}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {(["sine", "square", "saw", "triangle"] as WaveType[]).map((w) => (
                <WaveButton key={w} wave={w} active={wave === w} onClick={() => setWave(w)} />
              ))}
            </div>
            <p className="mt-3 text-[10px] text-white/30">
              Square and Saw may have aliasing artifacts
            </p>
          </Card>

          {/* Tuning Card */}
          <Card title="Tuning" accent="purple">
            <div className="space-y-4">
              {/* A4 Reference */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs text-white/50">A4 Reference</span>
                  <span className="font-['JetBrains_Mono'] text-sm text-cyan-400">
                    {refA4.toFixed(1)} Hz
                  </span>
                </div>
                <input
                  type="range"
                  min={430}
                  max={450}
                  step={0.1}
                  value={refA4}
                  onChange={(e) => setRefA4(Number(e.target.value))}
                  className="w-full"
                />
                <div className="mt-2 flex gap-2">
                  {[440, 441, 442].map((v) => (
                    <button
                      key={v}
                      onClick={() => setRefA4(v)}
                      className={cn(
                        "rounded-md border px-3 py-1 text-xs transition-all",
                        refA4 === v
                          ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-400"
                          : "border-white/[0.08] text-white/40 hover:border-white/20"
                      )}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              {/* Root Note */}
              <div>
                <span className="mb-2 block text-xs text-white/50">Root Note</span>
                <select
                  value={root}
                  onChange={(e) => setRoot(e.target.value as NoteName)}
                  className="w-full appearance-none rounded-lg border border-white/[0.08] bg-white/[0.02] px-4 py-2.5 text-sm text-white outline-none transition-all focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/20"
                >
                  {NOTE_OPTIONS.map((n) => (
                    <option key={n} value={n} className="bg-[#12121a]">{n}</option>
                  ))}
                </select>
              </div>
            </div>
          </Card>

          {/* Master Gain */}
          <Card title="Output" accent="magenta">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs text-white/50">Master Gain</span>
              <span className="font-['JetBrains_Mono'] text-sm text-pink-400">
                {(gain * 100).toFixed(0)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={gain}
              onChange={(e) => setGain(Number(e.target.value))}
              className="w-full"
            />
            {/* VU Meter style indicator */}
            <div className="mt-4 flex h-2 gap-0.5 overflow-hidden rounded-full">
              {Array.from({ length: 20 }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex-1 transition-all duration-100",
                    i / 20 <= gain
                      ? i < 14 ? "bg-cyan-400" : i < 18 ? "bg-yellow-400" : "bg-pink-500"
                      : "bg-white/10"
                  )}
                />
              ))}
            </div>
          </Card>

          {/* Status */}
          <Card title="Status" accent="cyan">
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border border-white/[0.05] bg-white/[0.02] p-3">
                <span className="text-[10px] uppercase tracking-wider text-white/40">State</span>
                <div className={cn(
                  "mt-1 flex items-center gap-2 font-['JetBrains_Mono'] text-sm",
                  playing ? "text-cyan-400" : "text-white/50"
                )}>
                  <span className={cn(
                    "h-2 w-2 rounded-full",
                    playing ? "animate-pulse bg-cyan-400" : "bg-white/30"
                  )} />
                  {playing ? "PLAYING" : "IDLE"}
                </div>
              </div>
              <div className="rounded-lg border border-white/[0.05] bg-white/[0.02] p-3">
                <span className="text-[10px] uppercase tracking-wider text-white/40">Voices</span>
                <div className="mt-1 font-['JetBrains_Mono'] text-sm text-purple-400">
                  {freqs.length} note{freqs.length !== 1 && "s"}
                </div>
              </div>
            </div>
            {/* Frequency display */}
            <div className="mt-3 rounded-lg border border-white/[0.05] bg-black/30 p-3">
              <span className="text-[10px] uppercase tracking-wider text-white/40">Frequencies</span>
              <div className="mt-1 font-['JetBrains_Mono'] text-xs text-white/60">
                {freqs.length === 0
                  ? "—"
                  : freqs.map((f) => f.toFixed(1) + " Hz").join(" · ")}
              </div>
            </div>
          </Card>
        </div>

        {/* Intervals Card - Full Width */}
        <div className="mt-4">
          <Card title="Chord Builder" accent="purple">
            {/* Current selection summary */}
            <div className="mb-4 rounded-xl border-2 border-emerald-400/50 bg-emerald-400/10 p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                  Selected Intervals
                </span>
                <span className="rounded-full bg-emerald-400/20 px-3 py-1 font-['JetBrains_Mono'] text-xs font-semibold text-emerald-400">
                  {selected.size} note{selected.size !== 1 && "s"}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {selected.size === 0 ? (
                  <span className="text-sm text-white/40">No intervals selected</span>
                ) : (
                  Array.from(selected)
                    .sort((a, b) => {
                      const semA = intervalToSemitones(a) ?? 0;
                      const semB = intervalToSemitones(b) ?? 0;
                      return semA - semB;
                    })
                    .map((it) => (
                      <span
                        key={it}
                        className="rounded-md bg-emerald-400 px-3 py-1 font-['JetBrains_Mono'] text-sm font-bold text-black"
                      >
                        {it}
                      </span>
                    ))
                )}
              </div>
            </div>

            {/* Presets */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="mr-2 text-[10px] uppercase tracking-wider text-white/30">Presets</span>
              {(["maj", "min", "dom7", "maj7", "sus4"] as const).map((p) => (
                <PresetButton
                  key={p}
                  label={p === "dom7" ? "7" : p}
                  onClick={() => setPreset(p)}
                />
              ))}
              <button
                onClick={() => setSelected(new Set())}
                className="ml-auto rounded-full border border-white/[0.08] bg-white/[0.02] px-4 py-1.5 text-xs font-medium text-white/30 transition-all hover:border-rose-400/30 hover:bg-rose-400/10 hover:text-rose-400"
              >
                Clear
              </button>
            </div>

            {/* Interval Grid */}
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12">
              {INTERVAL_CHOICES.map((it) => (
                <IntervalButton
                  key={it}
                  interval={it}
                  active={selected.has(it)}
                  onClick={() => toggle(it)}
                />
              ))}
            </div>
          </Card>
        </div>

        {/* Footer */}
        <footer className="mt-6 flex items-center justify-between border-t border-white/[0.05] pt-4 text-[10px] text-white/30">
          <div className="flex items-center gap-4">
            <span>Built with Tauri + React</span>
          </div>
          <div className="font-['JetBrains_Mono']">
            {root} · A4={refA4.toFixed(1)} · {wave}
          </div>
        </footer>
      </div>
    </div>
  );
}
