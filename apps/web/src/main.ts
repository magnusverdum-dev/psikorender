import "./styles.css";

type VideoFormat = "vertical" | "square" | "landscape";
type CaptionStyle = "minimal" | "bold" | "karaoke_basic" | "manifesto";
type RenderTemplate = "minimal" | "cinematic" | "manifesto";
type ProjectFilter = "all" | VideoFormat;
type ProjectSort = "newest" | "oldest" | "largest";
type ScriptPresetId = "story" | "manifesto" | "calm";
type VoiceProvider = "stub" | "xtts" | "f5" | "piper" | "openvoice";
type RenderMode = "browser" | "backend";

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

const defaultSettings: LocalSettings = {
  voiceProvider: "stub",
  voiceName: "Narrador local",
  ollamaEndpoint: "http://localhost:11434",
  ollamaModel: "llama3.1",
  renderMode: "browser",
};

const scriptPresets: Array<{
  id: ScriptPresetId;
  label: string;
  title: string;
  text: string;
  template: RenderTemplate;
  captionStyle: CaptionStyle;
}> = [
  {
    id: "story",
    label: "Historia curta",
    title: "Historia rapida",
    text: "Comeca com uma imagem simples. Mostra o conflito numa frase. Fecha com uma ideia que fica na cabeca.",
    template: "cinematic",
    captionStyle: "bold",
  },
  {
    id: "manifesto",
    label: "Manifesto",
    title: "Manifesto",
    text: "Nao esperes pelo momento perfeito. Escolhe uma direcao. Faz hoje uma versao pequena, mas real.",
    template: "manifesto",
    captionStyle: "manifesto",
  },
  {
    id: "calm",
    label: "Calmo",
    title: "Respirar",
    text: "Respira fundo. Volta ao essencial. Um passo limpo vale mais do que dez ideias por acabar.",
    template: "minimal",
    captionStyle: "minimal",
  },
];

type Segment = {
  text: string;
  start: number;
  end: number;
};

type SourceMediaAsset = {
  name: string;
  mimeType: string;
  size: number;
  kind: "audio" | "background";
};

type RenderJobSnapshot = {
  id: string;
  status: string;
  progress: number;
  logs: string[];
  completedAt?: string;
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
  voiceProvider?: VoiceProvider;
  voiceName?: string;
  renderMode?: RenderMode;
  audioAsset?: SourceMediaAsset;
  backgroundAsset?: SourceMediaAsset;
  renderJob?: RenderJobSnapshot;
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

type LocalSettings = {
  voiceProvider: VoiceProvider;
  voiceName: string;
  ollamaEndpoint: string;
  ollamaModel: string;
  renderMode: RenderMode;
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
  lastRenderedProjectId?: string;
  projects: ProjectRecord[];
  projectFilter: ProjectFilter;
  projectSort: ProjectSort;
  projectSearch: string;
  pendingDeleteId?: string;
  editingProjectId?: string;
  showDraftSegments: boolean;
  projectSegmentsId?: string;
  pendingClearProjects: boolean;
  storageReady: boolean;
  status: string;
  progress: number;
  renderJobId?: string;
  renderPhase: string;
  renderLogs: string[];
  settings: LocalSettings;
  settingsStatus: string;
  storageEstimate?: { usage: number; quota: number };
  storageStatus: string;
  busy: boolean;
};

const savedDraft = loadDraft();
const savedProjectView = loadProjectView();
const savedSettings = loadSettings();

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
  projectSearch: savedProjectView.projectSearch,
  showDraftSegments: false,
  pendingClearProjects: false,
  storageReady: false,
  status: "",
  progress: 0,
  renderPhase: "idle",
  renderLogs: [],
  settings: savedSettings,
  settingsStatus: "",
  storageStatus: "",
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
  state.editingProjectId = undefined;
  state.pendingClearProjects = false;
  render();
}

function projectRouteId(path: string) {
  const prefix = "/projects/";
  if (!path.startsWith(prefix)) return "";
  const id = path.slice(prefix.length);
  try {
    return decodeURIComponent(id);
  } catch {
    return id;
  }
}

