import "./styles.css";

type VideoFormat = "vertical" | "square" | "landscape";
type CaptionStyle = "minimal" | "bold" | "karaoke_basic" | "manifesto";

type Segment = {
  text: string;
  start: number;
  end: number;
};

type ProjectRecord = {
  id: string;
  title: string;
  text: string;
  format: VideoFormat;
  captionStyle: CaptionStyle;
  filename: string;
  mimeType: string;
  size: number;
  duration: number;
  createdAt: string;
  url?: string;
};

type State = {
  path: string;
  title: string;
  text: string;
  format: VideoFormat;
  template: string;
  captionStyle: CaptionStyle;
  audioFile?: File;
  backgroundFile?: File;
  audioUrl?: string;
  backgroundUrl?: string;
  renderedUrl?: string;
  renderedName?: string;
  projects: ProjectRecord[];
  storageReady: boolean;
  status: string;
  progress: number;
  busy: boolean;
};

const state: State = {
  path: window.location.pathname,
  title: "Primeiro video",
  text: "Escreve aqui o texto do teu video. Divide ideias em frases curtas para legendas mais fortes.",
  format: "vertical",
  template: "minimal",
  captionStyle: "bold",
  projects: [],
  storageReady: false,
  status: "",
  progress: 0,
  busy: false,
};

const app = document.querySelector<HTMLDivElement>("#app");

window.addEventListener("popstate", () => {
  state.path = window.location.pathname;
  render();
});

function navigate(path: string) {
  history.pushState(null, "", path);
  state.path = path;
  render();
}

function render() {
  if (!app) return;

  const page =
    state.path === "/create"
      ? createPage()
      : state.path === "/projects"
        ? projectsPage()
        : state.path === "/settings"
          ? settingsPage()
          : homePage();

  app.innerHTML = shell(page);
  bindSharedEvents();

  if (state.path === "/create") {
    bindCreateEvents();
    refreshCreateUi();
  }
}

function shell(content: string) {
  return `
    <main class="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(103,232,249,0.18),transparent_34%),linear-gradient(135deg,#082032,#0f3f50_46%,#f0d9a7)] text-white">
      <nav class="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5">
        <button class="text-lg font-semibold tracking-wide" data-nav="/">PsikoRender</button>
        <div class="flex items-center gap-2 text-sm text-white/75">
          <button class="nav-link" data-nav="/create">Criar</button>
          <button class="nav-link" data-nav="/projects">Projetos</button>
          <button class="nav-link" data-nav="/settings">Settings</button>
        </div>
      </nav>
      ${content}
    </main>
  `;
}

function homePage() {
  return `
    <section class="mx-auto grid min-h-[calc(100vh-88px)] w-full max-w-6xl items-center gap-10 px-5 pb-16 pt-6 lg:grid-cols-[1fr_380px]">
      <div class="max-w-3xl">
        <p class="mb-4 text-sm uppercase tracking-[0.32em] text-aqua">Local-first video render</p>
        <h1 class="text-5xl font-bold leading-tight sm:text-7xl">Texto em video com voz, legendas e fundos cinematograficos.</h1>
        <p class="mt-6 max-w-2xl text-lg leading-8 text-white/80">Um pipeline leve para transformar ideias em ficheiros de video usando uploads locais, canvas, audio e legendas geradas por frase.</p>
        <div class="mt-8 flex flex-wrap gap-3">
          <button class="primary-button" data-nav="/create">Criar video</button>
          <button class="secondary-button" data-nav="/projects">Ver projetos</button>
        </div>
      </div>
      <div class="glass-panel mx-auto aspect-[9/16] w-full max-w-[340px] overflow-hidden p-4 shadow-glow">
        <div class="flex h-full flex-col justify-end rounded-md bg-[linear-gradient(180deg,rgba(103,232,249,0.28),rgba(8,32,50,0.96)),url('https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80')] bg-cover bg-center p-5">
          <div class="rounded-md bg-black/30 p-4 text-center text-2xl font-black uppercase leading-tight">Render local. Legendas vivas.</div>
        </div>
      </div>
    </section>
  `;
}

