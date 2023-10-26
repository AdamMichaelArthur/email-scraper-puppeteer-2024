/* An Email Scraper */

import CsvImport from './csv-import.mjs';
import ScrapeJob from './scrape-job.mjs';

import { EventEmitter } from 'events';
EventEmitter.defaultMaxListeners = 100;  // or any other number you deem appropriate

const [,, csvFile, domain] = process.argv;

if (!csvFile || !domain) {
  console.error('Usage: node index.mjs <path_to_csv_file.csv> <domain>');
  process.exit(1);
}

const CONCURRENCY = 20;
const TIMEOUT_DURATION = 5 * 60 * 1000; // 7 minutes in milliseconds

function timeout(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms));
}

async function withTimeout(promise, ms) {
  try {
    return await Promise.race([promise, timeout(ms)]);
  } catch (error) {
    if (error.message === 'Timeout') {
      console.log('Operation timed out');
    }
    throw error;
  }
}

async function main() {
  const csvImport = new CsvImport(csvFile);
  await csvImport.init();
  
  console.log(`Data loaded from ${csvFile}`);
  console.log(`Domain provided: ${domain}`);
  
  let websiteUrls = csvImport.getColumnByName(domain);
  let emails = csvImport.getColumnByName('email');
  let count = 0;

  const chunks = [];
  for (let i = 0; i < websiteUrls.length; i += CONCURRENCY) {
    chunks.push(websiteUrls.slice(i, i + CONCURRENCY));
  }

  for (const chunk of chunks) {
    const chunkPromises = chunk.map(async (websiteUrl, index) => {
      const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;

      if(emails[count] == 'none found' || emailRegex.test(emails[count])) {
        count++;
        console.log("Valid email or already searched", websiteUrl);
        return null; // Return early for this URL
      } else {
        count++;
      }

      if (!websiteUrl || websiteUrl.trim() === '' || typeof websiteUrl !== 'string') {
        //console.warn(`Skipped invalid URL: ${websiteUrl}`);
        return null; // Return early for this URL
      }

      try {
        const job = new ScrapeJob(websiteUrl);
        await job.init();
        const result = await withTimeout(job.crawl(), TIMEOUT_DURATION);
        await job.close();
        return {
          websiteUrl,
          emails: result.emails.join('|'),
          socialMedia: result.socialMediaLinks.join('|')
        };
      } catch(err){
        console.log(62, err);
        return {
          websiteUrl,
          emails: 'retry',
          socialMedia: ''
        }
      }
    });

    const chunkResults = await Promise.all(chunkPromises);

    for (const result of chunkResults) {
      if (result) { // Ensure the result isn't null from our early returns
        console.log("Emails:", result.websiteUrl, result.emails);
        if(result.emails.includes("none found")){
          // This line already has been searched
          continue;
        }
        await csvImport.updateAndSaveRow(result.websiteUrl, {
          emails: result.emails,
          socialMedia: result.socialMedia
        });
      }
    }
  }

  console.log(104, "All Chunks Finished");
  process.exit(1);
}

main().catch(error => {
  console.error(74, 'An error occurred:', error);
});
