import "./styles.css";

const API_URL = import.meta.env.PUBLIC_API_URL || "";

type State = {
  path: string;
  title: string;
  text: string;
  format: string;
  template: string;
  captionStyle: string;
  audioReady: boolean;
  backgroundReady: boolean;
  status: string;
};

const state: State = {
  path: window.location.pathname,
  title: "Primeiro vídeo",
  text: "Escreve aqui o texto do teu vídeo. Divide ideias em frases curtas para legendas mais fortes.",
  format: "vertical",
  template: "minimal",
  captionStyle: "bold",
  audioReady: false,
  backgroundReady: false,
  status: "",
};

const app = document.querySelector<HTMLDivElement>("#app");

function navigate(path: string) {
  history.pushState(null, "", path);
  state.path = path;
  render();
}

window.addEventListener("popstate", () => {
  state.path = window.location.pathname;
  render();
});

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

function home() {
  return `
    <section class="mx-auto grid min-h-[calc(100vh-88px)] w-full max-w-6xl items-center gap-10 px-5 pb-16 pt-6 lg:grid-cols-[1fr_380px]">
      <div class="max-w-3xl">
        <p class="mb-4 text-sm uppercase tracking-[0.32em] text-aqua">Local-first video render</p>
        <h1 class="text-5xl font-bold leading-tight sm:text-7xl">Texto em vídeo com voz, legendas e fundos cinematográficos.</h1>
        <p class="mt-6 max-w-2xl text-lg leading-8 text-white/80">Um pipeline leve para transformar ideias em MP4 vertical, quadrado ou landscape usando uploads locais e FFmpeg.</p>
        <div class="mt-8 flex flex-wrap gap-3">
          <button class="primary-button" data-nav="/create">Criar vídeo</button>
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

function create() {
  return `
    <section class="mx-auto grid w-full max-w-6xl gap-6 px-5 pb-16 pt-6 lg:grid-cols-[1fr_360px]">
      <div class="glass-panel p-5">
        <p class="text-sm uppercase tracking-[0.24em] text-aqua">Criar vídeo</p>
        <h1 class="mt-2 text-3xl font-bold">Pipeline local</h1>
        ${!API_URL ? `<p class="mt-4 rounded-md bg-white/10 p-3 text-sm text-white/80">Frontend online. Para uploads e render, configura PUBLIC_API_URL com o backend Rust deployado.</p>` : ""}
        <div class="mt-5 grid gap-4">
          <label class="field-label">Título<input id="title" class="input" value="${escapeAttr(state.title)}" /></label>
          <label class="field-label">Texto<textarea id="text" class="input min-h-44 resize-y">${escapeHtml(state.text)}</textarea></label>
          <div class="grid gap-4 md:grid-cols-3">
            <label class="field-label">Formato<select id="format" class="input">${option("vertical", "9:16", state.format)}${option("square", "1:1", state.format)}${option("landscape", "16:9", state.format)}</select></label>
            <label class="field-label">Template<select id="template" class="input">${option("minimal", "Minimal", state.template)}${option("cinematic", "Cinematic", state.template)}${option("manifesto", "Manifesto", state.template)}</select></label>
            <label class="field-label">Legendas<select id="captionStyle" class="input">${option("minimal", "Minimal", state.captionStyle)}${option("bold", "Bold", state.captionStyle)}${option("karaoke_basic", "Karaoke básico", state.captionStyle)}${option("manifesto", "Manifesto", state.captionStyle)}</select></label>
          </div>
          <div class="grid gap-4 md:grid-cols-2">
            <label class="upload-box"><span>Áudio de voz</span><input id="audio" type="file" accept=".wav,.mp3,.m4a,.aac,audio/*" /><small>${state.audioReady ? "Upload selecionado" : "WAV, MP3, M4A ou AAC"}</small></label>
            <label class="upload-box"><span>Vídeo de fundo</span><input id="background" type="file" accept=".mp4,.mov,.webm,video/*" /><small>${state.backgroundReady ? "Upload selecionado" : "MP4, MOV ou WEBM"}</small></label>
          </div>
          <button id="generate" class="primary-button w-full justify-center">Gerar vídeo</button>
          ${state.status ? `<p class="rounded-md bg-white/10 p-3 text-sm text-white/80">${escapeHtml(state.status)}</p>` : ""}
        </div>
      </div>
      <aside class="glass-panel mx-auto aspect-[9/16] w-full max-w-[340px] p-4">
        <div class="flex h-full flex-col justify-between overflow-hidden rounded-md bg-abyss/80 p-5">
          <div class="text-xs uppercase tracking-[0.22em] text-aqua">Preview</div>
          <div class="rounded-md border border-white/10 bg-white/10 p-4 text-center text-2xl font-black uppercase leading-tight">${escapeHtml(state.text.split(".")[0] || "Texto do vídeo")}</div>
          <div class="grid grid-cols-3 gap-2 text-center text-xs text-white/70"><span>${state.format}</span><span>${state.template}</span><span>${state.captionStyle}</span></div>
        </div>
      </aside>
    </section>
  `;
}

function projects() {
  return `
    <section class="mx-auto w-full max-w-6xl px-5 pb-16 pt-6">
      <div class="mb-6 flex items-center justify-between">
        <div><p class="text-sm uppercase tracking-[0.24em] text-aqua">Projetos</p><h1 class="mt-2 text-3xl font-bold">Histórico local</h1></div>
        <button class="primary-button" data-nav="/create">Novo</button>
      </div>
      <p class="glass-panel p-4 text-white/75">${API_URL ? "A lista de projetos será carregada pelo backend configurado." : "A lista de projetos fica disponível quando o backend Rust estiver deployado e PUBLIC_API_URL estiver configurado."}</p>
    </section>
  `;
}

function settings() {
  return `
    <section class="mx-auto w-full max-w-4xl px-5 pb-16 pt-6">
      <div class="glass-panel p-6">
        <p class="text-sm uppercase tracking-[0.24em] text-aqua">Settings</p>
        <h1 class="mt-2 text-3xl font-bold">Voz e modelos locais</h1>
        <div class="mt-6 grid gap-3 sm:grid-cols-2">
          ${["XTTS-v2", "F5-TTS", "Piper", "OpenVoice", "Ollama", "faster-whisper"].map((name) => `<div class="rounded-md border border-white/10 bg-white/10 p-4"><h2 class="font-semibold">${name}</h2><p class="mt-1 text-sm text-white/70">Preparado para integração depois do MVP.</p></div>`).join("")}
        </div>
      </div>
    </section>
  `;
}

function option(value: string, label: string, current: string) {
  return `<option value="${value}" ${value === current ? "selected" : ""}>${label}</option>`;
}

function render() {
  if (!app) return;
  const page = state.path === "/create" ? create() : state.path === "/projects" ? projects() : state.path === "/settings" ? settings() : home();
  app.innerHTML = shell(page);
  bindEvents();
}

function bindEvents() {
  document.querySelectorAll<HTMLElement>("[data-nav]").forEach((el) => {
    el.addEventListener("click", () => navigate(el.dataset.nav || "/"));
  });

  const title = document.querySelector<HTMLInputElement>("#title");
  const text = document.querySelector<HTMLTextAreaElement>("#text");
  const format = document.querySelector<HTMLSelectElement>("#format");
  const template = document.querySelector<HTMLSelectElement>("#template");
  const captionStyle = document.querySelector<HTMLSelectElement>("#captionStyle");
  const audio = document.querySelector<HTMLInputElement>("#audio");
  const background = document.querySelector<HTMLInputElement>("#background");
  const generate = document.querySelector<HTMLButtonElement>("#generate");

  title?.addEventListener("input", () => (state.title = title.value));
  text?.addEventListener("input", () => {
    state.text = text.value;
    render();
  });
  format?.addEventListener("change", () => {
    state.format = format.value;
    render();
  });
  template?.addEventListener("change", () => {
    state.template = template.value;
    render();
  });
  captionStyle?.addEventListener("change", () => {
    state.captionStyle = captionStyle.value;
    render();
  });
  audio?.addEventListener("change", () => {
    state.audioReady = Boolean(audio.files?.length);
    render();
  });
  background?.addEventListener("change", () => {
    state.backgroundReady = Boolean(background.files?.length);
    render();
  });
  generate?.addEventListener("click", () => {
    if (!API_URL) {
      state.status = "Frontend pronto. Falta deployar o backend para executar uploads e render.";
    } else if (!state.audioReady || !state.backgroundReady) {
      state.status = "Falta upload de áudio e vídeo de fundo.";
    } else {
      state.status = "Uploads e render serão enviados para o backend configurado.";
    }
    render();
  });
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char] || char));
}

function escapeAttr(value: string) {
  return escapeHtml(value);
}

render();
