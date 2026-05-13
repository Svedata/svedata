export type CityCoords = {
  name: string;
  latitude: number;
  longitude: number;
};

export const CITIES: Record<string, CityCoords> = {
  stockholm: { name: 'Stockholm', latitude: 59.3293, longitude: 18.0686 },
  goteborg: { name: 'Göteborg', latitude: 57.7089, longitude: 11.9746 },
  malmo: { name: 'Malmö', latitude: 55.6049, longitude: 13.0038 },
  uppsala: { name: 'Uppsala', latitude: 59.8586, longitude: 17.6389 },
  linkoping: { name: 'Linköping', latitude: 58.4108, longitude: 15.6214 },
  vasteras: { name: 'Västerås', latitude: 59.6099, longitude: 16.5448 },
  orebro: { name: 'Örebro', latitude: 59.2753, longitude: 15.2134 },
  helsingborg: { name: 'Helsingborg', latitude: 56.0465, longitude: 12.6945 },
  norrkoping: { name: 'Norrköping', latitude: 58.5877, longitude: 16.1924 },
  jonkoping: { name: 'Jönköping', latitude: 57.7826, longitude: 14.1618 },
  umea: { name: 'Umeå', latitude: 63.8258, longitude: 20.263 },
  lund: { name: 'Lund', latitude: 55.7047, longitude: 13.191 },
  gavle: { name: 'Gävle', latitude: 60.6749, longitude: 17.1413 },
  boras: { name: 'Borås', latitude: 57.721, longitude: 12.9401 },
  sundsvall: { name: 'Sundsvall', latitude: 62.3908, longitude: 17.3069 },
  lulea: { name: 'Luleå', latitude: 65.5848, longitude: 22.1547 },
  kiruna: { name: 'Kiruna', latitude: 67.8558, longitude: 20.2253 },
};

const NORMALIZE_MAP: Record<string, string> = {
  ä: 'a',
  å: 'a',
  ö: 'o',
  é: 'e',
  ü: 'u',
};

export function normalizeCityKey(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .split('')
    .map((c) => NORMALIZE_MAP[c] ?? c)
    .join('')
    .replace(/[^a-z]/g, '');
}

export function findCity(input: string): CityCoords | null {
  const key = normalizeCityKey(input);
  return CITIES[key] ?? null;
}
