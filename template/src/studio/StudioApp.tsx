import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Player, type PlayerRef } from '@remotion/player';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowsClockwise,
  ArrowSquareOut,
  ArrowUp,
  BookOpen,
  Buildings,
  Check,
  CheckCircle,
  Compass,
  Copy,
  DeviceMobile,
  DownloadSimple,
  FilmStrip,
  Flame,
  Flask,
  Gear,
  MagicWand,
  Monitor,
  Pause,
  Play,
  Plus,
  PresentationChart,
  SlidersHorizontal,
  Sparkle,
  SpeakerHigh,
  Trash,
  Trophy,
  VideoCamera,
  Waveform,
  YoutubeLogo,
} from '@phosphor-icons/react';
import type { CharacterPose } from '../shots/G1/DesmontandoRig';
import { DynamicStudioVideo } from './DynamicStudioVideo';
import {
  type AspectRatioId,
  buildProjectForModel,
  type CandidateModelOption,
  type DailyThemeSuggestion,
  DURATION_PRESETS,
  estimateSceneTimings,
  getCanvasSize,
  is2DTemplateModel,
  type PlatformId,
  type SectorStationType,
  type StudioProjectSpec,
  type StudioSceneSpec,
  type StudioSectorSpec,
  TEMPLATE_MODELS,
  type TemplateModelId,
  VOICE_CATALOG,
  type YoutubeChannelRef,
  type YoutubeViralVideo,
} from './StudioSchema';

type WizardStep = 1 | 2 | 3 | 4 | 5;
type ViewMode = 'wizard' | 'youtube_radar' | 'gallery';

interface GalleryVideoItem {
  filename: string;
  title: string;
  videoUrl: string;
  sizeMb: number;
  updatedAt: string;
  aspectRatio: AspectRatioId;
  modelLabel: string;
  project?: StudioProjectSpec | null;
}

interface CalibrationMeta {
  actualSeconds: number;
  targetSeconds: number;
  appliedRatePct: number;
  calibrationNote: string;
  needsResize: 'shorter' | 'longer' | null;
}

interface RenderJobState {
  jobId: string;
  status: 'running' | 'done' | 'error';
  progressPct: number;
  phase: string;
  renderedFrames: number;
  totalFrames: number;
  outputUrl: string | null;
  filename: string | null;
  sizeMb: number | null;
  error: string | null;
  project?: StudioProjectSpec;
}

const STEP_LABELS: Array<{ step: WizardStep; title: string }> = [
  { step: 1, title: 'Ideia' },
  { step: 2, title: 'Formato & Tempo' },
  { step: 3, title: 'Roteiro IA' },
  { step: 4, title: 'Voz & Áudio' },
  { step: 5, title: '3 Modelos IA & MP4' },
];

function renderModelIcon(modelId: TemplateModelId, size = 19): React.ReactNode {
  switch (modelId) {
    case 'doc_mapa_radar':
      return <Compass size={size} weight="duotone" color="#F59E0B" />;
    case 'ilustrado_flat_2d':
      return <BookOpen size={size} weight="duotone" color="#A78BFA" />;
    case 'editorial_kinetic_2d':
      return <Gear size={size} weight="duotone" color="#38BDF8" />;
    case 'fluxo_corporativo':
      return <Buildings size={size} weight="duotone" color="#FACC15" />;
    case 'sala_experimento':
      return <Flask size={size} weight="duotone" color="#38BDF8" />;
    case 'estudio_apresentador':
    default:
      return <PresentationChart size={size} weight="duotone" color="#4ADE80" />;
  }
}

const POSE_OPTIONS: Array<{ value: CharacterPose; label: string }> = [
  { value: 'standing_neutral', label: 'Em pé Apresentando' },
  { value: 'standing_phone', label: 'Em pé com Celular / Scanner' },
  { value: 'standing_worried', label: 'Em pé Preocupado (Alerta)' },
  { value: 'sitting_desk', label: 'Sentado no Computador' },
  { value: 'standing_wave', label: 'Em pé Acenando (Conclusão)' },
  { value: 'sitting_hot', label: 'Poltrona com Calor / Alerta' },
  { value: 'sitting_cool', label: 'Poltrona Confortável' },
];

const STATION_TYPE_OPTIONS: Array<{ value: SectorStationType; label: string }> = [
  { value: 'office_single', label: 'Escritório / Estação (1 Tela)' },
  { value: 'office_dual_erp', label: 'Central / Sistema ERP (2 Telas)' },
  { value: 'supermarket_aisle', label: 'Loja / Gôndola + Impressora' },
  { value: 'warehouse_dock', label: 'Estoque / Logística (Paletes)' },
];

function formatSecondsFriendly(sec: number): string {
  if (sec < 60) return `${Math.round(sec)}s`;
  const m = Math.floor(sec / 60);
  const r = Math.round(sec % 60);
  return r > 0 ? `${m}m ${r}s` : `${m} min`;
}

