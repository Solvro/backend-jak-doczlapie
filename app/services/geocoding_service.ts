/* eslint-disable @typescript-eslint/strict-boolean-expressions */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import fetch from "node-fetch";

// Prosta pamięć podręczna na czas trwania jednego żądania
const cache = new Map<string, { lat: number; lon: number } | null>();

export class GeocodingService {
  /**
   * Pobiera współrzędne dla nazwy przystanku, używając Nominatim API.
   * Wyniki są cachowane, aby unikać wielokrotnych zapytań o to samo miejsce.
   */
  public async geocode(
    stopName: string,
  ): Promise<{ lat: number; lon: number } | null> {
    if (cache.has(stopName)) {
      return cache.get(stopName) ?? null;
    }

    try {
      // Nominatim wymaga unikalnego User-Agenta
      const userAgent = "HackYeahJakDoczlapie/1.0 (kontakt@solvro.pl)";
      const query = `${stopName}, Poland`; // Dodajemy kontekst, aby poprawić wyniki
      const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json`;

      const response = await fetch(url, {
        headers: { "User-Agent": userAgent },
      });

      if (!response.ok) {
        throw new Error(
          `Nominatim API responded with status ${response.status}`,
        );
      }

      const results = (await response.json()) as [{ lat: string; lon: string }];

      if (results.length > 0) {
        const { lat, lon } = results[0];
        const coords = {
          lat: Number.parseFloat(lat),
          lon: Number.parseFloat(lon),
        };
        cache.set(stopName, coords);
        return coords;
      }

      cache.set(stopName, null);
      return null;
    } catch (error) {
      console.error(`Geocoding failed for stop "${stopName}":`, error);
      cache.set(stopName, null);
      return null;
    }
  }

  public clearCache() {
    cache.clear();
  }
}
