# email-scraper-puppeteer-2024
This is a node.js based email scraper.  Start with a csv file of domains and get out email addresses.

# Purpose
Hunter.io has been my goto tool for emails.  However, they've raised their prices such that I no longer feel it is worth it.  Their current plan is $500 for 50,000 credits.

# How This Works
This scraper uses a CSV input file.  

# Usage
node --no-warnings index.js ./[CSV-FILE].csv [URL-COLUMN]

# Example
You have a CSV file with headers.  You have a column titled "website" and a csv file named "gmaps-extracted-data.csv"

node node --no-warnings index.js ./gmaps-extracted-data.csv website

# Notes
This scraper uses Puppeteer.  There are pros and cons to this approach.  The main benefit is that you can get rendered HTML, which will increase the number of emails that we extract.  The downside is that it's resource intensive.
