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

struct Shared {
    table: ArcSwap<Vec<f32>>,
    freq_bits: AtomicU32,
    gate: AtomicBool,
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
            freq_bits: AtomicU32::new(f32_to_u32_bits(440.0)),
            gate: AtomicBool::new(false),
        });

        let config: cpal::StreamConfig = supported.clone().into();
        let sample_rate = config.sample_rate as f32;
        let channels = config.channels as usize;

        // 音声スレッド内状態（unsafe不要）
        let mut phase: f32 = 0.0;
        let mut amp: f32 = 0.0;

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
                // 別クロージャを作るので、Arc をもう1回 clone する
                let shared_cl = Arc::clone(&shared);
                let mut phase: f32 = 0.0;
                let mut amp: f32 = 0.0;
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
                let mut phase: f32 = 0.0;
                let mut amp: f32 = 0.0;
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

    pub fn note_on(&self, freq: f32) {
        self.shared
            .freq_bits
            .store(f32_to_u32_bits(freq.max(1.0)), Ordering::Relaxed);
        self.shared.gate.store(true, Ordering::Relaxed);
    }

    pub fn note_off(&self) {
        self.shared.gate.store(false, Ordering::Relaxed);
    }
}

// ======================
// renderer（音声スレッド）
// ======================

fn render_core(
    out_len_frames: usize,
    channels: usize,
    sample_rate: f32,
    shared: &Arc<Shared>,
    phase: &mut f32,
    amp: &mut f32,
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

    let freq = u32_bits_to_f32(shared.freq_bits.load(Ordering::Relaxed));
    let on = shared.gate.load(Ordering::Relaxed);

    // 超簡易クリック抑制（後でADSRへ）
    let target = if on { 0.2 } else { 0.0 };
    let a = 0.001;
    let phase_inc = freq / sample_rate;

    for frame in 0..out_len_frames {
        *amp += (target - *amp) * a;

        *phase = (*phase + phase_inc) % 1.0;

        let pos = *phase * n;
        let i0 = pos.floor() as usize;
        let i1 = (i0 + 1) % tab.len();
        let frac = pos - i0 as f32;

        let s0 = tab[i0];
        let s1 = tab[i1];
        let sample = (s0 + (s1 - s0) * frac) * *amp;

        for ch in 0..channels {
            write_sample(frame * channels + ch, sample);
        }
    }
}

fn render_f32(
    out: &mut [f32],
    channels: usize,
    sample_rate: f32,
    shared: &Arc<Shared>,
    phase: &mut f32,
    amp: &mut f32,
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
    phase: &mut f32,
    amp: &mut f32,
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
    phase: &mut f32,
    amp: &mut f32,
) {
    let frames = out.len() / channels;
    render_core(frames, channels, sample_rate, shared, phase, amp, |i, s| {
        let v = ((s * 0.5 + 0.5) * u16::MAX as f32) as i32;
        out[i] = v.clamp(0, u16::MAX as i32) as u16;
    });
}
