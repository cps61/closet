import { CATEGORIES } from './categories.js';

const prefersReducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

/** Opens a <dialog> sheet. Escape and backdrop taps call `onDismiss`. */
export function setupSheet(dialog, onDismiss) {
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    onDismiss();
  });
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) onDismiss(); // tap on the backdrop
  });
}

export function openSheet(dialog) {
  dialog.classList.remove('closing');
  if (!dialog.open) dialog.showModal();
}

/** Plays the slide-down animation, then closes. */
export function closeSheet(dialog) {
  if (!dialog.open) return Promise.resolve();
  if (prefersReducedMotion.matches) {
    dialog.close();
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const finish = () => {
      clearTimeout(fallback);
      dialog.removeEventListener('animationend', onEnd);
      dialog.classList.remove('closing');
      dialog.close();
      resolve();
    };
    const onEnd = (event) => {
      if (event.target === dialog) finish();
    };
    const fallback = setTimeout(finish, 400);
    dialog.addEventListener('animationend', onEnd);
    dialog.classList.add('closing');
  });
}

/**
 * Builds a single-select row of category chips in `container`.
 * With `includeAll`, an "All" chip maps to `null`.
 */
export function createCategoryChips(container, { includeAll = false, initial = null, onChange = () => {} } = {}) {
  const options = [...(includeAll ? [{ id: null, label: 'All' }] : []), ...CATEGORIES];
  let selected = initial;

  const buttons = options.map((option) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chip';
    button.textContent = option.label;
    button.addEventListener('click', () => {
      if (selected === option.id) return;
      selected = option.id;
      update();
      onChange(selected);
    });
    return [option.id, button];
  });

  function update() {
    for (const [id, button] of buttons) button.setAttribute('aria-pressed', String(id === selected));
  }

  container.replaceChildren(...buttons.map(([, button]) => button));
  update();

  return {
    get value() {
      return selected;
    },
    set(id) {
      selected = id;
      update();
    },
  };
}