function render() {
  if (!app) return;

  const projectId = projectRouteId(state.path);
  const page =
    state.path === "/create"
      ? createPage()
      : projectId
        ? projectDetailPage(projectId)
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
  if (state.path === "/settings" && !state.storageEstimate && !state.storageStatus) {
    void refreshStorageEstimate();
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
          <div class="rounded-md border border-white/10 bg-white/10 p-3">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <span class="text-sm font-semibold text-white">Presets de guiao</span>
              <span id="segmentEstimate" class="text-xs uppercase tracking-[0.16em] text-aqua">${captionEstimateText()}</span>
            </div>
            <div class="mt-3 flex flex-wrap gap-2">
              ${scriptPresets.map((preset) => `<button class="secondary-button px-3 py-2 text-sm" type="button" data-script-preset="${preset.id}">${escapeHtml(preset.label)}</button>`).join("")}
            </div>
          </div>
          <div class="grid gap-4 md:grid-cols-3">
            <label class="field-label">Formato<select id="format" class="input">${option("vertical", "9:16", state.format)}${option("square", "1:1", state.format)}${option("landscape", "16:9", state.format)}</select></label>
            <label class="field-label">Template<select id="template" class="input">${option("minimal", "Minimal", state.template)}${option("cinematic", "Cinematic", state.template)}${option("manifesto", "Manifesto", state.template)}</select></label>
            <label class="field-label">Legendas<select id="captionStyle" class="input">${option("minimal", "Minimal", state.captionStyle)}${option("bold", "Bold", state.captionStyle)}${option("karaoke_basic", "Karaoke basico", state.captionStyle)}${option("manifesto", "Manifesto", state.captionStyle)}</select></label>
          </div>
          <div class="rounded-md border border-white/10 bg-white/10 p-3">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <span class="text-sm font-semibold text-white">Segmentos estimados</span>
              <button id="toggleDraftSegments" class="secondary-button px-3 py-2 text-sm" type="button">${state.showDraftSegments ? "Esconder segmentos" : "Ver segmentos"}</button>
            </div>
            <div id="draftSegmentsPanel" class="${state.showDraftSegments ? "mt-3" : "hidden"}">
              ${state.showDraftSegments ? captionSegmentsHtml(state.text, draftCaptionDuration()) : ""}
            </div>
          </div>
          <div class="grid gap-4 md:grid-cols-2">
            <label class="upload-box"><span>Audio de voz</span><input id="audio" type="file" accept=".wav,.mp3,.m4a,.aac,audio/*" /><small id="audioLabel">${AUDIO_UPLOAD.label}</small></label>
            <label class="upload-box"><span>Video de fundo</span><input id="background" type="file" accept=".mp4,.mov,.webm,video/*" /><small id="backgroundLabel">${BACKGROUND_UPLOAD.label}</small></label>
          </div>
          <div class="grid gap-3 sm:grid-cols-2">
            <button id="demoMedia" class="secondary-button w-full justify-center" type="button">Usar media demo</button>
            <button id="clearDraft" class="secondary-button w-full justify-center" type="button">Limpar rascunho</button>
          </div>
          <div class="grid gap-3 sm:grid-cols-2">
            <button id="exportDraftSrt" class="secondary-button w-full justify-center" type="button">Exportar SRT</button>
            <button id="exportDraftAss" class="secondary-button w-full justify-center" type="button">Exportar ASS</button>
          </div>
          <button id="saveDraftProject" class="secondary-button w-full justify-center" type="button">Guardar projeto</button>
          <button id="generate" class="primary-button w-full justify-center disabled:opacity-50">Gerar video</button>
          <div class="h-3 overflow-hidden rounded-full bg-white/10"><div id="progressBar" class="h-full rounded-full bg-gradient-to-r from-aqua to-sand transition-all" style="width: 0%"></div></div>
          <p id="status" class="rounded-md bg-white/10 p-3 text-sm text-white/80">Pronto para criar.</p>
          <div id="renderLog" class="rounded-md border border-white/10 bg-abyss/55 p-3 text-sm text-white/75">
            ${renderLogHtml()}
          </div>
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
  const hasCustomProjectView = state.projectSearch.trim() || state.projectFilter !== "all" || state.projectSort !== "newest";
  const stats = state.projects.length
    ? `<div class="mb-6 grid gap-3 sm:grid-cols-3">
        <div class="rounded-md border border-white/10 bg-white/10 p-4"><span class="block text-sm text-white/65">Projetos</span><span class="text-2xl font-bold text-white">${state.projects.length}</span></div>
        <div class="rounded-md border border-white/10 bg-white/10 p-4"><span class="block text-sm text-white/65">Storage local</span><span class="text-2xl font-bold text-white">${formatBytes(totalBytes)}</span></div>
        <div class="rounded-md border border-white/10 bg-white/10 p-4"><span class="block text-sm text-white/65">Duracao total</span><span class="text-2xl font-bold text-white">${formatDuration(totalDuration)}</span></div>
      </div>`
    : "";
  const controls = state.projects.length
    ? `<div class="mb-6 grid gap-3 rounded-md border border-white/10 bg-white/10 p-4 lg:grid-cols-[1fr_180px_180px_auto]">
        <label class="field-label">Pesquisar<input id="projectSearch" class="input" value="${escapeAttr(state.projectSearch)}" placeholder="Titulo ou texto" autocomplete="off" /></label>
        <label class="field-label">Formato<select id="projectFilter" class="input">${option("all", "Todos", state.projectFilter)}${option("vertical", "9:16", state.projectFilter)}${option("square", "1:1", state.projectFilter)}${option("landscape", "16:9", state.projectFilter)}</select></label>
        <label class="field-label">Ordenar<select id="projectSort" class="input">${option("newest", "Mais recentes", state.projectSort)}${option("oldest", "Mais antigos", state.projectSort)}${option("largest", "Maior ficheiro", state.projectSort)}</select></label>
        ${hasCustomProjectView ? `<button id="resetProjectView" class="secondary-button self-end justify-center" type="button">Limpar pesquisa</button>` : ""}
      </div>`
    : "";
  const content = state.projects.length
    ? visibleProjects.length
      ? `<div class="grid gap-4 md:grid-cols-2">${visibleProjects.map(projectCard).join("")}</div>`
      : `<div class="glass-panel p-5 text-white/80"><h2 class="text-xl font-semibold text-white">Sem resultados</h2><p class="mt-2">Nao ha projetos para esta pesquisa ou filtro.</p></div>`
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
          ${state.projects.length ? `<button class="secondary-button" id="exportProjects" type="button">Exportar JSON</button>` : ""}
          <button class="secondary-button" id="importProjects" type="button">Importar JSON</button>
          <input id="importProjectsFile" class="hidden" type="file" accept=".json,application/json" />
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
        <div class="rounded-md bg-white/10 p-3"><span class="block text-white">Estado</span>${project.url ? "Video guardado" : "So metadados"}</div>
        <div class="rounded-md bg-white/10 p-3"><span class="block text-white">Media</span>${sourceMediaSummary(project)}</div>
        <div class="rounded-md bg-white/10 p-3"><span class="block text-white">Template</span>${escapeHtml(project.template)}</div>
        <div class="rounded-md bg-white/10 p-3"><span class="block text-white">Duracao</span>${formatDuration(project.duration)}</div>
      </div>
      <div class="mt-4 flex flex-wrap gap-3">
        <button class="secondary-button" data-nav="/projects/${encodeURIComponent(project.id)}">Abrir</button>
        <a class="primary-button inline-flex ${disabled}" href="${href}" download="${escapeAttr(project.filename)}">Download</a>
        <button class="secondary-button" data-duplicate-project="${escapeAttr(project.id)}">Duplicar</button>
        <button class="secondary-button" data-reuse-project="${escapeAttr(project.id)}">Reutilizar</button>
        <button class="secondary-button ${isPendingDelete ? "border-sand/70 text-sand" : ""}" data-delete-project="${escapeAttr(project.id)}">${isPendingDelete ? "Confirmar apagar" : "Apagar"}</button>
      </div>
    </article>
  `;
}

function projectDetailPage(id: string) {
  const project = state.projects.find((item) => item.id === id);
  if (!project) {
    return `
      <section class="mx-auto w-full max-w-4xl px-5 pb-16 pt-6">
        <div class="glass-panel p-6 text-white/80">
          <p class="text-sm uppercase tracking-[0.24em] text-aqua">Projeto</p>
          <h1 class="mt-2 text-3xl font-bold text-white">${state.storageReady ? "Projeto nao encontrado" : "A carregar projeto"}</h1>
          <p class="mt-3">${state.storageReady ? "Este item ja nao existe no historico local deste browser." : "O historico local ainda esta a abrir."}</p>
          <button class="primary-button mt-5" data-nav="/projects">Voltar aos projetos</button>
        </div>
      </section>
    `;
  }

  const href = project.url || "#";
  const disabled = project.url ? "" : "pointer-events-none opacity-60";
  const isPendingDelete = state.pendingDeleteId === project.id;
  const isEditing = state.editingProjectId === project.id;
  const showSegments = state.projectSegmentsId === project.id;
  const media = project.url
    ? `<video class="aspect-video w-full rounded-md bg-abyss object-contain" src="${escapeAttr(project.url)}" controls playsinline ${project.thumbnailUrl ? `poster="${escapeAttr(project.thumbnailUrl)}"` : ""}></video>`
    : project.thumbnailUrl
      ? `<img class="aspect-video w-full rounded-md object-cover" src="${escapeAttr(project.thumbnailUrl)}" alt="Preview de ${escapeAttr(project.title)}" />`
      : `<div class="flex aspect-video items-center justify-center rounded-md border border-white/10 bg-white/10 text-center text-sm text-white/65">Projeto importado apenas com metadados</div>`;

  return `
    <section class="mx-auto grid w-full max-w-6xl gap-6 px-5 pb-16 pt-6 lg:grid-cols-[1fr_360px]">
      <div class="glass-panel p-5">
        <div class="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p class="text-sm uppercase tracking-[0.24em] text-aqua">Projeto</p>
            <h1 class="mt-2 text-3xl font-bold">${escapeHtml(project.title)}</h1>
            <p class="mt-2 text-sm text-white/65">${formatDate(project.createdAt)}</p>
          </div>
          <button class="secondary-button" data-nav="/projects">Voltar</button>
        </div>
        ${media}
        <div class="mt-5 rounded-md border border-white/10 bg-white/10 p-4">
          <h2 class="font-semibold text-white">Texto</h2>
          <p class="mt-3 whitespace-pre-wrap text-sm leading-6 text-white/80">${escapeHtml(project.text)}</p>
        </div>
        <div class="mt-5 rounded-md border border-white/10 bg-white/10 p-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <h2 class="font-semibold text-white">Segmentos de legenda</h2>
            <button class="secondary-button px-3 py-2 text-sm" type="button" data-toggle-project-segments="${escapeAttr(project.id)}">${showSegments ? "Esconder segmentos" : "Ver segmentos"}</button>
          </div>
          <div class="${showSegments ? "mt-3" : "hidden"}">
            ${showSegments ? captionSegmentsHtml(project.text, project.duration) : ""}
          </div>
        </div>
        ${isEditing ? projectEditForm(project) : ""}
      </div>
      <aside class="glass-panel p-5">
        <p class="text-sm uppercase tracking-[0.24em] text-aqua">Metadados</p>
        <div class="mt-5 grid gap-3 text-sm text-white/75">
          ${metadataRow("Estado", project.url ? "Video guardado" : "So metadados")}
          ${metadataRow("Formato", project.format)}
          ${metadataRow("Template", project.template)}
          ${metadataRow("Legendas", project.captionStyle)}
          ${metadataRow("Provider voz", displayVoiceProvider(project.voiceProvider))}
          ${metadataRow("Voz", project.voiceName || defaultSettings.voiceName)}
          ${metadataRow("Render", displayRenderMode(project.renderMode))}
          ${metadataRow("Ficheiro", project.filename)}
          ${metadataRow("Tipo", displayMimeType(project.mimeType))}
          ${metadataRow("Tamanho", formatBytes(project.size))}
          ${metadataRow("Duracao", formatDuration(project.duration))}
        </div>
        ${sourceMediaPanel(project)}
        ${renderJobPanel(project)}
        <div class="mt-5 grid gap-3">
          <a class="primary-button inline-flex justify-center ${disabled}" href="${href}" download="${escapeAttr(project.filename)}">Download</a>
          <button class="secondary-button justify-center" data-edit-project="${escapeAttr(project.id)}">${isEditing ? "Fechar edicao" : "Editar metadados"}</button>
          <button class="secondary-button justify-center" data-duplicate-project="${escapeAttr(project.id)}">Duplicar projeto</button>
          <button class="secondary-button justify-center" data-reuse-project="${escapeAttr(project.id)}">Reutilizar no create</button>
          <button class="secondary-button justify-center" data-export-project="${escapeAttr(project.id)}">Exportar JSON</button>
          <button class="secondary-button justify-center" data-export-captions="${escapeAttr(project.id)}" data-caption-format="srt">Exportar SRT</button>
          <button class="secondary-button justify-center" data-export-captions="${escapeAttr(project.id)}" data-caption-format="ass">Exportar ASS</button>
          <button class="secondary-button justify-center ${isPendingDelete ? "border-sand/70 text-sand" : ""}" data-delete-project="${escapeAttr(project.id)}">${isPendingDelete ? "Confirmar apagar" : "Apagar projeto"}</button>
        </div>
      </aside>
    </section>
  `;
}

function projectEditForm(project: ProjectRecord) {
  return `
    <form id="projectEditForm" class="mt-5 rounded-md border border-sand/30 bg-white/10 p-4">
      <h2 class="font-semibold text-white">Editar metadados</h2>
      <div class="mt-4 grid gap-4">
        <label class="field-label">Titulo<input id="editProjectTitle" class="input" value="${escapeAttr(project.title)}" autocomplete="off" /></label>
        <label class="field-label">Texto<textarea id="editProjectText" class="input min-h-36 resize-y">${escapeHtml(project.text)}</textarea></label>
        <div class="grid gap-4 md:grid-cols-3">
          <label class="field-label">Formato<select id="editProjectFormat" class="input">${option("vertical", "9:16", project.format)}${option("square", "1:1", project.format)}${option("landscape", "16:9", project.format)}</select></label>
          <label class="field-label">Template<select id="editProjectTemplate" class="input">${option("minimal", "Minimal", project.template)}${option("cinematic", "Cinematic", project.template)}${option("manifesto", "Manifesto", project.template)}</select></label>
          <label class="field-label">Legendas<select id="editProjectCaptionStyle" class="input">${option("minimal", "Minimal", project.captionStyle)}${option("bold", "Bold", project.captionStyle)}${option("karaoke_basic", "Karaoke basico", project.captionStyle)}${option("manifesto", "Manifesto", project.captionStyle)}</select></label>
        </div>
        <div class="grid gap-4 md:grid-cols-3">
          <label class="field-label">Provider voz<select id="editProjectVoiceProvider" class="input">${option("stub", "Upload manual", project.voiceProvider || defaultSettings.voiceProvider)}${option("xtts", "XTTS-v2", project.voiceProvider || defaultSettings.voiceProvider)}${option("f5", "F5-TTS", project.voiceProvider || defaultSettings.voiceProvider)}${option("piper", "Piper", project.voiceProvider || defaultSettings.voiceProvider)}${option("openvoice", "OpenVoice", project.voiceProvider || defaultSettings.voiceProvider)}</select></label>
          <label class="field-label">Voz<input id="editProjectVoiceName" class="input" value="${escapeAttr(project.voiceName || defaultSettings.voiceName)}" autocomplete="off" /></label>
          <label class="field-label">Render<select id="editProjectRenderMode" class="input">${option("browser", "Browser local", project.renderMode || defaultSettings.renderMode)}${option("backend", "Backend futuro", project.renderMode || defaultSettings.renderMode)}</select></label>
        </div>
        <div class="flex flex-wrap gap-3">
          <button class="primary-button" type="submit">Guardar metadados</button>
          <button class="secondary-button" type="button" data-cancel-project-edit="${escapeAttr(project.id)}">Cancelar</button>
        </div>
      </div>
    </form>
  `;
}

function metadataRow(label: string, value: string) {
  return `
    <div class="rounded-md border border-white/10 bg-white/10 p-3">
      <span class="block text-xs uppercase tracking-[0.18em] text-white/50">${escapeHtml(label)}</span>
      <span class="mt-1 block break-words text-white">${escapeHtml(value)}</span>
    </div>
  `;
}

function sourceMediaSummary(project: ProjectRecord) {
  const labels = [
    project.audioAsset ? "Audio" : "",
    project.backgroundAsset ? "Background" : "",
  ].filter(Boolean);
  return labels.length ? labels.join(" + ") : "Nao definido";
}

function sourceMediaPanel(project: ProjectRecord) {
  const assets = [project.audioAsset, project.backgroundAsset].filter(Boolean) as SourceMediaAsset[];
  if (!assets.length) return "";

  return `
    <div class="mt-5 rounded-md border border-white/10 bg-white/10 p-4">
      <h2 class="font-semibold text-white">Media de origem</h2>
      <div class="mt-3 grid gap-3">
        ${assets.map((asset) => sourceMediaRow(asset)).join("")}
      </div>
    </div>
  `;
}

function sourceMediaRow(asset: SourceMediaAsset) {
  return `
    <div class="rounded-md border border-white/10 bg-abyss/45 p-3 text-sm">
      <span class="block text-xs uppercase tracking-[0.16em] text-aqua">${asset.kind === "audio" ? "Audio" : "Background"}</span>
      <span class="mt-1 block break-words text-white">${escapeHtml(asset.name)}</span>
      <span class="mt-1 block text-white/65">${escapeHtml(displayMimeType(asset.mimeType))} | ${formatBytes(asset.size)}</span>
    </div>
  `;
}

function renderJobPanel(project: ProjectRecord) {
  if (!project.renderJob) return "";
  const job = project.renderJob;
  const logs = job.logs.length
    ? job.logs.map((line) => `<li class="break-words">${escapeHtml(line)}</li>`).join("")
    : `<li class="text-white/55">Sem logs persistidos.</li>`;

  return `
    <div class="mt-5 rounded-md border border-white/10 bg-white/10 p-4">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2 class="font-semibold text-white">Job de render</h2>
        <span class="rounded-md border border-white/10 bg-abyss/55 px-2 py-1 text-xs uppercase tracking-[0.16em] text-aqua">${escapeHtml(job.status)}</span>
      </div>
      <div class="mt-3 grid gap-3 text-sm text-white/75">
        ${metadataRow("Job ID", job.id)}
        ${metadataRow("Progresso", `${Math.round(job.progress)}%`)}
        ${job.completedAt ? metadataRow("Concluido", formatDate(job.completedAt)) : ""}
      </div>
      <ol class="mt-3 grid gap-1 text-xs leading-5 text-white/70">${logs}</ol>
    </div>
  `;
}

function filteredProjects() {
  const search = state.projectSearch.trim().toLowerCase();
  const byFormat =
    state.projectFilter === "all"
      ? [...state.projects]
      : state.projects.filter((project) => project.format === state.projectFilter);
  const filtered = search
    ? byFormat.filter((project) => `${project.title} ${project.text}`.toLowerCase().includes(search))
    : byFormat;

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
        <form id="settingsForm" class="mt-6 grid gap-4">
          <label class="field-label">Provider de voz<select id="voiceProvider" class="input">${option("stub", "Upload manual", state.settings.voiceProvider)}${option("xtts", "XTTS-v2", state.settings.voiceProvider)}${option("f5", "F5-TTS", state.settings.voiceProvider)}${option("piper", "Piper", state.settings.voiceProvider)}${option("openvoice", "OpenVoice", state.settings.voiceProvider)}</select></label>
          <label class="field-label">Nome da voz<input id="voiceName" class="input" value="${escapeAttr(state.settings.voiceName)}" autocomplete="off" /></label>
          <div class="grid gap-4 md:grid-cols-2">
            <label class="field-label">Ollama endpoint<input id="ollamaEndpoint" class="input" value="${escapeAttr(state.settings.ollamaEndpoint)}" autocomplete="off" /></label>
            <label class="field-label">Modelo LLM<input id="ollamaModel" class="input" value="${escapeAttr(state.settings.ollamaModel)}" autocomplete="off" /></label>
          </div>
          <label class="field-label">Render<select id="renderMode" class="input">${option("browser", "Browser local", state.settings.renderMode)}${option("backend", "Backend futuro", state.settings.renderMode)}</select></label>
          <div class="flex flex-wrap gap-3">
            <button class="primary-button" type="submit">Guardar settings</button>
            <button id="resetSettings" class="secondary-button" type="button">Repor defaults</button>
          </div>
          <p id="settingsStatus" class="rounded-md bg-white/10 p-3 text-sm text-white/80">${escapeHtml(state.settingsStatus || "Settings locais guardadas neste browser.")}</p>
        </form>
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
        <div class="mt-5 rounded-md bg-white/10 p-4 text-sm text-white/75">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <span class="font-semibold text-white">Storage do browser</span>
            <button id="refreshStorage" class="secondary-button px-3 py-2 text-sm" type="button">Recalcular</button>
          </div>
          <div id="storageEstimate" class="mt-3 grid gap-2">
            ${storageEstimateHtml()}
          </div>
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

function storageEstimateHtml() {
  if (!state.storageEstimate) {
    return `<span class="text-white/65">${escapeHtml(state.storageStatus || "Ainda nao calculado.")}</span>`;
  }
  const { usage, quota } = state.storageEstimate;
  const percent = quota > 0 ? Math.min(100, (usage / quota) * 100) : 0;
  return `
    <div class="flex items-center justify-between gap-3">
      <span>Uso estimado</span>
      <span class="font-semibold text-white">${formatBytes(usage)} / ${formatBytes(quota)}</span>
    </div>
    <div class="h-2 overflow-hidden rounded-full bg-white/10">
      <div class="h-full rounded-full bg-gradient-to-r from-aqua to-sand" style="width: ${percent.toFixed(1)}%"></div>
    </div>
    <span class="text-xs uppercase tracking-[0.16em] text-aqua">${percent.toFixed(1)}% usado</span>
  `;
}

async function refreshStorageEstimate() {
  const panel = document.querySelector<HTMLDivElement>("#storageEstimate");
  state.storageStatus = "A calcular storage...";
  if (panel) panel.innerHTML = storageEstimateHtml();

  try {
    if (!navigator.storage?.estimate) throw new Error("Storage estimate indisponivel neste browser.");
    const estimate = await navigator.storage.estimate();
    state.storageEstimate = {
      usage: estimate.usage || 0,
      quota: estimate.quota || 0,
    };
    state.storageStatus = "Storage calculado.";
  } catch (error) {
    state.storageEstimate = undefined;
    state.storageStatus = error instanceof Error ? error.message : "Falha ao calcular storage.";
  }

  const updatedPanel = document.querySelector<HTMLDivElement>("#storageEstimate");
  if (updatedPanel) updatedPanel.innerHTML = storageEstimateHtml();
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
  document.querySelectorAll<HTMLButtonElement>("[data-duplicate-project]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.duplicateProject;
      if (id) void duplicateProject(id);
    });
  });
  document.querySelectorAll<HTMLButtonElement>("[data-toggle-project-segments]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.toggleProjectSegments;
      state.projectSegmentsId = state.projectSegmentsId === id ? undefined : id;
      render();
    });
  });
  document.querySelectorAll<HTMLButtonElement>("[data-export-project]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.exportProject;
      if (id) exportProjectJson(id);
    });
  });
  document.querySelectorAll<HTMLButtonElement>("[data-export-captions]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.exportCaptions;
      const format = button.dataset.captionFormat;
      if (id && isCaptionExportFormat(format)) exportProjectCaptions(id, format);
    });
  });
  document.querySelectorAll<HTMLButtonElement>("[data-edit-project]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.editProject;
      if (!id) return;
      state.pendingDeleteId = undefined;
      state.editingProjectId = state.editingProjectId === id ? undefined : id;
      render();
    });
  });
  document.querySelectorAll<HTMLButtonElement>("[data-cancel-project-edit]").forEach((button) => {
    button.addEventListener("click", () => {
      state.editingProjectId = undefined;
      render();
    });
  });
  document.querySelector<HTMLFormElement>("#projectEditForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    void saveProjectMetadataEdit();
  });
  document.querySelector<HTMLFormElement>("#settingsForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    saveSettingsFromForm();
  });
  document.querySelector<HTMLButtonElement>("#resetSettings")?.addEventListener("click", () => {
    state.settings = { ...defaultSettings };
    state.settingsStatus = "Settings repostas.";
    saveSettings();
    render();
  });
  document.querySelector<HTMLButtonElement>("#refreshStorage")?.addEventListener("click", () => {
    void refreshStorageEstimate();
  });
  document.querySelector<HTMLButtonElement>("#clearProjects")?.addEventListener("click", () => {
    confirmOrClearProjects();
  });
  document.querySelector<HTMLButtonElement>("#exportProjects")?.addEventListener("click", () => {
    exportProjectsJson();
  });
  const importProjectsFile = document.querySelector<HTMLInputElement>("#importProjectsFile");
  document.querySelector<HTMLButtonElement>("#importProjects")?.addEventListener("click", () => {
    importProjectsFile?.click();
  });
  importProjectsFile?.addEventListener("change", () => {
    const file = importProjectsFile.files?.[0];
    if (file) void importProjectsJson(file);
    importProjectsFile.value = "";
  });
  document.querySelector<HTMLButtonElement>("#resetProjectView")?.addEventListener("click", () => {
    resetProjectView();
  });
  const projectSearch = document.querySelector<HTMLInputElement>("#projectSearch");
  const projectFilter = document.querySelector<HTMLSelectElement>("#projectFilter");
  const projectSort = document.querySelector<HTMLSelectElement>("#projectSort");
  projectSearch?.addEventListener("input", () => {
    state.projectSearch = projectSearch.value;
    saveProjectView();
    render();
  });
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
  const saveDraftProjectButton = document.querySelector<HTMLButtonElement>("#saveDraftProject");
  const exportDraftSrt = document.querySelector<HTMLButtonElement>("#exportDraftSrt");
  const exportDraftAss = document.querySelector<HTMLButtonElement>("#exportDraftAss");
  const toggleDraftSegments = document.querySelector<HTMLButtonElement>("#toggleDraftSegments");
  const presetButtons = document.querySelectorAll<HTMLButtonElement>("[data-script-preset]");

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
    updateSegmentEstimate();
    refreshDraftSegments();
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
  saveDraftProjectButton?.addEventListener("click", () => {
    void saveDraftProject();
  });
  exportDraftSrt?.addEventListener("click", () => {
    exportDraftCaptions("srt");
  });
  exportDraftAss?.addEventListener("click", () => {
    exportDraftCaptions("ass");
  });
  toggleDraftSegments?.addEventListener("click", () => {
    state.showDraftSegments = !state.showDraftSegments;
    render();
  });
  presetButtons.forEach((button) => {
    button.addEventListener("click", () => {
      applyScriptPreset(button.dataset.scriptPreset);
    });
  });
}

function applyScriptPreset(id: string | undefined) {
  const preset = scriptPresets.find((item) => item.id === id);
  if (!preset) return;

  clearRenderedResult();
  state.title = preset.title;
  state.text = preset.text;
  state.template = preset.template;
  state.captionStyle = preset.captionStyle;
  saveDraft();
  render();
  setStatus(`Preset aplicado: ${preset.label}.`, state.progress);
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
  state.renderJobId = undefined;
  state.renderPhase = "idle";
  state.renderLogs = [];
  render();
}

function clearRenderedResult() {
  if (state.renderedUrl) URL.revokeObjectURL(state.renderedUrl);
  state.renderedUrl = undefined;
  state.renderedName = undefined;
  state.renderedMimeType = undefined;
  state.renderedSize = undefined;
  state.renderedDuration = undefined;
  state.lastRenderedProjectId = undefined;
  refreshCreateUi();
}

function refreshCreateUi() {
  const audioLabel = document.querySelector("#audioLabel");
  const backgroundLabel = document.querySelector("#backgroundLabel");
  const audioPreview = document.querySelector<HTMLAudioElement>("#audioPreview");
  const backgroundPreview = document.querySelector<HTMLVideoElement>("#backgroundPreview");
  const download = document.querySelector<HTMLAnchorElement>("#download");
  const resultSummary = document.querySelector<HTMLDivElement>("#resultSummary");
  const renderLog = document.querySelector<HTMLDivElement>("#renderLog");

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
      ${state.lastRenderedProjectId ? `<button class="secondary-button mt-3 justify-center" data-nav="/projects/${encodeURIComponent(state.lastRenderedProjectId)}">Abrir projeto</button>` : ""}
    `;
    resultSummary.querySelector<HTMLButtonElement>("[data-nav]")?.addEventListener("click", (event) => {
      const target = event.currentTarget as HTMLButtonElement;
      navigate(target.dataset.nav || "/projects");
    });
  } else if (resultSummary) {
    resultSummary.classList.add("hidden");
    resultSummary.textContent = "";
  }
  if (renderLog) renderLog.innerHTML = renderLogHtml();
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
  startRenderLog();
  logRenderStep("queued", "Job local criado e colocado em execucao.", 3);
  logRenderStep("preparing", "A validar audio, background e parametros do video.", 8);

  try {
    const result = await renderClientVideo({
      audioUrl: state.audioUrl,
      backgroundUrl: state.backgroundUrl,
      text: state.text,
      format: state.format,
      template: state.template,
      style: state.captionStyle,
      onPhase: (phase, message, progress) => logRenderStep(phase, message, progress),
      onProgress: (progress) => setStatus(`A renderizar... ${Math.round(progress)}%`, progress),
    });

    logRenderStep("saving", "A guardar video e metadados no historico local.", 96);
    if (state.renderedUrl) URL.revokeObjectURL(state.renderedUrl);
    state.renderedUrl = URL.createObjectURL(result.blob);
    state.renderedName = safeFilename(state.title, result.extension);
    state.renderedMimeType = result.blob.type || "video/webm";
    state.renderedSize = result.blob.size;
    state.renderedDuration = result.duration;
    const savedProject: ProjectRecord = {
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
      voiceProvider: state.settings.voiceProvider,
      voiceName: state.settings.voiceName,
      renderMode: state.settings.renderMode,
      audioAsset: state.audioFile ? fileToSourceAsset(state.audioFile, "audio") : undefined,
      backgroundAsset: state.backgroundFile ? fileToSourceAsset(state.backgroundFile, "background") : undefined,
      renderJob: currentRenderJobSnapshot("rendering", state.progress),
      thumbnailUrl: result.thumbnailUrl,
      createdAt: new Date().toISOString(),
      url: state.renderedUrl,
    };
    await saveRenderedProject(result.blob, savedProject);
    state.lastRenderedProjectId = savedProject.id;
    logRenderStep("completed", "Video gerado com sucesso e pronto para download.", 100);
    savedProject.renderJob = currentRenderJobSnapshot("completed", 100);
    await updateStoredProjectMetadata(savedProject);
    state.projects = state.projects.map((item) => (item.id === savedProject.id ? savedProject : item));
    refreshCreateUi();
  } catch (error) {
    logRenderStep("failed", error instanceof Error ? error.message : "Falha ao gerar video.", 0);
  } finally {
    state.busy = false;
    setBusy(false);
  }
}

