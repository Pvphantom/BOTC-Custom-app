// Trouble Brewing script data, shared by the server and the phones.

export const TEAMS = {
  townsfolk: { label: 'Townsfolk', good: true },
  outsider: { label: 'Outsiders', good: true },
  minion: { label: 'Minions', good: false },
  demon: { label: 'Demon', good: false },
};

export const ROLES = [
  // Townsfolk
  { id: 'washerwoman', name: 'Washerwoman', team: 'townsfolk', icon: '🧺', ability: 'You start knowing that 1 of 2 players is a particular Townsfolk.' },
  { id: 'librarian', name: 'Librarian', team: 'townsfolk', icon: '📖', ability: 'You start knowing that 1 of 2 players is a particular Outsider. (Or that zero are in play.)' },
  { id: 'investigator', name: 'Investigator', team: 'townsfolk', icon: '🔍', ability: 'You start knowing that 1 of 2 players is a particular Minion.' },
  { id: 'chef', name: 'Chef', team: 'townsfolk', icon: '👨‍🍳', ability: 'You start knowing how many pairs of evil players there are.' },
  { id: 'empath', name: 'Empath', team: 'townsfolk', icon: '❤️', ability: 'Each night, you learn how many of your 2 alive neighbours are evil.' },
  { id: 'fortuneteller', name: 'Fortune Teller', team: 'townsfolk', icon: '🔮', ability: 'Each night, choose 2 players: you learn if either is a Demon. There is a good player that registers as a Demon to you.' },
  { id: 'undertaker', name: 'Undertaker', team: 'townsfolk', icon: '⚰️', ability: 'Each night*, you learn which character died by execution today.' },
  { id: 'monk', name: 'Monk', team: 'townsfolk', icon: '✝️', ability: 'Each night*, choose a player (not yourself): they are safe from the Demon tonight.' },
  { id: 'ravenkeeper', name: 'Ravenkeeper', team: 'townsfolk', icon: '🐦‍⬛', ability: 'If you die at night, you are woken to choose a player: you learn their character.' },
  { id: 'virgin', name: 'Virgin', team: 'townsfolk', icon: '💍', ability: 'The 1st time you are nominated, if the nominator is a Townsfolk, they are executed immediately.' },
  { id: 'slayer', name: 'Slayer', team: 'townsfolk', icon: '🏹', ability: 'Once per game, during the day, publicly choose a player: if they are the Demon, they die.' },
  { id: 'soldier', name: 'Soldier', team: 'townsfolk', icon: '🛡️', ability: 'You are safe from the Demon.' },
  { id: 'mayor', name: 'Mayor', team: 'townsfolk', icon: '🏛️', ability: 'If only 3 players live & no execution occurs, your team wins. If you die at night, another player might die instead.' },
  // Outsiders
  { id: 'butler', name: 'Butler', team: 'outsider', icon: '🛎️', ability: 'Each night, choose a player (not yourself): tomorrow, you may only vote if they are voting too.' },
  { id: 'drunk', name: 'Drunk', team: 'outsider', icon: '🍺', ability: 'You do not know you are the Drunk. You think you are a Townsfolk character, but you are not.' },
  { id: 'recluse', name: 'Recluse', team: 'outsider', icon: '🕯️', ability: 'You might register as evil & as a Minion or Demon, even if dead.' },
  { id: 'saint', name: 'Saint', team: 'outsider', icon: '😇', ability: 'If you die by execution, your team loses.' },
  // Minions
  { id: 'poisoner', name: 'Poisoner', team: 'minion', icon: '🧪', ability: 'Each night, choose a player: they are poisoned tonight and tomorrow day.' },
  { id: 'spy', name: 'Spy', team: 'minion', icon: '🗡️', ability: 'Each night, you see the Grimoire. You might register as good & as a Townsfolk or Outsider, even if dead.' },
  { id: 'scarletwoman', name: 'Scarlet Woman', team: 'minion', icon: '💋', ability: "If there are 5 or more players alive (Travellers don't count) & the Demon dies, you become the Demon." },
  { id: 'baron', name: 'Baron', team: 'minion', icon: '🎩', ability: 'There are extra Outsiders in play. [+2 Outsiders]' },
  // Demon
  { id: 'imp', name: 'Imp', team: 'demon', icon: '🔱', ability: 'Each night*, choose a player: they die. If you kill yourself this way, a Minion becomes the Imp.' },
];

export const ROLE_BY_ID = Object.fromEntries(ROLES.map((r) => [r.id, r]));

// Setup table: [townsfolk, outsiders, minions, demons] by player count.
const SETUP = {
  5: [3, 0, 1, 1],
  6: [3, 1, 1, 1],
  7: [5, 0, 1, 1],
  8: [5, 1, 1, 1],
  9: [5, 2, 1, 1],
  10: [7, 0, 2, 1],
  11: [7, 1, 2, 1],
  12: [7, 2, 2, 1],
  13: [9, 0, 3, 1],
  14: [9, 1, 3, 1],
  15: [9, 2, 3, 1],
};

// Required counts for a player count. The Baron swaps 2 Townsfolk for 2 Outsiders.
export function setupCounts(playerCount, hasBaron = false) {
  const row = SETUP[Math.min(Math.max(playerCount, 5), 15)];
  const counts = { townsfolk: row[0], outsider: row[1], minion: row[2], demon: row[3] };
  if (hasBaron) {
    counts.townsfolk -= 2;
    counts.outsider += 2;
  }
  return counts;
}

// Night order helpers for the storyteller. "*" roles don't act the first night.
export const FIRST_NIGHT_ORDER = [
  'Minion info (minions learn each other & the Demon)',
  'Demon info (Demon learns minions + 3 not-in-play bluffs)',
  'poisoner', 'spy', 'washerwoman', 'librarian', 'investigator', 'chef', 'empath', 'fortuneteller', 'butler',
];
export const OTHER_NIGHT_ORDER = [
  'poisoner', 'monk', 'spy', 'scarletwoman', 'imp', 'ravenkeeper', 'empath', 'fortuneteller', 'undertaker', 'butler',
];
