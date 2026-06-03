import "./styles.css";

type VideoFormat = "vertical" | "square" | "landscape";
type CaptionStyle = "minimal" | "bold" | "karaoke_basic" | "manifesto";
type RenderTemplate = "minimal" | "cinematic" | "manifesto";
type ProjectFilter = "all" | VideoFormat;
type ProjectSort = "newest" | "oldest" | "largest";

const AUDIO_UPLOAD = {
  label: "WAV, MP3, M4A ou AAC ate 50 MB",
  extensions: ["wav", "mp3", "m4a", "aac"],
  mimePrefix: "audio/",
  maxBytes: 50 * 1024 * 1024,
};

const BACKGROUND_UPLOAD = {
  label: "MP4, MOV ou WEBM ate 200 MB",
  extensions: ["mp4", "mov", "webm"],
  mimePrefix: "video/",
  maxBytes: 200 * 1024 * 1024,
};

const defaultDraft: DraftState = {
  title: "Primeiro video",
  text: "Escreve aqui o texto do teu video. Divide ideias em frases curtas para legendas mais fortes.",
  format: "vertical",
  template: "minimal",
  captionStyle: "bold",
};

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
  template: RenderTemplate;
  captionStyle: CaptionStyle;
  filename: string;
  mimeType: string;
  size: number;
  duration: number;
  createdAt: string;
  thumbnailUrl?: string;
  url?: string;
};

type DraftState = {
  title: string;
  text: string;
  format: VideoFormat;
  template: RenderTemplate;
  captionStyle: CaptionStyle;
};

type State = {
  path: string;
  title: string;
  text: string;
  format: VideoFormat;
  template: RenderTemplate;
  captionStyle: CaptionStyle;
  audioFile?: File;
  backgroundFile?: File;
  audioUrl?: string;
  backgroundUrl?: string;
  renderedUrl?: string;
  renderedName?: string;
  renderedMimeType?: string;
  renderedSize?: number;
  renderedDuration?: number;
  projects: ProjectRecord[];
  projectFilter: ProjectFilter;
  projectSort: ProjectSort;
  pendingDeleteId?: string;
  pendingClearProjects: boolean;
  storageReady: boolean;
  status: string;
  progress: number;
  busy: boolean;
};

const savedDraft = loadDraft();
const savedProjectView = loadProjectView();

