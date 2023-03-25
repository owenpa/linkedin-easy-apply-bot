const puppeteer = require("puppeteer");
const dotenv = require("dotenv");

const wait = require("../utils/wait");
const { checkDotEnvExists } = require('../utils/dotenvHelper');
const ask = require("../utils/ask");
const login = require("../login");
const apply = require("../apply");
const fetchJobLinksUser = require("../fetch/fetchJobLinksUser");

dotenv.config();

const state = {
  paused: false
};

const askForPauseInput = async () => {
  await ask('press enter to pause the program');

  state.paused = true;

  await ask('press enter to continue the program');

  state.paused = false;
  console.log('unpaused');

  askForPauseInput();
}

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    ignoreHTTPSErrors: true,
    args: ["--disable-setuid-sandbox", "--no-sandbox",]
  });
  const context = await browser.createIncognitoBrowserContext();
  let page = await context.newPage();
  const pages = await browser.pages();
  await pages[0].close();

  try {
    checkDotEnvExists();
  } catch (e) {
    console.error(e.message);
    process.exit(1)
  }

  await login({ page, email: process.env.LINKEDIN_EMAIL, password: process.env.LINKEDIN_PASSWORD });

  askForPauseInput();

  const links = [];
  const linkGenerator = fetchJobLinksUser({
    page,
    location: process.env.LOCATION,
    keywords: process.env.KEYWORDS,
    remote: process.env.REMOTE === "true",
    easyApply: process.env.EASY_APPLY === "true",
    jobTitle: process.env.JOB_TITLE,
    jobDescription: process.env.JOB_DESCRIPTION
  });

  for await (const link of linkGenerator) {
    links.push(link);

    while(state.paused) {
      console.log('program paused, press enter to continue the program');
      await wait(2000);
    }
  }

  console.log(links);

  for (const link of links) {
    if (process.env.SINGLE_PAGE !== "true")
      page = await context.newPage();

    await apply({
      page,
      link,
      formData: {
        phone: process.env.PHONE,
        cvPath: process.env.CV_PATH,
        homeCity: process.env.HOME_CITY,
        coverLetterPath: process.env.COVER_LETTER_PATH,
        yearsOfExperience: process.env.YEARS_OF_EXPERIENCE,
        languageProficiency: process.env.LANGUAGE_PROFICIENCY,
        requiresVisaSponsorship: process.env.REQUIRES_VISA_SPONSORSHIP === "true",
        booleans: process.env.BOOLEANS,
        textFields: process.env.TEXT_FIELDS,
        multipleChoiceFields: process.env.MULTIPLE_CHOICE_FIELDS,
      },
      shouldSubmit: process.argv[2] === 'SUBMIT',
    });

    await wait(2000);

    while(state.paused) {
      console.log('program paused, press enter to continue the program');
      await wait(2000);
    }
  }

  // await browser.close();
})();