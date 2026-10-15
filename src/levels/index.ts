import type { LevelDef } from '../types';
import { dashLab } from './dashLab';
import { firstLight } from './firstLight';
import { labyrinth } from './labyrinth';

export const LEVELS: LevelDef[] = [firstLight, dashLab, labyrinth];

export const levelById = (id: string) => LEVELS.find((l) => l.id === id);
