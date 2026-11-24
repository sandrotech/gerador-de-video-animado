import React from 'react';
import {Composition} from 'remotion';
import {W, H, FPS, TOTAL_FRAMES} from './common';
import {Video} from './Main';
import {ReelVideo} from './shots/G1/ReelStage';
import {MicrowaveReelVideo} from './shots/G1/MicrowaveStage';
import {MICROWAVE_TOTAL_FRAMES} from './shots/G1/microwaveWords';
import {DataCriticaReelVideo} from './shots/G1/DataCriticaStage';
import {DATACRITICA_TOTAL_FRAMES} from './shots/G1/dataCriticaWords';
import {RestauranteStage} from './shots/G1/RestauranteStage';
import {RESTAURANTE_TOTAL_FRAMES} from './shots/G1/restauranteWords';
import {StechStage} from './shots/G1/StechStage';
import {STECH_TOTAL_FRAMES} from './shots/G1/stechWords';
import {StechV3ReelsStage} from './shots/G1/StechV3Stage';
import {STECH_V3_TOTAL_FRAMES} from './shots/G1/stechV3Words';
import {CenterboxStage} from './shots/G1/CenterboxStage';
import {CENTERBOX_TOTAL_FRAMES} from './shots/G1/centerboxWords';
import {ExplainerStage} from './factory/ExplainerStage';
import {FACTORY_PROJECTS} from './factory/registry';

const StechHorizontal: React.FC = () => <StechStage variant="16:9" />;
const StechVertical: React.FC = () => <StechStage variant="9:16" />;
const FACTORY_COMPS = FACTORY_PROJECTS.map(({config, timing}) => ({
  config,
  timing,
  Comp: (() => <ExplainerStage config={config} timing={timing} />) as React.FC,
}));
import {PreviewOverlay} from './overlay/Preview';
import {PreviewG1} from './shots/G1/Preview';
import {PreviewG2} from './shots/G2/Preview';
import {PreviewG3} from './shots/G3/Preview';
import {PreviewG4} from './shots/G4/Preview';
import {PreviewG5} from './shots/G5/Preview';
import {PreviewG6} from './shots/G6/Preview';
import {PreviewG7} from './shots/G7/Preview';
import {PreviewG8} from './shots/G8/Preview';

export const Root: React.FC = () => (
  <>
    <Composition id="Reel" component={ReelVideo} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
    <Composition
      id="MicroOndas"
      component={MicrowaveReelVideo}
      durationInFrames={MICROWAVE_TOTAL_FRAMES}
      fps={FPS}
      width={1080}
      height={1920}
    />
    <Composition
      id="DataCritica"
      component={DataCriticaReelVideo}
      durationInFrames={DATACRITICA_TOTAL_FRAMES}
      fps={FPS}
      width={1920}
      height={1080}
    />
    <Composition
      id="RestauranteContrast"
      component={RestauranteStage}
      durationInFrames={RESTAURANTE_TOTAL_FRAMES}
      fps={FPS}
      width={1920}
      height={1080}
    />
    <Composition
      id="StechAutomacao"
      component={StechHorizontal}
      durationInFrames={STECH_TOTAL_FRAMES}
      fps={FPS}
      width={1920}
      height={1080}
    />
    <Composition
      id="StechAutomacaoVertical"
      component={StechVertical}
      durationInFrames={STECH_TOTAL_FRAMES}
      fps={FPS}
      width={1080}
      height={1920}
    />
    <Composition
      id="StechAutomacaoReelsV3"
      component={StechV3ReelsStage}
      durationInFrames={STECH_V3_TOTAL_FRAMES}
      fps={FPS}
      width={1080}
      height={1920}
    />
    <Composition
      id="CenterboxAntecipacao"
      component={CenterboxStage}
      durationInFrames={CENTERBOX_TOTAL_FRAMES}
      fps={FPS}
      width={1920}
      height={1080}
    />
    {FACTORY_COMPS.map(({config, timing, Comp}) => (
      <React.Fragment key={config.slug}>
        <Composition
          id={config.compositionId}
          component={Comp}
          durationInFrames={timing.total_frames}
          fps={FPS}
          width={1920}
          height={1080}
        />
        <Composition
          id={`${config.compositionId}Reels`}
          component={Comp}
          durationInFrames={timing.total_frames}
          fps={FPS}
          width={1080}
          height={1920}
        />
      </React.Fragment>
    ))}
    <Composition id="Video" component={Video} durationInFrames={TOTAL_FRAMES} fps={FPS} width={W} height={H} />
    <Composition id="Overlay" component={PreviewOverlay} durationInFrames={TOTAL_FRAMES} fps={FPS} width={W} height={H} />
    <Composition id="G1" component={PreviewG1} durationInFrames={TOTAL_FRAMES} fps={FPS} width={W} height={H} />
    <Composition id="G2" component={PreviewG2} durationInFrames={TOTAL_FRAMES} fps={FPS} width={W} height={H} />
    <Composition id="G3" component={PreviewG3} durationInFrames={TOTAL_FRAMES} fps={FPS} width={W} height={H} />
    <Composition id="G4" component={PreviewG4} durationInFrames={TOTAL_FRAMES} fps={FPS} width={W} height={H} />
    <Composition id="G5" component={PreviewG5} durationInFrames={TOTAL_FRAMES} fps={FPS} width={W} height={H} />
    <Composition id="G6" component={PreviewG6} durationInFrames={TOTAL_FRAMES} fps={FPS} width={W} height={H} />
    <Composition id="G7" component={PreviewG7} durationInFrames={TOTAL_FRAMES} fps={FPS} width={W} height={H} />
    <Composition id="G8" component={PreviewG8} durationInFrames={TOTAL_FRAMES} fps={FPS} width={W} height={H} />
  </>
);
