use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::{fmt, str::FromStr};
use uuid::Uuid;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum VideoFormat {
    Vertical,
    Square,
    Landscape,
}

impl VideoFormat {
    pub fn dimensions(self) -> (u32, u32) {
        match self {
            Self::Vertical => (1080, 1920),
            Self::Square => (1080, 1080),
            Self::Landscape => (1920, 1080),
        }
    }
}

impl fmt::Display for VideoFormat {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(match self {
            Self::Vertical => "vertical",
            Self::Square => "square",
            Self::Landscape => "landscape",
        })
    }
}

impl FromStr for VideoFormat {
    type Err = String;

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        match value {
            "vertical" | "9:16" => Ok(Self::Vertical),
            "square" | "1:1" => Ok(Self::Square),
            "landscape" | "16:9" => Ok(Self::Landscape),
            other => Err(format!("unsupported video format: {other}")),
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CaptionStyle {
    Minimal,
    Bold,
    KaraokeBasic,
    Manifesto,
}

impl fmt::Display for CaptionStyle {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(match self {
            Self::Minimal => "minimal",
            Self::Bold => "bold",
            Self::KaraokeBasic => "karaoke_basic",
            Self::Manifesto => "manifesto",
        })
    }
}

impl FromStr for CaptionStyle {
    type Err = String;

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        match value {
            "minimal" => Ok(Self::Minimal),
            "bold" => Ok(Self::Bold),
            "karaoke_basic" | "karaoke" => Ok(Self::KaraokeBasic),
            "manifesto" => Ok(Self::Manifesto),
            other => Err(format!("unsupported caption style: {other}")),
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum MediaType {
    Background,
    Audio,
    Music,
    Font,
}

impl fmt::Display for MediaType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(match self {
            Self::Background => "background",
            Self::Audio => "audio",
            Self::Music => "music",
            Self::Font => "font",
        })
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum JobStatus {
    Queued,
    GeneratingAudio,
    GeneratingCaptions,
    Rendering,
    Completed,
    Failed,
}

impl fmt::Display for JobStatus {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(match self {
            Self::Queued => "queued",
            Self::GeneratingAudio => "generating_audio",
            Self::GeneratingCaptions => "generating_captions",
            Self::Rendering => "rendering",
            Self::Completed => "completed",
            Self::Failed => "failed",
        })
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub id: Uuid,
    pub title: String,
    pub text: String,
    pub format: String,
    pub template: String,
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MediaAsset {
    pub id: Uuid,
    pub media_type: String,
    pub path: String,
    pub duration: Option<f64>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RenderJob {
    pub id: Uuid,
    pub project_id: Uuid,
    pub status: String,
    pub progress: i32,
    pub error_message: Option<String>,
    pub output_path: Option<String>,
    pub created_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaptionSegment {
    pub id: Uuid,
    pub project_id: Uuid,
    pub text: String,
    pub start_time: f64,
    pub end_time: f64,
    pub style: String,
    pub highlight_words: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateProjectRequest {
    pub title: String,
    pub text: String,
    pub format: VideoFormat,
    pub template: String,
    pub voice_mode: String,
    pub background_id: Option<Uuid>,
    pub audio_id: Option<Uuid>,
    pub caption_style: Option<CaptionStyle>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenerateCaptionsRequest {
    pub project_id: Uuid,
    pub style: CaptionStyle,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RenderRequest {
    pub project_id: Uuid,
    pub background_id: Uuid,
    pub audio_id: Uuid,
    pub format: VideoFormat,
    pub caption_style: CaptionStyle,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RenderJobPayload {
    pub job_id: Uuid,
    pub project_id: Uuid,
    pub background_id: Uuid,
    pub audio_id: Uuid,
    pub format: VideoFormat,
    pub caption_style: CaptionStyle,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RenderResponse {
    pub job_id: Uuid,
}
