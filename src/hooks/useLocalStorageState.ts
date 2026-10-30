import { useState, useEffect, useCallback } from 'react';

export function useLocalStorageState<T>(key: string, defaultValue: T): [T, (val: T | ((prev: T) => T)) => void] {
  const [state, setState] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      const item = window.localStorage.getItem(key);
      setState(item ? JSON.parse(item) : defaultValue);
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      setState(defaultValue);
    }
  }, [key]); // Re-initialize state if key changes and component stays mounted

  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    setState((prevState) => {
      const newValue = value instanceof Function ? value(prevState) : value;
      try {
        if (newValue === undefined) {
          window.localStorage.removeItem(key);
        } else {
          window.localStorage.setItem(key, JSON.stringify(newValue));
        }
      } catch (error) {
        console.warn(`Error setting localStorage key "${key}":`, error);
      }
      return newValue;
    });
  }, [key]);

  return [state, setValue];
}
