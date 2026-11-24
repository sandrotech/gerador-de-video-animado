export type HudEntry = {fromS: string; toS: string; text: string; tech?: string; fromOffset?: number; toOffset?: number; w?: number};
export type RailSpec = {steps: string[]; switchS: string[]; fromS: string; toS: string};
export const VIDEO = {
  slug: 'ar-condicionado',
  lang: 'en' as 'zh' | 'en',
  bg: 'dots' as 'stars' | 'dots',
  title: {
    big: 'AR-CONDICIONADO',
    rest: '',
    en: 'COMO MONTAR UM AR-CONDICIONADO DO ZERO',
    tagline: 'DO BALDE DE GELO AO CICLO DE REFRIGERAÇÃO',
  },
  credit: null as {kicker: string; title: string; byline: string; note: string} | null,
  builtBy: '',
  chapterTech: ['Thermodynamic Heat Pump Cycle'],
  hud: [
    {fromS: 'S01', toS: 'S01', text: '1. O Balde de Gelo', w: 380},
    {fromS: 'S02', toS: 'S03', text: '2. Evaporador (-50°C)', w: 400},
    {fromS: 'S04', toS: 'S04', text: '3. Compressor (+70°C)', w: 400},
    {fromS: 'S05', toS: 'S05', text: '4. Condensador', w: 380},
    {fromS: 'S06', toS: 'S07', text: '5. Válvula e Dreno', w: 380},
    {fromS: 'S08', toS: 'S08', text: '6. Montagem Final', w: 380},
  ] as HudEntry[],
  rails: [] as RailSpec[],
  endingFade: 30,
};
