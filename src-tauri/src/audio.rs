// src-tauri/src/audio.rs

use std::sync::Arc;
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};

use arc_swap::ArcSwap;
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};

fn f32_to_u32_bits(x: f32) -> u32 {
    x.to_bits()
}
fn u32_bits_to_f32(x: u32) -> f32 {
    f32::from_bits(x)
}

const MAX_VOICES: usize = 16;

#[derive(Default)]
struct VoiceParam {
    freq_bits: AtomicU32,
    gate: AtomicBool,
}

struct Shared {
    table: ArcSwap<Vec<f32>>,
    voices: [VoiceParam; MAX_VOICES],
    master_gain_bits: AtomicU32, // 例: 0.2 など
}

pub struct AudioEngine {
    shared: Arc<Shared>,
    _stream: cpal::Stream,
}

impl AudioEngine {
    pub fn new() -> anyhow::Result<Self> {
        let host = cpal::default_host();
        let device = host
            .default_output_device()
            .ok_or_else(|| anyhow::anyhow!("No output device"))?;
        let supported = device.default_output_config()?;

        // 初期テーブル（サイン波）
        let n = 2048usize;
        let mut init = vec![0.0f32; n];
        for i in 0..n {
            let t = i as f32 / n as f32;
            init[i] = (2.0 * std::f32::consts::PI * t).sin();
        }

        let shared = Arc::new(Shared {
            table: ArcSwap::from_pointee(init),
            voices: std::array::from_fn(|_| VoiceParam::default()),
            master_gain_bits: AtomicU32::new(f32_to_u32_bits(0.2)),
        });

        let config: cpal::StreamConfig = supported.clone().into();
        let sample_rate = config.sample_rate as f32;
        let channels = config.channels as usize;

        // 音声スレッド内状態（各voiceのphase/amp）
        let mut phase = [0.0f32; MAX_VOICES];
        let mut amp = [0.0f32; MAX_VOICES];

        let shared_cl = Arc::clone(&shared);

        let stream = match supported.sample_format() {
            cpal::SampleFormat::F32 => device.build_output_stream(
                &config,
                move |out: &mut [f32], _| {
                    render_f32(out, channels, sample_rate, &shared_cl, &mut phase, &mut amp);
                },
                move |err| eprintln!("audio err: {err}"),
                None,
            )?,
            cpal::SampleFormat::I16 => {
                let shared_cl = Arc::clone(&shared);
                let mut phase = [0.0f32; MAX_VOICES];
                let mut amp = [0.0f32; MAX_VOICES];
                device.build_output_stream(
                    &config,
                    move |out: &mut [i16], _| {
                        render_i16(out, channels, sample_rate, &shared_cl, &mut phase, &mut amp);
                    },
                    move |err| eprintln!("audio err: {err}"),
                    None,
                )?
            }
            cpal::SampleFormat::U16 => {
                let shared_cl = Arc::clone(&shared);
                let mut phase = [0.0f32; MAX_VOICES];
                let mut amp = [0.0f32; MAX_VOICES];
                device.build_output_stream(
                    &config,
                    move |out: &mut [u16], _| {
                        render_u16(out, channels, sample_rate, &shared_cl, &mut phase, &mut amp);
                    },
                    move |err| eprintln!("audio err: {err}"),
                    None,
                )?
            }
            _ => return Err(anyhow::anyhow!("Unsupported sample format")),
        };

        stream.play()?;
        Ok(Self {
            shared,
            _stream: stream,
        })
    }

    pub fn set_wavetable(&self, samples: Vec<f32>) {
        let mut s = samples;
        for x in &mut s {
            *x = x.clamp(-1.0, 1.0);
        }
        self.shared.table.store(Arc::new(s));
    }

    pub fn set_master_gain(&self, gain: f32) {
        self.shared
            .master_gain_bits
            .store(f32_to_u32_bits(gain.clamp(0.0, 1.0)), Ordering::Relaxed);
    }