function createPage() {
  return `
    <section class="mx-auto grid w-full max-w-6xl gap-6 px-5 pb-16 pt-6 lg:grid-cols-[1fr_380px]">
      <div class="glass-panel p-5">
        <p class="text-sm uppercase tracking-[0.24em] text-aqua">Criar video</p>
        <h1 class="mt-2 text-3xl font-bold">MVP local no browser</h1>
        <p class="mt-4 rounded-md bg-white/10 p-3 text-sm text-white/80">Seleciona audio e video de fundo. A renderizacao acontece neste browser e gera um ficheiro descarregavel. Nenhum ficheiro e enviado para fora.</p>
        <div class="mt-5 grid gap-4">
          <label class="field-label">Titulo<input id="title" class="input" value="${escapeAttr(state.title)}" autocomplete="off" /></label>
          <label class="field-label">Texto<textarea id="text" class="input min-h-44 resize-y">${escapeHtml(state.text)}</textarea></label>
          <div class="grid gap-4 md:grid-cols-3">
            <label class="field-label">Formato<select id="format" class="input">${option("vertical", "9:16", state.format)}${option("square", "1:1", state.format)}${option("landscape", "16:9", state.format)}</select></label>
            <label class="field-label">Template<select id="template" class="input">${option("minimal", "Minimal", state.template)}${option("cinematic", "Cinematic", state.template)}${option("manifesto", "Manifesto", state.template)}</select></label>
            <label class="field-label">Legendas<select id="captionStyle" class="input">${option("minimal", "Minimal", state.captionStyle)}${option("bold", "Bold", state.captionStyle)}${option("karaoke_basic", "Karaoke basico", state.captionStyle)}${option("manifesto", "Manifesto", state.captionStyle)}</select></label>
          </div>
          <div class="grid gap-4 md:grid-cols-2">
            <label class="upload-box"><span>Audio de voz</span><input id="audio" type="file" accept=".wav,.mp3,.m4a,.aac,audio/*" /><small id="audioLabel">WAV, MP3, M4A ou AAC</small></label>
            <label class="upload-box"><span>Video de fundo</span><input id="background" type="file" accept=".mp4,.mov,.webm,video/*" /><small id="backgroundLabel">MP4, MOV ou WEBM</small></label>
          </div>
          <button id="generate" class="primary-button w-full justify-center disabled:opacity-50">Gerar video</button>
          <div class="h-3 overflow-hidden rounded-full bg-white/10"><div id="progressBar" class="h-full rounded-full bg-gradient-to-r from-aqua to-sand transition-all" style="width: 0%"></div></div>
          <p id="status" class="rounded-md bg-white/10 p-3 text-sm text-white/80">Pronto para criar.</p>
          <a id="download" class="secondary-button hidden justify-center" download>Download do video</a>
        </div>
      </div>
      <aside class="glass-panel mx-auto w-full max-w-[360px] p-4">
        <div id="previewFrame" class="relative mx-auto aspect-[9/16] w-full overflow-hidden rounded-md bg-abyss/80">
          <video id="backgroundPreview" class="h-full w-full object-cover" muted loop playsinline></video>
          <div class="absolute inset-x-5 bottom-16 rounded-md border border-white/10 bg-black/35 p-4 text-center text-2xl font-black uppercase leading-tight" id="captionPreview">${escapeHtml(firstSentence(state.text))}</div>
          <div class="absolute left-5 top-5 text-xs uppercase tracking-[0.22em] text-aqua">Preview</div>
        </div>
        <audio id="audioPreview" class="mt-4 w-full" controls></audio>
      </aside>
    </section>
  `;
}

function projectsPage() {
  const content = state.projects.length
    ? `<div class="grid gap-4 md:grid-cols-2">${state.projects.map(projectCard).join("")}</div>`
    : `<div class="glass-panel p-5 text-white/80">
        <h2 class="text-xl font-semibold text-white">Ainda sem projetos</h2>
        <p class="mt-2">${state.storageReady ? "Cria o primeiro video para aparecer aqui com download persistente." : "A carregar historico local..."}</p>
        <button class="primary-button mt-4" data-nav="/create">Criar video</button>
      </div>`;

  return `
    <section class="mx-auto w-full max-w-6xl px-5 pb-16 pt-6">
      <div class="mb-6 flex items-center justify-between">
        <div><p class="text-sm uppercase tracking-[0.24em] text-aqua">Projetos</p><h1 class="mt-2 text-3xl font-bold">Historico local</h1></div>
        <button class="primary-button" data-nav="/create">Novo</button>
      </div>
      ${content}
    </section>
  `;
}

