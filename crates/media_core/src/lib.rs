use anyhow::{anyhow, Context, Result};
use shared::MediaType;
use std::{
    ffi::OsStr,
    path::{Path, PathBuf},
};
use tokio::process::Command;
use uuid::Uuid;

pub const MAX_UPLOAD_BYTES: u64 = 1024 * 1024 * 1024;

pub fn ensure_storage_dirs(root: &Path) -> Result<()> {
    for dir in [
        "uploads",
        "generated_audio",
        "generated_video",
        "thumbnails",
        "captions",
    ] {
        std::fs::create_dir_all(root.join(dir))
            .with_context(|| format!("failed to create storage directory {dir}"))?;
    }
    Ok(())
}

pub fn validate_upload(filename: &str, media_type: MediaType) -> Result<String> {
    let ext = Path::new(filename)
        .extension()
        .and_then(OsStr::to_str)
        .map(|ext| ext.to_ascii_lowercase())
        .ok_or_else(|| anyhow!("file has no extension"))?;

    let allowed = match media_type {
        MediaType::Background => ["mp4", "mov", "webm"].as_slice(),
        MediaType::Audio => ["wav", "mp3", "m4a", "aac"].as_slice(),
        MediaType::Music => ["wav", "mp3", "m4a", "aac"].as_slice(),
        MediaType::Font => ["ttf", "otf"].as_slice(),
    };

    if allowed.contains(&ext.as_str()) {
        Ok(ext)
    } else {
        Err(anyhow!("unsupported {media_type} extension: {ext}"))
    }
}

pub fn stored_upload_path(root: &Path, media_type: MediaType, filename: &str) -> Result<PathBuf> {
    let ext = validate_upload(filename, media_type)?;
    let prefix = match media_type {
        MediaType::Background => "background",
        MediaType::Audio => "audio",
        MediaType::Music => "music",
        MediaType::Font => "font",
    };
    Ok(root
        .join("uploads")
        .join(format!("{prefix}-{}.{}", Uuid::new_v4(), ext)))
}

pub fn output_video_path(root: &Path, job_id: Uuid) -> PathBuf {
    root.join("generated_video").join(format!("{job_id}.mp4"))
}

pub fn caption_path(root: &Path, job_id: Uuid) -> PathBuf {
    root.join("captions").join(format!("{job_id}.ass"))
}

pub async fn probe_duration_seconds(path: &Path) -> Result<f64> {
    let output = Command::new("ffprobe")
        .args([
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
        ])
        .arg(path)
        .output()
        .await
        .context("failed to run ffprobe")?;

    if !output.status.success() {
        return Err(anyhow!(
            "ffprobe failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    let value = String::from_utf8_lossy(&output.stdout)
        .trim()
        .parse::<f64>()
        .context("failed to parse ffprobe duration")?;
    Ok(value.max(0.1))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validates_background_extensions() {
        assert!(validate_upload("clip.mp4", MediaType::Background).is_ok());
        assert!(validate_upload("clip.exe", MediaType::Background).is_err());
    }

    #[test]
    fn creates_format_specific_output_path() {
        let id = Uuid::nil();
        assert!(output_video_path(Path::new("storage"), id)
            .ends_with("00000000-0000-0000-0000-000000000000.mp4"));
    }
}
