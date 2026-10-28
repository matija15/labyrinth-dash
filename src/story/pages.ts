/**
 * Storybook passages: each one opens once the player has found `pages` storybook pages (`@` tiles) in the
 * release pack. Placeholder text: rewrite it, add more, keep `pages` increasing.
 */
export interface StoryPassage {
  pages: number;
  title: string;
  text: string;
}

export const STORY: StoryPassage[] = [
  { pages: 1, title: 'The Red Hood', text: 'Once there was a girl in a red hood who took the short way through the woods, because the long way was for people who were afraid.' },
  { pages: 5, title: 'The Thornwood', text: 'The path she knew closed behind her. The trees grew walls, the walls grew thorns, and the thorns remembered every step she had taken.' },
  { pages: 10, title: 'The First Echo', text: 'Each time she fell, a pale girl stood up where she had been. The echo never spoke, but it always went where she had meant to go.' },
  { pages: 15, title: 'The Clockwork Mill', text: 'Deep in the labyrinth a mill ground the hours instead of grain. Its gears turned the ground upside down whenever it pleased.' },
  { pages: 25, title: 'The Lanterns', text: 'Somebody had hung lanterns where the dark was worst. Every one was still warm, as if whoever lit them had only just walked on.' },
  { pages: 40, title: 'The Wolf', text: 'The wolf did not chase her. The wolf waited at the heart of the maze, because every road in it had been built to lead there.' },
  { pages: 60, title: 'The Way Out', text: 'There is a way out of every labyrinth, the old stories say. They never say that you will want to take it.' },
];
