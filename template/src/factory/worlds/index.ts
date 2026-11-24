import type * as THREE from 'three';
import type { ExplainerProjectConfig, ExplainerTiming } from '../types';
import { buildPixNetworkWorld, type WorldController } from './pixNetworkWorld';
import { buildScienceLabWorld } from './scienceLabWorld';
import { buildPorQueOGeloFlutuaWorld } from './porQueOGeloFlutuaWorld';

export type WorldBuilderFn = (
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  config: ExplainerProjectConfig,
  timing: ExplainerTiming,
  isVertical: boolean,
) => WorldController;

// WORLD_REGISTRY_START
export const WORLD_BUILDERS: Record<string, WorldBuilderFn> = {
  pix_network: buildPixNetworkWorld,
  science_lab: buildScienceLabWorld,
  por_que_o_gelo_flutua: buildPorQueOGeloFlutuaWorld,
  // WORLD_REGISTRY_END
};
