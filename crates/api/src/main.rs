use anyhow::{Context, Result};
use axum::{
    body::Body,
    extract::{DefaultBodyLimit, Multipart, Path, State},
    http::{header, HeaderMap, HeaderValue, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use chrono::{DateTime, Utc};
use media_core::{
    ensure_storage_dirs, probe_duration_seconds, stored_upload_path, MAX_UPLOAD_BYTES,
};
use redis::AsyncCommands;
use serde::Deserialize;
use shared::{
    CreateProjectRequest, GenerateCaptionsRequest, JobStatus, MediaAsset, MediaType, Project,
    RenderJob, RenderJobPayload, RenderRequest, RenderResponse,
};
use sqlx::{postgres::PgPoolOptions, PgPool, Row};
use std::{env, net::SocketAddr, path::PathBuf, sync::Arc};
use tokio::{fs, net::TcpListener};
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use tracing::{error, info};
use uuid::Uuid;

const RENDER_QUEUE: &str = "psikorender:render_jobs";

#[derive(Clone)]
struct AppState {
    pool: PgPool,
    redis: redis::Client,
    storage_root: PathBuf,
}

#[derive(Debug)]
struct ApiError {
    status: StatusCode,
    message: String,
}

impl ApiError {
    fn bad_request(message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::BAD_REQUEST,
            message: message.into(),
        }
    }

    fn not_found(message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::NOT_FOUND,
            message: message.into(),
        }
    }

    fn internal(error: anyhow::Error) -> Self {
        error!("{error:?}");
        Self {
            status: StatusCode::INTERNAL_SERVER_ERROR,
            message: "internal server error".to_string(),
        }
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        (
            self.status,
            Json(serde_json::json!({ "error": self.message })),
        )
            .into_response()
    }
}

impl From<anyhow::Error> for ApiError {
    fn from(value: anyhow::Error) -> Self {
        Self::internal(value)
    }
}

#[tokio::main]
async fn main() -> Result<()> {
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    let database_url = env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://psikorender:psikorender@localhost:5432/psikorender".into());
    let redis_url = env::var("REDIS_URL").unwrap_or_else(|_| "redis://localhost:6379".into());
    let api_addr = env::var("API_ADDR").unwrap_or_else(|_| "127.0.0.1:8080".into());
    let storage_root = PathBuf::from(env::var("STORAGE_ROOT").unwrap_or_else(|_| "storage".into()));

    ensure_storage_dirs(&storage_root)?;

    let pool = PgPoolOptions::new()
        .max_connections(8)
        .connect(&database_url)
        .await
        .context("failed to connect to postgres")?;
    ensure_schema(&pool).await?;

    let redis = redis::Client::open(redis_url).context("failed to create redis client")?;
    let state = Arc::new(AppState {
        pool,
        redis,
        storage_root,
    });

    let app = Router::new()
        .route("/health", get(|| async { "ok" }))
        .route("/api/projects", post(create_project).get(list_projects))
        .route("/api/projects/:id", get(get_project))
        .route("/api/backgrounds/upload", post(upload_background))
        .route("/api/audio/upload", post(upload_audio))
        .route("/api/captions/generate", post(generate_captions))
        .route("/api/render", post(create_render_job))
        .route("/api/jobs/:id", get(get_job))
        .route("/api/videos/:id/download", get(download_video))
        .layer(DefaultBodyLimit::max(MAX_UPLOAD_BYTES as usize))
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    let addr: SocketAddr = api_addr.parse().context("invalid API_ADDR")?;
    let listener = TcpListener::bind(addr).await?;
    info!("PsikoRender API listening on http://{addr}");
    axum::serve(listener, app).await?;
    Ok(())
}

async fn create_project(
    State(state): State<Arc<AppState>>,
    Json(input): Json<CreateProjectRequest>,
) -> Result<Json<Project>, ApiError> {
    if input.title.trim().is_empty() || input.text.trim().is_empty() {
        return Err(ApiError::bad_request("title and text are required"));
    }

    let id = Uuid::new_v4();
    let now = Utc::now();
    let project = sqlx::query_as::<_, ProjectRow>(
        "INSERT INTO projects (id, title, text, format, template, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, title, text, format, template, status, created_at, updated_at",
    )
    .bind(id)
    .bind(input.title.trim())
    .bind(input.text.trim())
    .bind(input.format.to_string())
    .bind(input.template.trim())
    .bind("draft")
    .bind(now)
    .bind(now)
    .fetch_one(&state.pool)
    .await
    .map_err(|err| ApiError::internal(err.into()))?;

    Ok(Json(project.into()))
}

