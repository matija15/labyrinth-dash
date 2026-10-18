import type { LevelDef } from '../../types';
import { contraptions } from './contraptions';
import { dashLab } from './dashLab';
import { firstLight } from './firstLight';
import { labyrinth } from './labyrinth';
import { sawMill } from './sawMill';
import { switchback } from './switchback';
import { undercroft } from './undercroft';

/** Demo / test levels: used by the tests and the solver, and only shown in dev builds. */
export const DEV_LEVELS: LevelDef[] = [firstLight, dashLab, labyrinth, switchback, sawMill, undercroft, contraptions];
