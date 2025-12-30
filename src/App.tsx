import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

// ---- types ----
type WaveType = "sine" | "square" | "saw" | "triangle";
type NoteName =
  | "C" | "C#" | "Db" | "D" | "D#" | "Eb" | "E"
  | "F" | "F#" | "Gb" | "G" | "G#" | "Ab" | "A" | "A#" | "Bb" | "B";

const N = 2048;

// ---- audio / wavetable ----
function makeWavetable(type: WaveType, n: number): number[] {
  const out = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const phase = 2 * Math.PI * t;
    let v = 0;
    switch (type) {
      case "sine": v = Math.sin(phase); break;
      case "square": v = t < 0.5 ? 1 : -1; break;
      case "saw": v = 2 * t - 1; break;
      case "triangle": v = t < 0.5 ? (4 * t - 1) : (-4 * t + 3); break;
    }
    out[i] = v;
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
    "A": 0,  "A#": 1, "Bb": 1,
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
  "C","C#","Db","D","D#","Eb","E","F","F#","Gb","G","G#","Ab","A","A#","Bb","B"
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

function cn(...xs: Array<string | false | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function Card(props: { title: string; desc: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.35)] backdrop-blur">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">{props.title}</div>
          <div className="mt-0.5 text-xs text-white/60">{props.desc}</div>
        </div>
        {props.right}
      </div>
      {props.children}
    </section>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="max-w-[55%] truncate rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
      {children}
    </span>
  );
}

