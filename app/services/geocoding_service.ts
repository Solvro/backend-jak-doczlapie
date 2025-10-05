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
      // Nominatim requires a unique User-Agent.
      const userAgent = "HackYeahJakDoczlapie/1.0 (kontakt@solvro.pl)";
      const query = `${stopName}, Poland`; // Adding context improves search results.
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
        query,
      )}&format=json`;

      // 3. Perform the network request using the built-in fetch.
      const response = await fetch(url, {
        headers: { "User-Agent": userAgent },
      });

      if (!response.ok) {
        // Handle non-successful HTTP responses (e.g., 404, 500).
        throw new Error(
          `Nominatim API responded with status ${response.status}`,
        );
      }

      // 4. Safely parse and validate the JSON response.
      const results: unknown = await response.json();

      // Check if the response is an array with at least one item.
      if (Array.isArray(results) && results.length > 0) {
        const firstResult = results[0];

        // Use our type guard to ensure the first item has the data we need.
        if (isNominatimResult(firstResult)) {
          const coords = {
            lat: Number.parseFloat(firstResult.lat),
            lon: Number.parseFloat(firstResult.lon),
          };

          // Cache the successful result and return it.
          cache.set(stopName, coords);
          return coords;
        }
      }

      // If no valid results were found, cache null and return it.
      cache.set(stopName, null);
      return null;
    } catch (error) {
      // 5. Handle any errors during the process.
      console.error(`Geocoding failed for stop "${stopName}":`, error);
      // Cache the failure so we don't repeatedly try a failing query.
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
