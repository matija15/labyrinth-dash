import type { LevelDef } from '../../types';

// Legend: # solid  ^v<> spikes  = crumble  K key  D door  O dash orb  J jump pad
//         1-9 portal pair  S spawn/checkpoint  G goal  . empty  - one-way  [ ] switch blocks
//         * lantern (2 dashes)  ( ) u n wind left / right / up / down  % fake wall  P echo plate  E echo door  F gravity gate  R reverse gate
export const flipSide: LevelDef = {
  id: "flip-side",
  name: "Flip Side",
  subtitle: "The ceiling is a floor",
  chapter: "Wolf's Den",
  par: 10,
  theme: "wolfden",
  rooms: [
    {
      id: "flip",
      x: 0,
      y: 0,
      hint: "Blue gates flip gravity. Green gates turn you around.",
      tiles: [
        '################################',
        '#.......F......vv.......F....R.#',
        '#.......F...............F....R.#',
        '#.......F...............F....R.#',
        '#.......F...............F....R.#',
        '#.......F...............F....R.#',
        '#.......F...............F....R.#',
        '#.......F...............F....R.#',
        '#.......F...............F....R.#',
        '#.......F...............F....R.#',
        '#.......F...............F....R.#',
        '#.......F...............F....R.#',
        '#.......F...............F....R.#',
        '#.S.....F...^^^^^^^^^.G.F....R.#',
        '################################',
        '################################',
      ],
    },
  ],
};