function projectCard(project: ProjectRecord) {
  const href = project.url || "#";
  const disabled = project.url ? "" : "pointer-events-none opacity-60";
  return `
    <article class="glass-panel p-5 text-white/80">
      <div class="flex items-start justify-between gap-4">
        <div>
          <h2 class="text-xl font-semibold text-white">${escapeHtml(project.title)}</h2>
          <p class="mt-1 text-sm">${formatDate(project.createdAt)}</p>
        </div>
        <span class="rounded-md border border-white/10 bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-aqua">${escapeHtml(project.format)}</span>
      </div>
      <p class="mt-4 line-clamp-3 text-sm leading-6">${escapeHtml(project.text)}</p>
      <div class="mt-4 grid grid-cols-3 gap-2 text-xs text-white/70">
        <div class="rounded-md bg-white/10 p-3"><span class="block text-white">Legenda</span>${escapeHtml(project.captionStyle)}</div>
        <div class="rounded-md bg-white/10 p-3"><span class="block text-white">Tamanho</span>${formatBytes(project.size)}</div>
        <div class="rounded-md bg-white/10 p-3"><span class="block text-white">Duracao</span>${formatDuration(project.duration)}</div>
      </div>
      <a class="primary-button mt-4 inline-flex ${disabled}" href="${href}" download="${escapeAttr(project.filename)}">Download</a>
    </article>
  `;
}

function settingsPage() {
  return `
    <section class="mx-auto w-full max-w-4xl px-5 pb-16 pt-6">
      <div class="glass-panel p-6">
        <p class="text-sm uppercase tracking-[0.24em] text-aqua">Settings</p>
        <h1 class="mt-2 text-3xl font-bold">Voz e modelos locais</h1>
        <div class="mt-6 grid gap-3 sm:grid-cols-2">
          ${["XTTS-v2", "F5-TTS", "Piper", "OpenVoice", "Ollama", "faster-whisper"].map((name) => `<div class="rounded-md border border-white/10 bg-white/10 p-4"><h2 class="font-semibold">${name}</h2><p class="mt-1 text-sm text-white/70">Preparado para integracao depois do MVP.</p></div>`).join("")}
        </div>
      </div>
    </section>
  `;
}

function bindSharedEvents() {
  document.querySelectorAll<HTMLElement>("[data-nav]").forEach((el) => {
    el.addEventListener("click", () => navigate(el.dataset.nav || "/"));
  });
}

function bindCreateEvents() {
  const title = getInput("title");
  const text = document.querySelector<HTMLTextAreaElement>("#text");
  const format = document.querySelector<HTMLSelectElement>("#format");
  const template = document.querySelector<HTMLSelectElement>("#template");
  const captionStyle = document.querySelector<HTMLSelectElement>("#captionStyle");
  const audio = document.querySelector<HTMLInputElement>("#audio");
  const background = document.querySelector<HTMLInputElement>("#background");
  const generate = document.querySelector<HTMLButtonElement>("#generate");

  title?.addEventListener("input", () => {
    state.title = title.value;
  });
  text?.addEventListener("input", () => {
    state.text = text.value;
    const preview = document.querySelector<HTMLDivElement>("#captionPreview");
    if (preview) preview.textContent = firstSentence(state.text);
  });
  format?.addEventListener("change", () => {
    state.format = format.value as VideoFormat;
    updatePreviewAspect();
  });
  template?.addEventListener("change", () => {
    state.template = template.value;
  });
  captionStyle?.addEventListener("change", () => {
    state.captionStyle = captionStyle.value as CaptionStyle;
  });
  audio?.addEventListener("change", () => {
    const file = audio.files?.[0];
    if (!file) return;
    setAudioFile(file);
  });
  background?.addEventListener("change", () => {
    const file = background.files?.[0];
    if (!file) return;
    setBackgroundFile(file);
  });
  generate?.addEventListener("click", () => {
    void generateVideo();
  });
}

function setAudioFile(file: File) {
  if (state.audioUrl) URL.revokeObjectURL(state.audioUrl);
  state.audioFile = file;
  state.audioUrl = URL.createObjectURL(file);
  refreshCreateUi();
}

