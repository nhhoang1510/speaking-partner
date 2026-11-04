// Day or night in town: by the clock on this device (night from 18:00 to 6:00) unless the learner picks one.
import { createContext } from 'react';

export const Night = createContext(false);
export const isNight = (sky, d = new Date()) => (sky === 'night' ? true : sky === 'day' ? false : d.getHours() >= 18 || d.getHours() < 6);
