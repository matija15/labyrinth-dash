import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Game } from '../src/engine/game';
import { createInput } from '../src/engine/input';
import { echoChamber } from '../src/levels/dev/echoChamber';
import { sim } from './helpers';

const DOOR_X = 22 * 8;

test('echo doors stay shut without an echo', () => {
  const g = new Game(echoChamber);
  sim(g, 360, (_f, i) => { i.moveX = 1; });
  assert.equal(g.phase, 'playing');
  assert.ok(g.player.x + 6 <= DOOR_X + 0.01, 'stopped at the closed door');
  assert.equal(g.echo, null);
});

test('dying on purpose leaves an echo that presses the plate and opens the door', () => {
  const g = new Game(echoChamber);
  const input = createInput();
  input.moveX = -1;
  for (let f = 0; f < 600 && g.deaths === 0; f++) g.step(input);
  assert.equal(g.deaths, 1, 'ran over the plate into the spikes');
  assert.ok(g.echo && g.echo.frames.length > 0, 'the attempt was recorded');
  let opened = false;
  sim(g, 600, (_f, i) => {
    i.moveX = 1;
    if (g.echoOpen[0] > 0) opened = true;
  });
  assert.ok(opened, 'the echo held the plate');
  assert.equal(g.phase, 'complete', 'ran through the open echo door to the goal');
  assert.equal(g.deaths, 1);
});

test('the player never presses plates, and a restart forgets the echo', () => {
  const g = new Game(echoChamber);
  sim(g, 30, (_f, i) => { i.moveX = -1; });
  assert.equal(g.echoOpen[0], 0, 'standing on the plate does nothing');
  g.restart();
  assert.equal(g.echo, null);
});
