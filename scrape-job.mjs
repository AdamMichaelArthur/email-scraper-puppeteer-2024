import puppeteer from 'puppeteer';
import { JSDOM, VirtualConsole } from 'jsdom';

var virtualConsole = new VirtualConsole();

export default class ScrapeJob {

  blockedByCloudflare = [];

  constructor(url) {
    this.url = url;
    this.browser = null;
    this.page = null;
    this.visitedUrls = new Set();
  }

  async init() {
    // Launch a new browser instance
    this.browser = await puppeteer.launch({ headless: "new", ignoreHTTPSErrors: true });

    // Open a new page
    this.page = await this.browser.newPage();

  }

  async getLinks() {
    return await this.page.$$eval('a[href]', links => {
      return links
        .map(link => link.href)
        .filter(href => href.startsWith('http://') || href.startsWith('https://'));
    });
  }

  async extractEmailAddresses() {
    return await this.page.$$eval('a[href^="mailto:"]', anchors => {
      return anchors.map(anchor => anchor.href.replace('mailto:', ''));
    });
  }

  async extractSMSLinks(page) {
      return await page.$$eval('a[href^="sms:"]', elements => {
          return elements.map(el => el.href);
      });
  }

  async extractPlainTextEmails() {
    // Fetch the page's content
    const content = await this.page.content();

    // Use JSDOM to parse the content
    

    virtualConsole.on("error", (message) => {
        if (!message.includes("Could not parse CSS stylesheet")) {
            //console.error(message);
        }
    });

    virtualConsole.on("warn", (message) => {
        // suppress warnings or handle them
    });

    const dom = new JSDOM(content, {
        resources: "usable",
        virtualConsole: virtualConsole
    });
    const doc = dom.window.document;

    //const regex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b/g;
    const regex = /(?<=\s|^)[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}(?=\s|$)/g;


    let emails = [];
    const elements = doc.querySelectorAll('*');


    for (const el of elements) {

      // Only evaluate leaf nodes
      //if (el.childElementCount === 0) {
        //const matches = el.textContent.match(regex);
        const matches = el.innerHTML.match(regex);


        if (matches) {
          //console.log(76, el.textContent);
          //console.log(77, matches);
          emails = emails.concat(matches);
        } else {
          // const regex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b/g;
          // const matches = el.textContent.match(regex);
          // if(matches){
          //   emails = emails.concat(matches);
          // }
        }
    }

    return Array.from(new Set(emails)); // Deduplicate
  }