    /// 和音を一発でセット（voices[0..k] を鳴らして、残りは止める）
    pub fn set_chord(&self, freqs: Vec<f32>) {
        let k = freqs.len().min(MAX_VOICES);
        for i in 0..k {
            let f = freqs[i].max(1.0);
            self.shared.voices[i]
                .freq_bits
                .store(f32_to_u32_bits(f), Ordering::Relaxed);
            self.shared.voices[i].gate.store(true, Ordering::Relaxed);
        }
        for i in k..MAX_VOICES {
            self.shared.voices[i].gate.store(false, Ordering::Relaxed);
        }
    }

    /// すべての音を止める
    pub fn all_notes_off(&self) {
        for v in &self.shared.voices {
            v.gate.store(false, Ordering::Relaxed);
        }
    }
}

// ---- audio render ----

fn soft_clip(x: f32) -> f32 {
    // 速いソフトクリップ（tanhの近似っぽいやつ）
    // x / (1 + |x|) は軽くて効く
    x / (1.0 + x.abs())
}

fn render_core(
    out_len_frames: usize,
    channels: usize,
    sample_rate: f32,
    shared: &Arc<Shared>,
    phase: &mut [f32; MAX_VOICES],
    amp: &mut [f32; MAX_VOICES],
    mut write_sample: impl FnMut(usize, f32),
) {
    let tab = shared.table.load();
    if tab.is_empty() {
        for i in 0..(out_len_frames * channels) {
            write_sample(i, 0.0);
        }
        return;
    }
    let n = tab.len() as f32;

    let gain = u32_bits_to_f32(shared.master_gain_bits.load(Ordering::Relaxed));

    // envelope追従速度（クリック抑制。ADSRは後で）
    let a = 0.001;

    for frame in 0..out_len_frames {
        let mut sum = 0.0f32;
        let mut active = 0u32;

        for i in 0..MAX_VOICES {
            let on = shared.voices[i].gate.load(Ordering::Relaxed);
            let target = if on { 1.0 } else { 0.0 };
            amp[i] += (target - amp[i]) * a;

            if amp[i] < 1e-5 {
                continue;
            }

            active += 1;

            let freq = u32_bits_to_f32(shared.voices[i].freq_bits.load(Ordering::Relaxed));
            let phase_inc = freq / sample_rate;
            phase[i] = (phase[i] + phase_inc) % 1.0;

            let pos = phase[i] * n;
            let i0 = pos.floor() as usize;
            let i1 = (i0 + 1) % tab.len();
            let frac = pos - i0 as f32;

            let s0 = tab[i0];
            let s1 = tab[i1];
            let sample = (s0 + (s1 - s0) * frac) * amp[i];

            sum += sample;
        }

        // ボイス数で軽く正規化（音割れしにくく）
        let norm = if active > 0 {
            1.0 / (active as f32).sqrt()
        } else {
            0.0
        };
        let out_sample = soft_clip(sum * norm * gain);

        for ch in 0..channels {
            write_sample(frame * channels + ch, out_sample);
        }
    }
}

fn render_f32(
    out: &mut [f32],
    channels: usize,
    sample_rate: f32,
    shared: &Arc<Shared>,
    phase: &mut [f32; MAX_VOICES],
    amp: &mut [f32; MAX_VOICES],
) {
    let frames = out.len() / channels;
    render_core(frames, channels, sample_rate, shared, phase, amp, |i, s| {
        out[i] = s
    });
}

fn render_i16(
    out: &mut [i16],
    channels: usize,
    sample_rate: f32,
    shared: &Arc<Shared>,
    phase: &mut [f32; MAX_VOICES],
    amp: &mut [f32; MAX_VOICES],
) {
    let frames = out.len() / channels;
    render_core(frames, channels, sample_rate, shared, phase, amp, |i, s| {
        let v = (s * i16::MAX as f32) as i32;
        out[i] = v.clamp(i16::MIN as i32, i16::MAX as i32) as i16;
    });
}

fn render_u16(
    out: &mut [u16],
    channels: usize,
    sample_rate: f32,
    shared: &Arc<Shared>,
    phase: &mut [f32; MAX_VOICES],
    amp: &mut [f32; MAX_VOICES],
) {
    let frames = out.len() / channels;
    render_core(frames, channels, sample_rate, shared, phase, amp, |i, s| {
        let v = ((s * 0.5 + 0.5) * u16::MAX as f32) as i32;
        out[i] = v.clamp(0, u16::MAX as i32) as u16;
    });
}