async function saveDraftProject() {
  if (state.busy) return;
  if (state.text.trim().length < 10) {
    setStatus("Escreve pelo menos 10 caracteres de texto para guardar o projeto.", 0);
    return;
  }

  const project: ProjectRecord = {
    id: crypto.randomUUID(),
    title: state.title.trim() || "Projeto sem titulo",
    text: state.text.trim() || "PsikoRender",
    format: state.format,
    template: state.template,
    captionStyle: state.captionStyle,
    filename: safeFilename(state.title || "projeto", "json"),
    mimeType: "application/json",
    size: 1,
    duration: draftCaptionDuration(),
    voiceProvider: state.settings.voiceProvider,
    voiceName: state.settings.voiceName,
    renderMode: state.settings.renderMode,
    audioAsset: state.audioFile ? fileToSourceAsset(state.audioFile, "audio") : undefined,
    backgroundAsset: state.backgroundFile ? fileToSourceAsset(state.backgroundFile, "background") : undefined,
    createdAt: new Date().toISOString(),
  };
  project.size = new Blob([JSON.stringify(projectToMetadata(project), null, 2)], { type: "application/json" }).size;

  await putStoredProjectMetadata(project);
  state.projects = [project, ...state.projects.filter((item) => item.id !== project.id)];
  state.pendingDeleteId = undefined;
  state.editingProjectId = undefined;
  state.lastRenderedProjectId = undefined;
  state.status = "Projeto guardado no historico local.";
  state.progress = 100;
  saveDraft();
  navigate(`/projects/${encodeURIComponent(project.id)}`);
}

