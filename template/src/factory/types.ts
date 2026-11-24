export type EnvironmentTheme = 'office' | 'lab' | 'studio';

export type WorldSceneType = 'office' | 'pix_network' | 'science_lab' | (string & {});

export interface HookConfig {
  eyebrow: string;
  headline: string;
  badgeText?: string;
  stopwatchTargetSec?: number;
  durationFrames?: number;
}

export type CharacterMood = 'worried' | 'neutral' | 'happy' | 'joy';

export type HairStyle = 'quiff' | 'bob' | 'bun' | 'short';

export type CharacterRole = 'left_desk' | 'walker' | 'core_desk' | 'right_desk';

export type CameraPreset =
  | 'drone_to_left'
  | 'focus_left'
  | 'focus_core'
  | 'walker_to_step1'
  | 'focus_step1'
  | 'focus_right'
  | 'orbit_core'
  | 'wide_finale';

export type SfxKind = 'whoosh' | 'beep' | 'chime' | 'none';

export interface BrandPalette {
  name: string;
  primary: string;
  primaryDark: string;
  accent: string;
  secondary: string;
  danger: string;
  background: string;
  stripeColors: string[];
  logoAsset?: string;
}

export interface VoiceConfig {
  voice: string;
  rate: string;
  pronunciation?: Record<string, string>;
}

export interface BoardConfig {
  title: string;
  headline: string;
  subline: string;
}

export interface CompareCardConfig {
  eyebrow: string;
  line1: string;
  line2: string;
  footer: string;
}

export interface CompareWallConfig {
  header: string;
  left: CompareCardConfig;
  right: CompareCardConfig;
}

export interface MetricBoxConfig {
  label: string;
  value: string;
  accent?: boolean;
}

export interface ActionScreenConfig {
  header: string;
  subtitle: string;
  leftMetric: MetricBoxConfig;
  rightMetric: MetricBoxConfig;
  footerNote: string;
  buttonText: string;
  confirmedHeader: string;
  confirmedTitle: string;
  confirmedSubtitle: string;
  switchAtActIndex: number;
  switchAtProgress: number;
}

export interface RightScreenRow {
  label: string;
  value: string;
  positive?: boolean;
}

export interface RightScreenConfig {
  header: string;
  rows: RightScreenRow[];
  buttons: string[];
  approvedButtonLabel: string;
  stampText: string;
  approveAtActIndex: number;
  approveAtProgress: number;
}

export interface CoreHubConfig {
  titleLines: string[];
  badge: string;
  items: string[];
  visualStyle: 'pillar' | 'gears';
}

export interface CharacterConfig {
  id: string;
  role: CharacterRole;
  shirtColor: string;
  pantsColor: string;
  hairColor: string;
  skinColor: string;
  hairStyle: HairStyle;
  walkActIndex?: number;
  moodsByAct: CharacterMood[];
}

export interface OverlayCardConfig {
  side: 'left' | 'right';
  accentColor?: string;
  eyebrow: string;
  headline?: string;
  subline?: string;
  highlight?: string;
  checklist?: string[];
  counter?: {
    prefix: string;
    value: number;
    suffix: string;
    decimals?: number;
  };
}

export interface ActConfig {
  id: string;
  title: string;
  badge: string;
  badgeColor: string;
  narration: string;
  pauseAfterSec: number;
  sfx: SfxKind;
  cameraPreset: CameraPreset;
  overlayCard?: OverlayCardConfig;
}

export interface ExplainerProjectConfig {
  slug: string;
  compositionId: string;
  title: string;
  tagline: string;
  world?: WorldSceneType;
  hook?: HookConfig;
  environment: EnvironmentTheme;
  brand: BrandPalette;
  voice: VoiceConfig;
  dataFlowStartAct: number;
  flyingPapersUntilAct: number;
  leftBoard: BoardConfig;
  compareWall: CompareWallConfig;
  step1Screen: ActionScreenConfig;
  coreHub: CoreHubConfig;
  rightScreen: RightScreenConfig;
  characters: CharacterConfig[];
  acts: ActConfig[];
}

export interface WordCue {
  text: string;
  from: number;
  to: number;
}

export interface ExplainerTiming {
  total_frames: number;
  act_starts: Record<string, number>;
  words: WordCue[];
}
