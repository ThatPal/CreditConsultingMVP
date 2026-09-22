const $ = (selector) => document.querySelector(selector);
document.querySelectorAll('.switch').forEach((button) =>
  button.addEventListener('click', () => {
    const enabled = button.getAttribute('aria-checked') !== 'true';
    button.setAttribute('aria-checked', String(enabled));
    $('#switch-status').textContent =
      `${button.getAttribute('aria-label')}: ${enabled ? 'on' : 'off'}. Preview only.`;
  }),
);
document.querySelectorAll('.navigation-sample button').forEach((button) =>
  button.addEventListener('click', () => {
    document.querySelectorAll('.navigation-sample button').forEach((item) => {
      item.setAttribute('aria-pressed', String(item === button));
      item.querySelector('span').hidden = item !== button;
    });
  }),
);
document.querySelectorAll('[data-period]').forEach((button) =>
  button.addEventListener('click', () => {
    document
      .querySelectorAll('[data-period]')
      .forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
    const year = button.dataset.period === '12';
    const line = year
      ? 'M0 160L55 150L109 156L164 139L218 142L273 123L327 130L382 106L436 89L491 79L545 60L600 35'
      : 'M0 145L120 119L240 130L360 86L480 67L600 35';
    $('#chart-line').setAttribute('d', line);
    $('#chart-area').setAttribute('d', line + 'V180H0Z');
    $('#chart-caption').textContent = `sample score · last ${button.dataset.period} months`;
    $('#chart-months').innerHTML = (
      year ? ['Oct', 'Dec', 'Feb', 'Apr', 'Jun', 'Sep'] : ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep']
    )
      .map((month) => `<span>${month}</span>`)
      .join('');
    $('.trend-chart').setAttribute(
      'aria-label',
      year
        ? 'Illustrative twelve-month score history, from 660 to 732.'
        : 'Illustrative score history: 684, 696, 691, 711, 719, 732',
    );
  }),
);
let toastTimer;
function toast(message) {
  $('#toast').textContent = message;
  $('#toast').classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 3500);
}
document
  .querySelectorAll('[data-toast]')
  .forEach((button) => button.addEventListener('click', () => toast(button.dataset.toast)));
document
  .querySelectorAll('[data-color]')
  .forEach((button) =>
    button.addEventListener('click', () =>
      toast(`${button.dataset.color} · ${button.textContent.trim().split('#')[0]} palette sample`),
    ),
  );
document.querySelectorAll('[data-score]').forEach((button) =>
  button.addEventListener('click', () => {
    document.querySelectorAll('[data-score]').forEach((b) => {
      b.classList.toggle('selected', b === button);
      b.setAttribute('aria-pressed', String(b === button));
    });
    $('#score').textContent = button.dataset.score;
    $('#score-bureau').textContent = `${button.dataset.bureau} · illustrative score`;
    const pct = (Number(button.dataset.score) - 300) / 550;
    $('.gauge-fill').style.strokeDasharray = `${pct * 100} 100`;
    const angle = Math.PI * (1 - pct);
    $('.gauge-pointer').setAttribute('cx', String(125 + 100 * Math.cos(angle)));
    $('.gauge-pointer').setAttribute('cy', String(130 - 100 * Math.sin(angle)));
  }),
);
$('#glow').addEventListener('input', (e) => {
  document.documentElement.style.setProperty('--glow', Number(e.target.value) / 100);
  $('#glow-value').textContent = e.target.value + '%';
});
$('#sample-form').addEventListener('submit', (e) => {
  e.preventDefault();
  if (!$('#goal').value.trim()) {
    $('#goal').setCustomValidity('Enter a milestone to try this example.');
    $('#goal').reportValidity();
    return;
  }
  $('#form-status').textContent = 'Example saved for this preview only.';
  toast('Example saved in this page. Your account is unchanged.');
});
$('#goal').addEventListener('input', () => {
  $('#goal').setCustomValidity('');
  $('#form-status').textContent = 'Demo only · Nothing is saved to your account';
});
const tabs = [...document.querySelectorAll('[data-tab]')];
function selectTab(button) {
  tabs.forEach((b) => {
    const active = b === button;
    b.setAttribute('aria-selected', String(active));
    b.tabIndex = active ? 0 : -1;
    $('#sample-' + b.dataset.tab).hidden = !active;
  });
}
tabs.forEach((b, i) => {
  b.addEventListener('click', () => selectTab(b));
  b.addEventListener('keydown', (e) => {
    let index;
    if (e.key === 'ArrowRight') index = (i + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') index = (i + tabs.length - 1) % tabs.length;
    else if (e.key === 'Home') index = 0;
    else if (e.key === 'End') index = tabs.length - 1;
    else return;
    e.preventDefault();
    selectTab(tabs[index]);
    tabs[index].focus();
  });
});
const dialog = $('#detail-dialog');
const copy = {
  score: [
    'A score with its source.',
    'The sample score belongs to the selected bureau and illustrative model. This preview shows how a supplied range, context and details can feel clear and welcoming.',
  ],
  review: [
    'Your review, in one place.',
    'A comfortable overlay for a focused task. Blue and violet create hierarchy, while soft borders keep the content calm and readable.',
  ],
  assessment: [
    'Space for thoughtful guidance.',
    'A light focus area gives consultant interpretation a distinct place. Teal leads on the light surface; blue and violet remain supporting colors. This is sample copy, not credit advice.',
  ],
  document: [
    'Source evidence, easy to find.',
    'Document previews would open here with clear source details and accessible controls. This isolated page does not load or upload real documents.',
  ],
};
document.querySelectorAll('[data-open]').forEach((button) =>
  button.addEventListener('click', () => {
    const [title, body] = copy[button.dataset.open];
    $('#dialog-title').textContent = title;
    $('#dialog-copy').textContent = body;
    dialog.showModal();
  }),
);
$('#close-dialog').addEventListener('click', () => dialog.close());
$('#dialog-done').addEventListener('click', () => dialog.close());
$('#dialog-action').addEventListener('click', () => {
  dialog.close();
  toast('Preview interaction only — no design approval recorded.');
});