function setBackgroundFile(file: File) {
  if (state.backgroundUrl) URL.revokeObjectURL(state.backgroundUrl);
  state.backgroundFile = file;
  state.backgroundUrl = URL.createObjectURL(file);
  refreshCreateUi();
}

function refreshCreateUi() {
  const audioLabel = document.querySelector("#audioLabel");
  const backgroundLabel = document.querySelector("#backgroundLabel");
  const audioPreview = document.querySelector<HTMLAudioElement>("#audioPreview");
  const backgroundPreview = document.querySelector<HTMLVideoElement>("#backgroundPreview");
  const download = document.querySelector<HTMLAnchorElement>("#download");

  if (audioLabel) audioLabel.textContent = state.audioFile ? state.audioFile.name : "WAV, MP3, M4A ou AAC";
  if (backgroundLabel) backgroundLabel.textContent = state.backgroundFile ? state.backgroundFile.name : "MP4, MOV ou WEBM";
  if (audioPreview && state.audioUrl) audioPreview.src = state.audioUrl;
  if (backgroundPreview && state.backgroundUrl) {
    backgroundPreview.src = state.backgroundUrl;
    void backgroundPreview.play().catch(() => undefined);
  }
  if (download && state.renderedUrl) {
    download.href = state.renderedUrl;
    download.download = state.renderedName || "psikorender.webm";
    download.classList.remove("hidden");
    download.textContent = `Download ${state.renderedName || "video"}`;
  }
  updatePreviewAspect();
  setStatus(state.status || "Pronto para criar.", state.progress);
}

async function generateVideo() {
  if (state.busy) return;
  if (!state.audioFile || !state.backgroundFile || !state.audioUrl || !state.backgroundUrl) {
    setStatus("Falta selecionar audio e video de fundo.", 0);
    return;
  }

  state.busy = true;
  setBusy(true);
  setStatus("A preparar media...", 5);

  try {
    const result = await renderClientVideo({
      audioUrl: state.audioUrl,
      backgroundUrl: state.backgroundUrl,
      text: state.text,
      format: state.format,
      style: state.captionStyle,
      onProgress: (progress) => setStatus(`A renderizar... ${Math.round(progress)}%`, progress),
    });

    if (state.renderedUrl) URL.revokeObjectURL(state.renderedUrl);
    state.renderedUrl = URL.createObjectURL(result.blob);
    state.renderedName = safeFilename(state.title, result.extension);
    await saveRenderedProject(result.blob, {
      id: crypto.randomUUID(),
      title: state.title.trim() || "Video sem titulo",
      text: state.text.trim() || "PsikoRender",
      format: state.format,
      captionStyle: state.captionStyle,
      filename: state.renderedName,
      mimeType: result.blob.type || "video/webm",
      size: result.blob.size,
      duration: result.duration,
      createdAt: new Date().toISOString(),
      url: state.renderedUrl,
    });
    setStatus("Video gerado com sucesso.", 100);
    refreshCreateUi();
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Falha ao gerar video.", 0);
  } finally {
    state.busy = false;
    setBusy(false);
  }
}

async function renderClientVideo(options: {
  audioUrl: string;
  backgroundUrl: string;
  text: string;
  format: VideoFormat;
  style: CaptionStyle;
  onProgress: (progress: number) => void;
}) {
  if (!("MediaRecorder" in window)) {
    throw new Error("Este browser nao suporta MediaRecorder.");
  }

  const { width, height } = dimensions(options.format);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Nao foi possivel criar canvas de render.");

  const video = document.querySelector<HTMLVideoElement>("#backgroundPreview");
  const audio = document.querySelector<HTMLAudioElement>("#audioPreview");
  if (!video || !audio) throw new Error("Preview de audio/video nao encontrado.");
  await Promise.all([waitForMedia(video), waitForMedia(audio)]);
  video.currentTime = 0;
  audio.currentTime = 0;
  video.loop = true;
  video.muted = true;

  const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 10;
  const segments = buildSegments(options.text, duration);
  const canvasStream = canvas.captureStream(30);
  const audioStream = captureElementStream(audio);

  const stream = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...audioStream.getAudioTracks(),
  ]);
  const mimeType = pickMimeType();
  const chunks: BlobPart[] = [];
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  recorder.addEventListener("dataavailable", (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  });

  const stopped = new Promise<void>((resolve) => recorder.addEventListener("stop", () => resolve(), { once: true }));
  let animationFrame = 0;

  const draw = () => {
    drawFrame(ctx, video, width, height, segments, audio.currentTime, options.style);
    options.onProgress(Math.min(99, (audio.currentTime / duration) * 100));
    if (!audio.ended && !audio.paused) {
      animationFrame = requestAnimationFrame(draw);
    }
  };

  recorder.start(250);
  await new Promise((resolve) => window.setTimeout(resolve, 100));
  await video.play();
  await audio.play();
  draw();

  await Promise.race([
    new Promise<void>((resolve) => {
      audio.addEventListener("ended", () => resolve(), { once: true });
    }),
    new Promise<void>((resolve) => window.setTimeout(resolve, duration * 1000 + 500)),
  ]);

  cancelAnimationFrame(animationFrame);
  drawFrame(ctx, video, width, height, segments, duration, options.style);
  recorder.requestData();
  recorder.stop();
  video.pause();
  audio.pause();
  await stopped;

  const blob = new Blob(chunks, { type: mimeType || "video/webm" });
  if (blob.size === 0) throw new Error("O browser gerou um ficheiro vazio.");

  return {
    blob,
    extension: mimeType.includes("mp4") ? "mp4" : "webm",
    duration,
  };
}