function fileToSourceAsset(file: File, kind: SourceMediaAsset["kind"]): SourceMediaAsset {
  return {
    name: file.name,
    mimeType: file.type || (kind === "audio" ? "audio/unknown" : "video/unknown"),
    size: file.size,
    kind,
  };
}

async function renderClientVideo(options: {
  audioUrl: string;
  backgroundUrl: string;
  text: string;
  format: VideoFormat;
  template: RenderTemplate;
  style: CaptionStyle;
  onPhase: (phase: string, message: string, progress: number) => void;
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
  options.onPhase("captions", `${segments.length} blocos de legenda estimados para ${formatDuration(duration)}.`, 18);
  const canvasStream = canvas.captureStream(30);
  const audioStream = captureElementStream(audio);

  const stream = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...audioStream.getAudioTracks(),
  ]);
  const mimeType = pickMimeType();
  const chunks: BlobPart[] = [];
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  options.onPhase("rendering", `A capturar canvas e audio em ${displayMimeType(mimeType || "video/webm")}.`, 24);
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
  if (projectRouteId(state.path) === id) {
    history.pushState(null, "", "/projects");
    state.path = "/projects";
  }
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

function resetProjectView() {
  state.projectSearch = "";
  state.projectFilter = "all";
  state.projectSort = "newest";
  saveProjectView();
  render();
}

