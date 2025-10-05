/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/**
 * This service provides geocoding functionality using the free Nominatim API.
 * It is designed to be type-safe and has no external dependencies, relying on
 * the built-in `fetch` function available in modern Node.js versions.
 */

// A simple in-memory cache to store results for the lifetime of the application instance.
const cache = new Map<string, { lat: number; lon: number } | null>();

/**
 * Defines the expected structure of a single result from the Nominatim API.
 * We only care about 'lat' and 'lon' for this service.
 */
interface NominatimResult {
  lat: string;
  lon: string;
  // The API returns many other fields, but we can safely ignore them.
}

/**
 * A TypeScript type guard to safely check if an unknown object
 * matches the NominatimResult interface. This avoids unsafe type assertions.
 *
 * @param obj The object to check.
 * @returns True if the object is a valid NominatimResult.
 */
function isNominatimResult(obj: unknown): obj is NominatimResult {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "lat" in obj &&
    typeof (obj as NominatimResult).lat === "string" &&
    "lon" in obj &&
    typeof (obj as NominatimResult).lon === "string"
  );
}

export class GeocodingService {
  /**
   * Pobiera współrzędne dla nazwy przystanku, używając Nominatim API.
   * Wyniki są cachowane, aby unikać wielokrotnych zapytań o to samo miejsce.
   *
   * @param stopName The name of the location to geocode (e.g., "Dworzec Centralny").
   * @returns A promise that resolves to an object with lat/lon coordinates, or null if not found.
   */
  public async geocode(
    stopName: string,
  ): Promise<{ lat: number; lon: number } | null> {
    // 1. Check the cache first to avoid unnecessary network requests.
    if (cache.has(stopName)) {
      return cache.get(stopName) ?? null;
    }

    try {
      // 2. Prepare the API request.
      const userAgent = "HackYeahJakDoczlapie/1.0 (kontakt@solvro.pl)";
      const query = `${stopName}, Poland`;
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
        query,
      )}&format=json`;

      // 3. Perform the network request using the built-in fetch.
      const response = await fetch(url, {
        headers: { "User-Agent": userAgent },
      });

      if (!response.ok) {
        throw new Error(
          `Nominatim API responded with status ${response.status}`,
        );
      }

      // 4. Safely parse and validate the JSON response.
      const results: unknown = await response.json();

      if (Array.isArray(results) && results.length > 0) {
        const firstResult = results[0];

        if (isNominatimResult(firstResult)) {
          const coords = {
            lat: Number.parseFloat(firstResult.lat),
            lon: Number.parseFloat(firstResult.lon),
          };
          cache.set(stopName, coords);
          return coords;
        }
      }

      cache.set(stopName, null);
      return null;
    } catch (error) {
      console.error(`Geocoding failed for query "${stopName}":`, error);
      cache.set(stopName, null);
      return null;
    }
  }

  /**
   * Clears the entire geocoding cache. Useful for testing or long-running processes.
   */
  public clearCache(): void {
    cache.clear();
  }
}
