const STEPPER_ID = 'tfe-stepper';

const STEP_LABELS = ['Detect', 'Set up', 'Analyze', 'Risk map', 'AI review'] as const;

export function injectStepper(onNext: () => void, onBack: () => void): void {
  if (document.getElementById(STEPPER_ID)) return;

  const bar = document.createElement('div');
  bar.id = STEPPER_ID;
  bar.setAttribute('role', 'navigation');
  bar.setAttribute('aria-label', 'Analysis steps');

  const stepsEl = document.createElement('div');
  stepsEl.className = 'tfe-stepper-steps';

  for (let i = 0; i < STEP_LABELS.length; i++) {
    if (i > 0) {
      const line = document.createElement('span');
      line.className = 'tfe-stepper-line';
      line.setAttribute('aria-hidden', 'true');
      stepsEl.appendChild(line);
    }
    const step = document.createElement('div');
    step.className = 'tfe-stepper-step tfe-step-pending';
    step.dataset.step = String(i + 1);

    const circle = document.createElement('span');
    circle.className = 'tfe-stepper-circle';
    circle.textContent = String(i + 1);

    const label = document.createElement('span');
    label.className = 'tfe-stepper-label';
    label.textContent = STEP_LABELS[i];

    step.appendChild(circle);
    step.appendChild(label);
    stepsEl.appendChild(step);
  }

  const buttonsEl = document.createElement('div');
  buttonsEl.className = 'tfe-stepper-buttons';

  const backBtn = document.createElement('button');
  backBtn.className = 'tfe-stepper-btn tfe-stepper-back';
  backBtn.textContent = 'Back';
  backBtn.setAttribute('aria-label', 'Go to previous step');
  backBtn.addEventListener('click', onBack);

  const nextBtn = document.createElement('button');
  nextBtn.className = 'tfe-stepper-btn tfe-stepper-next';
  nextBtn.setAttribute('aria-label', 'Go to next step');
  const nextText = document.createTextNode('Next step ');
  const nextArrow = document.createElement('span');
  nextArrow.setAttribute('aria-hidden', 'true');
  nextArrow.textContent = '→';
  nextBtn.appendChild(nextText);
  nextBtn.appendChild(nextArrow);
  nextBtn.addEventListener('click', onNext);

  buttonsEl.appendChild(backBtn);
  buttonsEl.appendChild(nextBtn);
  bar.appendChild(stepsEl);
  bar.appendChild(buttonsEl);
  document.body.appendChild(bar);
}

export function setStepperStep(active: 1 | 2 | 3 | 4 | 5, completedUpTo: number): void {
  const bar = document.getElementById(STEPPER_ID);
  if (!bar) return;

  bar.querySelectorAll<HTMLElement>('.tfe-stepper-step').forEach((el) => {
    const n = Number(el.dataset.step);
    const circle = el.querySelector<HTMLElement>('.tfe-stepper-circle');
    el.classList.remove('tfe-step-active', 'tfe-step-complete', 'tfe-step-pending');
    if (n <= completedUpTo) {
      el.classList.add('tfe-step-complete');
      if (circle) circle.textContent = '✓';
    } else if (n === active) {
      el.classList.add('tfe-step-active');
      if (circle) circle.textContent = String(n);
    } else {
      el.classList.add('tfe-step-pending');
      if (circle) circle.textContent = String(n);
    }
  });

  const backBtn = bar.querySelector<HTMLButtonElement>('.tfe-stepper-back');
  const nextBtn = bar.querySelector<HTMLButtonElement>('.tfe-stepper-next');
  if (backBtn) backBtn.disabled = active === 1;
  if (nextBtn) nextBtn.disabled = active === 5;
}

export function removeStepper(): void {
  document.getElementById(STEPPER_ID)?.remove();
}