async fn list_projects(State(state): State<Arc<AppState>>) -> Result<Json<Vec<Project>>, ApiError> {
    let projects = sqlx::query_as::<_, ProjectRow>(
        "SELECT id, title, text, format, template, status, created_at, updated_at
         FROM projects ORDER BY created_at DESC",
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|err| ApiError::internal(err.into()))?
    .into_iter()
    .map(Into::into)
    .collect();
    Ok(Json(projects))
}

async fn get_project(
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
) -> Result<Json<ProjectDetail>, ApiError> {
    let project = fetch_project(&state.pool, id).await?;
    let latest_job = sqlx::query_as::<_, RenderJobRow>(
        "SELECT id, project_id, status, progress, error_message, output_path, created_at, completed_at
         FROM render_jobs WHERE project_id = $1 ORDER BY created_at DESC LIMIT 1",
    )
    .bind(id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|err| ApiError::internal(err.into()))?
    .map(Into::into);

    Ok(Json(ProjectDetail {
        project,
        latest_job,
    }))
}

async fn upload_background(
    State(state): State<Arc<AppState>>,
    multipart: Multipart,
) -> Result<Json<MediaAsset>, ApiError> {
    upload_media(state, multipart, MediaType::Background).await
}

async fn upload_audio(
    State(state): State<Arc<AppState>>,
    multipart: Multipart,
) -> Result<Json<MediaAsset>, ApiError> {
    upload_media(state, multipart, MediaType::Audio).await
}

async fn upload_media(
    state: Arc<AppState>,
    mut multipart: Multipart,
    media_type: MediaType,
) -> Result<Json<MediaAsset>, ApiError> {
    let mut saved_path = None;

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|err| ApiError::bad_request(err.to_string()))?
    {
        let Some(filename) = field.file_name().map(ToOwned::to_owned) else {
            continue;
        };
        let path = stored_upload_path(&state.storage_root, media_type, &filename)
            .map_err(|err| ApiError::bad_request(err.to_string()))?;
        let bytes = field
            .bytes()
            .await
            .map_err(|err| ApiError::bad_request(err.to_string()))?;
        if bytes.is_empty() {
            return Err(ApiError::bad_request("uploaded file is empty"));
        }
        fs::write(&path, &bytes)
            .await
            .map_err(|err| ApiError::internal(err.into()))?;
        saved_path = Some(path);
        break;
    }

    let path =
        saved_path.ok_or_else(|| ApiError::bad_request("multipart file field is required"))?;
    let duration = probe_duration_seconds(&path).await.ok();
    let asset = insert_media_asset(&state.pool, media_type, path, duration).await?;
    Ok(Json(asset))
}

async fn generate_captions(
    State(state): State<Arc<AppState>>,
    Json(input): Json<GenerateCaptionsRequest>,
) -> Result<Json<Vec<shared::CaptionSegment>>, ApiError> {
    let project = fetch_project(&state.pool, input.project_id).await?;
    let segments = captions::build_segments(project.id, &project.text, 30.0, input.style);
    replace_caption_segments(&state.pool, project.id, &segments).await?;
    Ok(Json(segments))
}

async fn create_render_job(
    State(state): State<Arc<AppState>>,
    Json(input): Json<RenderRequest>,
) -> Result<Json<RenderResponse>, ApiError> {
    fetch_project(&state.pool, input.project_id).await?;
    fetch_media(&state.pool, input.background_id).await?;
    fetch_media(&state.pool, input.audio_id).await?;

    let job_id = Uuid::new_v4();
    let now = Utc::now();
    sqlx::query(
        "INSERT INTO render_jobs (id, project_id, status, progress, created_at)
         VALUES ($1, $2, $3, $4, $5)",
    )
    .bind(job_id)
    .bind(input.project_id)
    .bind(JobStatus::Queued.to_string())
    .bind(0_i32)
    .bind(now)
    .execute(&state.pool)
    .await
    .map_err(|err| ApiError::internal(err.into()))?;

    sqlx::query("UPDATE projects SET status = $1, updated_at = $2 WHERE id = $3")
        .bind(JobStatus::Queued.to_string())
        .bind(now)
        .bind(input.project_id)
        .execute(&state.pool)
        .await
        .map_err(|err| ApiError::internal(err.into()))?;

    let payload = RenderJobPayload {
        job_id,
        project_id: input.project_id,
        background_id: input.background_id,
        audio_id: input.audio_id,
        format: input.format,
        caption_style: input.caption_style,
    };
    let mut redis = state
        .redis
        .get_multiplexed_async_connection()
        .await
        .map_err(|err| ApiError::internal(err.into()))?;
    let payload_json =
        serde_json::to_string(&payload).map_err(|err| ApiError::internal(err.into()))?;
    let _: () = redis
        .rpush(RENDER_QUEUE, payload_json)
        .await
        .map_err(|err| ApiError::internal(err.into()))?;

    Ok(Json(RenderResponse { job_id }))
}