export default function App() {
  // synth params
  const [wave, setWave] = useState<WaveType>("sine");
  const [refA4, setRefA4] = useState(440.0);
  const [root, setRoot] = useState<NoteName>("A");
  const [gain, setGain] = useState(0.2);

  const [selected, setSelected] = useState<Set<IntervalChoice>>(
    () => new Set<IntervalChoice>(["1", "3", "5"])
  );
  const [playing, setPlaying] = useState(false);

  // wavetable
  const table = useMemo(() => makeWavetable(wave, N), [wave]);
  useEffect(() => { setWavetable(table).catch(console.error); }, [table]);
  useEffect(() => { setMasterGain(gain).catch(console.error); }, [gain]);

  // freqs
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

  // play/stop
  const play = async () => {
    setPlaying(true);
    await setChord(freqs);
  };
  const stop = async () => {
    setPlaying(false);
    await allNotesOff();
  };

  // reflect changes while playing
  useEffect(() => {
    if (playing) setChord(freqs).catch(console.error);
  }, [playing, freqs]);

  // space hold
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !playing) {
        e.preventDefault();
        play().catch(console.error);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        stop().catch(console.error);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
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
    <div className="min-h-screen">
      {/* background */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-24 left-[-10%] h-[420px] w-[520px] rounded-full bg-violet-500/25 blur-[90px]" />
        <div className="absolute top-10 right-[-10%] h-[420px] w-[520px] rounded-full bg-emerald-400/15 blur-[90px]" />
        <div className="absolute bottom-[-20%] left-[30%] h-[520px] w-[620px] rounded-full bg-rose-500/10 blur-[110px]" />
      </div>

      <div className="mx-auto flex max-w-6xl flex-col gap-4 p-5">
        {/* header */}
        <header className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.35)] backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-violet-500 to-emerald-400 shadow-[0_12px_30px_rgba(124,92,255,0.25)]" />
            <div>
              <div className="text-sm font-semibold tracking-tight">p5-tuner</div>
              <div className="text-xs text-white/60">Chord + wavetable synth</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-white/60 sm:block">
              <span className="rounded-lg border border-white/10 bg-black/30 px-2 py-1 font-mono">Space</span>{" "}
              hold to play
            </span>
            <button
              onClick={playing ? stop : play}
              className={cn(
                "rounded-xl px-4 py-2 text-sm font-semibold transition active:scale-[0.99]",
                playing
                  ? "bg-rose-500/90 hover:bg-rose-400 text-white shadow-[0_14px_35px_rgba(244,63,94,0.25)]"
                  : "bg-violet-500/90 hover:bg-violet-400 text-white shadow-[0_14px_35px_rgba(139,92,246,0.25)]"
              )}
            >
              {playing ? "Stop" : "Play"}
            </button>
          </div>
        </header>

        {/* content */}
        <main className="grid grid-cols-12 gap-4">
          <div className="col-span-12 md:col-span-6">
            <Card title="Tuning" desc="Reference + root note" right={<Chip>{freqs.length} notes</Chip>}>
              <div className="grid gap-3">
                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-white/60">A4 reference</div>
                    <div className="font-mono text-sm text-white/85">{refA4.toFixed(1)} Hz</div>
                  </div>
                  <input
                    className="w-full accent-violet-400"
                    type="range"
                    min={430}
                    max={450}
                    step={0.1}
                    value={refA4}
                    onChange={(e) => setRefA4(Number(e.target.value))}
                  />
                  <div className="flex gap-2">
                    {[440, 441, 442].map((v) => (
                      <button
                        key={v}
                        onClick={() => setRefA4(v)}
                        className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70 hover:bg-white/10"
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-2">
                  <div className="text-xs text-white/60">Root (note4)</div>
                  <select
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:ring-4 focus:ring-violet-500/20"
                    value={root}
                    onChange={(e) => setRoot(e.target.value as NoteName)}
                  >
                    {NOTE_OPTIONS.map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                  <div className="text-[11px] text-white/45">
                    Root is mapped around A4 for now (easy mode).
                  </div>
                </div>
              </div>
            </Card>
          </div>

          <div className="col-span-12 md:col-span-6">
            <Card title="Sound" desc="Waveform + gain" right={<Chip><span className="font-mono">{wave}</span></Chip>}>
              <div className="grid gap-3">
                <div className="grid gap-2">
                  <div className="text-xs text-white/60">Waveform</div>
                  <select
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:ring-4 focus:ring-violet-500/20"
                    value={wave}
                    onChange={(e) => setWave(e.target.value as WaveType)}
                  >
                    <option value="sine">Sine</option>
                    <option value="square">Square</option>
                    <option value="saw">Saw</option>
                    <option value="triangle">Triangle</option>
                  </select>
                  <div className="text-[11px] text-white/45">
                    Square/Saw are alias-prone (band-limited later).
                  </div>
                </div>

                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-white/60">Master gain</div>
                    <div className="font-mono text-sm text-white/85">{gain.toFixed(2)}</div>
                  </div>
                  <input
                    className="w-full accent-emerald-400"
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={gain}
                    onChange={(e) => setGain(Number(e.target.value))}
                  />
                </div>
              </div>
            </Card>
          </div>

          <div className="col-span-12">
            <Card
              title="Intervals"
              desc="Toggle any tensions you want"
              right={
                <Chip>
                  <span className="font-mono">
                    {freqs.length === 0 ? "—" : freqs.map((f) => f.toFixed(2)).join(", ") + " Hz"}
                  </span>
                </Chip>
              }
            >
              <div className="flex flex-wrap items-center gap-2">
                {(["maj","min","dom7","maj7","sus4"] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPreset(p)}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70 hover:bg-white/10"
                  >
                    {p === "dom7" ? "7" : p}
                  </button>
                ))}
                <button
                  onClick={() => setSelected(new Set())}
                  className="ml-auto rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70 hover:bg-white/10"
                >
                  Clear
                </button>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
                {INTERVAL_CHOICES.map((it) => {
                  const checked = selected.has(it);
                  return (
                    <button
                      key={it}
                      type="button"
                      onClick={() => toggle(it)}
                      className={cn(
                        "group flex items-center justify-between gap-2 rounded-full border px-3 py-2 text-sm transition active:scale-[0.99]",
                        checked
                          ? "border-emerald-400/40 bg-emerald-400/10 hover:bg-emerald-400/15"
                          : "border-white/10 bg-white/5 hover:bg-white/10"
                      )}
                    >
                      <span className="font-mono">{it}</span>
                      <span
                        className={cn(
                          "h-2.5 w-2.5 rounded-full border",
                          checked
                            ? "border-emerald-400/60 bg-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,0.18)]"
                            : "border-white/15 bg-white/10"
                        )}
                      />
                    </button>
                  );
                })}
              </div>
            </Card>
          </div>
        </main>

        <footer className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-white/60 backdrop-blur">
          <div>
            <span className="rounded-lg border border-white/10 bg-black/30 px-2 py-1 font-mono text-white/80">Space</span>{" "}
            hold to play
          </div>
          <div className="font-mono text-white/55">
            {playing ? "PLAYING" : "IDLE"} · {root} · A4={refA4.toFixed(1)} · {wave}
          </div>
        </footer>
      </div>
    </div>
  );
}