async function saveRenderedProject(blob: Blob, project: ProjectRecord) {
  await putStoredProject(project, blob);
  state.projects = [project, ...state.projects.filter((item) => item.id !== project.id)].slice(0, 24);
}

async function loadProjectHistory() {
  try {
    state.projects = await listStoredProjects();
  } catch {
    state.projects = [];
  } finally {
    state.storageReady = true;
    render();
  }
}

function openProjectDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("psikorender-projects", 1);
    request.addEventListener("upgradeneeded", () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("projects")) db.createObjectStore("projects", { keyPath: "id" });
    });
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error));
  });
}

async function putStoredProject(project: ProjectRecord, blob: Blob) {
  const db = await openProjectDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("projects", "readwrite");
    tx.objectStore("projects").put({ ...project, url: undefined, blob });
    tx.addEventListener("complete", () => resolve());
    tx.addEventListener("error", () => reject(tx.error));
  });
  db.close();
}

async function listStoredProjects() {
  const db = await openProjectDb();
  const rows = await new Promise<Array<ProjectRecord & { blob?: Blob }>>((resolve, reject) => {
    const request = db.transaction("projects", "readonly").objectStore("projects").getAll();
    request.addEventListener("success", () => resolve(request.result as Array<ProjectRecord & { blob?: Blob }>));
    request.addEventListener("error", () => reject(request.error));
  });
  db.close();
  return rows
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .map((row) => {
      const { blob, ...project } = row;
      return { ...project, url: blob ? URL.createObjectURL(blob) : undefined };
    });
}

