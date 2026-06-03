use anyhow::{anyhow, Context, Result};
use shared::VideoFormat;
use std::path::{Path, PathBuf};
use tokio::process::Command;

#[derive(Debug, Clone)]
pub struct RenderInput {
    pub background_path: PathBuf,
    pub audio_path: PathBuf,
    pub captions_path: PathBuf,
    pub output_path: PathBuf,
    pub format: VideoFormat,
}

pub fn build_filter(format: VideoFormat, captions_filename: &str) -> String {
    let (width, height) = format.dimensions();
    format!(
        "scale={width}:{height}:force_original_aspect_ratio=increase,crop={width}:{height},ass={captions_filename}"
    )
}

pub async fn render(input: &RenderInput) -> Result<()> {
    let captions_dir = input
        .captions_path
        .parent()
        .ok_or_else(|| anyhow!("captions path has no parent directory"))?;
    let captions_filename = input
        .captions_path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| anyhow!("captions filename is not valid UTF-8"))?;

    if let Some(parent) = input.output_path.parent() {
        std::fs::create_dir_all(parent)
            .with_context(|| format!("failed to create output directory {}", parent.display()))?;
    }

    let output = Command::new("ffmpeg")
        .current_dir(captions_dir)
        .args(["-y", "-stream_loop", "-1", "-i"])
        .arg(&input.background_path)
        .arg("-i")
        .arg(&input.audio_path)
        .arg("-vf")
        .arg(build_filter(input.format, captions_filename))
        .args([
            "-map",
            "0:v:0",
            "-map",
            "1:a:0",
            "-shortest",
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            "18",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-movflags",
            "+faststart",
        ])
        .arg(&input.output_path)
        .output()
        .await
        .context("failed to run ffmpeg")?;

    if !output.status.success() {
        return Err(anyhow!(
            "ffmpeg failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    Ok(())
}

pub fn output_exists(path: &Path) -> bool {
    path.exists() && path.metadata().map(|m| m.len() > 0).unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn filter_changes_by_format() {
        assert!(build_filter(VideoFormat::Vertical, "captions.ass").contains("1080:1920"));
        assert!(build_filter(VideoFormat::Square, "captions.ass").contains("1080:1080"));
        assert!(build_filter(VideoFormat::Landscape, "captions.ass").contains("1920:1080"));
    }
}
