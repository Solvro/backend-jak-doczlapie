// commands/scrape_epodroznik.ts
import fs from "fs/promises";
import puppeteer, { Page } from "puppeteer";

import { BaseCommand } from "@adonisjs/core/ace";
import type { CommandOptions } from "@adonisjs/core/types/ace";

import RoutesController from "#controllers/routes_controller";
import { GeocodingService } from "#services/geocoding_service";

// Define a type for the scraped data for better type safety
interface ScheduleData {
  route: string;
  operator: string;
  type: "bus";
  conditions: string[];
  direction: string;
  run: number;
  stops: { name: string; time: string }[];
}

export default class ScrapeEPodroznik extends BaseCommand {
  static commandName = "scrape:epodroznik";
  static description = "Scrapes bus schedules from e-podroznik.pl";

  static options: CommandOptions = {
    startApp: true,
    allowUnknownFlags: false,
  };

  /**
   * Helper function to scrape all departure hours for the currently active view (route or sub-route).
   * This logic is encapsulated to be reused for pages with and without .seoIndexBunchLink.
   */
  async scrapeHoursForView(
    page: Page,
    routeName: string,
    operatorName: string,
  ): Promise<ScheduleData[]> {
    const results: ScheduleData[] = [];
    try {
      // Wait for the dynamic content (hour buttons) to load
      await page.waitForSelector("#innerFirstStopHoursContainer > div", {
        timeout: 15000,
      });

      // Get all hour button handles to click them one by one
      const hourHandles = await page.$$("#innerFirstStopHoursContainer > div");

      // Get schedule conditions (legend) for this specific view
      const conditions = await page
        .$eval("#connectionLegendContainer", (el) => {
          const text = el.textContent || "";
          return text
            .replace("Legenda:", "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
        })
        .catch(() => []); // Handle cases where legend is not present

      // Iterate over each hour/run for the current route view
      console.log(hourHandles.length);
      for (let i = 0; i < hourHandles.length; i++) {
        // We need to re-fetch handles in each iteration as clicks can cause the DOM to re-render
        const currentHourHandles = await page.$$(
          "#innerFirstStopHoursContainer > div",
        );
        if (!currentHourHandles[i]) continue; // Skip if the handle is no longer valid

        await currentHourHandles[i].click();

        // Wait for the AJAX call to complete and update the table
        await page.waitForSelector("#stopsInTimeContentContainer", {
          timeout: 5000,
        });

        const runData = await page.$eval(
          "#stopsInTimeContentContainer",
          (tableContainer, rName, oName, conds, runId) => {
            const stops: { name: string; time: string }[] = [];
            const rows = tableContainer.querySelectorAll("tbody tr");

            for (const row of rows) {
              const cells = row.querySelectorAll("td");
              if (cells.length < 4) continue;

              const stopName = (cells[0].textContent || "")
                .replace(/\d+\.\s*/, "")
                .trim();
              let departureTime = (cells[2].textContent || "").trim();
              if (departureTime === "---") {
                departureTime = (cells[1].textContent || "").trim();
              }

              if (stopName && departureTime) {
                stops.push({
                  name: stopName,
                  time: departureTime,
                  conditions: conds,
                });
              }
            }
            const regexToRemove = /\s*\(Zobacz rozkład jazdy na trasie.*\)/;
            const cleanedRName = rName.replace(regexToRemove, "").trim();

            return {
              route: cleanedRName,
              operator: oName,
              type: "bus",
              direction: cleanedRName.split(" - ")[1] || cleanedRName,
              run: runId,
              stops: stops,
            };
          },
          routeName,
          operatorName,
          conditions,
          i,
        );
        results.push(runData);
        const geocodingService = new GeocodingService();
        console.log(runData);
        await RoutesController.processRoutesPayload(
          [runData],
          geocodingService,
        );
        // here send to routes controller
        this.logger.success(
          `--- Scraped run ${i + 1}/${hourHandles.length} for route: ${routeName}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error scraping hours for ${routeName}: ${error.message}`,
      );
    }
    return results;
  }

  public async run(): Promise<void> {
    this.logger.info("Starting the scraper...");
    const finalResults: ScheduleData[] = [];

    const browser = await puppeteer.launch({
      headless: false, // Set to true for production, false for debugging
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/5.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    );
    page.setDefaultNavigationTimeout(60000);

    try {
      const mainUrl = "https://www.e-podroznik.pl/rozklad-jazdy-pks-autobusy";
      await page.goto(mainUrl);
      this.logger.info(`Navigating to ${mainUrl}`);

      const carriers = await page.$$eval("#seoCarriers a", (links) =>
        links.map((link) => ({
          href: (link as HTMLAnchorElement).href,
          name: link.getAttribute("title") || "",
        })),
      );
      this.logger.info(`Found ${carriers.length} carriers.`);

      for (const carrier of carriers) {
        this.logger.info(`Processing carrier: ${carrier.name}`);
        await page.goto(carrier.href);
        await page.waitForSelector(".section-5 a", { timeout: 15000 });

        const routes = await page.$$eval(".section-5 a", (links) =>
          links.map((link) => ({
            href: (link as HTMLAnchorElement).href,
            name: link.getAttribute("title") || "",
          })),
        );
        this.logger.info(`Found ${routes.length} routes for ${carrier.name}.`);

        for (const route of routes) {
          try {
            this.logger.info(`-- Processing route: ${route.name}`);
            await page.goto(route.href);

            // **NEW LOGIC**: Check for sub-route links (.seoIndexBunchLink)
            const subRouteLinks = await page.$$(".seoIndexBunchLink");

            if (subRouteLinks.length > 0) {
              this.logger.info(
                `Found ${subRouteLinks.length} sub-routes. Iterating...`,
              );
              for (let i = 0; i < subRouteLinks.length; i++) {
                // Re-fetch the links on each iteration to avoid stale element references
                const currentSubRouteLinks =
                  await page.$$(".seoIndexBunchLink");
                if (!currentSubRouteLinks[i]) continue;

                const subRouteName = await currentSubRouteLinks[i].evaluate(
                  (el) => el.textContent?.trim() || `Sub-route ${i + 1}`,
                );
                this.logger.info(`---- Clicking sub-route: ${subRouteName}`);

                await currentSubRouteLinks[i].click();

                // Scrape all hours for this clicked sub-route view
                const scrapedData = await this.scrapeHoursForView(
                  page,
                  `${route.name} (${subRouteName})`,
                  carrier.name,
                );
                finalResults.push(...scrapedData);
              }
            } else {
              // **ORIGINAL LOGIC**: No sub-routes found, scrape the main view directly
              this.logger.info("No sub-routes found. Processing main view.");
              const scrapedData = await this.scrapeHoursForView(
                page,
                route.name,
                carrier.name,
              );
              finalResults.push(...scrapedData);
            }
          } catch (error) {
            this.logger.error(
              `Failed to process route ${route.name}: ${error.message}`,
            );
          }
        }
      }
    } catch (error) {
      this.logger.error(`A critical error occurred: ${error}`);
    } finally {
      this.logger.info("Scraping finished. Writing results to file...");
      await fs.writeFile(
        "scraped_schedules.json",
        JSON.stringify(finalResults, null, 2),
      );
      this.logger.success("Data successfully saved to scraped_schedules.json");
      await browser.close();
      this.logger.info("Browser closed.");
    }
  }
}
