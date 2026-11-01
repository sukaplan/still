import { ordinal } from './date-utils.mjs';
import wordList from './data/word-garden.json' with { type: 'json' };

export const WORDS = wordList;

export function dailyPuzzle(date) {
  const [answer, hint] = WORDS[((ordinal(date) % WORDS.length) + WORDS.length) % WORDS.length];
  return { answer, hint };
}

export function scoreGuess(guess, answer) {
  const score = Array(5).fill('absent'),
    counts = {};
  for (let i = 0; i < 5; i++) {
    if (guess[i] === answer[i]) score[i] = 'correct';
    else counts[answer[i]] = (counts[answer[i]] || 0) + 1;
  }
  for (let i = 0; i < 5; i++) {
    if (score[i] !== 'correct' && counts[guess[i]]) {
      score[i] = 'present';
      counts[guess[i]]--;
    }
  }
  return score;
}