async fn get_job(
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
) -> Result<Json<RenderJob>, ApiError> {
    let job = fetch_job(&state.pool, id).await?;
    Ok(Json(job))
}

async fn download_video(
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
) -> Result<Response, ApiError> {
    let job = fetch_job(&state.pool, id).await?;
    let output_path = job
        .output_path
        .ok_or_else(|| ApiError::not_found("video is not ready"))?;
    let bytes = fs::read(&output_path)
        .await
        .map_err(|_| ApiError::not_found("video file not found"))?;
    let filename = std::path::Path::new(&output_path)
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("psikorender.mp4");
    let mut headers = HeaderMap::new();
    headers.insert(header::CONTENT_TYPE, HeaderValue::from_static("video/mp4"));
    let disposition = HeaderValue::from_str(&format!("attachment; filename=\"{filename}\""))
        .map_err(|err| ApiError::internal(anyhow::anyhow!(err)))?;
    headers.insert(header::CONTENT_DISPOSITION, disposition);
    Ok((headers, Body::from(bytes)).into_response())
}

async fn ensure_schema(pool: &PgPool) -> Result<()> {
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS projects (
            id UUID PRIMARY KEY,
            title TEXT NOT NULL,
            text TEXT NOT NULL,
            format TEXT NOT NULL,
            template TEXT NOT NULL,
            status TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL,
            updated_at TIMESTAMPTZ NOT NULL
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS media_assets (
            id UUID PRIMARY KEY,
            media_type TEXT NOT NULL,
            path TEXT NOT NULL,
            duration DOUBLE PRECISION,
            created_at TIMESTAMPTZ NOT NULL
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS render_jobs (
            id UUID PRIMARY KEY,
            project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            status TEXT NOT NULL,
            progress INTEGER NOT NULL DEFAULT 0,
            error_message TEXT,
            output_path TEXT,
            created_at TIMESTAMPTZ NOT NULL,
            completed_at TIMESTAMPTZ
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS caption_segments (
            id UUID PRIMARY KEY,
            project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            text TEXT NOT NULL,
            start_time DOUBLE PRECISION NOT NULL,
            end_time DOUBLE PRECISION NOT NULL,
            style TEXT NOT NULL,
            highlight_words TEXT[] NOT NULL DEFAULT '{}'
        )",
    )
    .execute(pool)
    .await?;

    Ok(())
}

async fn fetch_project(pool: &PgPool, id: Uuid) -> Result<Project, ApiError> {
    sqlx::query_as::<_, ProjectRow>(
        "SELECT id, title, text, format, template, status, created_at, updated_at FROM projects WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(pool)
    .await
    .map_err(|err| ApiError::internal(err.into()))?
    .map(Into::into)
    .ok_or_else(|| ApiError::not_found("project not found"))
}

async fn fetch_media(pool: &PgPool, id: Uuid) -> Result<MediaAsset, ApiError> {
    sqlx::query_as::<_, MediaAssetRow>(
        "SELECT id, media_type, path, duration, created_at FROM media_assets WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(pool)
    .await
    .map_err(|err| ApiError::internal(err.into()))?
    .map(Into::into)
    .ok_or_else(|| ApiError::not_found("media asset not found"))
}

async fn fetch_job(pool: &PgPool, id: Uuid) -> Result<RenderJob, ApiError> {
    sqlx::query_as::<_, RenderJobRow>(
        "SELECT id, project_id, status, progress, error_message, output_path, created_at, completed_at
         FROM render_jobs WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(pool)
    .await
    .map_err(|err| ApiError::internal(err.into()))?
    .map(Into::into)
    .ok_or_else(|| ApiError::not_found("job not found"))
}

async fn insert_media_asset(
    pool: &PgPool,
    media_type: MediaType,
    path: PathBuf,
    duration: Option<f64>,
) -> Result<MediaAsset, ApiError> {
    let id = Uuid::new_v4();
    let now = Utc::now();
    sqlx::query_as::<_, MediaAssetRow>(
        "INSERT INTO media_assets (id, media_type, path, duration, created_at)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, media_type, path, duration, created_at",
    )
    .bind(id)
    .bind(media_type.to_string())
    .bind(path.to_string_lossy().to_string())
    .bind(duration)
    .bind(now)
    .fetch_one(pool)
    .await
    .map(Into::into)
    .map_err(|err| ApiError::internal(err.into()))
}

async fn replace_caption_segments(
    pool: &PgPool,
    project_id: Uuid,
    segments: &[shared::CaptionSegment],
) -> Result<(), ApiError> {
    let mut tx = pool
        .begin()
        .await
        .map_err(|err| ApiError::internal(err.into()))?;
    sqlx::query("DELETE FROM caption_segments WHERE project_id = $1")
        .bind(project_id)
        .execute(&mut *tx)
        .await
        .map_err(|err| ApiError::internal(err.into()))?;
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
        .await
        .map_err(|err| ApiError::internal(err.into()))?;
    }
    tx.commit()
        .await
        .map_err(|err| ApiError::internal(err.into()))?;
    Ok(())
}

#[derive(Debug, Deserialize)]
struct ProjectRow {
    id: Uuid,
    title: String,
    text: String,
    format: String,
    template: String,
    status: String,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

impl<'r> sqlx::FromRow<'r, sqlx::postgres::PgRow> for ProjectRow {
    fn from_row(row: &'r sqlx::postgres::PgRow) -> sqlx::Result<Self> {
        Ok(Self {
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
}

impl From<ProjectRow> for Project {
    fn from(value: ProjectRow) -> Self {
        Self {
            id: value.id,
            title: value.title,
            text: value.text,
            format: value.format,
            template: value.template,
            status: value.status,
            created_at: value.created_at,
            updated_at: value.updated_at,
        }
    }
}

#[derive(Debug, Deserialize)]
struct MediaAssetRow {
    id: Uuid,
    media_type: String,
    path: String,
    duration: Option<f64>,
    created_at: DateTime<Utc>,
}

impl<'r> sqlx::FromRow<'r, sqlx::postgres::PgRow> for MediaAssetRow {
    fn from_row(row: &'r sqlx::postgres::PgRow) -> sqlx::Result<Self> {
        Ok(Self {
            id: row.try_get("id")?,
            media_type: row.try_get("media_type")?,
            path: row.try_get("path")?,
            duration: row.try_get("duration")?,
            created_at: row.try_get("created_at")?,
        })
    }
}

impl From<MediaAssetRow> for MediaAsset {
    fn from(value: MediaAssetRow) -> Self {
        Self {
            id: value.id,
            media_type: value.media_type,
            path: value.path,
            duration: value.duration,
            created_at: value.created_at,
        }
    }
}

#[derive(Debug, Deserialize)]
struct RenderJobRow {
    id: Uuid,
    project_id: Uuid,
    status: String,
    progress: i32,
    error_message: Option<String>,
    output_path: Option<String>,
    created_at: DateTime<Utc>,
    completed_at: Option<DateTime<Utc>>,
}

impl<'r> sqlx::FromRow<'r, sqlx::postgres::PgRow> for RenderJobRow {
    fn from_row(row: &'r sqlx::postgres::PgRow) -> sqlx::Result<Self> {
        Ok(Self {
            id: row.try_get("id")?,
            project_id: row.try_get("project_id")?,
            status: row.try_get("status")?,
            progress: row.try_get("progress")?,
            error_message: row.try_get("error_message")?,
            output_path: row.try_get("output_path")?,
            created_at: row.try_get("created_at")?,
            completed_at: row.try_get("completed_at")?,
        })
    }
}

impl From<RenderJobRow> for RenderJob {
    fn from(value: RenderJobRow) -> Self {
        Self {
            id: value.id,
            project_id: value.project_id,
            status: value.status,
            progress: value.progress,
            error_message: value.error_message,
            output_path: value.output_path,
            created_at: value.created_at,
            completed_at: value.completed_at,
        }
    }
}

#[derive(serde::Serialize)]
struct ProjectDetail {
    project: Project,
    latest_job: Option<RenderJob>,
}
