import { $, component$, useSignal, useVisibleTask$ } from "@builder.io/qwik";
import "./styles.css";

const API_URL = import.meta.env.PUBLIC_API_URL || "http://localhost:8080";

type MediaAsset = {
  id: string;
  media_type: string;
  path: string;
};

type Project = {
  id: string;
  title: string;
  text: string;
  format: string;
  status: string;
};

type ProjectDetail = {
  project: Project;
  latest_job?: {
    id: string;
    status: string;
    progress: number;
    error_message?: string;
    output_path?: string;
  };
};

export default component$(() => {
  const path = useSignal("/");

  useVisibleTask$(() => {
    path.value = window.location.pathname;
    const onPop = () => (path.value = window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  });

  const navigate = $((href: string) => {
    history.pushState(null, "", href);
    path.value = href;
  });

  const projectMatch = path.value.match(/^\/projects\/([^/]+)/);

  return (
    <main class="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(103,232,249,0.18),transparent_34%),linear-gradient(135deg,#082032,#0f3f50_46%,#f0d9a7)] text-white">
      <nav class="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5">
        <button class="text-lg font-semibold tracking-wide" onClick$={() => navigate("/")}>
          PsikoRender
        </button>
        <div class="flex items-center gap-2 text-sm text-white/75">
          <button class="nav-link" onClick$={() => navigate("/create")}>Criar</button>
          <button class="nav-link" onClick$={() => navigate("/projects")}>Projetos</button>
          <button class="nav-link" onClick$={() => navigate("/settings")}>Settings</button>
        </div>
      </nav>
      {path.value === "/" && <Home onNavigate$={navigate} />}
      {path.value === "/create" && <Create onNavigate$={navigate} />}
      {path.value === "/projects" && <Projects onNavigate$={navigate} />}
      {projectMatch && <ProjectPage id={projectMatch[1]} />}
      {path.value === "/settings" && <Settings />}
    </main>
  );
});

export const Home = component$<{ onNavigate$: (href: string) => void }>(({ onNavigate$ }) => (
  <section class="mx-auto grid min-h-[calc(100vh-88px)] w-full max-w-6xl items-center gap-10 px-5 pb-16 pt-6 lg:grid-cols-[1fr_380px]">
    <div class="max-w-3xl">
      <p class="mb-4 text-sm uppercase tracking-[0.32em] text-aqua">Local-first video render</p>
      <h1 class="text-5xl font-bold leading-tight sm:text-7xl">
        Texto em vídeo com voz, legendas e fundos cinematográficos.
      </h1>
      <p class="mt-6 max-w-2xl text-lg leading-8 text-white/80">
        Um pipeline leve para transformar ideias em MP4 vertical, quadrado ou landscape usando uploads locais e FFmpeg.
      </p>
      <div class="mt-8 flex flex-wrap gap-3">
        <button class="primary-button" onClick$={() => onNavigate$("/create")}>Criar vídeo</button>
        <button class="secondary-button" onClick$={() => onNavigate$("/projects")}>Ver projetos</button>
      </div>
    </div>
    <div class="glass-panel mx-auto aspect-[9/16] w-full max-w-[340px] overflow-hidden p-4 shadow-glow">
      <div class="flex h-full flex-col justify-end rounded-md bg-[linear-gradient(180deg,rgba(103,232,249,0.28),rgba(8,32,50,0.96)),url('https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80')] bg-cover bg-center p-5">
        <div class="rounded-md bg-black/30 p-4 text-center text-2xl font-black uppercase leading-tight">
          Render local. Legendas vivas.
        </div>
      </div>
    </div>
  </section>
));

export const Create = component$<{ onNavigate$: (href: string) => void }>(({ onNavigate$ }) => {
  const title = useSignal("Primeiro vídeo");
  const text = useSignal("Escreve aqui o texto do teu vídeo. Divide ideias em frases curtas para legendas mais fortes.");
  const format = useSignal("vertical");
  const template = useSignal("minimal");
  const captionStyle = useSignal("bold");
  const audio = useSignal<MediaAsset>();
  const background = useSignal<MediaAsset>();
  const status = useSignal("");
  const busy = useSignal(false);

  const uploadFile = $(async (event: Event, kind: "audio" | "background") => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    status.value = `A enviar ${kind}...`;
    const formData = new FormData();
    formData.append("file", file);
    const endpoint = kind === "audio" ? "/api/audio/upload" : "/api/backgrounds/upload";
    const response = await fetch(`${API_URL}${endpoint}`, { method: "POST", body: formData });
    if (!response.ok) {
      status.value = await response.text();
      return;
    }
    const asset = (await response.json()) as MediaAsset;
    if (kind === "audio") audio.value = asset;
    if (kind === "background") background.value = asset;
    status.value = `${kind} pronto`;
  });

  const generate = $(async () => {
    if (!audio.value || !background.value) {
      status.value = "Falta upload de áudio e vídeo de fundo.";
      return;
    }
    busy.value = true;
    try {
      const projectResponse = await fetch(`${API_URL}/api/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.value,
          text: text.value,
          format: format.value,
          template: template.value,
          voice_mode: "uploaded_audio",
          background_id: background.value.id,
          audio_id: audio.value.id,
          caption_style: captionStyle.value,
        }),
      });
      if (!projectResponse.ok) throw new Error(await projectResponse.text());
      const project = await projectResponse.json();
      const renderResponse = await fetch(`${API_URL}/api/render`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: project.id,
          background_id: background.value.id,
          audio_id: audio.value.id,
          format: format.value,
          caption_style: captionStyle.value,
        }),
      });
      if (!renderResponse.ok) throw new Error(await renderResponse.text());
      status.value = "Job criado. A abrir detalhes...";
      onNavigate$(`/projects/${project.id}`);
    } catch (error) {
      status.value = error instanceof Error ? error.message : "Erro ao gerar vídeo";
    } finally {
      busy.value = false;
    }
  });

  return (
    <section class="mx-auto grid w-full max-w-6xl gap-6 px-5 pb-16 pt-6 lg:grid-cols-[1fr_360px]">
      <div class="glass-panel p-5">
        <p class="text-sm uppercase tracking-[0.24em] text-aqua">Criar vídeo</p>
        <h1 class="mt-2 text-3xl font-bold">Pipeline local</h1>
        <div class="mt-5 grid gap-4">
          <label class="field-label">Título<input class="input" value={title.value} onInput$={(event) => (title.value = (event.target as HTMLInputElement).value)} /></label>
          <label class="field-label">Texto<textarea class="input min-h-44 resize-y" value={text.value} onInput$={(event) => (text.value = (event.target as HTMLTextAreaElement).value)} /></label>
          <div class="grid gap-4 md:grid-cols-3">
            <label class="field-label">Formato<select class="input" value={format.value} onChange$={(event) => (format.value = (event.target as HTMLSelectElement).value)}><option value="vertical">9:16</option><option value="square">1:1</option><option value="landscape">16:9</option></select></label>
            <label class="field-label">Template<select class="input" value={template.value} onChange$={(event) => (template.value = (event.target as HTMLSelectElement).value)}><option value="minimal">Minimal</option><option value="cinematic">Cinematic</option><option value="manifesto">Manifesto</option></select></label>
            <label class="field-label">Legendas<select class="input" value={captionStyle.value} onChange$={(event) => (captionStyle.value = (event.target as HTMLSelectElement).value)}><option value="minimal">Minimal</option><option value="bold">Bold</option><option value="karaoke_basic">Karaoke básico</option><option value="manifesto">Manifesto</option></select></label>
          </div>
          <div class="grid gap-4 md:grid-cols-2">
            <label class="upload-box"><span>Áudio de voz</span><input type="file" accept=".wav,.mp3,.m4a,.aac,audio/*" onChange$={(event) => uploadFile(event, "audio")} /><small>{audio.value ? "Upload concluído" : "WAV, MP3, M4A ou AAC"}</small></label>
            <label class="upload-box"><span>Vídeo de fundo</span><input type="file" accept=".mp4,.mov,.webm,video/*" onChange$={(event) => uploadFile(event, "background")} /><small>{background.value ? "Upload concluído" : "MP4, MOV ou WEBM"}</small></label>
          </div>
          <button class="primary-button w-full justify-center disabled:opacity-50" disabled={busy.value} onClick$={generate}>{busy.value ? "A preparar..." : "Gerar vídeo"}</button>
          {status.value && <p class="rounded-md bg-white/10 p-3 text-sm text-white/80">{status.value}</p>}
        </div>
      </div>
      <aside class="glass-panel mx-auto aspect-[9/16] w-full max-w-[340px] p-4">
        <div class="flex h-full flex-col justify-between overflow-hidden rounded-md bg-abyss/80 p-5">
          <div class="text-xs uppercase tracking-[0.22em] text-aqua">Preview</div>
          <div class="rounded-md border border-white/10 bg-white/10 p-4 text-center text-2xl font-black uppercase leading-tight">{text.value.split(".")[0] || "Texto do vídeo"}</div>
          <div class="grid grid-cols-3 gap-2 text-center text-xs text-white/70"><span>{format.value}</span><span>{template.value}</span><span>{captionStyle.value}</span></div>
        </div>
      </aside>
    </section>
  );
});

export const Projects = component$<{ onNavigate$: (href: string) => void }>(({ onNavigate$ }) => {
  const projects = useSignal<Project[]>([]);
  const error = useSignal("");
  useVisibleTask$(async () => {
    const response = await fetch(`${API_URL}/api/projects`);
    if (!response.ok) {
      error.value = await response.text();
      return;
    }
    projects.value = await response.json();
  });
  return (
    <section class="mx-auto w-full max-w-6xl px-5 pb-16 pt-6">
      <div class="mb-6 flex items-center justify-between"><div><p class="text-sm uppercase tracking-[0.24em] text-aqua">Projetos</p><h1 class="mt-2 text-3xl font-bold">Histórico local</h1></div><button class="primary-button" onClick$={() => onNavigate$("/create")}>Novo</button></div>
      {error.value && <p class="glass-panel p-4 text-sm">{error.value}</p>}
      <div class="grid gap-3">
        {projects.value.map((project) => <button key={project.id} onClick$={() => onNavigate$(`/projects/${project.id}`)} class="glass-panel block p-4 text-left transition hover:bg-white/20"><div class="flex flex-wrap items-center justify-between gap-3"><div><h2 class="text-xl font-semibold">{project.title}</h2><p class="mt-1 line-clamp-1 text-sm text-white/70">{project.text}</p></div><div class="flex gap-2 text-xs uppercase tracking-[0.18em] text-white/70"><span>{project.format}</span><span>{project.status}</span></div></div></button>)}
        {!projects.value.length && !error.value && <p class="glass-panel p-4 text-white/75">Ainda não existem projetos.</p>}
      </div>
    </section>
  );
});

export const ProjectPage = component$<{ id: string }>(({ id }) => {
  const detail = useSignal<ProjectDetail>();
  const error = useSignal("");
  useVisibleTask$(({ cleanup }) => {
    let cancelled = false;
    const load = async () => {
      const response = await fetch(`${API_URL}/api/projects/${id}`);
      if (!response.ok) {
        error.value = await response.text();
        return;
      }
      if (!cancelled) detail.value = await response.json();
    };
    load();
    const interval = window.setInterval(load, 2500);
    cleanup(() => { cancelled = true; window.clearInterval(interval); });
  });
  const job = detail.value?.latest_job;
  return (
    <section class="mx-auto grid w-full max-w-6xl gap-6 px-5 pb-16 pt-6 lg:grid-cols-[1fr_340px]">
      <div class="glass-panel p-5">
        {error.value && <p class="rounded-md bg-red-500/20 p-3 text-sm">{error.value}</p>}
        {detail.value && <><p class="text-sm uppercase tracking-[0.24em] text-aqua">Projeto</p><h1 class="mt-2 text-3xl font-bold">{detail.value.project.title}</h1><p class="mt-4 whitespace-pre-wrap text-white/80">{detail.value.project.text}</p><div class="mt-6 grid gap-3 sm:grid-cols-3"><div class="metric"><span>Formato</span><strong>{detail.value.project.format}</strong></div><div class="metric"><span>Estado</span><strong>{job?.status || detail.value.project.status}</strong></div><div class="metric"><span>Progresso</span><strong>{job?.progress ?? 0}%</strong></div></div>{job?.error_message && <p class="mt-4 rounded-md bg-red-500/20 p-3 text-sm">{job.error_message}</p>}{job?.status === "completed" && <a class="primary-button mt-6 inline-flex" href={`${API_URL}/api/videos/${job.id}/download`}>Download MP4</a>}</>}
      </div>
      <aside class="glass-panel p-5"><div class="mb-3 flex items-center justify-between text-sm text-white/70"><span>Render</span><span>{job?.id?.slice(0, 8) || "sem job"}</span></div><div class="h-3 overflow-hidden rounded-full bg-white/10"><div class="h-full rounded-full bg-gradient-to-r from-aqua to-sand" style={{ width: `${job?.progress ?? 0}%` }} /></div><div class="mt-5 aspect-video rounded-md border border-white/10 bg-black/30 p-4 text-center text-sm text-white/60">{job?.status === "completed" ? "MP4 pronto para download" : "Preview disponível após render"}</div></aside>
    </section>
  );
});

export const Settings = component$(() => (
  <section class="mx-auto w-full max-w-4xl px-5 pb-16 pt-6">
    <div class="glass-panel p-6">
      <p class="text-sm uppercase tracking-[0.24em] text-aqua">Settings</p>
      <h1 class="mt-2 text-3xl font-bold">Voz e modelos locais</h1>
      <div class="mt-6 grid gap-3 sm:grid-cols-2">
        {["XTTS-v2", "F5-TTS", "Piper", "OpenVoice", "Ollama", "faster-whisper"].map((name) => <div class="rounded-md border border-white/10 bg-white/10 p-4" key={name}><h2 class="font-semibold">{name}</h2><p class="mt-1 text-sm text-white/70">Preparado para integração depois do MVP.</p></div>)}
      </div>
    </div>
  </section>
));
