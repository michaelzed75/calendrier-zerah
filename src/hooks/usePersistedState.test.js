// @ts-check
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import usePersistedState from './usePersistedState';

describe('usePersistedState', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('retourne la valeur par défaut si rien n\'est sauvegardé', () => {
    const { result } = renderHook(() => usePersistedState('test_key', 'defaut'));
    expect(result.current[0]).toBe('defaut');
  });

  it('sauvegarde la valeur dans localStorage quand elle change', () => {
    const { result } = renderHook(() => usePersistedState('test_key', 'defaut'));
    act(() => result.current[1]('nouvelle'));
    expect(result.current[0]).toBe('nouvelle');
    expect(JSON.parse(localStorage.getItem('test_key'))).toBe('nouvelle');
  });

  it('restaure la valeur sauvegardée au montage suivant', () => {
    const first = renderHook(() => usePersistedState('test_key', 'defaut'));
    act(() => first.result.current[1]('persistee'));
    first.unmount();

    const second = renderHook(() => usePersistedState('test_key', 'defaut'));
    expect(second.result.current[0]).toBe('persistee');
  });

  it('supporte les objets et tableaux', () => {
    const { result, unmount } = renderHook(() =>
      usePersistedState('test_obj', { column: 'ecart', direction: 'desc' })
    );
    act(() => result.current[1]({ column: 'client', direction: 'asc' }));
    unmount();

    const { result: restored } = renderHook(() =>
      usePersistedState('test_obj', { column: 'ecart', direction: 'desc' })
    );
    expect(restored.current[0]).toEqual({ column: 'client', direction: 'asc' });
  });

  it('supporte les setters fonctionnels (prev => ...)', () => {
    const { result } = renderHook(() => usePersistedState('test_count', 0));
    act(() => result.current[1](prev => prev + 1));
    act(() => result.current[1](prev => prev + 1));
    expect(result.current[0]).toBe(2);
    expect(JSON.parse(localStorage.getItem('test_count'))).toBe(2);
  });

  it('retombe sur la valeur par défaut si le JSON sauvegardé est corrompu', () => {
    localStorage.setItem('test_key', '{invalide');
    const { result } = renderHook(() => usePersistedState('test_key', 'defaut'));
    expect(result.current[0]).toBe('defaut');
  });
});
