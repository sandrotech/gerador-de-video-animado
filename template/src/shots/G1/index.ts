import type { ShotDef, BgSpec, FootageSpec } from '../../common';
import { SC01 } from './SC01';
import { SC02 } from './SC02';
import { SC03 } from './SC03';
import { SC04 } from './SC04';
import { SC05 } from './SC05';
import { SC06 } from './SC06';

export const SHOTS_G1: ShotDef[] = [
  { id: 'SC01', from: 78, to: 500, Comp: SC01 },
  { id: 'SC02', from: 501, to: 921, Comp: SC02 },
  { id: 'SC03', from: 922, to: 1342, Comp: SC03 },
  { id: 'SC04', from: 1343, to: 1757, Comp: SC04 },
  { id: 'SC05', from: 1758, to: 2170, Comp: SC05 },
  { id: 'SC06', from: 2171, to: 2545, Comp: SC06 },
];
export const BG_G1: BgSpec[] = [];
export const FOOTAGE_G1: FootageSpec[] = [];
