import type { LevelDef } from '../../types';

// Legend: # solid  ^v<> spikes  = crumble  K key  D door  O dash orb  J jump pad
//         1-9 portal pair  S spawn/checkpoint  G goal  . empty  - one-way  [ ] switch blocks
//         * lantern (2 dashes)  ( ) u n wind left / right / up / down  % fake wall  P echo plate  E echo door
export const echoChamber: LevelDef = {
  id: "echo-chamber",
  name: "Echo Chamber",
  subtitle: "Your last life holds the door",
  chapter: "Clockwork Mill",
  par: 12,
  theme: "clockwork",
  rooms: [
    {
      id: "chamber",
      x: 0,
      y: 0,
      hint: "Only your echo can press a plate. Die on purpose: it replays your last try.",
      tiles: [
        '################################',
        '#.....................#........#',
        '#.....................#........#',
        '#.....................#........#',
        '#.....................#........#',
        '#.....................#........#',
        '#.....................#........#',
        '#.....................#........#',
        '#.....................#........#',
        '#.....................#........#',
        '#.....................#........#',
        '#.....................E........#',
        '#.....................E........#',
        '#^^^..P.......S.......E.....G..#',
        '################################',
        '################################',
      ],
    },
  ],
};
