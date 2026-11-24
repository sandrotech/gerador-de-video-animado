import type {ExplainerProjectConfig, ExplainerTiming} from './types';
import comoFuncionaOPixConfig from './projects/como-funciona-o-pix/config.json';
import comoFuncionaOPixTiming from './projects/como-funciona-o-pix/timing.json';
import porQueOGeloFlutuaConfig from './projects/por-que-o-gelo-flutua/config.json';
import porQueOGeloFlutuaTiming from './projects/por-que-o-gelo-flutua/timing.json';

export interface RegisteredFactoryProject {
  config: ExplainerProjectConfig;
  timing: ExplainerTiming;
}

export const FACTORY_PROJECTS: RegisteredFactoryProject[] = [
  {
    config: comoFuncionaOPixConfig as unknown as ExplainerProjectConfig,
    timing: comoFuncionaOPixTiming as unknown as ExplainerTiming,
  },
  {
    config: porQueOGeloFlutuaConfig as unknown as ExplainerProjectConfig,
    timing: porQueOGeloFlutuaTiming as unknown as ExplainerTiming,
  },
];