function captureElementStream(media: HTMLMediaElement) {
  const element = media as HTMLMediaElement & {
    captureStream?: () => MediaStream;
    mozCaptureStream?: () => MediaStream;
  };
  const stream = element.captureStream?.() || element.mozCaptureStream?.();
  if (!stream) throw new Error("Este browser nao consegue capturar audio do elemento carregado.");
  return stream;
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  width: number,
  height: number,
  segments: Segment[],
  time: number,
  style: CaptionStyle,
) {
  drawCover(ctx, video, width, height);
  const segment = segments.find((item) => time >= item.start && time <= item.end) || segments.at(-1);
  if (!segment) return;

  const text = style === "manifesto" ? segment.text.toUpperCase() : segment.text;
  const fontSize = style === "minimal" ? Math.round(width * 0.064) : Math.round(width * 0.078);
  const lines = wrapText(ctx, text, width * 0.82, `${style === "minimal" ? 700 : 900} ${fontSize}px Arial`);
  const lineHeight = fontSize * 1.16;
  const blockHeight = lines.length * lineHeight;
  const y = height - Math.max(height * 0.13, blockHeight + 80);

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${style === "minimal" ? 700 : 900} ${fontSize}px Arial`;
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(8, 32, 50, 0.95)";
  ctx.lineWidth = style === "minimal" ? 8 : 12;
  ctx.shadowColor = "rgba(0, 0, 0, 0.55)";
  ctx.shadowBlur = 18;
  ctx.fillStyle = style === "karaoke_basic" ? "#f0d9a7" : "#ffffff";

  lines.forEach((line, index) => {
    const lineY = y + index * lineHeight;
    ctx.strokeText(line, width / 2, lineY);
    ctx.fillText(line, width / 2, lineY);
  });
  ctx.restore();
}

function drawCover(ctx: CanvasRenderingContext2D, video: HTMLVideoElement, width: number, height: number) {
  const sourceWidth = video.videoWidth || width;
  const sourceHeight = video.videoHeight || height;
  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  const x = (width - drawWidth) / 2;
  const y = (height - drawHeight) / 2;
  ctx.drawImage(video, x, y, drawWidth, drawHeight);
}

function buildSegments(text: string, duration: number): Segment[] {
  const sentences = splitSentences(text);
  const total = sentences.reduce((sum, item) => sum + Math.max(1, item.length), 0);
  let cursor = 0;
  return sentences.map((sentence, index) => {
    const end =
      index === sentences.length - 1
        ? duration
        : Math.min(duration, cursor + duration * (Math.max(1, sentence.length) / total));
    const segment = { text: sentence, start: cursor, end: Math.max(end, cursor + 0.8) };
    cursor = segment.end;
    return segment;
  });
}

function splitSentences(text: string) {
  const matches = text.match(/[^.!?\n]+[.!?\n]*/g)?.map((part) => part.trim()).filter(Boolean);
  return matches?.length ? matches : ["PsikoRender"];
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, font: string) {
  ctx.font = font;
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 4);
}

function waitForMedia(media: HTMLMediaElement) {
  return new Promise<void>((resolve, reject) => {
    if (media.readyState >= 1) {
      resolve();
      return;
    }

    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("O browser nao conseguiu carregar os metadados do audio/video."));
    }, 8000);
    const interval = window.setInterval(() => {
      if (media.readyState >= 1) {
        cleanup();
        resolve();
      }
    }, 100);

    const cleanup = () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
      media.removeEventListener("loadedmetadata", onLoaded);
      media.removeEventListener("canplay", onLoaded);
      media.removeEventListener("error", onError);
    };
    const onLoaded = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("Nao foi possivel carregar um ficheiro de media."));
    };

    media.addEventListener("loadedmetadata", onLoaded, { once: true });
    media.addEventListener("canplay", onLoaded, { once: true });
    media.addEventListener("error", onError, {
      once: true,
    });
    media.load();
  });
}

function pickMimeType() {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
  ];
  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) || "";
}

function dimensions(format: VideoFormat) {
  if (format === "square") return { width: 1080, height: 1080 };
  if (format === "landscape") return { width: 1920, height: 1080 };
  return { width: 1080, height: 1920 };
}

function updatePreviewAspect() {
  const frame = document.querySelector<HTMLDivElement>("#previewFrame");
  if (!frame) return;
  frame.classList.remove("aspect-[9/16]", "aspect-square", "aspect-video");
  if (state.format === "square") frame.classList.add("aspect-square");
  else if (state.format === "landscape") frame.classList.add("aspect-video");
  else frame.classList.add("aspect-[9/16]");
}

function setBusy(busy: boolean) {
  const button = document.querySelector<HTMLButtonElement>("#generate");
  if (!button) return;
  button.disabled = busy;
  button.textContent = busy ? "A renderizar..." : "Gerar video";
}

function setStatus(message: string, progress: number) {
  state.status = message;
  state.progress = progress;
  const status = document.querySelector("#status");
  const bar = document.querySelector<HTMLDivElement>("#progressBar");
  if (status) status.textContent = message;
  if (bar) bar.style.width = `${Math.max(0, Math.min(100, progress))}%`;
}

function firstSentence(text: string) {
  return splitSentences(text)[0] || "Texto do video";
}

function safeFilename(title: string, extension: string) {
  const safe = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return `${safe || "psikorender"}.${extension}`;
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDuration(seconds: number) {
  return `${Math.max(1, Math.round(seconds))}s`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-PT", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function option(value: string, label: string, current: string) {
  return `<option value="${value}" ${value === current ? "selected" : ""}>${label}</option>`;
}

function getInput(id: string) {
  return document.querySelector<HTMLInputElement>(`#${id}`);
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] || char,
  );
}

function escapeAttr(value: string) {
  return escapeHtml(value);
}

render();
void loadProjectHistory();