function formatTimestampMMSS(frame: number): string {
  const totalSec = Math.max(0, Math.floor((frame - 1) / 30));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatViewsCompact(views: number): string {
  if (!views || views <= 0) return 'Novo';
  if (views >= 1_000_000) {
    return `${(views / 1_000_000).toFixed(1).replace('.', ',')} mi`;
  }
  if (views >= 1_000) {
    return `${Math.round(views / 1_000)} mil`;
  }
  return `${views}`;
}

export const StudioApp: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('wizard');
  const [step, setStep] = useState<WizardStep>(1);
  const [maxUnlockedStep, setMaxUnlockedStep] = useState<WizardStep>(1);

  // Etapa 1 & 2: Estados limpos iniciais prontos para YouTube Shorts 9:16 (escolha de 3 modelos 100% via OmniRoute)
  const [promptInput, setPromptInput] = useState<string>('');
  const [platform, setPlatform] = useState<PlatformId>('youtube_shorts');
  const [aspectRatio, setAspectRatio] = useState<AspectRatioId>('9:16');
  const [targetSeconds, setTargetSeconds] = useState<number>(90);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('yt_shorts_90');
  const [hintModelId, setHintModelId] = useState<TemplateModelId | null>(null);

  // Etapa 3, 4 e 5: Projeto criado dinamicamente + Base de Conhecimento
  const [project, setProject] = useState<StudioProjectSpec | null>(null);
  const [calibration, setCalibration] = useState<CalibrationMeta | null>(null);
  const [activeSceneIdx, setActiveSceneIdx] = useState<number>(0);
  const [showAdvanced3d, setShowAdvanced3d] = useState<boolean>(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [learnedPrefsCount, setLearnedPrefsCount] = useState<number>(0);
  const [savingChoiceModelId, setSavingChoiceModelId] = useState<TemplateModelId | null>(null);
  const [choiceFeedbackMsg, setChoiceFeedbackMsg] = useState<string | null>(null);
  const [isSyncPlayingAll, setIsSyncPlayingAll] = useState<boolean>(false);

  // Estados do Radar YouTube Shorts & Temas do Dia (OmniRoute IA)
  const [radarChannels, setRadarChannels] = useState<YoutubeChannelRef[]>([]);
  const [radarVideos, setRadarVideos] = useState<YoutubeViralVideo[]>([]);
  const [dailyThemes, setDailyThemes] = useState<DailyThemeSuggestion[]>([]);
  const [radarChannelAnalysis, setRadarChannelAnalysis] = useState<string>('');
  const [radarAiModel, setRadarAiModel] = useState<string>('');
  const [radarAnalyzedAt, setRadarAnalyzedAt] = useState<string>('');
  const [radarLastUpdated, setRadarLastUpdated] = useState<string>('');
  const [newChannelInput, setNewChannelInput] = useState<string>('');
  const [nicheHintInput, setNicheHintInput] = useState<string>('');
  const [viralChannelFilter, setViralChannelFilter] = useState<string>('ALL');
  const [isLoadingRadar, setIsLoadingRadar] = useState<boolean>(false);
  const [isAddingChannel, setIsAddingChannel] = useState<boolean>(false);
  const [isGeneratingThemes, setIsGeneratingThemes] = useState<boolean>(false);

  // Loaders & Jobs do Wizard
  const [isGeneratingScript, setIsGeneratingScript] = useState<boolean>(false);
  const [isResizingScript, setIsResizingScript] = useState<boolean>(false);
  const [isRefiningScript, setIsRefiningScript] = useState<boolean>(false);
  const [scriptPromptEdit, setScriptPromptEdit] = useState<string>('');
  const [refineSummaryMsg, setRefineSummaryMsg] = useState<string | null>(null);
  const [isManualTextMode, setIsManualTextMode] = useState<boolean>(false);
  const [step3PreviewModelIdx, setStep3PreviewModelIdx] = useState<number>(0);
  const [isQuickListeningStep3, setIsQuickListeningStep3] = useState<boolean>(false);
  const [isGeneratingVoice, setIsGeneratingVoice] = useState<boolean>(false);
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null);
  const [renderJob, setRenderJob] = useState<RenderJobState | null>(null);
  const [galleryVideos, setGalleryVideos] = useState<GalleryVideoItem[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const step3PlayerRef = useRef<PlayerRef>(null);
  const candidatePlayerRefs = useRef<Array<PlayerRef | null>>([null, null, null]);
  const sampleAudioRef = useRef<HTMLAudioElement | null>(null);
  const themesSectionRef = useRef<HTMLDivElement | null>(null);
  const scriptAbortRef = useRef<AbortController | null>(null);

  const cancelPendingScriptGeneration = useCallback(() => {
    if (scriptAbortRef.current) {
      scriptAbortRef.current.abort();
      scriptAbortRef.current = null;
    }
    setIsGeneratingScript(false);
  }, []);

  const fetchKnowledgePrefs = useCallback(async () => {
    try {
      const resp = await fetch('/api/knowledge/preferences');
      const data = await resp.json();
      if (data.ok && typeof data.count === 'number') {
        setLearnedPrefsCount(data.count);
      }
    } catch {
      // Silencioso no boot inicial
    }
  }, []);

  const applyRadarPayload = useCallback((radar: Record<string, unknown>) => {
    if (Array.isArray(radar.channels)) {
      setRadarChannels(radar.channels as YoutubeChannelRef[]);
    }
    if (Array.isArray(radar.viralVideos)) {
      setRadarVideos(radar.viralVideos as YoutubeViralVideo[]);
    }
    if (Array.isArray(radar.dailyThemes)) {
      setDailyThemes((radar.dailyThemes as DailyThemeSuggestion[]).slice(0, 3));
    }
    if (typeof radar.channelAnalysis === 'string') {
      setRadarChannelAnalysis(radar.channelAnalysis);
    }
    if (typeof radar.aiModelUsed === 'string') {
      setRadarAiModel(radar.aiModelUsed);
    }
    if (typeof radar.analyzedAt === 'string') {
      setRadarAnalyzedAt(radar.analyzedAt);
    }
    if (typeof radar.lastUpdatedAt === 'string') {
      setRadarLastUpdated(radar.lastUpdatedAt);
    }
  }, []);

  const fetchGallery = useCallback(async () => {
    try {
      const resp = await fetch('/api/gallery');
      const data = await resp.json();
      if (data.ok && Array.isArray(data.videos)) {
        setGalleryVideos(data.videos);
      }
    } catch {
      // Silencioso no boot inicial
    }
  }, []);

  const fetchYoutubeRadar = useCallback(async () => {
    setIsLoadingRadar(true);
    try {
      const resp = await fetch('/api/youtube/radar');
      const data = await resp.json();
      if (data.ok && data.radar) {
        applyRadarPayload(data.radar);
      }
    } catch {
      // Silencioso no boot inicial
    } finally {
      setIsLoadingRadar(false);
    }
  }, [applyRadarPayload]);

  useEffect(() => {
    fetchGallery();
    fetchYoutubeRadar();
    fetchKnowledgePrefs();
  }, [fetchGallery, fetchYoutubeRadar, fetchKnowledgePrefs]);

  useEffect(() => {
    if (viewMode !== 'wizard' || step !== 3 || !project) return;
    const timer = window.setInterval(() => {
      const ref = step3PlayerRef.current;
      if (!ref) return;
      const curN = ref.getCurrentFrame() + 1;
      const idx = project.scenes.findIndex((s) => curN >= s.fromFrame && curN <= s.toFrame);
      if (idx >= 0) {
        setActiveSceneIdx((prev) => (prev === idx ? prev : idx));
      }
    }, 140);
    return () => window.clearInterval(timer);
  }, [viewMode, step, project]);

  useEffect(() => {
    if (!renderJob || renderJob.status !== 'running') return;
    const timer = window.setInterval(async () => {
      try {
        const resp = await fetch(`/api/render/status/${renderJob.jobId}`);
        const data = await resp.json();
        if (data.ok && data.job) {
          setRenderJob(data.job);
          if (data.job.status === 'done') {
            fetchGallery();
          }
        }
      } catch {
        // Continua monitorando
      }
    }, 1400);
    return () => window.clearInterval(timer);
  }, [renderJob, fetchGallery]);

  const totalScriptWords = useMemo(() => {
    if (!project) return 0;
    return project.scenes.reduce((acc, sc) => {
      const cnt = sc.narration.trim().split(/\s+/).filter(Boolean).length;
      return acc + cnt;
    }, 0);
  }, [project]);

  const estimatedSecondsFromWords = useMemo(() => {
    return Math.max(10, Math.round(totalScriptWords / 2.55));
  }, [totalScriptWords]);

  const filteredViralVideos = useMemo(() => {
    if (viralChannelFilter === 'ALL') return radarVideos;
    return radarVideos.filter(
      (v) => v.channelHandle.toLowerCase() === viralChannelFilter.toLowerCase()
    );
  }, [radarVideos, viralChannelFilter]);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(key);
    window.setTimeout(() => setCopiedField(null), 1800);
  };

  const resetToFreshPrompt = () => {
    cancelPendingScriptGeneration();
    setPromptInput('');
    setHintModelId(null);
    setProject(null);
    setCalibration(null);
    setRenderJob(null);
    setChoiceFeedbackMsg(null);
    setRefineSummaryMsg(null);
    setScriptPromptEdit('');
    setIsManualTextMode(false);
    setStep3PreviewModelIdx(0);
    setIsSyncPlayingAll(false);
    setErrorMsg(null);
    setStep(1);
    setMaxUnlockedStep(1);
    setViewMode('wizard');
  };

  const goToStep = (next: WizardStep) => {
    setStep(next);
    setMaxUnlockedStep((prev) => (next > prev ? next : prev));
    setViewMode('wizard');
  };

  // =========================================================================
  // Ações do Radar YouTube Shorts & Temas do Dia
  // =========================================================================
  const handleAddYoutubeChannel = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newChannelInput.trim()) return;
    setIsAddingChannel(true);
    setErrorMsg(null);
    try {
      const resp = await fetch('/api/youtube/channels/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: newChannelInput.trim() }),
      });
      const data = await resp.json();
      if (data.ok && data.radar) {
        applyRadarPayload(data.radar);
        setNewChannelInput('');
      } else {
        setErrorMsg(data.error || 'Não foi possível adicionar este canal do YouTube.');
      }
    } catch (err) {
      setErrorMsg(`Erro ao buscar canal no YouTube: ${String(err)}`);
    } finally {
      setIsAddingChannel(false);
    }
  };

  const handleRemoveYoutubeChannel = async (ch: YoutubeChannelRef) => {
    setErrorMsg(null);
    try {
      const resp = await fetch('/api/youtube/channels/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId: ch.id, handle: ch.handle }),
      });
      const data = await resp.json();
      if (data.ok && data.radar) {
        applyRadarPayload(data.radar);
        if (viralChannelFilter.toLowerCase() === ch.handle.toLowerCase()) {
          setViralChannelFilter('ALL');
        }
      }
    } catch (err) {
      setErrorMsg(`Erro ao remover canal: ${String(err)}`);
    }
  };

  const handleRefreshVirals = async () => {
    setIsLoadingRadar(true);
    setErrorMsg(null);
    try {
      const resp = await fetch('/api/youtube/refresh', { method: 'POST' });
      const data = await resp.json();
      if (data.ok && data.radar) {
        applyRadarPayload(data.radar);
      }
    } catch (err) {
      setErrorMsg(`Erro ao atualizar Shorts virais: ${String(err)}`);
    } finally {
      setIsLoadingRadar(false);
    }
  };

  const handleGenerateDailyThemes = async (inspireVideoId = '') => {
    setIsGeneratingThemes(true);
    setErrorMsg(null);
    if (inspireVideoId && themesSectionRef.current) {
      themesSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    try {
      const resp = await fetch('/api/youtube/daily-themes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nicheHint: nicheHintInput.trim(),
          inspireVideoId,
        }),
      });
      const data = await resp.json();
      if (data.ok && data.radar) {
        applyRadarPayload(data.radar);
      } else {
        setErrorMsg(data.error || 'Falha ao gerar os Temas do Dia.');
      }
    } catch (err) {
      setErrorMsg(`Erro ao gerar Temas do Dia: ${String(err)}`);
    } finally {
      setIsGeneratingThemes(false);
    }
  };

  const openRadarAndEnsureThemes = () => {
    setViewMode('youtube_radar');
    if ((dailyThemes.length !== 3 || !radarChannelAnalysis) && !isGeneratingThemes && !isLoadingRadar) {
      handleGenerateDailyThemes();
    }
  };

  // Carrega Tema do Dia e leva para a Etapa 2 (Formato & Tempo) SEM disparar geração antes da confirmação do usuário!
  const handleCreateShortFromTheme = (
    theme: DailyThemeSuggestion,
    goToFormatStep: boolean
  ) => {
    cancelPendingScriptGeneration();
    const sec = theme.recommendedSeconds || 90;
    const presetMatch =
      DURATION_PRESETS.find((p) => p.platform === 'youtube_shorts' && p.seconds === sec)?.id ||
      'yt_shorts_90';

    setPromptInput(theme.readyPrompt);
    setHintModelId(theme.suggestedModelId);
    setPlatform('youtube_shorts');
    setAspectRatio('9:16');
    setTargetSeconds(sec);
    setSelectedPresetId(presetMatch);
    setChoiceFeedbackMsg(null);
    setErrorMsg(null);

    if (!goToFormatStep) {
      setStep(1);
      setViewMode('wizard');
      return;
    }

    goToStep(2);
  };

  // =========================================================================
  // Ações do Assistente de 5 Etapas
  // =========================================================================
  const handlePromptContinue = () => {
    if (!promptInput.trim()) return;
    cancelPendingScriptGeneration();
    setErrorMsg(null);
    goToStep(2);
  };

  const handleSelectDurationPreset = (presetId: string) => {
    const found = DURATION_PRESETS.find((p) => p.id === presetId);
    if (!found) return;
    if (isGeneratingScript) {
      cancelPendingScriptGeneration();
    }
    setSelectedPresetId(found.id);
    setPlatform(found.platform);
    setAspectRatio(found.aspectRatio);
    setTargetSeconds(found.seconds);
  };

  const handleGenerateScript = async () => {
    if (!promptInput.trim()) return;
    cancelPendingScriptGeneration();
    const controller = new AbortController();
    scriptAbortRef.current = controller;

    setIsGeneratingScript(true);
    setChoiceFeedbackMsg(null);
    setErrorMsg(null);
    try {
      const resp = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          promptIdea: promptInput.trim(),
          platform,
          aspectRatio,
          targetSeconds,
          ...(hintModelId ? { hintModelId } : {}),
          voiceId: project?.voiceId || 'antonio_dinamico',
        }),
      });
      const data = await resp.json();
      if (controller.signal.aborted) return;
      if (data.ok && data.project) {
        setProject(data.project);
        setCalibration(null);
        setRenderJob(null);
        setRefineSummaryMsg(null);
        setScriptPromptEdit('');
        setIsManualTextMode(false);
        setStep3PreviewModelIdx(0);
        setActiveSceneIdx(0);
        goToStep(3);
      } else {
        setErrorMsg(data.error || 'Não foi possível gerar o roteiro.');
      }
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return;
      setErrorMsg(`Falha ao comunicar com a API: ${String(err)}`);
    } finally {
      if (scriptAbortRef.current === controller) {
        scriptAbortRef.current = null;
        setIsGeneratingScript(false);
      }
    }
  };

  const handleResizeScript = async (
    mode: 'shorter' | 'longer' | 'fit_target',
    regenerateVoiceAfter = false
  ) => {
    if (!project) return;
    setIsResizingScript(true);
    setErrorMsg(null);
    try {
      const resp = await fetch('/api/ai/resize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project,
          mode,
          targetSeconds,
        }),
      });
      const data = await resp.json();
      if (data.ok && data.project) {
        const updatedProj: StudioProjectSpec = {
          ...data.project,
          voiceId: project.voiceId,
          voiceRatePct: project.voiceRatePct,
          sfxEnabled: project.sfxEnabled,
          subtitlesEnabled: project.subtitlesEnabled,
        };
        setProject(updatedProj);
        setCalibration(null);
        if (regenerateVoiceAfter) {
          await synthesizeVoiceInternal(updatedProj);
        }
      }
    } catch (err) {
      setErrorMsg(`Erro ao ajustar tamanho do roteiro: ${String(err)}`);
    } finally {
      setIsResizingScript(false);
    }
  };

  const handleRefineScriptByPrompt = async (customInstruction?: string) => {
    if (!project) return;
    const instruction = (customInstruction ?? scriptPromptEdit).trim();
    if (!instruction) return;

    setIsRefiningScript(true);
    setRefineSummaryMsg(null);
    setErrorMsg(null);
    if (step3PlayerRef.current) {
      step3PlayerRef.current.pause();
    }

    try {
      const resp = await fetch('/api/ai/refine-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project,
          instruction,
          targetSeconds,
        }),
      });
      const data = await resp.json();
      if (data.ok && data.project) {
        const updatedProj: StudioProjectSpec = {
          ...data.project,
          voiceId: project.voiceId,
          voiceRatePct: project.voiceRatePct,
          sfxEnabled: project.sfxEnabled,
          subtitlesEnabled: project.subtitlesEnabled,
          audioUrl: null,
        };
        setProject(updatedProj);
        setCalibration(null);
        setActiveSceneIdx(0);
        if (!customInstruction) {
          setScriptPromptEdit('');
        }
        setRefineSummaryMsg(
          data.changeSummary || 'Roteiro e elementos visuais atualizados conforme seu pedido!'
        );
        window.setTimeout(() => {
          step3PlayerRef.current?.seekTo(0);
        }, 60);
      } else {
        setErrorMsg(data.error || 'Não foi possível ajustar o roteiro pela IA.');
      }
    } catch (err) {
      setErrorMsg(`Erro ao ajustar o roteiro com IA: ${String(err)}`);
    } finally {
      setIsRefiningScript(false);
    }
  };

  const seekStep3PreviewToScene = (idx: number) => {
    if (!project) return;
    const sc = project.scenes[idx];
    setActiveSceneIdx(idx);
    if (sc && step3PlayerRef.current) {
      step3PlayerRef.current.seekTo(Math.max(0, sc.fromFrame - 1));
    }
  };

  const handleQuickListenStep3 = async () => {
    if (!project) return;
    setErrorMsg(null);
    if (project.audioUrl) {
      if (step3PlayerRef.current) {
        step3PlayerRef.current.unmute();
        step3PlayerRef.current.seekTo(0);
        step3PlayerRef.current.play();
      }
      return;
    }

    setIsQuickListeningStep3(true);
    try {
      const synth = await synthesizeVoiceInternal(project);
      if (synth) {
        window.setTimeout(() => {
          if (step3PlayerRef.current) {
            step3PlayerRef.current.unmute();
            step3PlayerRef.current.seekTo(0);
            step3PlayerRef.current.play();
          }
        }, 120);
      }
    } finally {
      setIsQuickListeningStep3(false);
    }
  };

  const handlePreviewVoice = async (voiceId: string) => {
    const voice = VOICE_CATALOG.find((v) => v.id === voiceId);
    if (!voice) return;
    setPreviewingVoiceId(voiceId);
    try {
      const resp = await fetch('/api/voice/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voiceId: voice.id,
          edgeVoice: voice.edgeVoice,
          ratePct: project?.voiceId === voice.id ? project.voiceRatePct : voice.defaultRatePct,
          pitchHz: voice.pitchHz,
          text: voice.sampleText,
        }),
      });
      const data = await resp.json();
      if (data.ok && data.audioUrl) {
        if (sampleAudioRef.current) {
          sampleAudioRef.current.pause();
        }
        const audio = new Audio(data.audioUrl);
        sampleAudioRef.current = audio;
        audio.onended = () => setPreviewingVoiceId(null);
        await audio.play();
      } else {
        setPreviewingVoiceId(null);
      }
    } catch {
      setPreviewingVoiceId(null);
    }
  };

  const synthesizeVoiceInternal = async (projToSynth: StudioProjectSpec) => {
    setIsGeneratingVoice(true);
    setErrorMsg(null);
    try {
      const payloadProj: StudioProjectSpec = {
        ...projToSynth,
        aspectRatio,
        platform,
        targetSeconds,
      };
      const resp = await fetch('/api/project/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project: payloadProj,
          autoFitDuration: true,
        }),
      });
      const data = await resp.json();
      if (data.ok && data.project) {
        setProject(data.project);
        setCalibration(data.calibration || null);
        return data.project as StudioProjectSpec;
      }
      setErrorMsg(data.error || 'Erro ao gerar voz neural.');
      return null;
    } catch (err) {
      setErrorMsg(`Falha ao sintetizar áudio: ${String(err)}`);
      return null;
    } finally {
      setIsGeneratingVoice(false);
    }
  };

  const handleGenerateVoiceStep4 = async () => {
    if (!project) return;
    await synthesizeVoiceInternal(project);
  };

  const handleAdvanceToStep5 = async () => {
    if (!project) return;
    if (!project.audioUrl) {
      const generated = await synthesizeVoiceInternal(project);
      if (!generated) return;
    }
    setActiveSceneIdx(0);
    setIsSyncPlayingAll(false);
    goToStep(5);
  };

  // Garante sempre 3 modelos distintos selecionados pelo OmniRoute (ou fallback inteligente p/ projetos antigos)
  const resolvedCandidates = useMemo<CandidateModelOption[]>(() => {
    if (!project) return [];
    const seen = new Set<TemplateModelId>();
    const out: CandidateModelOption[] = [];

    if (Array.isArray(project.candidateModels)) {
      for (const item of project.candidateModels) {
        if (
          item &&
          TEMPLATE_MODELS.some((m) => m.id === item.modelId) &&
          !seen.has(item.modelId)
        ) {
          seen.add(item.modelId);
          out.push({
            modelId: item.modelId,
            rank: (out.length + 1) as 1 | 2 | 3,
            reason:
              item.reason ||
              `Selecionado pela IA OmniRoute como opção #${out.length + 1} para este tema.`,
          });
        }
        if (out.length === 3) break;
      }
    }

    const fallbackOrder: TemplateModelId[] = [
      project.suggestedModelId || project.modelId,
      project.modelId,
      'editorial_kinetic_2d',
      'ilustrado_flat_2d',
      'doc_mapa_radar',
      'sala_experimento',
      'estudio_apresentador',
      'fluxo_corporativo',
    ];
    for (const mid of fallbackOrder) {
      if (out.length >= 3) break;
      if (!seen.has(mid) && TEMPLATE_MODELS.some((m) => m.id === mid)) {
        seen.add(mid);
        const tpl = TEMPLATE_MODELS.find((m) => m.id === mid);
        out.push({
          modelId: mid,
          rank: (out.length + 1) as 1 | 2 | 3,
          reason:
            out.length === 0
              ? `Escolha principal sugerida pela IA (${tpl?.inspiredChannel || 'OmniRoute'}) para máxima retenção.`
              : `Alternativa contrastante (${tpl?.badge || tpl?.name}) para você comparar o ritmo visual.`,
        });
      }
    }

    return out;
  }, [project]);

  const candidateBundles = useMemo(() => {
    if (!project) return [];
    return resolvedCandidates.map((cand) => ({
      candidate: cand,
      variantProject: buildProjectForModel(project, cand.modelId),
      meta: TEMPLATE_MODELS.find((m) => m.id === cand.modelId) || TEMPLATE_MODELS[0],
    }));
  }, [project, resolvedCandidates]);

  const handleChooseWinningModel = async (modelId: TemplateModelId) => {
    if (!project) return;
    setSavingChoiceModelId(modelId);
    setErrorMsg(null);

    const adaptedProj: StudioProjectSpec = {
      ...buildProjectForModel(project, modelId),
      knowledgeSavedModelId: modelId,
    };
    setProject(adaptedProj);

    // Se estiver reproduzindo, deixa o áudio ativo no modelo escolhido e silencia os outros 2
    const winIdx = resolvedCandidates.findIndex((c) => c.modelId === modelId);
    candidatePlayerRefs.current.forEach((ref, idx) => {
      if (!ref) return;
      if (idx === winIdx) {
        ref.unmute();
      } else {
        ref.mute();
      }
    });

    const chosenMeta = TEMPLATE_MODELS.find((m) => m.id === modelId);
    try {
      const resp = await fetch('/api/knowledge/choose-model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project: adaptedProj,
          chosenModelId: modelId,
          candidateModels: resolvedCandidates,
        }),
      });
      const data = await resp.json();
      if (data.ok) {
        if (typeof data.totalLearnedCount === 'number') {
          setLearnedPrefsCount(data.totalLearnedCount);
        }
        setChoiceFeedbackMsg(
          `Opção "${chosenMeta?.name || modelId}" salva como melhor escolha na Base de Conhecimento${data.hubSaved ? ' + Cometa Knowledge Hub' : ''
          }! O OmniRoute já usará esse aprendizado nos próximos vídeos.`
        );
      } else {
        setErrorMsg(data.error || 'Não foi possível registrar a escolha na Base de Conhecimento.');
      }
    } catch (err) {
      setErrorMsg(`Erro ao salvar preferência na Base de Conhecimento: ${String(err)}`);
    } finally {
      setSavingChoiceModelId(null);
    }
  };

  const handleTogglePlayAll3 = () => {
    if (!project) return;
    if (isSyncPlayingAll) {
      candidatePlayerRefs.current.forEach((ref) => ref?.pause());
      setIsSyncPlayingAll(false);
      return;
    }

    const activeAudioModel = project.knowledgeSavedModelId || project.modelId;
    const rawAudioIdx = resolvedCandidates.findIndex((c) => c.modelId === activeAudioModel);
    const audioIdx = rawAudioIdx >= 0 ? rawAudioIdx : 0;
    const baseFrame = candidatePlayerRefs.current[audioIdx]?.getCurrentFrame() ?? 0;

    candidatePlayerRefs.current.forEach((ref, idx) => {
      if (!ref) return;
      if (idx === audioIdx) {
        ref.unmute();
      } else {
        ref.mute();
      }
      ref.seekTo(baseFrame);
      ref.play();
    });
    setIsSyncPlayingAll(true);
  };

  const updateScene = (idx: number, patch: Partial<StudioSceneSpec>, invalidateAudio = false) => {
    setProject((prev) => {
      if (!prev) return prev;
      const nextScenes = [...prev.scenes];
      nextScenes[idx] = { ...nextScenes[idx], ...patch };
      if (invalidateAudio) {
        const est = estimateSceneTimings(nextScenes);
        setCalibration(null);
        return {
          ...prev,
          scenes: est.scenes,
          words: est.words,
          totalFrames: est.totalFrames,
          audioUrl: null,
        };
      }
      return { ...prev, scenes: nextScenes };
    });
  };

  const moveScene = (idx: number, dir: -1 | 1) => {
    if (!project) return;
    const target = idx + dir;
    if (target < 0 || target >= project.scenes.length) return;
    setProject((prev) => {
      if (!prev) return prev;
      const copy = [...prev.scenes];
      const [item] = copy.splice(idx, 1);
      copy.splice(target, 0, item);
      const est = estimateSceneTimings(copy);
      setCalibration(null);
      return {
        ...prev,
        scenes: est.scenes,
        words: est.words,
        totalFrames: est.totalFrames,
        audioUrl: null,
      };
    });
  };

  const addScene = () => {
    if (!project) return;
    const idx = project.scenes.length + 1;
    const newSc: StudioSceneSpec = {
      id: `act-${Date.now()}`,
      stepBanner: `ETAPA ${idx}`,
      narration: 'Digite a explicação falada desta cena.',
      sectorIndex: 0,
      pose: 'standing_neutral',
      visualEffect: 'presenter_steps',
      headline: `ETAPA ${idx}!`,
      leftBadge: 'PONTO CHAVE',
      leftBadgeColor: '#FACC15',
      rightBadge: 'CONFIRMADO ✓',
      rightBadgeColor: '#22C55E',
      screenLine1: `ETAPA ${idx}`,
      screenLine2: 'EM DESTAQUE',
      sendDataToSector: null,
      fromFrame: 1,
      toFrame: 150,
    };
    setProject((prev) => {
      if (!prev) return prev;
      const est = estimateSceneTimings([...prev.scenes, newSc]);
      setCalibration(null);
      return {
        ...prev,
        scenes: est.scenes,
        words: est.words,
        totalFrames: est.totalFrames,
        audioUrl: null,
      };
    });
  };

  const removeScene = (idx: number) => {
    if (!project || project.scenes.length <= 1) return;
    setProject((prev) => {
      if (!prev) return prev;
      const filtered = prev.scenes.filter((_, i) => i !== idx);
      const est = estimateSceneTimings(filtered);
      setCalibration(null);
      return {
        ...prev,
        scenes: est.scenes,
        words: est.words,
        totalFrames: est.totalFrames,
        audioUrl: null,
      };
    });
  };

  const updateSector = (idx: number, patch: Partial<StudioSectorSpec>) => {
    setProject((prev) => {
      if (!prev) return prev;
      const next = [...prev.sectors];
      next[idx] = { ...next[idx], ...patch };
      return { ...prev, sectors: next };
    });
  };

  const seekToScene = (idx: number) => {
    if (!project) return;
    const sc = project.scenes[idx];
    setActiveSceneIdx(idx);
    setIsSyncPlayingAll(false);
    if (sc) {
      const targetFrame = Math.max(0, sc.fromFrame - 1);
      candidatePlayerRefs.current.forEach((ref) => {
        if (!ref) return;
        ref.pause();
        ref.seekTo(targetFrame);
      });
    }
  };

  const handleExportCandidateModel = async (modelId: TemplateModelId) => {
    if (!project) return;
    setErrorMsg(null);
    const variantProj: StudioProjectSpec = {
      ...buildProjectForModel(project, modelId),
      candidateModels: resolvedCandidates,
    };
    setProject(variantProj);
    try {
      const resp = await fetch('/api/render/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project: variantProj }),
      });
      const data = await resp.json();
      if (data.ok && data.job) {
        setRenderJob(data.job);
        setProject((prev) => (prev ? { ...prev, knowledgeSavedModelId: modelId } : prev));
        fetchKnowledgePrefs();
      } else {
        setErrorMsg(data.error || 'Falha ao iniciar exportação MP4.');
      }
    } catch (err) {
      setErrorMsg(`Falha ao iniciar exportação MP4: ${String(err)}`);
    }
  };

  const handleOpenGalleryProject = (vid: GalleryVideoItem) => {
    if (!vid.project) return;
    const cloned: StudioProjectSpec = JSON.parse(JSON.stringify(vid.project));
    setProject(cloned);
    setPromptInput(cloned.promptIdea || cloned.name);
    setAspectRatio(cloned.aspectRatio);
    setPlatform(cloned.platform || (cloned.aspectRatio === '9:16' ? 'youtube_shorts' : 'youtube'));
    setTargetSeconds(cloned.targetSeconds || Math.round(cloned.totalFrames / 30));
    setMaxUnlockedStep(5);
    setStep(5);
    setViewMode('wizard');
  };

  const canvasSize = getCanvasSize(project?.aspectRatio || aspectRatio);

  return (
    <div className="studio-shell">
      {/* TOPBAR ENXUTA COM STEPPER + CENTRAL YOUTUBE SHORTS */}
      <header className="studio-topbar">
        <div className="brand-cluster" onClick={() => setViewMode('wizard')}>
          <div className="brand-mark">
            <VideoCamera size={20} weight="fill" />
          </div>
          <span className="brand-name">Desmontando Studio • 2D & 3D</span>
        </div>

        {viewMode === 'wizard' ? (
          <nav className="wizard-stepper" aria-label="Etapas de criação">
            {STEP_LABELS.map((item) => {
              const isCurrent = step === item.step;
              const isUnlocked = item.step <= maxUnlockedStep;
              const isDone = item.step < step;
              return (
                <button
                  key={item.step}
                  type="button"
                  disabled={!isUnlocked}
                  className={`step-pill ${isCurrent ? 'current' : isDone ? 'done' : ''}`}
                  onClick={() => setStep(item.step)}
                >
                  <span className="step-num">
                    {isDone ? <Check size={11} weight="bold" /> : item.step}
                  </span>
                  {item.title}
                </button>
              );
            })}
          </nav>
        ) : null}

        <div className="topbar-actions">
          <button
            type="button"
            className={`btn-secondary ${viewMode === 'youtube_radar' ? 'active-tab' : ''}`}
            onClick={() => {
              if (viewMode === 'youtube_radar') {
                setViewMode('wizard');
              } else {
                openRadarAndEnsureThemes();
              }
            }}
          >
            <YoutubeLogo size={17} weight="fill" color="#EF4444" />
            {viewMode === 'youtube_radar'
              ? 'Voltar ao Criador'
              : `YouTube Shorts • Temas do Dia (${radarChannels.length})`}
          </button>

          {step > 1 || project ? (
            <button type="button" className="btn-ghost" onClick={resetToFreshPrompt}>
              <Plus size={15} weight="bold" />
              Novo Vídeo Limpo
            </button>
          ) : null}

          <button
            type="button"
            className={`btn-secondary ${viewMode === 'gallery' ? 'active-tab' : ''}`}
            onClick={() => {
              if (viewMode === 'gallery') {
                setViewMode('wizard');
              } else {
                fetchGallery();
                setViewMode('gallery');
              }
            }}
          >
            <FilmStrip size={16} weight="bold" />
            {viewMode === 'gallery' ? 'Voltar ao Criador' : `Galeria MP4 (${galleryVideos.length})`}
          </button>
        </div>
      </header>

      {/* =====================================================================
          CENTRAL YOUTUBE SHORTS: TEMAS DO DIA + CANAIS DE REFERÊNCIA + VIRAIS
         ===================================================================== */}
      {viewMode === 'youtube_radar' ? (
        <main className="radar-container">
          {/* SEÇÃO 1: ANÁLISE AUTOMÁTICA DOS CANAIS + 3 SUGESTÕES VIA OMNIROUTE IA */}
          <section className="panel-card" ref={themesSectionRef}>
            <div className="panel-header" style={{ flexWrap: 'wrap' }}>
              <div>
                <h1 className="panel-title" style={{ fontSize: 22 }}>
                  <YoutubeLogo size={26} weight="fill" color="#EF4444" />
                  Análise dos Canais & 3 Sugestões do Dia (OmniRoute IA)
                </h1>
                <p className="panel-subtitle">
                  A IA do OmniRoute cruza automaticamente os vídeos mais virais dos seus canais cadastrados e entrega 3 pautas campeãs prontas para gravar em 2D Motion ou 3D.
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <span className="step-tag green">
                  IA OmniRoute: {radarAiModel || 'Conectando...'}
                </span>
                <span className="step-tag red">
                  {radarChannels.length} canais ativos • {radarVideos.length} virais analisados
                </span>
              </div>
            </div>

            {radarChannelAnalysis ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: 12,
                  background: 'linear-gradient(90deg, rgba(250, 204, 21, 0.09), rgba(34, 197, 94, 0.06))',
                  border: '1px solid #3F3F46',
                  borderLeft: '3px solid #FACC15',
                  borderRadius: 12,
                  padding: '12px 15px',
                  marginBottom: 16,
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ flex: 1, minWidth: 240, fontSize: 13, lineHeight: 1.5, color: '#E4E4E7' }}>
                  <strong style={{ color: '#FACC15', display: 'inline-flex', alignItems: 'center', gap: 6, marginRight: 6 }}>
                    <Sparkle size={14} weight="fill" />
                    Leitura dos Canais (OmniRoute):
                  </strong>
                  {radarChannelAnalysis}
                </div>
                {radarAnalyzedAt ? (
                  <span className="mono-val" style={{ fontSize: 11, color: '#A1A1AA', whiteSpace: 'nowrap' }}>
                    Analisado em {radarAnalyzedAt}
                  </span>
                ) : null}
              </div>
            ) : null}

            <div
              style={{
                display: 'flex',
                gap: 10,
                alignItems: 'center',
                flexWrap: 'wrap',
                marginBottom: 18,
              }}
            >
              <input
                className="studio-input"
                style={{ flex: 1, minWidth: 260, padding: '11px 14px' }}
                value={nicheHintInput}
                onChange={(e) => setNicheHintInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isGeneratingThemes) {
                    handleGenerateDailyThemes();
                  }
                }}
                placeholder="Foco opcional p/ direcionar as 3 sugestões (ex: engenharia civil, espaço, Brasil... ou deixe livre)"
              />

              <button
                type="button"
                className="btn-primary btn-lg"
                disabled={isGeneratingThemes || isLoadingRadar}
                onClick={() => handleGenerateDailyThemes()}
              >
                <Flame size={19} weight="fill" />
                {isGeneratingThemes || isLoadingRadar
                  ? 'Analisando Canais via OmniRoute...'
                  : 'Reanalisar Canais (+3 Sugestões)'}
              </button>
            </div>

            {errorMsg ? (
              <div className="status-banner error" style={{ marginBottom: 16 }}>
                <span>{errorMsg}</span>
              </div>
            ) : null}

            {(isGeneratingThemes || isLoadingRadar) && dailyThemes.length === 0 ? (
              <div className="status-banner warn">
                <span>
                  A IA do OmniRoute está estudando os vídeos mais vistos ({radarChannels.map((c) => c.handle).join(', ')}) para selecionar as 3 melhores sugestões...
                </span>
              </div>
            ) : null}

            {dailyThemes.length > 0 ? (
              <div className="themes-grid">
                {dailyThemes.slice(0, 3).map((theme, idx) => {
                  const suggestedMeta = TEMPLATE_MODELS.find(
                    (m) => m.id === theme.suggestedModelId
                  );
                  const is2D = is2DTemplateModel(theme.suggestedModelId);
                  return (
                    <article key={theme.id} className="theme-card">
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: 8,
                            flexWrap: 'wrap',
                          }}
                        >
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                            <span className="step-tag" style={{ background: '#FACC15', color: '#09090B', borderColor: '#FACC15' }}>
                              TOP #{idx + 1}
                            </span>
                            <span className="step-tag red">{theme.formatStyle}</span>
                          </div>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <span className={`step-tag ${is2D ? 'purple' : 'green'}`}>
                              {is2D ? '2D MOTION' : '3D MAQUETE'}
                            </span>
                            <span className="step-tag blue">
                              {formatSecondsFriendly(theme.recommendedSeconds)} • 9:16
                            </span>
                          </div>
                        </div>

                        <h3 className="theme-hook-title">{theme.hookTitle}</h3>
                        <p className="theme-prompt-preview">{theme.readyPrompt}</p>

                        {theme.whyItWorks ? (
                          <div
                            style={{
                              fontSize: 12,
                              lineHeight: 1.42,
                              color: '#86EFAC',
                              background: 'rgba(34, 197, 94, 0.08)',
                              border: '1px solid rgba(34, 197, 94, 0.25)',
                              borderRadius: 8,
                              padding: '7px 10px',
                            }}
                          >
                            <strong>Por que a IA escolheu:</strong> {theme.whyItWorks}
                          </div>
                        ) : null}

                        {suggestedMeta ? (
                          <div
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              fontSize: 11.5,
                              color: '#D4D4D8',
                              fontWeight: 700,
                            }}
                          >
                            {renderModelIcon(suggestedMeta.id, 15)}
                            Design base: {suggestedMeta.name} ({suggestedMeta.inspiredChannel})
                          </div>
                        ) : null}
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div className="theme-inspired-box">
                          <strong style={{ color: '#FACC15' }}>Inspirado no viral:</strong>{' '}
                          {theme.inspiredByTitle} ({theme.inspiredByChannel} •{' '}
                          {formatViewsCompact(theme.inspiredByViews)} views)
                        </div>

                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            type="button"
                            className="btn-primary"
                            style={{ flex: 1 }}
                            onClick={() => handleCreateShortFromTheme(theme, true)}
                          >
                            <MagicWand size={16} weight="bold" />
                            Usar Tema & Escolher Tempo
                          </button>
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => handleCreateShortFromTheme(theme, false)}
                          >
                            Editar Ideia
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : null}
          </section>

          {/* SEÇÃO 2: ALIMENTAR CANAIS DE REFERÊNCIA */}
          <section className="panel-card">
            <div className="panel-header" style={{ flexWrap: 'wrap' }}>
              <div>
                <h2 className="panel-title">Canais de Referência (Alimente Quando Quiser)</h2>
                <p className="panel-subtitle">
                  Cole o link de qualquer YouTube Short, link de canal ou @arroba — o sistema descobre o canal automaticamente e puxa os vídeos mais virais dele.
                </p>
              </div>
              <button
                type="button"
                className="btn-secondary"
                disabled={isLoadingRadar}
                onClick={handleRefreshVirals}
              >
                <ArrowsClockwise size={16} weight="bold" />
                {isLoadingRadar ? 'Atualizando...' : 'Atualizar Virais'}
              </button>
            </div>

            <form
              onSubmit={handleAddYoutubeChannel}
              style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}
            >
              <input
                className="studio-input"
                style={{ flex: 1, minWidth: 260, padding: '10px 14px' }}
                value={newChannelInput}
                onChange={(e) => setNewChannelInput(e.target.value)}
                placeholder="Ex: https://www.youtube.com/shorts/... ou https://www.youtube.com/@canal ou @arroba"
              />
              <button
                type="submit"
                className="btn-primary"
                disabled={isAddingChannel || !newChannelInput.trim()}
              >
                <Plus size={16} weight="bold" />
                {isAddingChannel ? 'Lendo Canal no YouTube...' : 'Adicionar Canal'}
              </button>
            </form>

            <div className="channels-strip">
              {radarChannels.map((ch) => {
                const chIs2D = ch.defaultModelId ? is2DTemplateModel(ch.defaultModelId) : false;
                return (
                  <div key={ch.id} className="channel-card" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            fontWeight: 800,
                            fontSize: 14.5,
                          }}
                        >
                          <YoutubeLogo size={17} weight="fill" color="#EF4444" />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {ch.title}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: '#A1A1AA', marginTop: 3 }}>
                          {ch.handle} • {ch.shortsCount} Shorts • Topo:{' '}
                          <strong style={{ color: '#FACC15' }}>{formatViewsCompact(ch.topViews)} views</strong>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 2 }}>
                        <a
                          href={ch.url}
                          target="_blank"
                          rel="noreferrer"
                          className="btn-ghost"
                          title="Abrir canal no YouTube"
                        >
                          <ArrowSquareOut size={16} />
                        </a>
                        <button
                          type="button"
                          className="btn-ghost"
                          title="Remover canal"
                          onClick={() => handleRemoveYoutubeChannel(ch)}
                        >
                          <Trash size={15} />
                        </button>
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 8,
                        paddingTop: 8,
                        borderTop: '1px solid #242731',
                      }}
                    >
                      <span className={`step-tag ${chIs2D ? 'purple' : 'blue'}`}>
                        {ch.designStyleLabel || (chIs2D ? 'Design 2D Motion' : 'Design 3D Maquete')}
                      </span>
                      <span style={{ fontSize: 11, color: '#A1A1AA' }}>Base IA OmniRoute</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* SEÇÃO 3: RANKING DOS SHORTS MAIS VIRAIS EXTRAÍDOS */}
          <section className="panel-card">
            <div className="panel-header" style={{ flexWrap: 'wrap' }}>
              <div>
                <h2 className="panel-title">
                  <Flame size={20} weight="fill" color="#FACC15" />
                  Shorts Mais Virais dos Seus Canais
                </h2>
                <p className="panel-subtitle">
                  Veja o que mais explodiu em visualizações {radarLastUpdated ? `(atualizado em ${radarLastUpdated})` : ''} ou clique em um viral para pedir 3 sugestões à IA OmniRoute inspiradas nele.
                </p>
              </div>

              <div className="scene-jump-strip">
                <button
                  type="button"
                  className="jump-chip"
                  style={
                    viralChannelFilter === 'ALL'
                      ? { borderColor: '#FACC15', color: '#F4F4F5' }
                      : undefined
                  }
                  onClick={() => setViralChannelFilter('ALL')}
                >
                  Todos ({radarVideos.length})
                </button>
                {radarChannels.map((ch) => (
                  <button
                    key={ch.id}
                    type="button"
                    className="jump-chip"
                    style={
                      viralChannelFilter.toLowerCase() === ch.handle.toLowerCase()
                        ? { borderColor: '#FACC15', color: '#F4F4F5' }
                        : undefined
                    }
                    onClick={() => setViralChannelFilter(ch.handle)}
                  >
                    {ch.handle}
                  </button>
                ))}
              </div>
            </div>

            <div className="viral-grid">
              {filteredViralVideos.slice(0, 18).map((vid) => (
                <article key={vid.id} className="viral-card">
                  <div className="viral-thumb-wrap">
                    <img src={vid.thumbnail} alt={vid.title} loading="lazy" />
                    <span className="viral-views-badge">
                      {formatViewsCompact(vid.viewCount)} views
                    </span>
                    <span className="viral-channel-badge">{vid.channelHandle}</span>
                  </div>
                  <div className="viral-body">
                    <strong style={{ fontSize: 13.5, lineHeight: 1.4 }}>{vid.title}</strong>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ flex: 1, fontSize: 12 }}
                        disabled={isGeneratingThemes}
                        onClick={() => handleGenerateDailyThemes(vid.id)}
                      >
                        <Sparkle size={14} weight="fill" color="#FACC15" />
                        3 Sugestões Deste
                      </button>
                      <a
                        href={vid.url}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-ghost"
                        title="Assistir Short original no YouTube"
                      >
                        <ArrowSquareOut size={16} />
                      </a>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </main>
      ) : null}

      {/* ABA GALERIA MP4 */}
      {viewMode === 'gallery' ? (
        <main className="gallery-container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Galeria de Vídeos Prontos</h1>
              <p className="panel-subtitle">
                Assista ou baixe seus vídeos renderizados em MP4 Full HD.
              </p>
            </div>
            <button type="button" className="btn-secondary" onClick={fetchGallery}>
              <ArrowsClockwise size={16} weight="bold" />
              Atualizar
            </button>
          </div>

          <div className="gallery-grid">
            {galleryVideos.map((vid) => (
              <article key={vid.filename} className="gallery-card">
                <div className="gallery-video-wrap">
                  <video src={vid.videoUrl} controls preload="metadata" />
                </div>
                <div className="gallery-body">
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <strong style={{ fontSize: 14.5 }}>{vid.title}</strong>
                    <span className="step-tag">{vid.aspectRatio}</span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 12,
                      color: '#A1A1AA',
                    }}
                  >
                    <span>{vid.modelLabel}</span>
                    <span>
                      {vid.sizeMb} MB • {vid.updatedAt}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <a
                      href={vid.videoUrl}
                      download={vid.filename}
                      className="btn-primary"
                      style={{ textDecoration: 'none', flex: 1 }}
                    >
                      <DownloadSimple size={15} weight="bold" />
                      Baixar MP4
                    </a>
                    {vid.project ? (
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => handleOpenGalleryProject(vid)}
                      >
                        <SlidersHorizontal size={15} weight="bold" />
                        Reabrir
                      </button>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </main>
      ) : null}

      {/* =====================================================================
          ETAPA 1: TELA INICIAL LIMPA — PROMPT + ATALHO TEMAS DO DIA SHORTS
         ===================================================================== */}
      {viewMode === 'wizard' && step === 1 ? (
        <main className="wizard-prompt-hero">
          <div className="hero-box">
            <span className="hero-kicker">
              <Sparkle size={13} weight="fill" />
              ETAPA 1 DE 5 • IDEIA DO VÍDEO
            </span>
            <h1 className="hero-title">Qual vídeo explicativo vamos criar?</h1>
            <p className="hero-subtitle">
              Digite sua ideia livremente abaixo — a IA do OmniRoute cria o roteiro e já gera automaticamente 3 modelos visuais diferentes na etapa final para você comparar e alimentar sua Base de Conhecimento.
            </p>

            <textarea
              className="prompt-big-textarea"
              autoFocus
              value={promptInput}
              onChange={(e) => setPromptInput(e.target.value)}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && promptInput.trim()) {
                  handlePromptContinue();
                }
              }}
              placeholder="Ex: Como uma ponte estaiada sustenta milhares de toneladas sem cair? Explique cada parte..."
            />

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: 18,
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <span style={{ fontSize: 12.5, color: '#71717A' }}>
                Na próxima etapa você escolhe: YouTube Shorts, Reels ou YouTube 16:9.
              </span>

              <button
                type="button"
                className="btn-primary btn-lg"
                disabled={!promptInput.trim()}
                onClick={handlePromptContinue}
              >
                Escolher Formato & Tempo
                <ArrowRight size={18} weight="bold" />
              </button>
            </div>
          </div>

          {/* Card de Atalho Rápido p/ Radar YouTube Shorts */}
          <div className="yt-shortcut-banner">
            <div style={{ flex: 1, minWidth: 240 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 15 }}>
                <YoutubeLogo size={20} weight="fill" color="#EF4444" />
                Sem ideia agora? Gere os Temas do Dia p/ YouTube Shorts!
              </div>
              <div style={{ fontSize: 12.5, color: '#A1A1AA', marginTop: 4 }}>
                Baseado nos vídeos mais virais de{' '}
                <strong style={{ color: '#F4F4F5' }}>
                  {radarChannels.length > 0
                    ? radarChannels.map((c) => c.handle).join(', ')
                    : '@DesmontandoOMundo, @engenhocaexplicadas, @curiosicasabr, @FronteiraDoc, @HistoriandoCuriosidades'}
                </strong>{' '}
                (adicione novos canais quando quiser).
              </div>
            </div>

            <button type="button" className="btn-secondary" onClick={openRadarAndEnsureThemes}>
              <Flame size={16} weight="fill" color="#FACC15" />
              Abrir Temas do Dia & Canais
            </button>
          </div>
        </main>
      ) : null}

      {/* =====================================================================
          ETAPA 2: PLATAFORMA (YOUTUBE SHORTS / REELS / YOUTUBE 16:9) & TEMPO
         ===================================================================== */}
      {viewMode === 'wizard' && step === 2 ? (
        <main className="wizard-center-wrap">
          <div className="prompt-summary-bar">
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <strong style={{ color: '#F4F4F5' }}>Tema:</strong> {promptInput}
            </span>
            <button type="button" className="btn-ghost" onClick={() => setStep(1)}>
              Editar ideia
            </button>
          </div>

          <section className="panel-card">
            <div className="panel-header">
              <div>
                <h2 className="panel-title">Onde o vídeo será publicado e qual o tempo ideal?</h2>
                <p className="panel-subtitle">
                  O modo YouTube Shorts já gera gancho forte no 1º segundo + título, descrição e hashtags prontos para postar.
                </p>
              </div>
              <span className="step-tag">ETAPA 2 DE 5</span>
            </div>

            <div className="platform-columns">
              {/* Coluna 1: YouTube Shorts (9:16 até 3 min) */}
              <div className="platform-group highlight-yt">
                <div className="platform-group-header">
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 800 }}>
                    <YoutubeLogo size={20} weight="fill" color="#EF4444" />
                    YouTube Shorts
                  </span>
                  <span className="step-tag red">9:16 + Kit #shorts</span>
                </div>

                {DURATION_PRESETS.filter((p) => p.platform === 'youtube_shorts').map((preset) => {
                  const sel =
                    selectedPresetId === preset.id &&
                    platform === 'youtube_shorts' &&
                    targetSeconds === preset.seconds;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      className={`duration-card ${sel ? 'selected' : ''}`}
                      onClick={() => handleSelectDurationPreset(preset.id)}
                    >
                      <div>
                        <div className="dur-title">{preset.label}</div>
                        <div className="dur-sub">{preset.subtitle}</div>
                      </div>
                      <span className="step-tag">{preset.recommendedScenes}</span>
                    </button>
                  );
                })}
              </div>

              {/* Coluna 2: Instagram Reels / TikTok */}
              <div className="platform-group">
                <div className="platform-group-header">
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 800 }}>
                    <DeviceMobile size={19} weight="duotone" color="#FACC15" />
                    Reels / TikTok
                  </span>
                  <span className="step-tag blue">Vertical 9:16</span>
                </div>

                {DURATION_PRESETS.filter((p) => p.platform === 'reels').map((preset) => {
                  const sel =
                    selectedPresetId === preset.id &&
                    platform === 'reels' &&
                    targetSeconds === preset.seconds;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      className={`duration-card ${sel ? 'selected' : ''}`}
                      onClick={() => handleSelectDurationPreset(preset.id)}
                    >
                      <div>
                        <div className="dur-title">{preset.label}</div>
                        <div className="dur-sub">{preset.subtitle}</div>
                      </div>
                      <span className="step-tag">{preset.recommendedScenes}</span>
                    </button>
                  );
                })}
              </div>

              {/* Coluna 3: YouTube Longo / TV Horizontal */}
              <div className="platform-group">
                <div className="platform-group-header">
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 800 }}>
                    <Monitor size={19} weight="duotone" color="#38BDF8" />
                    YouTube / Reunião / TV
                  </span>
                  <span className="step-tag blue">Horizontal 16:9</span>
                </div>

                {DURATION_PRESETS.filter((p) => p.platform === 'youtube').map((preset) => {
                  const sel =
                    selectedPresetId === preset.id &&
                    platform === 'youtube' &&
                    targetSeconds === preset.seconds;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      className={`duration-card ${sel ? 'selected' : ''}`}
                      onClick={() => handleSelectDurationPreset(preset.id)}
                    >
                      <div>
                        <div className="dur-title">{preset.label}</div>
                        <div className="dur-sub">{preset.subtitle}</div>
                      </div>
                      <span className="step-tag">{preset.recommendedScenes}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Aviso Automático: 3 Modelos selecionados pelo OmniRoute + Base de Conhecimento */}
            <div
              style={{
                marginTop: 18,
                padding: '13px 16px',
                borderRadius: 12,
                background:
                  'linear-gradient(90deg, rgba(250, 204, 21, 0.08), rgba(34, 197, 94, 0.07))',
                border: '1px solid #3F3F46',
                borderLeft: '3px solid #FACC15',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <div style={{ flex: 1, minWidth: 250 }}>
                <div
                  style={{
                    fontSize: 13.5,
                    fontWeight: 800,
                    color: '#F4F4F5',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 7,
                  }}
                >
                  <Sparkle size={16} weight="fill" color="#FACC15" />
                  3 Modelos Visuais Escolhidos e Gerados Automaticamente pelo OmniRoute
                </div>
                <div style={{ fontSize: 12.5, color: '#D4D4D8', marginTop: 3, lineHeight: 1.45 }}>
                  Sem precisar escolher estilo agora: a IA analisa seu tema e gera 3 modelos diferentes (2D Motion, Documentário e/ou 3D) na última etapa para você ver lado a lado, escolher o melhor e alimentar a Base de Conhecimento.
                </div>
              </div>
              <span className="step-tag green">
                Base de Conhecimento: {learnedPrefsCount}{' '}
                {learnedPrefsCount === 1 ? 'escolha aprendida' : 'escolhas aprendidas'}
              </span>
            </div>

            {/* Ajuste personalizado opcional */}
            <div
              className="form-grid-2"
              style={{
                marginTop: 18,
                paddingTop: 16,
                borderTop: '1px solid #242731',
                alignItems: 'end',
              }}
            >
              <div>
                <label className="field-label">
                  Ou digite um tempo personalizado em segundos (15s a 600s):
                </label>
                <input
                  type="number"
                  min={15}
                  max={600}
                  step={5}
                  className="studio-input"
                  value={targetSeconds}
                  onChange={(e) => {
                    setSelectedPresetId('custom');
                    setTargetSeconds(Math.max(15, Math.min(600, Number(e.target.value) || 60)));
                  }}
                />
              </div>

              <div>
                <label className="field-label">Formato da tela selecionado:</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={
                      aspectRatio === '9:16'
                        ? { borderColor: '#FACC15', flex: 1 }
                        : { flex: 1 }
                    }
                    onClick={() => {
                      setAspectRatio('9:16');
                      if (platform === 'youtube') setPlatform('youtube_shorts');
                    }}
                  >
                    <DeviceMobile size={16} weight="bold" />
                    Vertical 9:16 (1080×1920)
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={
                      aspectRatio === '16:9'
                        ? { borderColor: '#FACC15', flex: 1 }
                        : { flex: 1 }
                    }
                    onClick={() => {
                      setAspectRatio('16:9');
                      setPlatform('youtube');
                    }}
                  >
                    <Monitor size={16} weight="bold" />
                    Horizontal 16:9 (1920×1080)
                  </button>
                </div>
              </div>
            </div>

            {errorMsg ? (
              <div className="status-banner error" style={{ marginTop: 14 }}>
                <span>{errorMsg}</span>
              </div>
            ) : null}

            <div className="wizard-footer-nav">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  cancelPendingScriptGeneration();
                  setStep(1);
                }}
              >
                <ArrowLeft size={16} weight="bold" />
                Voltar à Ideia
              </button>

              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {isGeneratingScript ? (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={cancelPendingScriptGeneration}
                  >
                    Cancelar
                  </button>
                ) : null}

                <button
                  type="button"
                  className="btn-primary btn-lg"
                  disabled={isGeneratingScript}
                  onClick={handleGenerateScript}
                >
                  <MagicWand size={18} weight="bold" />
                  {isGeneratingScript
                    ? `Criando Roteiro de ${formatSecondsFriendly(targetSeconds)} com IA...`
                    : `Gerar Roteiro ${platform === 'youtube_shorts' ? 'Short ' : ''}p/ ${formatSecondsFriendly(targetSeconds)}`}
                </button>
              </div>
            </div>
          </section>
        </main>
      ) : null}

      {/* =====================================================================
          ETAPA 3: ROTEIRO EM TEXTO CORRIDO LEIGO (ESQUERDA) + PRÉVIA VISUAL
          INSTANTÂNEA COM LEGENDAS & LEITURA RÁPIDA OPCIONAL (DIREITA)
         ===================================================================== */}
      {viewMode === 'wizard' && step === 3 && project ? (
        <main className="step3-split-workspace">
          {/* COLUNA ESQUERDA: LEITURA COMPLETA FLUIDA + AJUSTE 100% POR PROMPT */}
          <section className="panel-card">
            <div className="panel-header" style={{ flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 260 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <h2 className="panel-title">História Completa do Vídeo</h2>
                  <span className="step-tag green">IA: {project.aiModelUsed || 'OmniRoute'}</span>
                  <span className="step-tag blue">
                    Leitura: ~{estimatedSecondsFromWords}s • Meta:{' '}
                    {formatSecondsFriendly(targetSeconds)}
                  </span>
                </div>
                <p className="panel-subtitle">
                  Leia o roteiro inteiro de uma só vez abaixo (clique em qualquer trecho para ver na Prévia ao lado). Se quiser mudar qualquer parte, basta pedir em português no campo da IA!
                </p>
              </div>
              <span className="step-tag">ETAPA 3 DE 5</span>
            </div>

            {/* Título limpo + botão discreto p/ regerar ou editar palavra manual */}
            <div
              style={{
                display: 'flex',
                gap: 10,
                alignItems: 'end',
                marginBottom: 14,
                flexWrap: 'wrap',
              }}
            >
              <div style={{ flex: 1, minWidth: 240 }}>
                <label className="field-label">Título Principal do Vídeo</label>
                <input
                  className="studio-input"
                  value={project.name}
                  onChange={(e) => setProject((p) => (p ? { ...p, name: e.target.value } : p))}
                />
              </div>

              <button
                type="button"
                className="btn-ghost"
                onClick={() => setIsManualTextMode((v) => !v)}
              >
                <SlidersHorizontal size={15} weight="bold" />
                {isManualTextMode ? 'Concluir Edição Manual' : 'Editar Palavras Manualmente'}
              </button>

              <button
                type="button"
                className="btn-secondary"
                disabled={isGeneratingScript || isRefiningScript}
                onClick={handleGenerateScript}
              >
                <ArrowsClockwise size={15} weight="bold" />
                Nova Versão do Zero
              </button>
            </div>

            {refineSummaryMsg ? (
              <div className="status-banner success" style={{ marginBottom: 14 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: '#86EFAC', fontWeight: 700 }}>
                  <Sparkle size={16} weight="fill" color="#4ADE80" />
                  {refineSummaryMsg}
                </span>
              </div>
            ) : null}

            {errorMsg ? (
              <div className="status-banner error" style={{ marginBottom: 14 }}>
                <span>{errorMsg}</span>
              </div>
            ) : null}

            {/* FOLHA ÚNICA DE LEITURA FLUIDA (ESTILO ARTIGO / TELEPROMPTER) */}
            <div className="script-story-sheet">
              {project.scenes.map((sc, idx) => {
                const isCurrent = activeSceneIdx === idx;
                const isFirst = idx === 0;
                const isLast = idx === project.scenes.length - 1;
                const momentLabel = isFirst
                  ? 'Início • Gancho de Atenção'
                  : isLast
                    ? 'Conclusão & Fechamento'
                    : `Parte ${idx + 1}`;

                return (
                  <div
                    key={sc.id}
                    className={`story-paragraph-row ${isCurrent ? 'active-reading' : ''}`}
                    onClick={() => seekStep3PreviewToScene(idx)}
                  >
                    <div className="story-time-meta">
                      <span>
                        {formatTimestampMMSS(sc.fromFrame)} • {momentLabel}
                      </span>
                      {isManualTextMode ? (
                        <div
                          style={{ display: 'flex', gap: 4 }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            className="btn-ghost"
                            style={{ padding: '2px 6px' }}
                            disabled={idx === 0}
                            onClick={() => moveScene(idx, -1)}
                          >
                            <ArrowUp size={13} weight="bold" />
                          </button>
                          <button
                            type="button"
                            className="btn-ghost"
                            style={{ padding: '2px 6px' }}
                            disabled={isLast}
                            onClick={() => moveScene(idx, 1)}
                          >
                            <ArrowDown size={13} weight="bold" />
                          </button>
                          <button
                            type="button"
                            className="btn-ghost"
                            style={{ padding: '2px 6px' }}
                            disabled={project.scenes.length <= 1}
                            onClick={() => removeScene(idx)}
                          >
                            <Trash size={13} />
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: 10.5, opacity: isCurrent ? 1 : 0.7 }}>
                          {isCurrent ? '▶ Mostrando na Prévia' : 'Clique p/ ver na Prévia'}
                        </span>
                      )}
                    </div>

                    {isManualTextMode ? (
                      <textarea
                        className="studio-textarea"
                        style={{ marginTop: 6 }}
                        rows={2}
                        value={sc.narration}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => updateScene(idx, { narration: e.target.value }, true)}
                      />
                    ) : (
                      <p className="story-spoken-text">{sc.narration}</p>
                    )}
                  </div>
                );
              })}

              {isManualTextMode ? (
                <div>
                  <button type="button" className="btn-secondary" onClick={addScene}>
                    <Plus size={14} weight="bold" />
                    Adicionar Parágrafo
                  </button>
                </div>
              ) : null}
            </div>

            {/* CAIXA DE AJUSTE 100% VIA PROMPT (OMNIROUTE) */}
            <div className="ai-prompt-refine-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <strong style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 14, color: '#F4F4F5' }}>
                  <MagicWand size={17} weight="fill" color="#FACC15" />
                  Quer mudar alguma coisa? Peça por prompt para a IA:
                </strong>
                <span style={{ fontSize: 11.5, color: '#A1A1AA' }}>
                  A IA reescreve a fala e atualiza os textos visuais sozinha
                </span>
              </div>

              <div className="quick-prompt-chips">
                <button
                  type="button"
                  className="prompt-chip-btn"
                  disabled={isRefiningScript || isResizingScript}
                  onClick={() =>
                    handleRefineScriptByPrompt(
                      'Reescreva com linguagem bem leiga, simples e fácil de entender por qualquer pessoa, tirando termos técnicos difíceis.'
                    )
                  }
                >
                  ✨ Deixar mais leigo e fácil
                </button>
                <button
                  type="button"
                  className="prompt-chip-btn"
                  disabled={isRefiningScript || isResizingScript}
                  onClick={() =>
                    handleRefineScriptByPrompt(
                      'Explique usando uma comparação ou exemplo prático do dia a dia para ficar super visual e intuitivo.'
                    )
                  }
                >
                  💡 Usar exemplo do dia a dia
                </button>
                <button
                  type="button"
                  className="prompt-chip-btn"
                  disabled={isRefiningScript || isResizingScript}
                  onClick={() =>
                    handleRefineScriptByPrompt(
                      'Deixe o início (gancho do primeiro parágrafo) muito mais curioso, surpreendente e direto ao ponto.'
                    )
                  }
                >
                  🎯 Melhorar gancho inicial
                </button>
                <button
                  type="button"
                  className="prompt-chip-btn"
                  disabled={isRefiningScript || isResizingScript}
                  onClick={() => handleResizeScript('shorter')}
                >
                  ✂️ Enxugar texto (-20%)
                </button>
                <button
                  type="button"
                  className="prompt-chip-btn"
                  disabled={isRefiningScript || isResizingScript}
                  onClick={() => handleResizeScript('longer')}
                >
                  🔍 Explicar com mais calma (+25%)
                </button>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input
                  className="studio-input"
                  style={{ flex: 1, minWidth: 240, padding: '10px 13px' }}
                  value={scriptPromptEdit}
                  disabled={isRefiningScript}
                  onChange={(e) => setScriptPromptEdit(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && scriptPromptEdit.trim() && !isRefiningScript) {
                      e.preventDefault();
                      handleRefineScriptByPrompt();
                    }
                  }}
                  placeholder="Ex: Troque o final por uma curiosidade, fale como uma conversa simples, destaque o peso em carros..."
                />
                <button
                  type="button"
                  className="btn-primary"
                  disabled={isRefiningScript || !scriptPromptEdit.trim()}
                  onClick={() => handleRefineScriptByPrompt()}
                >
                  <Sparkle size={16} weight="fill" />
                  {isRefiningScript ? 'Ajustando Roteiro c/ IA...' : 'Aplicar com IA'}
                </button>
              </div>
            </div>

            <div className="wizard-footer-nav">
              <button type="button" className="btn-secondary" onClick={() => setStep(2)}>
                <ArrowLeft size={16} weight="bold" />
                Voltar (Formato & Tempo)
              </button>

              <button
                type="button"
                className="btn-primary btn-lg"
                disabled={isRefiningScript}
                onClick={() => goToStep(4)}
              >
                Gostei do Roteiro • Escolher Voz
                <ArrowRight size={18} weight="bold" />
              </button>
            </div>
          </section>

          {/* COLUNA DIREITA: PRÉVIA VISUAL INSTANTÂNEA COM LEGENDAS + OUVIR LEITURA RÁPIDA OPCIONAL */}
          <aside className="preview-column">
            {(() => {
              const safeIdx = Math.min(
                Math.max(0, step3PreviewModelIdx),
                Math.max(0, candidateBundles.length - 1)
              );
              const activeBundle = candidateBundles[safeIdx];
              const previewProj = activeBundle ? activeBundle.variantProject : project;

              return (
                <div className="player-stage-card">
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 8,
                      flexWrap: 'wrap',
                    }}
                  >
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 800,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 7,
                      }}
                    >
                      <CheckCircle size={18} weight="fill" color="#22C55E" />
                      Prévia Visual do Roteiro
                    </span>
                    <span className="mono-val">
                      {project.audioUrl ? 'Com Rascunho de Voz' : 'Visual + Legendas (0s)'}
                    </span>
                  </div>

                  {/* Troca rápida opcional caso queira espiar os 3 modelos separados pela IA */}
                  {candidateBundles.length > 1 ? (
                    <div className="scene-jump-strip">
                      {candidateBundles.map((b, bIdx) => (
                        <button
                          key={b.candidate.modelId}
                          type="button"
                          className="jump-chip"
                          style={
                            safeIdx === bIdx
                              ? { borderColor: '#FACC15', color: '#F4F4F5', flex: 1 }
                              : { flex: 1 }
                          }
                          onClick={() => setStep3PreviewModelIdx(bIdx)}
                        >
                          #{bIdx + 1} {b.meta.category === '2d' ? '2D' : '3D'} •{' '}
                          {b.meta.name.split(' ')[0]}
                        </button>
                      ))}
                    </div>
                  ) : null}

                  <div
                    className={`player-viewport ${previewProj.aspectRatio === '16:9' ? 'ratio-wide' : 'ratio-vertical'
                      }`}
                  >
                    <Player
                      ref={step3PlayerRef}
                      component={DynamicStudioVideo}
                      inputProps={{ project: previewProj }}
                      durationInFrames={Math.max(60, previewProj.totalFrames)}
                      fps={30}
                      compositionWidth={canvasSize.width}
                      compositionHeight={canvasSize.height}
                      style={{ width: '100%', height: '100%' }}
                      autoPlay
                      loop
                      controls
                      acknowledgeRemotionLicense
                    />
                  </div>

                  {/* Botão Opcional p/ Ouvir Leitura Rápida ali mesmo se quiser testar o som */}
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ width: '100%', justifyContent: 'center' }}
                    disabled={isQuickListeningStep3 || isGeneratingVoice || isRefiningScript}
                    onClick={handleQuickListenStep3}
                  >
                    <SpeakerHigh size={16} weight="fill" color="#FACC15" />
                    {isQuickListeningStep3 || isGeneratingVoice
                      ? 'Gerando leitura rápida (~3s)...'
                      : project.audioUrl
                        ? 'Ouvir Leitura do Início (Áudio Pronto)'
                        : 'Ouvir Leitura Rápida (Opcional)'}
                  </button>

                  <div
                    style={{
                      fontSize: 11.5,
                      color: '#A1A1AA',
                      lineHeight: 1.4,
                      textAlign: 'center',
                    }}
                  >
                    A escolha oficial da voz (masculina/feminina e ritmo) continua na próxima etapa (Etapa 4), e a comparação dos 3 modelos completos na Etapa 5.
                  </div>
                </div>
              );
            })()}
          </aside>
        </main>
      ) : null}

      {/* =====================================================================
          ETAPA 4: ESCOLHER VOZ & GERAR ÁUDIO CALIBRADO NO TEMPO
         ===================================================================== */}
      {viewMode === 'wizard' && step === 4 && project ? (
        <main className="wizard-center-wrap">
          <section className="panel-card">
            <div className="panel-header">
              <div>
                <h2 className="panel-title">
                  <Waveform size={21} weight="bold" color="#FACC15" />
                  Escolha a Voz Neural
                </h2>
                <p className="panel-subtitle">
                  Ouça uma amostra e clique em Gerar Voz para sintetizar o áudio calibrado para{' '}
                  <strong>{formatSecondsFriendly(targetSeconds)}</strong> ({aspectRatio}).
                </p>
              </div>
              <span className="step-tag">ETAPA 4 DE 5</span>
            </div>

            <div className="voice-grid">
              {VOICE_CATALOG.map((voice) => {
                const isSel = project.voiceId === voice.id;
                const isPlaying = previewingVoiceId === voice.id;
                return (
                  <div
                    key={voice.id}
                    className={`voice-row ${isSel ? 'selected' : ''}`}
                    onClick={() => {
                      setProject((p) =>
                        p
                          ? {
                            ...p,
                            voiceId: voice.id,
                            voiceRatePct: voice.defaultRatePct,
                            audioUrl: null,
                          }
                          : p
                      );
                      setCalibration(null);
                    }}
                  >
                    <div>
                      <div className="voice-title">
                        <span>{voice.label}</span>
                        <span className="gender-tag">
                          {voice.gender === 'F' ? 'FEMININA' : 'MASCULINA'}
                        </span>
                      </div>
                      <div className="voice-sub">{voice.subtitle}</div>
                    </div>

                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePreviewVoice(voice.id);
                      }}
                    >
                      <SpeakerHigh size={15} weight="fill" />
                      {isPlaying ? 'Ouvindo...' : 'Ouvir Prévia'}
                    </button>
                  </div>
                );
              })}
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
                marginTop: 18,
                paddingTop: 16,
                borderTop: '1px solid #242731',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
                <label className="toggle-check">
                  <input
                    type="checkbox"
                    checked={project.sfxEnabled}
                    onChange={(e) => {
                      setProject((p) => (p ? { ...p, sfxEnabled: e.target.checked, audioUrl: null } : p));
                      setCalibration(null);
                    }}
                  />
                  Efeitos Sonoros Suaves (Transições / Pop)
                </label>

                <label className="toggle-check">
                  <input
                    type="checkbox"
                    checked={project.subtitlesEnabled}
                    onChange={(e) =>
                      setProject((p) => (p ? { ...p, subtitlesEnabled: e.target.checked } : p))
                    }
                  />
                  Legenda Dinâmica Sincronizada
                </label>
              </div>

              <button
                type="button"
                className="btn-primary"
                disabled={isGeneratingVoice}
                onClick={handleGenerateVoiceStep4}
              >
                <SpeakerHigh size={17} weight="bold" />
                {isGeneratingVoice
                  ? 'Gerando e Calibrando Voz...'
                  : project.audioUrl
                    ? 'Regerar Voz'
                    : `Gerar Voz (${formatSecondsFriendly(targetSeconds)})`}
              </button>
            </div>

            {project.audioUrl ? (
              <div className="generated-audio-box">
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 8,
                  }}
                >
                  <strong style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: '#4ADE80' }}>
                    <CheckCircle size={18} weight="fill" />
                    Voz Gerada e Sincronizada!
                  </strong>
                  <span className="mono-val">
                    Duração Final: {(project.totalFrames / 30).toFixed(1)}s • Meta:{' '}
                    {formatSecondsFriendly(targetSeconds)} • Ritmo:{' '}
                    {project.voiceRatePct >= 0 ? `+${project.voiceRatePct}%` : `${project.voiceRatePct}%`}
                  </span>
                </div>

                {calibration?.calibrationNote ? (
                  <span style={{ fontSize: 12.5, color: '#D4D4D8' }}>{calibration.calibrationNote}</span>
                ) : null}

                <audio controls src={project.audioUrl} style={{ width: '100%', height: 40 }} />

                {calibration?.needsResize ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                      paddingTop: 6,
                      flexWrap: 'wrap',
                    }}
                  >
                    <span style={{ fontSize: 12.5, color: '#FACC15' }}>
                      {calibration.needsResize === 'shorter'
                        ? `O texto ficou um pouco acima de ${targetSeconds}s mesmo acelerando naturalmente.`
                        : `O texto ficou mais curto que os ${targetSeconds}s escolhidos.`}
                    </span>
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={isResizingScript || isGeneratingVoice}
                      onClick={() => handleResizeScript(calibration.needsResize!, true)}
                    >
                      <MagicWand size={15} weight="bold" />
                      {isResizingScript
                        ? 'Reajustando texto e voz...'
                        : `Ajustar Texto p/ ${targetSeconds}s e Regerar Voz`}
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}

            {errorMsg ? (
              <div className="status-banner error" style={{ marginTop: 14 }}>
                <span>{errorMsg}</span>
              </div>
            ) : null}

            <div className="wizard-footer-nav">
              <button type="button" className="btn-secondary" onClick={() => setStep(3)}>
                <ArrowLeft size={16} weight="bold" />
                Voltar ao Roteiro
              </button>

              <button
                type="button"
                className="btn-primary btn-lg"
                disabled={isGeneratingVoice}
                onClick={handleAdvanceToStep5}
              >
                {project.audioUrl
                  ? 'Gerar & Comparar os 3 Modelos IA'
                  : 'Gerar Voz & Ver os 3 Modelos IA'}
                <ArrowRight size={18} weight="bold" />
              </button>
            </div>
          </section>
        </main>
      ) : null}

      {/* =====================================================================
          ETAPA 5: ARENA DE COMPARAÇÃO DOS 3 MODELOS GERADOS PELA IA OMNIROUTE
          + ESCOLHA DO CAMPEÃO (BASE DE CONHECIMENTO) + EXPORTAÇÃO MP4
         ===================================================================== */}
      {viewMode === 'wizard' && step === 5 && project ? (
        <main className="step5-arena-wrap">
          {/* Barra Superior de Controle Sincronizado dos 3 Modelos + Base de Conhecimento */}
          <section className="panel-card">
            <div className="panel-header" style={{ flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 280 }}>
                <h2 className="panel-title">
                  <Sparkle size={22} weight="fill" color="#FACC15" />
                  3 Modelos Gerados pelo OmniRoute — Compare & Escolha a Melhor Opção
                </h2>
                <p className="panel-subtitle">
                  Os 3 modelos abaixo já estão montados com o seu roteiro e a sua voz sincronizada. Assista, analise e clique em <strong>Escolher Esta Opção</strong> na que ficar melhor para ensinar a Base de Conhecimento!
                </p>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <span className="step-tag green">
                  IA: {project.aiModelUsed || 'OmniRoute'}
                </span>
                <span className="step-tag blue">
                  Base de Conhecimento: {learnedPrefsCount}{' '}
                  {learnedPrefsCount === 1 ? 'escolha salva' : 'escolhas salvas'}
                </span>
                <span className="step-tag">
                  {canvasSize.width}×{canvasSize.height} • {(project.totalFrames / 30).toFixed(1)}s
                </span>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                flexWrap: 'wrap',
                paddingTop: 4,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleTogglePlayAll3}
                >
                  {isSyncPlayingAll ? (
                    <>
                      <Pause size={16} weight="fill" />
                      Pausar os 3 Modelos
                    </>
                  ) : (
                    <>
                      <Play size={16} weight="fill" />
                      Reproduzir os 3 Sincronizados
                    </>
                  )}
                </button>

                <div className="scene-jump-strip">
                  {project.scenes.map((sc, i) => (
                    <button
                      key={sc.id}
                      type="button"
                      className="jump-chip"
                      style={
                        activeSceneIdx === i
                          ? { borderColor: '#FACC15', color: '#F4F4F5' }
                          : undefined
                      }
                      onClick={() => seekToScene(i)}
                    >
                      Cena {i + 1}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" className="btn-secondary" onClick={() => setStep(4)}>
                  <ArrowLeft size={15} weight="bold" />
                  Trocar Voz / Tempo
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setShowAdvanced3d((s) => !s)}
                >
                  <SlidersHorizontal size={15} weight="bold" />
                  {showAdvanced3d ? 'Ocultar Ajustes Finos' : 'Ajustes Finos de Textos / Cores'}
                </button>
              </div>
            </div>

            {choiceFeedbackMsg ? (
              <div className="status-banner success" style={{ marginTop: 14 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 700, color: '#86EFAC' }}>
                  <Trophy size={18} weight="fill" color="#4ADE80" />
                  {choiceFeedbackMsg}
                </span>
              </div>
            ) : null}

            {errorMsg ? (
              <div className="status-banner error" style={{ marginTop: 14 }}>
                <span>{errorMsg}</span>
              </div>
            ) : null}
          </section>

          {/* Banner de Progresso / Download MP4 (quando exportando qualquer uma das 3 opções) */}
          {renderJob ? (
            <div
              className={`status-banner ${renderJob.status === 'done'
                ? 'success'
                : renderJob.status === 'error'
                  ? 'error'
                  : 'warn'
                }`}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                <span>{renderJob.phase}</span>
                <span className="mono-val">{renderJob.progressPct}%</span>
              </div>

              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{
                    width: `${renderJob.progressPct}%`,
                    background: renderJob.status === 'done' ? '#22C55E' : '#FACC15',
                  }}
                />
              </div>

              {renderJob.status === 'done' && renderJob.outputUrl ? (
                <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                  <a
                    href={renderJob.outputUrl}
                    download={renderJob.filename || 'video.mp4'}
                    className="btn-primary"
                    style={{ textDecoration: 'none' }}
                  >
                    <DownloadSimple size={16} weight="bold" />
                    Baixar MP4 ({renderJob.sizeMb} MB)
                  </a>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      fetchGallery();
                      setViewMode('gallery');
                    }}
                  >
                    <FilmStrip size={16} weight="bold" />
                    Ver na Galeria
                  </button>
                </div>
              ) : null}

              {renderJob.status === 'error' && renderJob.error ? (
                <pre
                  style={{
                    margin: 0,
                    fontSize: 11,
                    color: '#FCA5A5',
                    whiteSpace: 'pre-wrap',
                    maxHeight: 140,
                    overflow: 'auto',
                  }}
                >
                  {renderJob.error}
                </pre>
              ) : null}
            </div>
          ) : null}

          {/* ARENA LADO A LADO COM OS 3 MODELOS DIFERENTES GERADOS PELA IA */}
          <div className="candidates-arena-grid">
            {candidateBundles.map(({ candidate, variantProject, meta }, idx) => {
              const isWinner = project.knowledgeSavedModelId === candidate.modelId;
              const is2D = meta.category === '2d';
              const isSavingThis = savingChoiceModelId === candidate.modelId;

              return (
                <article
                  key={candidate.modelId}
                  className={`candidate-stage-card ${isWinner ? 'winner' : ''}`}
                >
                  {/* Topo do Card: Ranking OmniRoute + Categoria + Título */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 6,
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span
                          className="step-tag"
                          style={
                            idx === 0
                              ? { background: '#FACC15', color: '#09090B' }
                              : undefined
                          }
                        >
                          OPÇÃO {idx + 1} • #{candidate.rank} OMNIROUTE
                        </span>
                        <span className={`step-tag ${is2D ? 'purple' : 'blue'}`}>
                          {is2D ? '2D MOTION' : '3D MAQUETE'}
                        </span>
                      </div>

                      {isWinner ? (
                        <span className="step-tag green">★ MELHOR OPÇÃO</span>
                      ) : (
                        <span style={{ fontSize: 11, color: '#A1A1AA', fontWeight: 600 }}>
                          Ref: {meta.inspiredChannel}
                        </span>
                      )}
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        fontSize: 16,
                        fontWeight: 800,
                        color: '#F4F4F5',
                      }}
                    >
                      {renderModelIcon(candidate.modelId, 20)}
                      <span>{meta.name}</span>
                    </div>
                  </div>

                  {/* Palco Remotion Ao Vivo (com áudio ativo no 1º/escolhido e sincronizável) */}
                  <div
                    className={`player-viewport ${variantProject.aspectRatio === '16:9' ? 'ratio-wide' : 'ratio-vertical'
                      }`}
                  >
                    <Player
                      ref={(el) => {
                        candidatePlayerRefs.current[idx] = el;
                      }}
                      component={DynamicStudioVideo}
                      inputProps={{ project: variantProject }}
                      durationInFrames={Math.max(60, variantProject.totalFrames)}
                      fps={30}
                      compositionWidth={canvasSize.width}
                      compositionHeight={canvasSize.height}
                      style={{ width: '100%', height: '100%' }}
                      initiallyMuted={idx > 0}
                      controls
                      acknowledgeRemotionLicense
                    />
                  </div>

                  {/* Justificativa da IA OmniRoute + Botões de Escolha (Base de Conhecimento) e Exportação */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                    <div className="candidate-reason-box">
                      <strong style={{ color: '#FACC15' }}>Análise OmniRoute:</strong>{' '}
                      {candidate.reason}
                    </div>

                    <button
                      type="button"
                      className={`btn-winner-choice ${isWinner ? 'saved' : ''}`}
                      disabled={isSavingThis}
                      onClick={() => handleChooseWinningModel(candidate.modelId)}
                    >
                      {isWinner ? (
                        <Trophy size={16} weight="fill" />
                      ) : (
                        <CheckCircle size={16} weight="bold" />
                      )}
                      {isSavingThis
                        ? 'Salvando na Base de Conhecimento...'
                        : isWinner
                          ? 'Melhor Opção Escolhida (Salva na Base)'
                          : 'Escolher Esta Opção (Alimentar Base)'}
                    </button>

                    <button
                      type="button"
                      className={isWinner || idx === 0 ? 'btn-primary' : 'btn-secondary'}
                      style={{ width: '100%' }}
                      disabled={renderJob?.status === 'running'}
                      onClick={() => handleExportCandidateModel(candidate.modelId)}
                    >
                      <DownloadSimple size={16} weight="bold" />
                      {renderJob?.status === 'running' && project.modelId === candidate.modelId
                        ? `Renderizando MP4 (${renderJob.progressPct}%)...`
                        : `Exportar MP4 desta Opção (${variantProject.aspectRatio})`}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          {/* Painel Opcional de Ajuste Fino (aplica nas 3 opções simultaneamente) */}
          {showAdvanced3d ? (
            <section className="panel-card">
              <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700 }}>
                Cabeçalho / Marca & Cores (Atualiza os 3 Modelos Ao Vivo)
              </h3>
              <div className="sectors-list">
                {project.sectors.map((sec, sIdx) => (
                  <div key={sec.id} className="sector-item">
                    <label className="field-label">Assinatura / Cabeçalho Superior</label>
                    <input
                      className="studio-input"
                      value={sec.monitorHeader}
                      onChange={(e) => updateSector(sIdx, { monitorHeader: e.target.value })}
                    />
                    <label className="field-label">Tipo de Estação (p/ modelos 3D de setores)</label>
                    <select
                      className="studio-select"
                      value={sec.stationType}
                      onChange={(e) =>
                        updateSector(sIdx, {
                          stationType: e.target.value as SectorStationType,
                        })
                      }
                    >
                      {STATION_TYPE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>

                    <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                      <label
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          fontSize: 12,
                          color: '#A1A1AA',
                        }}
                      >
                        <input
                          type="color"
                          value={sec.shirtColor}
                          onChange={(e) => updateSector(sIdx, { shirtColor: e.target.value })}
                        />
                        Camisa 3D
                      </label>
                      <label
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          fontSize: 12,
                          color: '#A1A1AA',
                        }}
                      >
                        <input
                          type="color"
                          value={sec.wallAccentColor}
                          onChange={(e) => updateSector(sIdx, { wallAccentColor: e.target.value })}
                        />
                        Cor de Destaque
                      </label>
                    </div>
                  </div>
                ))}
              </div>

              <h3 style={{ margin: '18px 0 10px', fontSize: 15, fontWeight: 700 }}>
                Cartões de Dados, Telas & Poses por Cena
              </h3>
              <div className="scenes-stack">
                {project.scenes.map((sc, idx) => (
                  <div key={sc.id} className="scene-card">
                    <div className="scene-card-top">
                      <button
                        type="button"
                        className="jump-chip"
                        onClick={() => seekToScene(idx)}
                      >
                        <Play size={11} weight="fill" /> Ir p/ Cena {idx + 1} nos 3 Modelos
                      </button>
                      <select
                        className="studio-select"
                        style={{ width: 'auto' }}
                        value={sc.pose}
                        onChange={(e) =>
                          updateScene(idx, { pose: e.target.value as CharacterPose })
                        }
                      >
                        {POSE_OPTIONS.map((p) => (
                          <option key={p.value} value={p.value}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-grid-2">
                      <div>
                        <label className="field-label">Cartão / Tela • Linha 1</label>
                        <input
                          className="studio-input"
                          value={sc.screenLine1}
                          onChange={(e) => updateScene(idx, { screenLine1: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="field-label">Cartão / Tela • Linha 2</label>
                        <input
                          className="studio-input"
                          value={sc.screenLine2}
                          onChange={(e) => updateScene(idx, { screenLine2: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {/* KIT DE PUBLICAÇÃO YOUTUBE SHORTS (Título, Descrição & Hashtags) */}
          {project.ytShortsMeta ? (
            <section className="panel-card">
              <div className="panel-header">
                <div>
                  <h3 className="panel-title" style={{ fontSize: 16 }}>
                    <YoutubeLogo size={20} weight="fill" color="#EF4444" />
                    Kit Pronto p/ Publicar no YouTube Shorts
                  </h3>
                  <p className="panel-subtitle">
                    Copie em 1 clique o título magnético, descrição e hashtags gerados para o seu vídeo.
                  </p>
                </div>
                <span className="step-tag red">#shorts</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 5,
                    }}
                  >
                    <label className="field-label" style={{ margin: 0 }}>
                      Título do YouTube Short
                    </label>
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => copyToClipboard(project.ytShortsMeta!.title, 'yt_title')}
                    >
                      <Copy size={14} weight="bold" />
                      {copiedField === 'yt_title' ? 'Copiado!' : 'Copiar Título'}
                    </button>
                  </div>
                  <input
                    className="studio-input"
                    value={project.ytShortsMeta.title}
                    onChange={(e) =>
                      setProject((p) =>
                        p && p.ytShortsMeta
                          ? { ...p, ytShortsMeta: { ...p.ytShortsMeta, title: e.target.value } }
                          : p
                      )
                    }
                  />
                </div>

                <div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 5,
                    }}
                  >
                    <label className="field-label" style={{ margin: 0 }}>
                      Descrição + Hashtags
                    </label>
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() =>
                        copyToClipboard(
                          `${project.ytShortsMeta!.description}\n\n${project.ytShortsMeta!.hashtags.join(' ')}`,
                          'yt_desc'
                        )
                      }
                    >
                      <Copy size={14} weight="bold" />
                      {copiedField === 'yt_desc' ? 'Copiado!' : 'Copiar Descrição + Tags'}
                    </button>
                  </div>
                  <textarea
                    className="studio-textarea"
                    rows={3}
                    value={`${project.ytShortsMeta.description}\n${project.ytShortsMeta.hashtags.join(' ')}`}
                    onChange={(e) => {
                      const lines = e.target.value.split('\n');
                      const last = lines[lines.length - 1] || '';
                      const hasTags = last.includes('#');
                      const desc = hasTags ? lines.slice(0, -1).join('\n') : e.target.value;
                      const tags = hasTags
                        ? last.split(/\s+/).filter((w) => w.startsWith('#'))
                        : project.ytShortsMeta?.hashtags || ['#shorts'];
                      setProject((p) =>
                        p && p.ytShortsMeta
                          ? { ...p, ytShortsMeta: { ...p.ytShortsMeta, description: desc, hashtags: tags } }
                          : p
                      );
                    }}
                  />
                </div>
              </div>
            </section>
          ) : null}
        </main>
      ) : null}
    </div>
  );
};
