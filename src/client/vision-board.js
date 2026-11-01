/** Vision cards, checklist editing, and Wikimedia photo search. */
import { goalStatus, goalSteps, stepsFromText } from '../state.mjs';
import { session } from './context.js';
import {
  formatDate,
  GOAL_CATEGORIES,
  photoCredit,
  safeImage,
  updatePersonalState,
} from './storage.js';
import {
  $,
  closeModal,
  creditHTML,
  escapeHTML,
  html,
  modalTitle,
  openModal,
  renderButton,
  renderIcon,
  renderPageHeading,
  toast,
} from './ui.js';
import { render } from './views.js';
export function renderGoal(goal) {
  const status = goalStatus(goal);
  return html`<article class="goal-card${status.achieved ? ' is-achieved' : ''}">
    ${status.achieved
      ? html`<span class="goal-done-label">${renderIcon('check')} Achieved</span>`
      : ''}<button
      class="goal-image-button"
      data-action="edit-goal"
      data-id="${escapeHTML(goal.id)}"
      aria-label="Edit ${escapeHTML(goal.title)}"
    >
      <img
        class="goal-image"
        src="${escapeHTML(safeImage(goal.image))}"
        alt="${escapeHTML(goal.title)}"
      /></button
    >${renderButton(
      'edit-goal',
      renderIcon('edit'),
      'goal-edit icon-button',
      'data-id="' + escapeHTML(goal.id) + '" aria-label="Edit intention"',
    )}
    <div class="goal-body">
      <span class="goal-category"
        >${escapeHTML(goal.category)}${goal.sample ? ' · Example' : ''}</span
      >
      <h2>${escapeHTML(goal.title)}</h2>
      ${goal.sample ? '' : html`<p>${escapeHTML(goal.note)}</p>`}${status.total
        ? html`<div class="goal-checklist">
              ${status.steps
                .map(
                  (step) =>
                    html`<label class="goal-step ${step.done ? 'checked' : ''}"
                      ><input
                        type="checkbox"
                        data-goal-id="${escapeHTML(goal.id)}"
                        data-step-id="${escapeHTML(step.id)}"
                        ${step.done ? 'checked' : ''}
                      /><span>${escapeHTML(step.text)}</span></label
                    >`,
                )
                .join('')}
            </div>
            <div class="goal-meta">
              <div
                class="thin-progress"
                role="progressbar"
                aria-label="${escapeHTML(goal.title)} steps completed"
                aria-valuenow="${status.done}"
                aria-valuemin="0"
                aria-valuemax="${status.total}"
              >
                <span style="width:${status.progress}%"></span>
              </div>
              <span>${status.done} / ${status.total} steps</span>${renderButton(
                'edit-goal',
                renderIcon('edit'),
                'icon-button',
                'data-id="' + escapeHTML(goal.id) + '" aria-label="Edit steps"',
              )}
            </div>`
        : html`<div class="goal-meta">
            ${renderButton(
              'toggle-achieved',
              renderIcon('check') + ' ' + (status.achieved ? 'Achieved' : 'Mark achieved'),
              'secondary-button achievement-toggle ' + (status.achieved ? 'selected' : ''),
              'data-id="' + escapeHTML(goal.id) + '" aria-pressed="' + status.achieved + '"',
            )}${renderButton(
              'edit-goal',
              'Add steps',
              'text-link',
              'data-id="' + escapeHTML(goal.id) + '"',
            )}
          </div>`}${goal.date
        ? html`<p class="saved-date">Target · ${escapeHTML(formatDate(goal.date))}</p>`
        : ''}${creditHTML(goal.photoCredit)}
    </div>
  </article>`;
}
export function renderVision() {
  const goals = session.state.goals.filter(
    (g) =>
      session.boardFilter === 'All' ||
      (session.boardFilter === 'Complete'
        ? goalStatus(g).achieved
        : g.category === session.boardFilter),
  );
  return (
    renderPageHeading('Vision board') +
    '<div class="section-head"><div class="eyebrow">' +
    session.state.goals.length +
    ' intentions · ' +
    session.state.goals.filter((g) => goalStatus(g).achieved).length +
    ' achieved</div>' +
    renderButton('new-goal', renderIcon('plus') + ' Add intention', 'primary-button') +
    '</div><div class="filter-row">' +
    ['All', ...GOAL_CATEGORIES, 'Complete']
      .map((c) =>
        renderButton(
          'board-filter',
          c === 'Complete' ? 'Achieved' : escapeHTML(c),
          'filter ' + (c === session.boardFilter ? 'active' : ''),
          'data-filter="' + escapeHTML(c) + '" aria-pressed="' + (c === session.boardFilter) + '"',
        ),
      )
      .join('') +
    '</div><div class="board-grid">' +
    (goals.length
      ? goals.map(renderGoal).join('')
      : html`<div class="empty-state">
          ${renderIcon('vision')}
          <h2>${session.state.goals.length ? 'No matching intentions' : 'No intentions yet'}</h2>
          ${renderButton(
            session.state.goals.length ? 'board-filter' : 'new-goal',
            session.state.goals.length ? 'Show all' : 'Add intention',
            'primary-button',
            'data-filter="All"',
          )}
        </div>`) +
    '</div>'
  );
}
export function openGoal(id) {
  const goal = session.state.goals.find((x) => x.id === id) || {
    title: '',
    category: GOAL_CATEGORIES[0],
    note: '',
    date: '',
    image: '/assets/lake.jpg',
    steps: [],
  };
  session.imageController?.abort();
  session.imageRequest++;
  session.imageResults = [];
  session.imagePage = 1;
  session.imageQuery = '';
  session.editingId = id || null;
  session.editingImage = goal.image;
  session.editingPhotoCredit = photoCredit(goal.photoCredit);
  openModal(
    html`${modalTitle(id ? 'Edit intention' : 'New intention', '')}
      <form id="goal-form">
        <div class="form-row">
          <label for="goal-title">Title</label
          ><input
            id="goal-title"
            name="title"
            value="${escapeHTML(goal.title)}"
            maxlength="90"
            required
            placeholder="Goal title"
          />
        </div>
        <div class="form-two">
          <div class="form-row">
            <label for="goal-category">Category</label
            ><select id="goal-category" name="category">
              ${GOAL_CATEGORIES.map(
                (c) =>
                  html`<option ${c === goal.category ? 'selected' : ''}>${escapeHTML(c)}</option>`,
              ).join('')}
            </select>
          </div>
          <div class="form-row">
            <label for="goal-date">Target date (optional)</label
            ><input id="goal-date" type="date" name="date" value="${escapeHTML(goal.date || '')}" />
          </div>
        </div>
        <div class="form-row">
          <label for="goal-note">Notes</label
          ><textarea id="goal-note" name="note" maxlength="1000" placeholder="Why it matters">
${escapeHTML(goal.note || '')}</textarea
          >
        </div>
        <div class="form-row">
          <label for="goal-steps">Steps</label
          ><textarea id="goal-steps" name="steps" maxlength="4200" placeholder="One step per line">
${escapeHTML(
              goalSteps(goal)
                .map((x) => x.text)
                .join('\n'),
            )}</textarea
          ><span class="hint">Check off steps on your board to track progress.</span>
        </div>
        <div class="form-row">
          <label for="image-query">Photo</label
          ><img
            id="photo-preview"
            class="photo-preview"
            src="${escapeHTML(safeImage(goal.image))}"
            alt="Selected intention photo"
          />
          <div id="photo-credit">${creditHTML(session.editingPhotoCredit)}</div>
          <div class="image-search-row">
            <input
              id="image-query"
              type="search"
              maxlength="100"
              placeholder="Search photos, e.g. Japan or ocean"
              autocomplete="off"
              aria-label="Search photos"
            />${renderButton(
              'search-images',
              'Search',
              'secondary-button',
              'id="image-search-button"',
            )}
          </div>
          <div id="image-search-status" class="hint" role="status" aria-live="polite"></div>
          <div id="image-results" class="image-results"></div>
          <details class="photo-upload">
            <summary>Upload a photo instead</summary>
            <input id="goal-photo" type="file" accept="image/jpeg,image/png,image/webp" />
          </details>
        </div>
        <div class="modal-actions">
          <button class="primary-button" type="submit">${renderIcon('check')} Save</button
          >${renderButton('close-modal', 'Cancel', 'secondary-button')}${id
            ? renderButton(
                'delete-goal',
                'Delete',
                'delete-button',
                'data-id="' + escapeHTML(id) + '"',
              )
            : ''}
        </div>
        <p id="goal-error" class="form-error" role="alert"></p>
      </form>`,
    'goal',
  );
}
export function saveGoal(form) {
  const formData = new FormData(form),
    title = String(formData.get('title')).trim();
  if (!title) {
    $('#goal-error').textContent = 'Enter a title.';
    return;
  }
  const previous = session.state.goals.find((g) => g.id === session.editingId),
    steps = stepsFromText(formData.get('steps') || '', goalSteps(previous || {}));
  const status = goalStatus({
    steps,
    achieved: !steps.length && goalStatus(previous || {}).achieved,
  });
  const goal = {
      id: session.editingId || crypto.randomUUID(),
      title,
      category: String(formData.get('category')),
      note: String(formData.get('note')).trim(),
      next: steps.find((x) => !x.done)?.text || '',
      steps,
      achieved: status.achieved,
      progress: status.progress,
      legacyProgress: previous?.legacyProgress,
      date: String(formData.get('date')),
      image: session.editingImage,
      photoCredit: session.editingPhotoCredit,
      sample: false,
    },
    previousId = session.editingId;
  if (
    updatePersonalState((s) => {
      const i = s.goals.findIndex((x) => x.id === previousId);
      if (i >= 0) s.goals[i] = goal;
      else s.goals.push(goal);
    })
  ) {
    closeModal();
    render();
    toast('Saved');
  }
}
export function renderImageResults(more = false) {
  const container = $('#image-results');
  if (!container) return;
  container.innerHTML =
    session.imageResults
      .map(
        (x, i) =>
          html`<button
            type="button"
            class="image-result ${session.editingImage === x.image ? 'selected' : ''}"
            data-action="select-image"
            data-index="${i}"
            aria-label="Choose photo: ${escapeHTML(x.title)}"
            aria-pressed="${session.editingImage === x.image}"
          >
            <img src="${escapeHTML(x.image)}" alt="${escapeHTML(x.title)}" loading="lazy" /><span
              >${escapeHTML(x.creator)} · ${escapeHTML(x.license)}</span
            >
          </button>`,
      )
      .join('') +
    (more ? renderButton('more-images', 'More photos', 'secondary-button more-images') : '');
}
export async function searchPhotos(page = 1) {
  const field = $('#image-query'),
    status = $('#image-search-status');
  if (!field || !status) return;
  const query = page === 1 ? field.value.trim() : session.imageQuery;
  if (query.length < 2) {
    status.textContent = 'Enter at least two characters.';
    return;
  }
  session.imageController?.abort();
  const controller = new AbortController();
  session.imageController = controller;
  const request = ++session.imageRequest;
  if (page === 1) {
    session.imageResults = [];
    session.imageQuery = query;
    $('#image-results').innerHTML = '';
  }
  $('#image-search-button').disabled = true;
  status.textContent = 'Searching…';
  try {
    const response = await fetch('/api/images?q=' + encodeURIComponent(query) + '&page=' + page, {
      signal: controller.signal,
    });
    const data = await response.json();
    if (request !== session.imageRequest || session.modalKind !== 'goal') return;
    if (!response.ok) throw Error(data.error || 'Search unavailable. Please try again.');
    session.imageResults = page === 1 ? data.results : [...session.imageResults, ...data.results];
    session.imagePage = page;
    renderImageResults(data.more);
    status.textContent = session.imageResults.length
      ? 'Wikimedia Commons'
      : 'No photos found. Try a different search.';
  } catch (error) {
    if (
      error.name !== 'AbortError' &&
      request === session.imageRequest &&
      $('#image-search-status')
    )
      $('#image-search-status').textContent =
        error.message || 'Search unavailable. Please try again.';
  } finally {
    if (request === session.imageRequest && $('#image-search-button'))
      $('#image-search-button').disabled = false;
  }
}
export function selectSearchImage(index) {
  const photo = session.imageResults[index];
  if (!photo) return;
  session.editingImage = photo.image;
  session.editingPhotoCredit = photoCredit(photo);
  $('#photo-preview').src = session.editingImage;
  $('#photo-credit').innerHTML = creditHTML(session.editingPhotoCredit);
  document.querySelectorAll('.image-result').forEach((b, i) => {
    b.classList.toggle('selected', i === index);
    b.setAttribute('aria-pressed', String(i === index));
  });
  $('#image-search-status').textContent = 'Photo selected';
}
export async function processPhoto(file) {
  if (!file) return;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    toast('Choose a JPEG, PNG, or WebP photo.');
    return;
  }
  if (file.size > 15 * 1024 * 1024) {
    toast('Choose a photo smaller than 15 MB.');
    return;
  }
  try {
    const bitmap = await createImageBitmap(file),
      canvas = document.createElement('canvas'),
      ratio = Math.min(1, 900 / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.round(bitmap.width * ratio);
    canvas.height = Math.round(bitmap.height * ratio);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    session.editingImage = canvas.toDataURL('image/jpeg', 0.78);
    session.editingPhotoCredit = null;
    bitmap.close();
    $('#photo-preview').src = session.editingImage;
    $('#photo-credit').innerHTML = '';
    document.querySelectorAll('.image-result').forEach((x) => {
      x.classList.remove('selected');
      x.setAttribute('aria-pressed', 'false');
    });
  } catch {
    toast('This photo could not be opened. Please choose another.');
  }
}