function exportProjectsJson() {
  downloadProjectsJson(state.projects, `psikorender-history-${new Date().toISOString().slice(0, 10)}.json`);
}

function exportProjectJson(id: string) {
  const project = state.projects.find((item) => item.id === id);
  if (!project) return;
  downloadProjectsJson([project], `${safeFilename(project.title, "json")}`);
}

function exportDraftCaptions(format: CaptionExportFormat) {
  const duration = state.renderedDuration || estimateDraftCaptionDuration(state.text);
  downloadCaptions({
    title: state.title.trim() || "psikorender",
    text: state.text,
    duration,
    style: state.captionStyle,
    format,
  });
  setStatus(`Legendas ${format.toUpperCase()} exportadas.`, state.progress);
}

function exportProjectCaptions(id: string, format: CaptionExportFormat) {
  const project = state.projects.find((item) => item.id === id);
  if (!project) return;
  downloadCaptions({
    title: project.title,
    text: project.text,
    duration: project.duration,
    style: project.captionStyle,
    format,
  });
}

function downloadProjectsJson(projects: ProjectRecord[], filename: string) {
  const payload = {
    app: "PsikoRender",
    exportedAt: new Date().toISOString(),
    projectCount: projects.length,
    totalBytes: projects.reduce((sum, project) => sum + project.size, 0),
    projects: projects.map(projectToMetadata),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

type CaptionExportFormat = "srt" | "ass";

function isCaptionExportFormat(value: unknown): value is CaptionExportFormat {
  return value === "srt" || value === "ass";
}

function downloadCaptions(options: {
  title: string;
  text: string;
  duration: number;
  style: CaptionStyle;
  format: CaptionExportFormat;
}) {
  const segments = buildSegments(options.text, Math.max(1, options.duration));
  const content =
    options.format === "srt"
      ? buildSrt(segments)
      : buildAss(segments, options.style);
  const mimeType = options.format === "srt" ? "application/x-subrip;charset=utf-8" : "text/x-ssa;charset=utf-8";
  downloadTextFile(content, `${safeFilename(options.title, options.format)}`, mimeType);
}

function downloadTextFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function buildSrt(segments: Segment[]) {
  return `${segments
    .map((segment, index) => [
      String(index + 1),
      `${formatSrtTime(segment.start)} --> ${formatSrtTime(segment.end)}`,
      segment.text,
    ].join("\n"))
    .join("\n\n")}\n`;
}

function buildAss(segments: Segment[], style: CaptionStyle) {
  const fontSize = style === "minimal" ? 64 : 78;
  const primaryColor = style === "karaoke_basic" ? "&H00A7D9F0" : "&H00FFFFFF";
  const lines = segments
    .map((segment) => `Dialogue: 0,${formatAssTime(segment.start)},${formatAssTime(segment.end)},Default,,0,0,0,,${escapeAssText(style === "manifesto" ? segment.text.toUpperCase() : segment.text)}`)
    .join("\n");

  return `[Script Info]
Title: PsikoRender captions
ScriptType: v4.00+
WrapStyle: 2
ScaledBorderAndShadow: yes
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,${fontSize},${primaryColor},&H00FFFFFF,&H00102032,&H99000000,1,0,0,0,100,100,0,0,1,5,2,2,80,80,180,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${lines}
`;
}

function formatSrtTime(seconds: number) {
  const totalMs = Math.max(0, Math.round(seconds * 1000));
  const hours = Math.floor(totalMs / 3_600_000);
  const minutes = Math.floor((totalMs % 3_600_000) / 60_000);
  const secs = Math.floor((totalMs % 60_000) / 1000);
  const millis = totalMs % 1000;
  return `${padTime(hours)}:${padTime(minutes)}:${padTime(secs)},${String(millis).padStart(3, "0")}`;
}

function formatAssTime(seconds: number) {
  const totalCs = Math.max(0, Math.round(seconds * 100));
  const hours = Math.floor(totalCs / 360_000);
  const minutes = Math.floor((totalCs % 360_000) / 6_000);
  const secs = Math.floor((totalCs % 6_000) / 100);
  const centis = totalCs % 100;
  return `${hours}:${padTime(minutes)}:${padTime(secs)}.${padTime(centis)}`;
}

function padTime(value: number) {
  return String(value).padStart(2, "0");
}

function escapeAssText(value: string) {
  return value.replace(/[{}]/g, "").replace(/\r?\n/g, "\\N");
}

function estimateDraftCaptionDuration(text: string) {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(3, words * 0.42);
}

function projectToMetadata(project: ProjectRecord) {
  return {
    id: project.id,
    title: project.title,
    text: project.text,
    format: project.format,
    template: project.template,
    captionStyle: project.captionStyle,
    filename: project.filename,
    mimeType: project.mimeType,
    size: project.size,
    duration: project.duration,
    voiceProvider: project.voiceProvider || defaultSettings.voiceProvider,
    voiceName: project.voiceName || defaultSettings.voiceName,
    renderMode: project.renderMode || defaultSettings.renderMode,
    audioAsset: project.audioAsset,
    backgroundAsset: project.backgroundAsset,
    renderJob: project.renderJob,
    createdAt: project.createdAt,
  };
}

async function importProjectsJson(file: File) {
  try {
    const payload = JSON.parse(await file.text()) as { projects?: unknown };
    if (!Array.isArray(payload.projects)) throw new Error("JSON sem lista de projetos.");
    const imported = payload.projects.map(normalizeImportedProject).filter(Boolean) as ProjectRecord[];
    if (!imported.length) throw new Error("Nao foram encontrados projetos validos.");

    for (const project of imported) {
      await putStoredProjectMetadata(project);
    }
    state.projects = await listStoredProjects();
    state.pendingClearProjects = false;
    state.pendingDeleteId = undefined;
    render();
  } catch (error) {
    window.alert(error instanceof Error ? error.message : "Falha ao importar JSON.");
  }
}

function normalizeImportedProject(value: unknown): ProjectRecord | undefined {
  if (!value || typeof value !== "object") return undefined;
  const item = value as Record<string, unknown>;
  if (typeof item.title !== "string" || typeof item.text !== "string") return undefined;

  const format = isVideoFormat(item.format) ? item.format : "vertical";
  const template = parseRenderTemplate(item.template);
  const captionStyle = isCaptionStyle(item.captionStyle) ? item.captionStyle : "bold";
  const createdAt = typeof item.createdAt === "string" ? item.createdAt : new Date().toISOString();
  const filename = typeof item.filename === "string" ? item.filename : safeFilename(item.title, "webm");
  const mimeType = typeof item.mimeType === "string" ? item.mimeType : "video/webm";
  const size = typeof item.size === "number" && Number.isFinite(item.size) ? Math.max(0, item.size) : 0;
  const duration = typeof item.duration === "number" && Number.isFinite(item.duration) ? Math.max(1, item.duration) : 1;
  const voiceProvider = isVoiceProvider(item.voiceProvider) ? item.voiceProvider : defaultSettings.voiceProvider;
  const voiceName = typeof item.voiceName === "string" && item.voiceName.trim() ? item.voiceName : defaultSettings.voiceName;
  const renderMode = isRenderMode(item.renderMode) ? item.renderMode : defaultSettings.renderMode;
  const audioAsset = normalizeSourceAsset(item.audioAsset, "audio");
  const backgroundAsset = normalizeSourceAsset(item.backgroundAsset, "background");
  const renderJob = normalizeRenderJob(item.renderJob);

  return {
    id: typeof item.id === "string" && item.id ? item.id : crypto.randomUUID(),
    title: item.title,
    text: item.text,
    format,
    template,
    captionStyle,
    filename,
    mimeType,
    size,
    duration,
    voiceProvider,
    voiceName,
    renderMode,
    audioAsset,
    backgroundAsset,
    renderJob,
    createdAt,
  };
}

function normalizeSourceAsset(value: unknown, kind: SourceMediaAsset["kind"]): SourceMediaAsset | undefined {
  if (!value || typeof value !== "object") return undefined;
  const item = value as Record<string, unknown>;
  const name = typeof item.name === "string" && item.name.trim() ? item.name : "";
  const mimeType = typeof item.mimeType === "string" && item.mimeType.trim() ? item.mimeType : "";
  const size = typeof item.size === "number" && Number.isFinite(item.size) ? Math.max(0, item.size) : 0;
  if (!name) return undefined;
  return {
    name,
    mimeType: mimeType || (kind === "audio" ? "audio/unknown" : "video/unknown"),
    size,
    kind,
  };
}

function normalizeRenderJob(value: unknown): RenderJobSnapshot | undefined {
  if (!value || typeof value !== "object") return undefined;
  const item = value as Record<string, unknown>;
  const id = typeof item.id === "string" && item.id.trim() ? item.id : "";
  if (!id) return undefined;
  const status = typeof item.status === "string" && item.status.trim() ? item.status : "completed";
  const progress = typeof item.progress === "number" && Number.isFinite(item.progress) ? Math.max(0, Math.min(100, item.progress)) : 100;
  const logs = Array.isArray(item.logs)
    ? item.logs.filter((line): line is string => typeof line === "string" && line.trim().length > 0).slice(0, 8)
    : [];
  const completedAt = typeof item.completedAt === "string" ? item.completedAt : undefined;
  return { id, status, progress, logs, completedAt };
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

async function duplicateProject(id: string) {
  const project = state.projects.find((item) => item.id === id);
  if (!project) return;

  const extension = project.filename.split(".").pop() || "webm";
  const copy: ProjectRecord = {
    ...project,
    id: crypto.randomUUID(),
    title: `${project.title} copia`,
    filename: safeFilename(`${project.title} copia`, extension),
    createdAt: new Date().toISOString(),
  };

  const stored = await getStoredProjectRow(id);
  if (stored?.blob) {
    await putStoredProject(copy, stored.blob);
    copy.url = URL.createObjectURL(stored.blob);
  } else {
    copy.url = undefined;
    await putStoredProjectMetadata(copy);
  }

  state.projects = [copy, ...state.projects].slice(0, 24);
  state.pendingDeleteId = undefined;
  state.editingProjectId = undefined;
  state.status = "Projeto duplicado.";
  if (projectRouteId(state.path) === id) {
    history.pushState(null, "", `/projects/${encodeURIComponent(copy.id)}`);
    state.path = `/projects/${copy.id}`;
  }
  render();
}

async function saveProjectMetadataEdit() {
  const id = state.editingProjectId;
  const project = id ? state.projects.find((item) => item.id === id) : undefined;
  if (!id || !project) return;

  const title = document.querySelector<HTMLInputElement>("#editProjectTitle")?.value.trim() || project.title;
  const text = document.querySelector<HTMLTextAreaElement>("#editProjectText")?.value.trim() || project.text;
  const formatValue = document.querySelector<HTMLSelectElement>("#editProjectFormat")?.value;
  const templateValue = document.querySelector<HTMLSelectElement>("#editProjectTemplate")?.value;
  const captionStyleValue = document.querySelector<HTMLSelectElement>("#editProjectCaptionStyle")?.value;
  const voiceProviderValue = document.querySelector<HTMLSelectElement>("#editProjectVoiceProvider")?.value;
  const voiceName = document.querySelector<HTMLInputElement>("#editProjectVoiceName")?.value.trim();
  const renderModeValue = document.querySelector<HTMLSelectElement>("#editProjectRenderMode")?.value;

  const updated: ProjectRecord = {
    ...project,
    title,
    text,
    format: isVideoFormat(formatValue) ? formatValue : project.format,
    template: isRenderTemplate(templateValue) ? templateValue : project.template,
    captionStyle: isCaptionStyle(captionStyleValue) ? captionStyleValue : project.captionStyle,
    voiceProvider: isVoiceProvider(voiceProviderValue) ? voiceProviderValue : project.voiceProvider || defaultSettings.voiceProvider,
    voiceName: voiceName || project.voiceName || defaultSettings.voiceName,
    renderMode: isRenderMode(renderModeValue) ? renderModeValue : project.renderMode || defaultSettings.renderMode,
    filename: title === project.title ? project.filename : safeFilename(title, project.filename.split(".").pop() || "webm"),
  };

  await updateStoredProjectMetadata(updated);
  state.projects = state.projects.map((item) => (item.id === id ? updated : item));
  state.editingProjectId = undefined;
  state.status = "Metadados do projeto atualizados.";
  render();
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

async function putStoredProjectMetadata(project: ProjectRecord) {
  const db = await openProjectDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("projects", "readwrite");
    tx.objectStore("projects").put({ ...project, url: undefined });
    tx.addEventListener("complete", () => resolve());
    tx.addEventListener("error", () => reject(tx.error));
  });
  db.close();
}

async function updateStoredProjectMetadata(project: ProjectRecord) {
  const db = await openProjectDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("projects", "readwrite");
    const store = tx.objectStore("projects");
    const get = store.get(project.id);
    get.addEventListener("success", () => {
      const existing = get.result || {};
      store.put({ ...existing, ...project, url: undefined });
    });
    tx.addEventListener("complete", () => resolve());
    tx.addEventListener("error", () => reject(tx.error));
  });
  db.close();
}

