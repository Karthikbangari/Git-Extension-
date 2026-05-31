// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { injectStepper, setStepperStep, removeStepper } from '../src/content/stepper';

describe('stepper.injectStepper', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('injects stepper bar into document body', () => {
    injectStepper(
      () => {},
      () => {}
    );
    expect(document.getElementById('tfe-stepper')).not.toBeNull();
  });

  it('renders 5 step indicators', () => {
    injectStepper(
      () => {},
      () => {}
    );
    expect(document.querySelectorAll('.tfe-stepper-step')).toHaveLength(5);
  });

  it('renders Back and Next step buttons', () => {
    injectStepper(
      () => {},
      () => {}
    );
    expect(document.querySelector('.tfe-stepper-back')).not.toBeNull();
    expect(document.querySelector('.tfe-stepper-next')).not.toBeNull();
  });

  it('does not inject a second stepper if one already exists', () => {
    injectStepper(
      () => {},
      () => {}
    );
    injectStepper(
      () => {},
      () => {}
    );
    expect(document.querySelectorAll('#tfe-stepper')).toHaveLength(1);
  });

  it('calls onNext when Next step is clicked', () => {
    const onNext = vi.fn();
    injectStepper(onNext, () => {});
    document.querySelector<HTMLButtonElement>('.tfe-stepper-next')!.click();
    expect(onNext).toHaveBeenCalledOnce();
  });

  it('calls onBack when Back is clicked', () => {
    const onBack = vi.fn();
    injectStepper(() => {}, onBack);
    document.querySelector<HTMLButtonElement>('.tfe-stepper-back')!.click();
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('renders step labels', () => {
    injectStepper(
      () => {},
      () => {}
    );
    const labels = [...document.querySelectorAll('.tfe-stepper-label')].map((el) => el.textContent);
    expect(labels).toEqual(['Detect', 'Set up', 'Analyze', 'Risk map', 'AI review']);
  });
});

describe('stepper.setStepperStep', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    injectStepper(
      () => {},
      () => {}
    );
  });

  it('Back button is disabled at step 1', () => {
    setStepperStep(1, 0);
    expect(document.querySelector<HTMLButtonElement>('.tfe-stepper-back')!.disabled).toBe(true);
  });

  it('Back button is enabled at step 2', () => {
    setStepperStep(2, 1);
    expect(document.querySelector<HTMLButtonElement>('.tfe-stepper-back')!.disabled).toBe(false);
  });

  it('Next step button is disabled at step 5', () => {
    setStepperStep(5, 4);
    expect(document.querySelector<HTMLButtonElement>('.tfe-stepper-next')!.disabled).toBe(true);
  });

  it('Next step button is enabled at step 4', () => {
    setStepperStep(4, 3);
    expect(document.querySelector<HTMLButtonElement>('.tfe-stepper-next')!.disabled).toBe(false);
  });

  it('step 1 is active, others pending at setStepperStep(1, 0)', () => {
    setStepperStep(1, 0);
    const steps = document.querySelectorAll('.tfe-stepper-step');
    expect(steps[0].classList.contains('tfe-step-active')).toBe(true);
    expect(steps[1].classList.contains('tfe-step-pending')).toBe(true);
    expect(steps[4].classList.contains('tfe-step-pending')).toBe(true);
  });

  it('step 1 complete, step 2 active at setStepperStep(2, 1)', () => {
    setStepperStep(2, 1);
    const steps = document.querySelectorAll('.tfe-stepper-step');
    expect(steps[0].classList.contains('tfe-step-complete')).toBe(true);
    expect(steps[1].classList.contains('tfe-step-active')).toBe(true);
    expect(steps[2].classList.contains('tfe-step-pending')).toBe(true);
  });

  it('shows ✓ for completed steps', () => {
    setStepperStep(3, 2);
    const circles = document.querySelectorAll('.tfe-stepper-circle');
    expect(circles[0].textContent).toBe('✓');
    expect(circles[1].textContent).toBe('✓');
    expect(circles[2].textContent).toBe('3');
    expect(circles[3].textContent).toBe('4');
  });

  it('shows step number (not ✓) for active step', () => {
    setStepperStep(4, 3);
    const circles = document.querySelectorAll('.tfe-stepper-circle');
    expect(circles[3].textContent).toBe('4');
  });

  it('all 4 steps complete at step 5', () => {
    setStepperStep(5, 4);
    const steps = document.querySelectorAll('.tfe-stepper-step');
    for (let i = 0; i < 4; i++) {
      expect(steps[i].classList.contains('tfe-step-complete')).toBe(true);
    }
    expect(steps[4].classList.contains('tfe-step-active')).toBe(true);
  });
});

describe('stepper.removeStepper', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('removes stepper from DOM', () => {
    injectStepper(
      () => {},
      () => {}
    );
    removeStepper();
    expect(document.getElementById('tfe-stepper')).toBeNull();
  });

  it('is safe to call when stepper is not in DOM', () => {
    expect(() => removeStepper()).not.toThrow();
  });
});
