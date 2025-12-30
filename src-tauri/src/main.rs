mod audio;

use std::sync::Arc;

use audio::AudioEngine;
use tauri::{Manager, State};

struct AppState {
    audio: Arc<AudioEngine>,
}

#[tauri::command]
fn set_wavetable(state: State<'_, AppState>, samples: Vec<f32>) {
    state.audio.set_wavetable(samples);
}

#[tauri::command]
fn set_chord(state: State<'_, AppState>, freqs: Vec<f32>) {
    state.audio.set_chord(freqs);
}

#[tauri::command]
fn all_notes_off(state: State<'_, AppState>) {
    state.audio.all_notes_off();
}

#[tauri::command]
fn set_master_gain(state: State<'_, AppState>, gain: f32) {
    state.audio.set_master_gain(gain);
}

fn main() -> anyhow::Result<()> {
    tauri::Builder::default()
        .setup(|app| {
            let engine = AudioEngine::new()?;
            app.manage(AppState {
                audio: Arc::new(engine),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            set_wavetable,
            set_chord,
            all_notes_off,
            set_master_gain
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");

    Ok(())
}