async function getStoredProjectRow(id: string) {
  const db = await openProjectDb();
  const row = await new Promise<(ProjectRecord & { blob?: Blob }) | undefined>((resolve, reject) => {
    const request = db.transaction("projects", "readonly").objectStore("projects").get(id);
    request.addEventListener("success", () => resolve(request.result as (ProjectRecord & { blob?: Blob }) | undefined));
    request.addEventListener("error", () => reject(request.error));
  });
  db.close();
  return row;
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
  const saveButton = document.querySelector<HTMLButtonElement>("#saveDraftProject");
  if (button) {
    button.disabled = busy;
    button.textContent = busy ? "A renderizar..." : "Gerar video";
  }
  if (saveButton) saveButton.disabled = busy;
}

function setStatus(message: string, progress: number) {
  state.status = message;
  state.progress = progress;
  const status = document.querySelector("#status");
  const bar = document.querySelector<HTMLDivElement>("#progressBar");
  if (status) status.textContent = message;
  if (bar) bar.style.width = `${Math.max(0, Math.min(100, progress))}%`;
}

function captionEstimateText() {
  const segments = splitSentences(state.text);
  const words = state.text.trim().split(/\s+/).filter(Boolean).length;
  return `${segments.length || 1} blocos | ${words} palavras`;
}

