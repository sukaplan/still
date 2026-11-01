/** Application startup and delegated user actions. */
import {
  loadDaily,
  loadKind,
  openDiscovery,
  pronounceGermanWord,
  setMomentComplete,
  toggleSave,
} from './client/content.js';
import { session } from './client/context.js';
import {
  checkCrossword,
  focusCrosswordCell,
  openCrossword,
  selectedCrosswordEntry,
  updateCrosswordLetter,
} from './client/crossword.js';
import {
  MOON_CITIES,
  openMoon,
  setMoonLocation,
  updateMoonBadge,
  useCurrentLocation,
} from './client/moon-ui.js';
import { openSettings } from './client/settings.js';
import {
  createInitialState,
  exportBackup,
  getTodayProgress,
  importBackup,
  localDateKey,
  normalizePersonalState,
  STORAGE,
  syncPersonalData,
  updatePersonalState,
} from './client/storage.js';
import { $, closeModal, renderIcon, toast } from './client/ui.js';
import { render } from './client/views.js';
import {
  openGoal,
  processPhoto,
  saveGoal,
  searchPhotos,
  selectSearchImage,
} from './client/vision-board.js';
import { openWordGarden, submitWordGuess } from './client/word-garden.js';
import { crosswordStatus, dailyCrossword } from './crosswords.mjs';
import { goalStatus, setGoalStep } from './state.mjs';
session.state = createInitialState();
try {
  const v = localStorage.getItem(STORAGE);
  if (v) session.state = normalizePersonalState(JSON.parse(v));
} catch {
  session.storageAvailable = false;
}
session.today = localDateKey();
$('#moon-badge').addEventListener('click', openMoon);
setInterval(() => {
  updateMoonBadge();
  if (session.daily.astronomy?.expiresAt < Date.now() && !session.loading.astronomy)
    loadKind('astronomy');
}, 60000);
$('#close-modal').innerHTML = renderIcon('close');
$('#close-modal').addEventListener('click', closeModal);
$('#modal').addEventListener('click', (e) => {
  if (e.target === $('#modal')) {
    const r = $('#modal').getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
      closeModal();
  }
});
$('#modal').addEventListener('close', () => {
  session.modalKind = '';
  if ('speechSynthesis' in window) speechSynthesis.cancel();
});
$('#settings-button').addEventListener('click', openSettings);
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-action]');
  if (!b || b.disabled) return;
  const a = b.dataset.action;
  if (a === 'moon') openMoon();
  else if (a === 'use-location') useCurrentLocation();
  else if (a === 'puzzle') openWordGarden();
  else if (a === 'crossword') openCrossword();
  else if (a === 'check-crossword') checkCrossword();
  else if (a === 'crossword-clue') {
    const entry = dailyCrossword(session.today).entries.find((x) => x.id === b.dataset.id);
    if (entry) {
      session.crosswordEntryId = entry.id;
      const status = crosswordStatus(getTodayProgress().crossword, dailyCrossword(session.today));
      const index = entry.cells.find((i) => !status.letters[i]) ?? entry.cells[0];
      focusCrosswordCell(index);
      $('[data-crossword-cell="' + index + '"]')?.focus();
    }
  } else if (a.startsWith('read-') && a !== 'read-saved') openDiscovery(a.slice(5));
  else if (a === 'save') toggleSave(b.dataset.kind);
  else if (a === 'retry') loadKind(b.dataset.kind);
  else if (a === 'complete') {
    setMomentComplete(b.dataset.kind, !getTodayProgress().done.includes(b.dataset.kind));
  } else if (a === 'speak') pronounceGermanWord();
  else if (a === 'open-board') location.hash = 'vision';
  else if (a === 'new-goal') openGoal();
  else if (a === 'edit-goal') openGoal(b.dataset.id);
  else if (a === 'close-modal') closeModal();
  else if (a === 'hint') {
    session.puzzleHint = true;
    openWordGarden();
  } else if (a === 'key') {
    const input = $('#guess-input');
    if (input) {
      input.value =
        b.dataset.key === 'Backspace'
          ? input.value.slice(0, -1)
          : (input.value + b.dataset.key).slice(0, 5);
      input.focus();
    }
  } else if (a === 'search-images') searchPhotos();
  else if (a === 'more-images') searchPhotos(session.imagePage + 1);
  else if (a === 'select-image') selectSearchImage(Number(b.dataset.index));
  else if (a === 'toggle-achieved') {
    const goal = session.state.goals.find((g) => g.id === b.dataset.id);
    if (
      goal &&
      updatePersonalState((s) => {
        const g = s.goals.find((g) => g.id === b.dataset.id);
        const value = !goalStatus(g).achieved;
        g.achieved = value;
        g.progress = value ? 100 : 0;
        g.sample = false;
      })
    )
      render();
  } else if (a === 'choose-image') {
    session.editingImage = b.dataset.image;
    $('#photo-preview').src = session.editingImage;
    document
      .querySelectorAll('.image-choice')
      .forEach((x) => x.classList.toggle('selected', x === b));
  } else if (a === 'board-filter') {
    session.boardFilter = b.dataset.filter;
    render();
  } else if (a === 'collection-filter') {
    session.filter = b.dataset.filter;
    render();
  } else if (a === 'remove-saved') {
    if (
      updatePersonalState((s) => {
        s.saved = s.saved.filter((x) => x.id !== b.dataset.id);
      })
    ) {
      render();
      toast('Removed');
    }
  } else if (a === 'read-saved') {
    const x = session.state.saved.find((x) => x.id === b.dataset.id);
    if (x) {
      openDiscovery(x.kind, x);
      if (x.kind === 'german') {
        session.modalKind = 'saved-german';
        session.savedSpeakingItem = x;
      }
    }
  } else if (a === 'delete-goal') {
    if (b.dataset.confirm === 'yes') {
      if (
        updatePersonalState((s) => {
          s.goals = s.goals.filter((g) => g.id !== b.dataset.id);
        })
      ) {
        closeModal();
        render();
        toast('Removed');
      }
    } else {
      b.dataset.confirm = 'yes';
      b.textContent = 'Remove this intention? Tap again.';
    }
  } else if (a === 'export') exportBackup();
  else if (a === 'import') $('#import-file').click();
});
document.addEventListener('submit', (e) => {
  if (e.target.id === 'puzzle-form') {
    e.preventDefault();
    submitWordGuess();
  } else if (e.target.id === 'goal-form') {
    e.preventDefault();
    saveGoal(e.target);
  } else if (e.target.id === 'moon-location-form') {
    e.preventDefault();
    const lat = e.target.elements.latitude.value,
      lon = e.target.elements.longitude.value;
    if (!lat || !lon) {
      $('#moon-location-error').textContent = 'Enter latitude and longitude.';
      return;
    }
    setMoonLocation({
      latitude: Number(lat),
      longitude: Number(lon),
      label: 'Selected coordinates',
      timezone: session.state.timezone,
    });
  }
});
document.addEventListener('input', (e) => {
  if (e.target.matches('[data-crossword-cell]')) {
    updateCrosswordLetter(Number(e.target.dataset.crosswordCell), e.target.value);
    return;
  }
  if (e.target.id === 'guess-input')
    e.target.value = e.target.value.replace(/[^a-z]/gi, '').toUpperCase();
  if (e.target.id === 'reflection') {
    const value = e.target.value,
      date = session.today;
    $('#reflection-status').textContent = 'Keeping your thought…';
    clearTimeout(session.reflectionTimer);
    session.reflectionTimer = setTimeout(() => {
      if (
        updatePersonalState((s) => {
          s.reflections[date] = value;
        })
      )
        $('#reflection-status') &&
          ($('#reflection-status').textContent = 'A thought, kept. Saved in this browser.');
    }, 450);
  }
});
document.addEventListener('change', (e) => {
  if (e.target.id === 'moon-city' && e.target.value) {
    const city = MOON_CITIES.find((c) => c.label === e.target.value);
    if (city) setMoonLocation(city);
    return;
  }
  if (e.target.matches('[data-goal-id][data-step-id]')) {
    const target = e.target;
    if (
      updatePersonalState((s) => {
        const index = s.goals.findIndex((g) => g.id === target.dataset.goalId);
        if (index >= 0)
          s.goals[index] = setGoalStep(s.goals[index], target.dataset.stepId, target.checked);
      })
    )
      render();
    return;
  }
  if (e.target.id === 'goal-photo') processPhoto(e.target.files[0]);
  if (e.target.id === 'import-file' && e.target.files[0]) importBackup(e.target.files[0]);
  if (e.target.id === 'timezone') {
    if (
      updatePersonalState((s) => {
        s.timezone = e.target.value;
      })
    ) {
      session.today = localDateKey();
      session.puzzleHint = false;
      closeModal();
      loadDaily();
      toast('Time zone updated');
    }
  }
});
document.addEventListener('keydown', (e) => {
  if (e.target.matches('[data-crossword-cell]')) {
    const index = Number(e.target.dataset.crosswordCell),
      entry = selectedCrosswordEntry(),
      puzzle = dailyCrossword(session.today);
    let next;
    if (e.key === 'Backspace' && !e.target.value) {
      e.preventDefault();
      next = entry.cells[entry.cells.indexOf(index) - 1];
      if (next !== undefined) {
        updateCrosswordLetter(next, '');
        focusCrosswordCell(next);
        $('[data-crossword-cell="' + next + '"]')?.focus();
      }
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      focusCrosswordCell(index, true);
      return;
    }
    const delta = {
      ArrowRight: 1,
      ArrowLeft: -1,
      ArrowDown: 5,
      ArrowUp: -5,
    }[e.key];
    if (delta) {
      e.preventDefault();
      for (let i = index + delta; i >= 0 && i < 25; i += delta) {
        if (Math.abs(delta) === 1 && Math.floor(i / 5) !== Math.floor(index / 5)) break;
        if (puzzle.rows[Math.floor(i / 5)][i % 5] !== '#') {
          next = i;
          break;
        }
      }
      if (next !== undefined) {
        const direction = Math.abs(delta) === 5 ? 'down' : 'across',
          candidate = puzzle.entries.find(
            (x) => x.direction === direction && x.cells.includes(next),
          );
        if (candidate) session.crosswordEntryId = candidate.id;
        focusCrosswordCell(next);
        $('[data-crossword-cell="' + next + '"]')?.focus();
      }
      return;
    }
  }
  if (e.key === 'Enter' && e.target.id === 'image-query') {
    e.preventDefault();
    searchPhotos();
    return;
  }
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.art-image-wrap')) {
    e.preventDefault();
    openDiscovery('art');
  }
});
document.addEventListener('focusin', (e) => {
  if (e.target.matches('[data-crossword-cell]'))
    focusCrosswordCell(Number(e.target.dataset.crosswordCell));
});
document.addEventListener('click', (e) => {
  if (e.target.matches('[data-crossword-cell]'))
    focusCrosswordCell(Number(e.target.dataset.crosswordCell));
});
window.addEventListener('hashchange', () => {
  render();
  window.scrollTo({
    top: 0,
    behavior: 'instant',
  });
});
export function rollover() {
  const next = localDateKey();
  if (next !== session.today) {
    session.today = next;
    session.puzzleHint = false;
    session.crosswordEntryId = null;
    session.crosswordCell = null;
    session.crosswordChecked = false;
    if (session.modalKind !== 'goal') closeModal();
    loadDaily();
    toast('A new day is ready');
  }
}
window.addEventListener('storage', (e) => {
  if (e.key === STORAGE) syncPersonalData();
});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    syncPersonalData();
    rollover();
  }
});
setInterval(rollover, 30000);
window.addEventListener('online', () => {
  for (const k of ['art', 'german', 'science', 'tech', 'astronomy'])
    if (!session.daily[k] && !session.loading[k]) loadKind(k);
});
render();
loadDaily();
if (!session.storageAvailable)
  setTimeout(
    () =>
      toast('Personal changes cannot currently be saved. Check your browser’s storage settings.'),
    1000,
  );
