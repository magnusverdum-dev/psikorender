use anyhow::{anyhow, Context, Result};
use chrono::Utc;
use media_core::{caption_path, ensure_storage_dirs, output_video_path, probe_duration_seconds};
use redis::AsyncCommands;
use renderer::RenderInput;
use shared::{JobStatus, MediaAsset, Project, RenderJobPayload};
use sqlx::{postgres::PgPoolOptions, PgPool, Row};
use std::{env, path::PathBuf, time::Duration};
use tracing::{error, info, warn};
use uuid::Uuid;

const RENDER_QUEUE: &str = "psikorender:render_jobs";

#[tokio::main]
async fn main() -> Result<()> {
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    let database_url = env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://psikorender:psikorender@localhost:5432/psikorender".into());
    let redis_url = env::var("REDIS_URL").unwrap_or_else(|_| "redis://localhost:6379".into());
    let storage_root = PathBuf::from(env::var("STORAGE_ROOT").unwrap_or_else(|_| "storage".into()));
    ensure_storage_dirs(&storage_root)?;

    let pool = PgPoolOptions::new()
        .max_connections(4)
        .connect(&database_url)
        .await
        .context("failed to connect to postgres")?;
    let redis = redis::Client::open(redis_url).context("failed to create redis client")?;
    let mut connection = redis
        .get_multiplexed_async_connection()
        .await
        .context("failed to connect to redis")?;

    info!("PsikoRender worker listening for render jobs");
    loop {
        let item: Option<[String; 2]> = connection.blpop(RENDER_QUEUE, 5.0).await?;
        let Some([_, raw_payload]) = item else {
            continue;
        };

        let payload: RenderJobPayload = match serde_json::from_str(&raw_payload) {
            Ok(payload) => payload,
            Err(err) => {
                warn!("discarding invalid job payload: {err}");
                continue;
            }
        };

        if let Err(err) = process_job(&pool, &storage_root, payload.clone()).await {
            error!("job {} failed: {err:?}", payload.job_id);
            mark_failed(&pool, payload.job_id, payload.project_id, &err.to_string()).await?;
        }

        tokio::time::sleep(Duration::from_millis(100)).await;
    }
}

async fn process_job(
    pool: &PgPool,
    storage_root: &PathBuf,
    payload: RenderJobPayload,
) -> Result<()> {
    update_job(
        pool,
        payload.job_id,
        payload.project_id,
        JobStatus::GeneratingCaptions,
        20,
        None,
        None,
    )
    .await?;

    let project = fetch_project(pool, payload.project_id).await?;
    let background = fetch_media(pool, payload.background_id).await?;
    let audio = fetch_media(pool, payload.audio_id).await?;
    let audio_path = PathBuf::from(&audio.path);
    let duration = audio
        .duration
        .unwrap_or(probe_duration_seconds(&audio_path).await.unwrap_or(30.0));

    let captions_path = caption_path(storage_root, payload.job_id);
    let segments =
        captions::build_segments(project.id, &project.text, duration, payload.caption_style);
    captions::write_ass_file(&captions_path, &segments, payload.caption_style)?;
    replace_caption_segments(pool, project.id, &segments).await?;

    update_job(
        pool,
        payload.job_id,
        payload.project_id,
        JobStatus::Rendering,
        45,
        None,
        None,
    )
    .await?;

    let output_path = output_video_path(storage_root, payload.job_id);
    renderer::render(&RenderInput {
        background_path: PathBuf::from(background.path),
        audio_path,
        captions_path,
        output_path: output_path.clone(),
        format: payload.format,
    })
    .await?;

    if !renderer::output_exists(&output_path) {
        return Err(anyhow!(
            "ffmpeg finished but output file is missing or empty"
        ));
    }

    update_job(
        pool,
        payload.job_id,
        payload.project_id,
        JobStatus::Completed,
        100,
        None,
        Some(output_path.to_string_lossy().to_string()),
    )
    .await?;
    Ok(())
}

async fn fetch_project(pool: &PgPool, id: Uuid) -> Result<Project> {
    let row = sqlx::query(
        "SELECT id, title, text, format, template, status, created_at, updated_at FROM projects WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| anyhow!("project not found"))?;

    Ok(Project {
        id: row.try_get("id")?,
        title: row.try_get("title")?,
        text: row.try_get("text")?,
        format: row.try_get("format")?,
        template: row.try_get("template")?,
        status: row.try_get("status")?,
        created_at: row.try_get("created_at")?,
        updated_at: row.try_get("updated_at")?,
    })
}

async fn fetch_media(pool: &PgPool, id: Uuid) -> Result<MediaAsset> {
    let row = sqlx::query(
        "SELECT id, media_type, path, duration, created_at FROM media_assets WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| anyhow!("media asset not found"))?;

    Ok(MediaAsset {
        id: row.try_get("id")?,
        media_type: row.try_get("media_type")?,
        path: row.try_get("path")?,
        duration: row.try_get("duration")?,
        created_at: row.try_get("created_at")?,
    })
}

async fn replace_caption_segments(
    pool: &PgPool,
    project_id: Uuid,
    segments: &[shared::CaptionSegment],
) -> Result<()> {
    let mut tx = pool.begin().await?;
    sqlx::query("DELETE FROM caption_segments WHERE project_id = $1")
        .bind(project_id)
        .execute(&mut *tx)
        .await?;

    for segment in segments {
        sqlx::query(
            "INSERT INTO caption_segments (id, project_id, text, start_time, end_time, style, highlight_words)
             VALUES ($1, $2, $3, $4, $5, $6, $7)",
        )
        .bind(segment.id)
        .bind(segment.project_id)
        .bind(&segment.text)
        .bind(segment.start_time)
        .bind(segment.end_time)
        .bind(&segment.style)
        .bind(&segment.highlight_words)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;
    Ok(())
}

async fn update_job(
    pool: &PgPool,
    job_id: Uuid,
    project_id: Uuid,
    status: JobStatus,
    progress: i32,
    error_message: Option<&str>,
    output_path: Option<String>,
) -> Result<()> {
    let now = Utc::now();
    let completed_at = if matches!(status, JobStatus::Completed | JobStatus::Failed) {
        Some(now)
    } else {
        None
    };

    sqlx::query(
        "UPDATE render_jobs
         SET status = $1, progress = $2, error_message = $3, output_path = COALESCE($4, output_path), completed_at = COALESCE($5, completed_at)
         WHERE id = $6",
    )
    .bind(status.to_string())
    .bind(progress)
    .bind(error_message)
    .bind(output_path)
    .bind(completed_at)
    .bind(job_id)
    .execute(pool)
    .await?;

    sqlx::query("UPDATE projects SET status = $1, updated_at = $2 WHERE id = $3")
        .bind(status.to_string())
        .bind(now)
        .bind(project_id)
        .execute(pool)
        .await?;

    Ok(())
}

async fn mark_failed(
    pool: &PgPool,
    job_id: Uuid,
    project_id: Uuid,
    error_message: &str,
) -> Result<()> {
    update_job(
        pool,
        job_id,
        project_id,
        JobStatus::Failed,
        100,
        Some(error_message),
        None,
    )
    .await
}