function draftCaptionDuration() {
  return state.renderedDuration || estimateDraftCaptionDuration(state.text);
}

function captionSegmentsHtml(text: string, duration: number) {
  const segments = buildSegments(text, Math.max(1, duration));
  return `
    <div class="grid gap-2">
      ${segments.map((segment, index) => `
        <div class="rounded-md border border-white/10 bg-abyss/45 p-3 text-sm">
          <div class="flex flex-wrap items-center justify-between gap-2 text-xs uppercase tracking-[0.14em] text-aqua">
            <span>Bloco ${index + 1}</span>
            <span>${formatSrtTime(segment.start)} - ${formatSrtTime(segment.end)}</span>
          </div>
          <p class="mt-2 leading-6 text-white/80">${escapeHtml(segment.text)}</p>
        </div>
      `).join("")}
    </div>
  `;
}

function updateSegmentEstimate() {
  const estimate = document.querySelector<HTMLSpanElement>("#segmentEstimate");
  if (estimate) estimate.textContent = captionEstimateText();
}

function refreshDraftSegments() {
  const panel = document.querySelector<HTMLDivElement>("#draftSegmentsPanel");
  if (panel && state.showDraftSegments) panel.innerHTML = captionSegmentsHtml(state.text, draftCaptionDuration());
}

