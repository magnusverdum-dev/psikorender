use anyhow::Result;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TtsRequest {
    pub text: String,
    pub voice_reference: Option<PathBuf>,
    pub language: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TtsOutput {
    pub audio_path: PathBuf,
    pub duration: Option<f64>,
}

#[async_trait]
pub trait TtsEngine: Send + Sync {
    fn id(&self) -> &'static str;
    async fn synthesize(&self, request: TtsRequest) -> Result<TtsOutput>;
}

pub struct NotImplementedEngine {
    id: &'static str,
}

impl NotImplementedEngine {
    pub fn xtts_v2() -> Self {
        Self { id: "xtts_v2" }
    }

    pub fn f5_tts() -> Self {
        Self { id: "f5_tts" }
    }

    pub fn piper() -> Self {
        Self { id: "piper" }
    }

    pub fn openvoice() -> Self {
        Self { id: "openvoice" }
    }
}

#[async_trait]
impl TtsEngine for NotImplementedEngine {
    fn id(&self) -> &'static str {
        self.id
    }

    async fn synthesize(&self, _request: TtsRequest) -> Result<TtsOutput> {
        anyhow::bail!("TTS engine '{}' is planned after the MVP", self.id)
    }
}
