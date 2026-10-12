import { act, createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SkillHotbarSlot } from './SkillHotbarSlot';

vi.mock('next/image', () => ({ default: ({ src, alt }: { src: string; alt: string }) => createElement('img', { src, alt }) }));

const skill = { id: 'test-skill', name: 'Vital Strike', manaCost: 10, cooldown: 60, lastUsed: '2026-10-11T08:00:00.000Z' };
beforeEach(() => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-11T08:00:01.000Z'));
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
});
afterEach(() => vi.useRealTimers());

describe('Hotbar cooldown hydration', () => {
    it('renders identical initial markup despite server/client clock drift', () => {
        const element = createElement(SkillHotbarSlot, { slotNumber: 1, skill, currentMana: 100, onActivate: vi.fn() });
        const serverMarkup = renderToString(element);
        vi.advanceTimersByTime(8000);
        expect(renderToString(element)).toBe(serverMarkup);
    });
    it('blocks activation before the first timer update and allows it after expiry', async () => {
        const activate = vi.fn();
        const element = createElement(SkillHotbarSlot, { slotNumber: 1, skill, currentMana: 100, onActivate: activate });
        const container = document.createElement('div');
        container.innerHTML = renderToString(element);
        document.body.appendChild(container);
        let root: Root | undefined;
        try {
            await act(async () => { root = hydrateRoot(container, element); });
            act(() => { container.querySelector('div')!.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
            expect(activate).not.toHaveBeenCalled();
            act(() => { vi.advanceTimersByTime(60_000); });
            act(() => { container.querySelector('div')!.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
            expect(activate).toHaveBeenCalledWith(skill.id);
        } finally {
            act(() => root?.unmount()); container.remove();
        }
    });
});
