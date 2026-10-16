import type { LevelDef } from '../types';
import { dashLab } from './dashLab';
import { firstLight } from './firstLight';
import { labyrinth } from './labyrinth';
import { sawMill } from './sawMill';
import { switchback } from './switchback';
import { undercroft } from './undercroft';

export const LEVELS: LevelDef[] = [firstLight, dashLab, labyrinth, switchback, sawMill, undercroft];

export const levelById = (id: string) => LEVELS.find((l) => l.id === id);
