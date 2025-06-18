// Finn Scraper v0.2 - Added Discord webhook notification

require("dotenv").config();

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const express = require("express");
const fs = require("fs");
const axios = require("axios");
const cheerio = require("cheerio");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 8080;
const SEARCH_FILE = "searches.json";
const RESULTS_FILE = "results.json";

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

function loadSearches() {
  if (!fs.existsSync(SEARCH_FILE)) fs.writeFileSync(SEARCH_FILE, "[]");
  return JSON.parse(fs.readFileSync(SEARCH_FILE));
}

function saveSearches(searches) {
  fs.writeFileSync(SEARCH_FILE, JSON.stringify(searches, null, 2));
}

function saveResults(results) {
  fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
}

function loadResults() {
  if (!fs.existsSync(RESULTS_FILE)) fs.writeFileSync(RESULTS_FILE, "[]");
  return JSON.parse(fs.readFileSync(RESULTS_FILE));
}

async function scrapeFinn(url) {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.endsWith("finn.no")) {
      console.warn("Skipped invalid URL (not finn.no):", url);
      return [];
    }
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);
    const items = [];

    $("article.sf-search-ad").each((_, el) => {
      const title = $(el).find("h2 > a.sf-search-ad-link").text().trim();
      const link = $(el).find("h2 > a.sf-search-ad-link").attr("href");
      const price = $(el).find("div.mb-4 > span.t3.font-bold").text().trim();
      
      if (title && link) {
        items.push({
          title,
          price,
          link: link.startsWith("http") ? link : `https://www.finn.no${link}`,
          url
        });
      }
    });

    console.log(`Scraped ${items.length} items from ${url}`);

    return items;
  } catch (err) {
    console.error("Error scraping:", err.message);
    return [];
  }
}

async function runScraper() {
  const searches = loadSearches();
  const previousResults = loadResults();
  const previousLinks = new Set(previousResults.map((r) => r.link));

  let allResults = [];
  let newListings = [];

  for (const entry of searches) {
    const results = await scrapeFinn(entry.url);
    const enriched = results.map((r) => ({
      ...r,
      searchUrl: entry.url,
      searchName: entry.name,
    }));

    for (const result of enriched) {
      if (!previousLinks.has(result.link)) {
        newListings.push(result);
      }
    }

    allResults = allResults.concat(enriched);
  }

  if (newListings.length > 0 && DISCORD_WEBHOOK_URL) {
    for (const listing of newListings) {
      await sendDiscordNotification(listing);
    }
  }

  saveResults(allResults);
  console.log("Scraped total", allResults.length, "results");
}

async function sendDiscordNotification(listing) {
  const message = {
    content: `🆕 **${listing.searchName || "New Listing"}**
**${listing.title}** - ${listing.price || "No price"}
🔗 <${listing.link}>`,
  };

  try {
    await axios.post(DISCORD_WEBHOOK_URL, message);
    console.log("🔔 Sent to Discord:", listing.title);
  } catch (err) {
    console.error("❌ Failed to send Discord alert:", err.message);
  }
}

setInterval(runScraper, 10 * 60 * 1000);
runScraper();

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/searches", (req, res) => {
  res.json(loadSearches());
});

app.post("/add", (req, res) => {
  let url = req.body.url?.trim();
  let name = req.body.name?.trim();
  try {
    if (url && !url.startsWith("http")) url = "https://" + url;
    const parsed = new URL(url);
    if (!parsed.hostname.endsWith("finn.no")) {
      return res.status(400).send("URL must be from finn.no");
    }
  } catch {
    return res.status(400).send("Invalid URL");
  }

  if (!name) name = "Search #" + Math.floor(Math.random() * 1000);

  const searches = loadSearches();
  if (!searches.find((s) => s.url === url)) {
    searches.push({ name, url });
    saveSearches(searches);
  }
  res.redirect("/");
});

app.post("/remove", (req, res) => {
  const url = req.body.url;
  const searches = loadSearches().filter((s) => s.url !== url);
  saveSearches(searches);
  res.redirect("/");
});

app.get("/status", (req, res) => {
  res.json(loadResults());
});

app.post("/run", async (req, res) => {
  await runScraper();
  const results = loadResults();
  res.json({ count: results.length });
});

app.listen(PORT, () => console.log(`🟢 Finn Scraper running on port ${PORT}`));
