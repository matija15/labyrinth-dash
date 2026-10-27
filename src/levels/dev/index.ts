import type { LevelDef } from '../../types';
import { contraptions } from './contraptions';
import { dashLab } from './dashLab';
import { echoChamber } from './echoChamber';
import { firstLight } from './firstLight';
import { labyrinth } from './labyrinth';
import { sawMill } from './sawMill';
import { switchback } from './switchback';
import { thornwoodMaze } from './thornwoodMaze';
import { undercroft } from './undercroft';

/** Demo / test levels: used by the tests and the solver, and only shown in dev builds. */
export const DEV_LEVELS: LevelDef[] = [firstLight, dashLab, labyrinth, switchback, sawMill, undercroft, contraptions, thornwoodMaze, echoChamber];
