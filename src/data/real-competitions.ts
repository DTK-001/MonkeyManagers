export const realCompetitions = [
  { id: 'premier-league', name: 'Premier League', type: 'League', colour: '#10e5eb', scoring: 'Counts only towards the league table.' },
  { id: 'fa-cup', name: 'The FA Cup', type: 'Domestic cup', colour: '#da107b', scoring: 'Has its own cup table and knockout results.' },
  { id: 'efl-cup', name: 'EFL Cup', type: 'Domestic cup', colour: '#a78bfa', scoring: 'Has its own cup table and knockout results.' },
  { id: 'champions-league', name: 'UEFA Champions League', type: 'European', colour: '#60a5fa', scoring: 'Only players involved in the competition can score here.' },
  { id: 'europa-league', name: 'UEFA Europa League', type: 'European', colour: '#fb923c', scoring: 'Only players involved in the competition can score here.' },
  { id: 'conference-league', name: 'UEFA Conference League', type: 'European', colour: '#4ade80', scoring: 'Only players involved in the competition can score here.' }
] as const;