function startRenderLog() {
  state.renderJobId = `local-${Date.now().toString(36)}`;
  state.renderPhase = "queued";
  state.renderLogs = [];
  refreshRenderLog();
}

function logRenderStep(phase: string, message: string, progress: number) {
  state.renderPhase = phase;
  const time = new Intl.DateTimeFormat("pt-PT", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date());
  state.renderLogs = [`${time} | ${phase} | ${message}`, ...state.renderLogs].slice(0, 8);
  setStatus(message, progress);
  refreshRenderLog();
}

function refreshRenderLog() {
  const renderLog = document.querySelector<HTMLDivElement>("#renderLog");
  if (renderLog) renderLog.innerHTML = renderLogHtml();
}

function currentRenderJobSnapshot(status = state.renderPhase, progress = state.progress): RenderJobSnapshot {
  return {
    id: state.renderJobId || `local-${Date.now().toString(36)}`,
    status,
    progress: Math.max(0, Math.min(100, progress)),
    logs: [...state.renderLogs],
    completedAt: status === "completed" ? new Date().toISOString() : undefined,
  };
}

function renderLogHtml() {
  const phase = state.renderPhase === "idle" ? "sem job ativo" : state.renderPhase;
  const logs = state.renderLogs.length
    ? state.renderLogs.map((line) => `<li class="break-words">${escapeHtml(line)}</li>`).join("")
    : `<li class="text-white/55">Os logs do proximo render aparecem aqui.</li>`;

  return `
    <div class="flex flex-wrap items-center justify-between gap-2">
      <span class="font-semibold text-white">Job ${escapeHtml(state.renderJobId || "local")}</span>
      <span class="rounded-md border border-white/10 bg-white/10 px-2 py-1 text-xs uppercase tracking-[0.16em] text-aqua">${escapeHtml(phase)}</span>
    </div>
    <ol class="mt-3 grid gap-1 text-xs leading-5">${logs}</ol>
  `;
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
  if (value.includes("wav")) return "WAV";
  if (value.includes("mpeg") || value.includes("mp3")) return "MP3";
  if (value.includes("aac")) return "AAC";
  if (value.includes("m4a")) return "M4A";
  if (value.includes("json")) return "JSON";
  if (value.includes("metadata")) return "Metadados";
  return value || "Video";
}

function displayVoiceProvider(value: VoiceProvider | undefined) {
  const provider = value || defaultSettings.voiceProvider;
  if (provider === "stub") return "Upload manual";
  if (provider === "xtts") return "XTTS-v2";
  if (provider === "f5") return "F5-TTS";
  if (provider === "piper") return "Piper";
  return "OpenVoice";
}

function displayRenderMode(value: RenderMode | undefined) {
  return (value || defaultSettings.renderMode) === "backend" ? "Backend futuro" : "Browser local";
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

function saveSettingsFromForm() {
  const voiceProvider = document.querySelector<HTMLSelectElement>("#voiceProvider")?.value;
  const renderMode = document.querySelector<HTMLSelectElement>("#renderMode")?.value;
  const voiceName = document.querySelector<HTMLInputElement>("#voiceName")?.value.trim();
  const ollamaEndpoint = document.querySelector<HTMLInputElement>("#ollamaEndpoint")?.value.trim();
  const ollamaModel = document.querySelector<HTMLInputElement>("#ollamaModel")?.value.trim();

  state.settings = {
    voiceProvider: isVoiceProvider(voiceProvider) ? voiceProvider : defaultSettings.voiceProvider,
    voiceName: voiceName || defaultSettings.voiceName,
    ollamaEndpoint: ollamaEndpoint || defaultSettings.ollamaEndpoint,
    ollamaModel: ollamaModel || defaultSettings.ollamaModel,
    renderMode: isRenderMode(renderMode) ? renderMode : defaultSettings.renderMode,
  };
  state.settingsStatus = "Settings guardadas.";
  saveSettings();
  render();
}

function loadSettings(): LocalSettings {
  try {
    const raw = localStorage.getItem("psikorender-local-settings");
    if (!raw) return defaultSettings;
    const parsed = JSON.parse(raw) as Partial<LocalSettings>;
    return {
      voiceProvider: isVoiceProvider(parsed.voiceProvider) ? parsed.voiceProvider : defaultSettings.voiceProvider,
      voiceName: typeof parsed.voiceName === "string" && parsed.voiceName.trim() ? parsed.voiceName : defaultSettings.voiceName,
      ollamaEndpoint: typeof parsed.ollamaEndpoint === "string" && parsed.ollamaEndpoint.trim() ? parsed.ollamaEndpoint : defaultSettings.ollamaEndpoint,
      ollamaModel: typeof parsed.ollamaModel === "string" && parsed.ollamaModel.trim() ? parsed.ollamaModel : defaultSettings.ollamaModel,
      renderMode: isRenderMode(parsed.renderMode) ? parsed.renderMode : defaultSettings.renderMode,
    };
  } catch {
    return defaultSettings;
  }
}

function saveSettings() {
  localStorage.setItem("psikorender-local-settings", JSON.stringify(state.settings));
}

function isVideoFormat(value: unknown): value is VideoFormat {
  return value === "vertical" || value === "square" || value === "landscape";
}

function isRenderTemplate(value: unknown): value is RenderTemplate {
  return value === "minimal" || value === "cinematic" || value === "manifesto";
}

function parseRenderTemplate(value: unknown): RenderTemplate {
  if (isRenderTemplate(value)) return value;
  if (value === "ocean") return "cinematic";
  return "minimal";
}

function isCaptionStyle(value: unknown): value is CaptionStyle {
  return value === "minimal" || value === "bold" || value === "karaoke_basic" || value === "manifesto";
}

function isVoiceProvider(value: unknown): value is VoiceProvider {
  return value === "stub" || value === "xtts" || value === "f5" || value === "piper" || value === "openvoice";
}

function isRenderMode(value: unknown): value is RenderMode {
  return value === "browser" || value === "backend";
}

function loadProjectView() {
  try {
    const raw = localStorage.getItem("psikorender-project-view");
    if (!raw) return { projectFilter: "all" as ProjectFilter, projectSort: "newest" as ProjectSort, projectSearch: "" };
    const parsed = JSON.parse(raw) as { projectFilter?: unknown; projectSort?: unknown; projectSearch?: unknown };
    return {
      projectFilter: isProjectFilter(parsed.projectFilter) ? parsed.projectFilter : "all",
      projectSort: isProjectSort(parsed.projectSort) ? parsed.projectSort : "newest",
      projectSearch: typeof parsed.projectSearch === "string" ? parsed.projectSearch : "",
    };
  } catch {
    return { projectFilter: "all" as ProjectFilter, projectSort: "newest" as ProjectSort, projectSearch: "" };
  }
}

function saveProjectView() {
  localStorage.setItem(
    "psikorender-project-view",
    JSON.stringify({ projectFilter: state.projectFilter, projectSort: state.projectSort, projectSearch: state.projectSearch }),
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