    async crawl() {

    const allEmails = [];

    // Navigate to the specified URL
    try {
      await this.page.setGeolocation({latitude: 0, longitude: 0});
      await this.page.goto(this.url, { waitUntil: 'networkidle2' });
      const emailsFromMailto = await this.extractEmailAddresses();
      var smsNumbers = await this.extractSMSLinks();
      console.log(111, smsNumbers);
      const emailsFromPlainText = await this.extractPlainTextEmails();
      allEmails.push(...emailsFromMailto, ...emailsFromPlainText);


    } catch(error){
      
    }

    this.visitedUrls.add(this.url);

    


   

    const links = await this.getLinks();


    const MAX_LINKS = 25;

    // Common keywords for bottom navigation
    const bottomNavKeywords = ['about', 'privacy', 'terms', 'contact', 'faq', 'careers', 'sitemap'];

    const isBottomNavLink = (link) => {
        try {
          const linkPath = new URL(link).pathname.toLowerCase();
          return bottomNavKeywords.some(keyword => linkPath.includes(keyword));
        } catch(err){
          return false;
        }
    };

    const isTopLevelLink = (link) => {
        try {
          const pathSegments = new URL(link).pathname.split('/').filter(segment => segment);
          return pathSegments.length === 1;
        } catch(err){
          return false;
        }
    };

    // Prioritize links
    var prioritizedLinks = links.filter(link => isTopLevelLink(link) || isBottomNavLink(link) || link.includes('contact'));

    var prioritizedLinks = [...new Set(links.filter(link => isTopLevelLink(link) || isBottomNavLink(link) || link.includes('contact')))];

    // Sort: links with "contact" first, then bottom nav links
    prioritizedLinks.sort((a, b) => {
        const aIsContact = a.includes('contact');
        const bIsContact = b.includes('contact');
        const aIsBottomNav = isBottomNavLink(a);
        const bIsBottomNav = isBottomNavLink(b);

        if (aIsContact && !bIsContact) return -1;
        if (bIsContact && !aIsContact) return 1;
        if (aIsBottomNav && !bIsBottomNav) return -1;
        if (bIsBottomNav && !aIsBottomNav) return 1;
        return 0;
    });

    const filteredLinks = prioritizedLinks.slice(0, MAX_LINKS);

    let errorCount = 0;

    const socialMediaLinks = []; 
    try {
      var targetDomain = new URL(this.url).hostname; 
    } catch(err){

    }

    const socialMediaPlatforms = ['youtube.com', 'linkedin.com', 'twitter.com', 'facebook.com', 'instagram.com'];

    for (const link of filteredLinks) {
      process.stdout.write(".");
      const linkDomain = new URL(link).hostname;

      // Check for PDF, images, or other unwanted extensions
      if (link.endsWith('.pdf') || link.endsWith('.jpg') || link.endsWith('.jpeg') || link.endsWith('.png') || link.endsWith('.gif')) {

        if(link.endsWith('.pdf')){
          // Create a module that downloads the pdf and scans it for email addreesses.
        }

        continue;
      }

      if (socialMediaPlatforms.includes(linkDomain)) {
        socialMediaLinks.push(link);

        continue;
      }

      if (linkDomain.includes('cloudflare')) {
        console.warn(`Blocked by Cloudflare: ${link}`);
        this.blockedByCloudflare.push(link);

        continue; // Skip further processing for this link
      }

      if(errorCount == 5){

        const emailsFromMailto = await this.extractEmailAddresses();

        const emailsFromPlainText = await this.extractPlainTextEmails();
        allEmails.push(...emailsFromMailto, ...emailsFromPlainText);
      }

      if(errorCount > 5){

        continue;
      }

      if (targetDomain.includes(linkDomain) && !this.visitedUrls.has(link)) {

        try {

                            await this.page.setGeolocation({latitude: 0, longitude: 0}); // Mock some location
                            await this.page.goto(link, { waitUntil: 'networkidle2', timeout: 60000 }); // 30 seconds timeout

                            // Check for Cloudflare challenge
                            const pageTitle = await this.page.title();

                            if (pageTitle.includes('Attention Required!')) {
                                this.blockedByCloudflareUrls.push(link);
                                console.warn(`Blocked by Cloudflare: ${link}`);
                                this.blockedByCloudflare.push(link);
                                continue; // Skip further processing for this link
                            }

                        } catch (error) {
                            //console.warn(152, `Error navigating to ${link}: ${error.message}`);
                            errorCount++;
                            continue;
                        }

        this.visitedUrls.add(link);

        const emailsFromMailto = await this.extractEmailAddresses();
        const emailsFromPlainText = await this.extractPlainTextEmails();
        allEmails.push(...emailsFromMailto, ...emailsFromPlainText);
      }
    }

    const decodeAndCleanEmail = (encodedEmail) => {
        const decodedEmail = decodeURIComponent(encodedEmail);
        return decodedEmail.trim().toLowerCase();
    };

    const allValidEmails = this.filterValidEmails(allEmails).map(decodeAndCleanEmail);
    const deduplicatedEmails = Array.from(new Set(allValidEmails));

    if (deduplicatedEmails.length === 0) {
        deduplicatedEmails.push('none found');
    }

    return {
      emails: deduplicatedEmails,
      socialMediaLinks: socialMediaLinks
    };

  }

  filterValidEmails(emails) {
      const blacklistedDomains = [
          'sentry.io', 
          'sentry-next.wixpress.com', 
          'sentry.wixpress.com'
      ];
      const invalidPatterns = ["@2x.png", "user@domain.com", "png", "jpg", "jpeg", "bmp", "gif", "svg", "tiff", "webp"];
      
      return emails.filter(email => {
          // Exclude patterns that are invalid
          const isInvalid = invalidPatterns.some(pattern => email.includes(pattern));
          if (isInvalid) return false;

          // Filter out emails with query parameters like "?subject=..."
          if (email.includes('?')) {
              return false;
          }

          // Check for blacklisted domains
          const domain = email.split('@')[1];
          if (blacklistedDomains.includes(domain)) {
              return false;
          }

          // This is a valid email
          return true;
      });
  }

  async close() {
    if (this.browser) {
      try {
        await this.browser.close();
      } catch (error) {
        console.error('Error closing the browser:', error);
      }
    }
  }

  async downloadImage(url) {
    const response = await fetch(url);
    return response.buffer();
  }

  async parseImages(){
    const images = await this.page.evaluate(() => {
      return Array.from(document.querySelectorAll('img')).map(img => img.src);
    });

    for (const [index, imageUrl] of images.entries()) {
      const imageBuffer = await downloadImage(imageUrl);
      const text = await recognizeText(imageBuffer);
      console.log(`Text from image ${index}:`, text);
    }    
  }

  async recognizeText(buffer) {
    await worker.load();
    await worker.loadLanguage('eng');
    await worker.initialize('eng');
    const { data: { text } } = await worker.recognize(buffer);
    await worker.terminate();
    return text;
  }




}