const state: State = {
  path: window.location.pathname,
  title: savedDraft.title,
  text: savedDraft.text,
  format: savedDraft.format,
  template: savedDraft.template,
  captionStyle: savedDraft.captionStyle,
  projects: [],
  projectFilter: savedProjectView.projectFilter,
  projectSort: savedProjectView.projectSort,
  pendingClearProjects: false,
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
  state.pendingDeleteId = undefined;
  state.pendingClearProjects = false;
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
            <label class="upload-box"><span>Audio de voz</span><input id="audio" type="file" accept=".wav,.mp3,.m4a,.aac,audio/*" /><small id="audioLabel">${AUDIO_UPLOAD.label}</small></label>
            <label class="upload-box"><span>Video de fundo</span><input id="background" type="file" accept=".mp4,.mov,.webm,video/*" /><small id="backgroundLabel">${BACKGROUND_UPLOAD.label}</small></label>
          </div>
          <div class="grid gap-3 sm:grid-cols-2">
            <button id="demoMedia" class="secondary-button w-full justify-center" type="button">Usar media demo</button>
            <button id="clearDraft" class="secondary-button w-full justify-center" type="button">Limpar rascunho</button>
          </div>
          <button id="generate" class="primary-button w-full justify-center disabled:opacity-50">Gerar video</button>
          <div class="h-3 overflow-hidden rounded-full bg-white/10"><div id="progressBar" class="h-full rounded-full bg-gradient-to-r from-aqua to-sand transition-all" style="width: 0%"></div></div>
          <p id="status" class="rounded-md bg-white/10 p-3 text-sm text-white/80">Pronto para criar.</p>
          <a id="download" class="secondary-button hidden justify-center" download>Download do video</a>
          <div id="resultSummary" class="hidden rounded-md border border-white/10 bg-white/10 p-3 text-sm text-white/80"></div>
        </div>
      </div>
      <aside class="glass-panel mx-auto w-full max-w-[360px] p-4">
        <div id="previewFrame" class="relative mx-auto aspect-[9/16] w-full overflow-hidden rounded-md bg-abyss/80" data-template="${state.template}">
          <video id="backgroundPreview" class="h-full w-full object-cover" muted loop playsinline></video>
          <div id="templatePreview" class="pointer-events-none absolute inset-0"></div>
          <div class="absolute inset-x-5 bottom-16 rounded-md border border-white/10 bg-black/35 p-4 text-center text-2xl font-black uppercase leading-tight" id="captionPreview">${escapeHtml(firstSentence(state.text))}</div>
          <div class="absolute left-5 top-5 text-xs uppercase tracking-[0.22em] text-aqua">Preview</div>
        </div>
        <audio id="audioPreview" class="mt-4 w-full" controls></audio>
      </aside>
    </section>
  `;
}

function projectsPage() {
  const totalBytes = state.projects.reduce((sum, project) => sum + project.size, 0);
  const totalDuration = state.projects.reduce((sum, project) => sum + project.duration, 0);
  const visibleProjects = filteredProjects();
  const stats = state.projects.length
    ? `<div class="mb-6 grid gap-3 sm:grid-cols-3">
        <div class="rounded-md border border-white/10 bg-white/10 p-4"><span class="block text-sm text-white/65">Projetos</span><span class="text-2xl font-bold text-white">${state.projects.length}</span></div>
        <div class="rounded-md border border-white/10 bg-white/10 p-4"><span class="block text-sm text-white/65">Storage local</span><span class="text-2xl font-bold text-white">${formatBytes(totalBytes)}</span></div>
        <div class="rounded-md border border-white/10 bg-white/10 p-4"><span class="block text-sm text-white/65">Duracao total</span><span class="text-2xl font-bold text-white">${formatDuration(totalDuration)}</span></div>
      </div>`
    : "";
  const controls = state.projects.length
    ? `<div class="mb-6 grid gap-3 rounded-md border border-white/10 bg-white/10 p-4 sm:grid-cols-2">
        <label class="field-label">Formato<select id="projectFilter" class="input">${option("all", "Todos", state.projectFilter)}${option("vertical", "9:16", state.projectFilter)}${option("square", "1:1", state.projectFilter)}${option("landscape", "16:9", state.projectFilter)}</select></label>
        <label class="field-label">Ordenar<select id="projectSort" class="input">${option("newest", "Mais recentes", state.projectSort)}${option("oldest", "Mais antigos", state.projectSort)}${option("largest", "Maior ficheiro", state.projectSort)}</select></label>
      </div>`
    : "";
  const content = state.projects.length
    ? visibleProjects.length
      ? `<div class="grid gap-4 md:grid-cols-2">${visibleProjects.map(projectCard).join("")}</div>`
      : `<div class="glass-panel p-5 text-white/80"><h2 class="text-xl font-semibold text-white">Sem resultados</h2><p class="mt-2">Nao ha projetos para este filtro.</p></div>`
    : `<div class="glass-panel p-5 text-white/80">
        <h2 class="text-xl font-semibold text-white">Ainda sem projetos</h2>
        <p class="mt-2">${state.storageReady ? "Cria o primeiro video para aparecer aqui com download persistente." : "A carregar historico local..."}</p>
        <button class="primary-button mt-4" data-nav="/create">Criar video</button>
      </div>`;

  return `
    <section class="mx-auto w-full max-w-6xl px-5 pb-16 pt-6">
      <div class="mb-6 flex items-center justify-between">
        <div><p class="text-sm uppercase tracking-[0.24em] text-aqua">Projetos</p><h1 class="mt-2 text-3xl font-bold">Historico local</h1></div>
        <div class="flex flex-wrap justify-end gap-3">
          ${state.projects.length ? `<button class="secondary-button ${state.pendingClearProjects ? "border-sand/70 text-sand" : ""}" id="clearProjects">${state.pendingClearProjects ? "Confirmar limpar" : "Limpar historico"}</button>` : ""}
          <button class="primary-button" data-nav="/create">Novo</button>
        </div>
      </div>
      ${stats}
      ${controls}
      ${content}
    </section>
  `;
}

function projectCard(project: ProjectRecord) {
  const href = project.url || "#";
  const disabled = project.url ? "" : "pointer-events-none opacity-60";
  const isPendingDelete = state.pendingDeleteId === project.id;
  return `
    <article class="glass-panel p-5 text-white/80">
      ${project.thumbnailUrl ? `<img class="mb-4 aspect-video w-full rounded-md object-cover" src="${escapeAttr(project.thumbnailUrl)}" alt="Preview de ${escapeAttr(project.title)}" />` : ""}
      <div class="flex items-start justify-between gap-4">
        <div>
          <h2 class="text-xl font-semibold text-white">${escapeHtml(project.title)}</h2>
          <p class="mt-1 text-sm">${formatDate(project.createdAt)}</p>
        </div>
        <span class="rounded-md border border-white/10 bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-aqua">${escapeHtml(project.format)}</span>
      </div>
      <p class="mt-4 line-clamp-3 text-sm leading-6">${escapeHtml(project.text)}</p>
      <div class="mt-4 grid grid-cols-2 gap-2 text-xs text-white/70 sm:grid-cols-4">
        <div class="rounded-md bg-white/10 p-3"><span class="block text-white">Template</span>${escapeHtml(project.template)}</div>
        <div class="rounded-md bg-white/10 p-3"><span class="block text-white">Legenda</span>${escapeHtml(project.captionStyle)}</div>
        <div class="rounded-md bg-white/10 p-3"><span class="block text-white">Tamanho</span>${formatBytes(project.size)}</div>
        <div class="rounded-md bg-white/10 p-3"><span class="block text-white">Duracao</span>${formatDuration(project.duration)}</div>
      </div>
      <div class="mt-4 flex flex-wrap gap-3">
        <a class="primary-button inline-flex ${disabled}" href="${href}" download="${escapeAttr(project.filename)}">Download</a>
        <button class="secondary-button" data-reuse-project="${escapeAttr(project.id)}">Reutilizar</button>
        <button class="secondary-button ${isPendingDelete ? "border-sand/70 text-sand" : ""}" data-delete-project="${escapeAttr(project.id)}">${isPendingDelete ? "Confirmar apagar" : "Apagar"}</button>
      </div>
    </article>
  `;
}

function filteredProjects() {
  const filtered =
    state.projectFilter === "all"
      ? [...state.projects]
      : state.projects.filter((project) => project.format === state.projectFilter);

  return filtered.sort((a, b) => {
    if (state.projectSort === "oldest") return Date.parse(a.createdAt) - Date.parse(b.createdAt);
    if (state.projectSort === "largest") return b.size - a.size;
    return Date.parse(b.createdAt) - Date.parse(a.createdAt);
  });
}

function settingsPage() {
  const capabilities = browserCapabilities();
  return `
    <section class="mx-auto grid w-full max-w-5xl gap-6 px-5 pb-16 pt-6 lg:grid-cols-[1fr_360px]">
      <div class="glass-panel p-6">
        <p class="text-sm uppercase tracking-[0.24em] text-aqua">Settings</p>
        <h1 class="mt-2 text-3xl font-bold">Voz e modelos locais</h1>
        <div class="mt-6 grid gap-3 sm:grid-cols-2">
          ${["XTTS-v2", "F5-TTS", "Piper", "OpenVoice", "Ollama", "faster-whisper"].map((name) => `<div class="rounded-md border border-white/10 bg-white/10 p-4"><h2 class="font-semibold">${name}</h2><p class="mt-1 text-sm text-white/70">Preparado para integracao depois do MVP.</p></div>`).join("")}
        </div>
      </div>
      <aside class="glass-panel p-6">
        <p class="text-sm uppercase tracking-[0.24em] text-aqua">Browser</p>
        <h2 class="mt-2 text-2xl font-bold">Diagnostico local</h2>
        <div class="mt-5 grid gap-3">
          ${capabilityRow("MediaRecorder", capabilities.mediaRecorder)}
          ${capabilityRow("Canvas capture", capabilities.canvasCapture)}
          ${capabilityRow("Audio capture", capabilities.audioCapture)}
          ${capabilityRow("IndexedDB", capabilities.indexedDb)}
          ${capabilityRow("WebM export", capabilities.webmExport)}
        </div>
        <div class="mt-5 rounded-md bg-white/10 p-4 text-sm text-white/75">
          <span class="block font-semibold text-white">Export preferido</span>
          <span>${escapeHtml(capabilities.preferredMime || "Nao detectado")}</span>
        </div>
      </aside>
    </section>
  `;
}

function capabilityRow(label: string, ok: boolean) {
  return `
    <div class="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-white/10 p-3 text-sm">
      <span class="font-medium text-white">${label}</span>
      <span class="${ok ? "text-aqua" : "text-sand"}">${ok ? "OK" : "Falta"}</span>
    </div>
  `;
}

function bindSharedEvents() {
  document.querySelectorAll<HTMLElement>("[data-nav]").forEach((el) => {
    el.addEventListener("click", () => navigate(el.dataset.nav || "/"));
  });
  document.querySelectorAll<HTMLButtonElement>("[data-delete-project]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.deleteProject;
      if (id) confirmOrDeleteProject(id);
    });
  });
  document.querySelectorAll<HTMLButtonElement>("[data-reuse-project]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.reuseProject;
      if (id) reuseProject(id);
    });
  });
  document.querySelector<HTMLButtonElement>("#clearProjects")?.addEventListener("click", () => {
    confirmOrClearProjects();
  });
  const projectFilter = document.querySelector<HTMLSelectElement>("#projectFilter");
  const projectSort = document.querySelector<HTMLSelectElement>("#projectSort");
  projectFilter?.addEventListener("change", () => {
    state.projectFilter = projectFilter.value as ProjectFilter;
    saveProjectView();
    render();
  });
  projectSort?.addEventListener("change", () => {
    state.projectSort = projectSort.value as ProjectSort;
    saveProjectView();
    render();
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
  const demoMedia = document.querySelector<HTMLButtonElement>("#demoMedia");
  const clearDraft = document.querySelector<HTMLButtonElement>("#clearDraft");
  const generate = document.querySelector<HTMLButtonElement>("#generate");

  title?.addEventListener("input", () => {
    state.title = title.value;
    saveDraft();
    clearRenderedResult();
  });
  text?.addEventListener("input", () => {
    state.text = text.value;
    saveDraft();
    clearRenderedResult();
    const preview = document.querySelector<HTMLDivElement>("#captionPreview");
    if (preview) preview.textContent = firstSentence(state.text);
  });
  format?.addEventListener("change", () => {
    state.format = format.value as VideoFormat;
    saveDraft();
    clearRenderedResult();
    updatePreviewAspect();
  });
  template?.addEventListener("change", () => {
    state.template = template.value as RenderTemplate;
    saveDraft();
    clearRenderedResult();
    updateTemplatePreview();
  });
  captionStyle?.addEventListener("change", () => {
    state.captionStyle = captionStyle.value as CaptionStyle;
    saveDraft();
    clearRenderedResult();
  });
  audio?.addEventListener("change", () => {
    const file = audio.files?.[0];
    if (!file) return;
    const error = validateUpload(file, AUDIO_UPLOAD);
    if (error) {
      clearAudioFile();
      audio.value = "";
      setStatus(error, 0);
      return;
    }
    setAudioFile(file);
    setStatus("Audio carregado com sucesso.", state.progress);
  });
  background?.addEventListener("change", () => {
    const file = background.files?.[0];
    if (!file) return;
    const error = validateUpload(file, BACKGROUND_UPLOAD);
    if (error) {
      clearBackgroundFile();
      background.value = "";
      setStatus(error, 0);
      return;
    }
    setBackgroundFile(file);
    setStatus("Video de fundo carregado com sucesso.", state.progress);
  });
  demoMedia?.addEventListener("click", () => {
    void useDemoMedia();
  });
  clearDraft?.addEventListener("click", () => {
    resetCreateDraft();
  });
  generate?.addEventListener("click", () => {
    void generateVideo();
  });
}

function setAudioFile(file: File) {
  clearRenderedResult();
  clearAudioUrl();
  state.audioFile = file;
  state.audioUrl = URL.createObjectURL(file);
  refreshCreateUi();
}

function setBackgroundFile(file: File) {
  clearRenderedResult();
  clearBackgroundUrl();
  state.backgroundFile = file;
  state.backgroundUrl = URL.createObjectURL(file);
  refreshCreateUi();
}

async function useDemoMedia() {
  if (state.busy) return;
  setStatus("A criar media demo...", 8);
  setBusy(true);

  try {
    const [audioFile, backgroundFile] = await Promise.all([createDemoAudioFile(), createDemoBackgroundFile()]);
    setAudioFile(audioFile);
    setBackgroundFile(backgroundFile);
    if (state.title === "Primeiro video") state.title = "Demo PsikoRender";
    if (state.text.startsWith("Escreve aqui")) {
      state.text = "Demo PsikoRender pronta para testar. O video e o audio foram criados neste browser.";
    }
    saveDraft();
    render();
    setStatus("Media demo carregada. Podes gerar o video.", 0);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Falha ao criar media demo.", 0);
  } finally {
    setBusy(false);
  }
}

function clearAudioFile() {
  clearRenderedResult();
  clearAudioUrl();
  state.audioFile = undefined;
  state.audioUrl = undefined;
  refreshCreateUi();
}

function clearBackgroundFile() {
  clearRenderedResult();
  clearBackgroundUrl();
  state.backgroundFile = undefined;
  state.backgroundUrl = undefined;
  refreshCreateUi();
}

function clearAudioUrl() {
  if (state.audioUrl) URL.revokeObjectURL(state.audioUrl);
}

function clearBackgroundUrl() {
  if (state.backgroundUrl) URL.revokeObjectURL(state.backgroundUrl);
}

function resetCreateDraft() {
  clearAudioUrl();
  clearBackgroundUrl();
  clearRenderedResult();
  state.title = defaultDraft.title;
  state.text = defaultDraft.text;
  state.format = defaultDraft.format;
  state.template = defaultDraft.template;
  state.captionStyle = defaultDraft.captionStyle;
  state.audioFile = undefined;
  state.backgroundFile = undefined;
  state.audioUrl = undefined;
  state.backgroundUrl = undefined;
  localStorage.removeItem("psikorender-create-draft");
  state.status = "Rascunho limpo.";
  state.progress = 0;
  render();
}

function clearRenderedResult() {
  if (state.renderedUrl) URL.revokeObjectURL(state.renderedUrl);
  state.renderedUrl = undefined;
  state.renderedName = undefined;
  state.renderedMimeType = undefined;
  state.renderedSize = undefined;
  state.renderedDuration = undefined;
  refreshCreateUi();
}

function refreshCreateUi() {
  const audioLabel = document.querySelector("#audioLabel");
  const backgroundLabel = document.querySelector("#backgroundLabel");
  const audioPreview = document.querySelector<HTMLAudioElement>("#audioPreview");
  const backgroundPreview = document.querySelector<HTMLVideoElement>("#backgroundPreview");
  const download = document.querySelector<HTMLAnchorElement>("#download");
  const resultSummary = document.querySelector<HTMLDivElement>("#resultSummary");

  if (audioLabel) audioLabel.textContent = state.audioFile ? `${state.audioFile.name} (${formatBytes(state.audioFile.size)})` : AUDIO_UPLOAD.label;
  if (backgroundLabel) {
    backgroundLabel.textContent = state.backgroundFile
      ? `${state.backgroundFile.name} (${formatBytes(state.backgroundFile.size)})`
      : BACKGROUND_UPLOAD.label;
  }
  if (audioPreview) audioPreview.src = state.audioUrl || "";
  if (backgroundPreview && state.backgroundUrl) {
    backgroundPreview.src = state.backgroundUrl;
    void backgroundPreview.play().catch(() => undefined);
  } else if (backgroundPreview) {
    backgroundPreview.removeAttribute("src");
    backgroundPreview.load();
  }
  if (download && state.renderedUrl) {
    download.href = state.renderedUrl;
    download.download = state.renderedName || "psikorender.webm";
    download.classList.remove("hidden");
    download.textContent = `Download ${state.renderedName || "video"}`;
  } else if (download) {
    download.removeAttribute("href");
    download.classList.add("hidden");
  }
  if (resultSummary && state.renderedName && state.renderedSize && state.renderedDuration) {
    resultSummary.classList.remove("hidden");
    resultSummary.innerHTML = `
      <span class="block font-semibold text-white">Resultado pronto</span>
      <span class="mt-1 block">${escapeHtml(state.renderedName)} | ${formatBytes(state.renderedSize)} | ${formatDuration(state.renderedDuration)} | ${escapeHtml(displayMimeType(state.renderedMimeType || ""))}</span>
    `;
  } else if (resultSummary) {
    resultSummary.classList.add("hidden");
    resultSummary.textContent = "";
  }
  updatePreviewAspect();
  updateTemplatePreview();
  setStatus(state.status || "Pronto para criar.", state.progress);
}

async function generateVideo() {
  if (state.busy) return;
  if (state.text.trim().length < 10) {
    setStatus("Escreve pelo menos 10 caracteres de texto para gerar legendas.", 0);
    return;
  }
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
      template: state.template,
      style: state.captionStyle,
      onProgress: (progress) => setStatus(`A renderizar... ${Math.round(progress)}%`, progress),
    });

    if (state.renderedUrl) URL.revokeObjectURL(state.renderedUrl);
    state.renderedUrl = URL.createObjectURL(result.blob);
    state.renderedName = safeFilename(state.title, result.extension);
    state.renderedMimeType = result.blob.type || "video/webm";
    state.renderedSize = result.blob.size;
    state.renderedDuration = result.duration;
    await saveRenderedProject(result.blob, {
      id: crypto.randomUUID(),
      title: state.title.trim() || "Video sem titulo",
      text: state.text.trim() || "PsikoRender",
      format: state.format,
      template: state.template,
      captionStyle: state.captionStyle,
      filename: state.renderedName,
      mimeType: result.blob.type || "video/webm",
      size: result.blob.size,
      duration: result.duration,
      thumbnailUrl: result.thumbnailUrl,
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
  template: RenderTemplate;
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
    drawFrame(ctx, video, width, height, segments, audio.currentTime, options.style, options.template);
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
  drawFrame(ctx, video, width, height, segments, duration, options.style, options.template);
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
    thumbnailUrl: canvas.toDataURL("image/jpeg", 0.78),
  };
}

async function saveRenderedProject(blob: Blob, project: ProjectRecord) {
  await putStoredProject(project, blob);
  state.projects = [project, ...state.projects.filter((item) => item.id !== project.id)].slice(0, 24);
}

async function deleteProject(id: string) {
  const project = state.projects.find((item) => item.id === id);
  if (project?.url) URL.revokeObjectURL(project.url);
  await deleteStoredProject(id);
  state.projects = state.projects.filter((item) => item.id !== id);
  state.pendingDeleteId = undefined;
  render();
}

async function clearProjects() {
  state.projects.forEach((project) => {
    if (project.url) URL.revokeObjectURL(project.url);
  });
  await clearStoredProjects();
  state.projects = [];
  state.pendingDeleteId = undefined;
  state.pendingClearProjects = false;
  render();
}

function confirmOrDeleteProject(id: string) {
  state.pendingClearProjects = false;
  if (state.pendingDeleteId === id) {
    void deleteProject(id);
    return;
  }

  state.pendingDeleteId = id;
  render();
}

function confirmOrClearProjects() {
  state.pendingDeleteId = undefined;
  if (state.pendingClearProjects) {
    void clearProjects();
    return;
  }

  state.pendingClearProjects = true;
  render();
}

function reuseProject(id: string) {
  const project = state.projects.find((item) => item.id === id);
  if (!project) return;

  clearAudioUrl();
  clearBackgroundUrl();
  clearRenderedResult();
  state.title = project.title;
  state.text = project.text;
  state.format = project.format;
  state.template = project.template;
  state.captionStyle = project.captionStyle;
  state.audioFile = undefined;
  state.backgroundFile = undefined;
  state.audioUrl = undefined;
  state.backgroundUrl = undefined;
  state.status = "Projeto reutilizado. Carrega media ou usa a demo.";
  state.progress = 0;
  saveDraft();
  navigate("/create");
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

async function deleteStoredProject(id: string) {
  const db = await openProjectDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("projects", "readwrite");
    tx.objectStore("projects").delete(id);
    tx.addEventListener("complete", () => resolve());
    tx.addEventListener("error", () => reject(tx.error));
  });
  db.close();
}

async function clearStoredProjects() {
  const db = await openProjectDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("projects", "readwrite");
    tx.objectStore("projects").clear();
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
      return { ...project, template: project.template || "minimal", url: blob ? URL.createObjectURL(blob) : undefined };
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

async function createDemoAudioFile() {
  const sampleRate = 44100;
  const duration = 2.4;
  const samples = Math.floor(sampleRate * duration);
  const pcm = new Int16Array(samples);

  for (let index = 0; index < samples; index += 1) {
    const t = index / sampleRate;
    const envelope = Math.min(1, t * 5, (duration - t) * 5);
    const tone = Math.sin(2 * Math.PI * 220 * t) * 0.55 + Math.sin(2 * Math.PI * 330 * t) * 0.25;
    pcm[index] = Math.max(-1, Math.min(1, tone * envelope)) * 0x7fff;
  }

  const blob = new Blob([wavHeader(samples, sampleRate), pcm], { type: "audio/wav" });
  return new File([blob], "psikorender-demo-voice.wav", { type: "audio/wav" });
}

async function createDemoBackgroundFile() {
  if (!("MediaRecorder" in window)) {
    throw new Error("Este browser nao suporta criacao de video demo.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = 720;
  canvas.height = 1280;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Nao foi possivel criar canvas demo.");

  const stream = canvas.captureStream(30);
  const mimeType = pickBackgroundDemoMimeType();
  const chunks: BlobPart[] = [];
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  recorder.addEventListener("dataavailable", (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  });

  const stopped = new Promise<void>((resolve) => recorder.addEventListener("stop", () => resolve(), { once: true }));
  const startedAt = performance.now();
  const durationMs = 2600;
  let frame = 0;

  const draw = () => {
    const elapsed = performance.now() - startedAt;
    const progress = Math.min(1, elapsed / durationMs);
    drawDemoBackground(ctx, canvas.width, canvas.height, progress, frame);
    frame += 1;
    if (progress < 1) requestAnimationFrame(draw);
    else recorder.stop();
  };

  recorder.start(250);
  draw();
  await stopped;

  const blob = new Blob(chunks, { type: mimeType || "video/webm" });
  if (blob.size === 0) throw new Error("O video demo ficou vazio.");
  return new File([blob], "psikorender-demo-background.webm", { type: blob.type || "video/webm" });
}

function wavHeader(samples: number, sampleRate: number) {
  const buffer = new ArrayBuffer(44);
  const view = new DataView(buffer);
  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + samples * 2, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, samples * 2, true);
  return buffer;
}

function writeAscii(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index));
}

function drawDemoBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  progress: number,
  frame: number,
) {
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#082032");
  gradient.addColorStop(0.45, "#0f3f50");
  gradient.addColorStop(1, "#f0d9a7");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "rgba(103, 232, 249, 0.2)";
  for (let index = 0; index < 7; index += 1) {
    const x = ((index * 143 + frame * 7) % (width + 160)) - 80;
    const y = height * (0.18 + index * 0.1) + Math.sin(progress * Math.PI * 2 + index) * 32;
    ctx.beginPath();
    ctx.arc(x, y, 62 + index * 6, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "rgba(8, 32, 50, 0.42)";
  ctx.fillRect(0, height * 0.7, width, height * 0.3);
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 54px Arial";
  ctx.textAlign = "center";
  ctx.fillText("PsikoRender", width / 2, height * 0.78);
  ctx.font = "700 28px Arial";
  ctx.fillStyle = "rgba(255, 255, 255, 0.76)";
  ctx.fillText("media demo local", width / 2, height * 0.82);
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  width: number,
  height: number,
  segments: Segment[],
  time: number,
  style: CaptionStyle,
  template: RenderTemplate,
) {
  drawCover(ctx, video, width, height);
  drawTemplateOverlay(ctx, width, height, template);
  const segment = segments.find((item) => time >= item.start && time <= item.end) || segments.at(-1);
  if (!segment) return;

  const text = style === "manifesto" ? segment.text.toUpperCase() : segment.text;
  const fontSize = style === "minimal" ? Math.round(width * 0.064) : Math.round(width * 0.078);
  const lines = wrapText(ctx, text, width * 0.82, `${style === "minimal" ? 700 : 900} ${fontSize}px Arial`);
  const lineHeight = fontSize * 1.16;
  const blockHeight = lines.length * lineHeight;
  const y = height - Math.max(height * 0.13, blockHeight + 80);

  ctx.save();
  if (template === "manifesto") {
    const panelHeight = blockHeight + fontSize * 1.2;
    ctx.fillStyle = "rgba(8, 32, 50, 0.72)";
    ctx.fillRect(width * 0.07, y - fontSize * 0.75, width * 0.86, panelHeight);
    ctx.strokeStyle = "rgba(240, 217, 167, 0.9)";
    ctx.lineWidth = Math.max(4, width * 0.006);
    ctx.strokeRect(width * 0.07, y - fontSize * 0.75, width * 0.86, panelHeight);
  }
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

function drawTemplateOverlay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  template: RenderTemplate,
) {
  if (template === "minimal") return;

  ctx.save();
  if (template === "cinematic") {
    const gradient = ctx.createRadialGradient(width / 2, height / 2, width * 0.15, width / 2, height / 2, width * 0.85);
    gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 0.52)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "rgba(8, 32, 50, 0.38)";
    const bar = Math.max(42, height * 0.045);
    ctx.fillRect(0, 0, width, bar);
    ctx.fillRect(0, height - bar, width, bar);
  }
  if (template === "manifesto") {
    ctx.fillStyle = "rgba(8, 32, 50, 0.2)";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "rgba(240, 217, 167, 0.22)";
    ctx.fillRect(0, 0, width, Math.max(14, height * 0.012));
    ctx.fillRect(0, height - Math.max(14, height * 0.012), width, Math.max(14, height * 0.012));
  }
  ctx.restore();
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

function pickBackgroundDemoMimeType() {
  const candidates = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
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

function updateTemplatePreview() {
  const frame = document.querySelector<HTMLDivElement>("#previewFrame");
  const overlay = document.querySelector<HTMLDivElement>("#templatePreview");
  const caption = document.querySelector<HTMLDivElement>("#captionPreview");
  if (!frame || !overlay || !caption) return;

  frame.dataset.template = state.template;
  overlay.className = "pointer-events-none absolute inset-0";
  caption.classList.remove("bg-black/35", "bg-abyss/70", "border-sand/60");
  caption.classList.add("bg-black/35");

  if (state.template === "cinematic") {
    overlay.classList.add("bg-[radial-gradient(circle_at_center,transparent_42%,rgba(0,0,0,0.58)_100%)]");
  }
  if (state.template === "manifesto") {
    overlay.classList.add("bg-aqua/10");
    caption.classList.remove("bg-black/35");
    caption.classList.add("bg-abyss/70", "border-sand/60");
  }
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

function displayMimeType(value: string) {
  if (value.includes("webm")) return "WebM";
  if (value.includes("mp4")) return "MP4";
  return value || "Video";
}

function loadDraft(): DraftState {
  try {
    const raw = localStorage.getItem("psikorender-create-draft");
    if (!raw) return defaultDraft;
    const parsed = JSON.parse(raw) as Partial<DraftState>;
    return {
      title: typeof parsed.title === "string" ? parsed.title : defaultDraft.title,
      text: typeof parsed.text === "string" ? parsed.text : defaultDraft.text,
      format: isVideoFormat(parsed.format) ? parsed.format : defaultDraft.format,
      template: isRenderTemplate(parsed.template) ? parsed.template : defaultDraft.template,
      captionStyle: isCaptionStyle(parsed.captionStyle) ? parsed.captionStyle : defaultDraft.captionStyle,
    };
  } catch {
    return defaultDraft;
  }
}

function saveDraft() {
  localStorage.setItem(
    "psikorender-create-draft",
    JSON.stringify({
      title: state.title,
      text: state.text,
      format: state.format,
      template: state.template,
      captionStyle: state.captionStyle,
    } satisfies DraftState),
  );
}

function isVideoFormat(value: unknown): value is VideoFormat {
  return value === "vertical" || value === "square" || value === "landscape";
}

function isRenderTemplate(value: unknown): value is RenderTemplate {
  return value === "minimal" || value === "cinematic" || value === "manifesto";
}

function isCaptionStyle(value: unknown): value is CaptionStyle {
  return value === "minimal" || value === "bold" || value === "karaoke_basic" || value === "manifesto";
}

function loadProjectView() {
  try {
    const raw = localStorage.getItem("psikorender-project-view");
    if (!raw) return { projectFilter: "all" as ProjectFilter, projectSort: "newest" as ProjectSort };
    const parsed = JSON.parse(raw) as { projectFilter?: unknown; projectSort?: unknown };
    return {
      projectFilter: isProjectFilter(parsed.projectFilter) ? parsed.projectFilter : "all",
      projectSort: isProjectSort(parsed.projectSort) ? parsed.projectSort : "newest",
    };
  } catch {
    return { projectFilter: "all" as ProjectFilter, projectSort: "newest" as ProjectSort };
  }
}

function saveProjectView() {
  localStorage.setItem(
    "psikorender-project-view",
    JSON.stringify({ projectFilter: state.projectFilter, projectSort: state.projectSort }),
  );
}

function isProjectFilter(value: unknown): value is ProjectFilter {
  return value === "all" || isVideoFormat(value);
}

function isProjectSort(value: unknown): value is ProjectSort {
  return value === "newest" || value === "oldest" || value === "largest";
}

function browserCapabilities() {
  const mediaRecorder = "MediaRecorder" in window;
  const canvas = document.createElement("canvas") as HTMLCanvasElement & { captureStream?: (fps?: number) => MediaStream };
  const audio = document.createElement("audio") as HTMLAudioElement & {
    captureStream?: () => MediaStream;
    mozCaptureStream?: () => MediaStream;
  };
  const preferredMime = mediaRecorder ? pickMimeType() : "";

  return {
    mediaRecorder,
    canvasCapture: typeof canvas.captureStream === "function",
    audioCapture: typeof audio.captureStream === "function" || typeof audio.mozCaptureStream === "function",
    indexedDb: "indexedDB" in window,
    webmExport: Boolean(preferredMime && preferredMime.includes("webm")),
    preferredMime,
  };
}

function validateUpload(
  file: File,
  rules: { extensions: string[]; mimePrefix: string; maxBytes: number },
) {
  const extension = file.name.split(".").pop()?.toLowerCase() || "";
  if (!rules.extensions.includes(extension)) {
    return `Formato invalido: ${file.name}. Usa ${rules.extensions.map((item) => item.toUpperCase()).join(", ")}.`;
  }
  if (file.type && !file.type.startsWith(rules.mimePrefix) && !(extension === "mov" && file.type === "video/quicktime")) {
    return `Tipo de ficheiro invalido: ${file.type}. Escolhe um ficheiro de media suportado.`;
  }
  if (file.size > rules.maxBytes) {
    return `Ficheiro demasiado grande: ${formatBytes(file.size)}. Limite: ${formatBytes(rules.maxBytes)}.`;
  }
  return "";
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
