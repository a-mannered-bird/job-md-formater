# job-md-formater

Use AI to analyze job ads and format them into a Markdown file.

## Introduction

Whether or not you're looking for a new job, it's important to gather data about the job market. By properly analyzing its demands, we can make observations about trends in the IT business, the most popular requirements depending on location, or the roles in demand. **Having reliable statistics can help us figure out what to learn or where to orient ourselves based on our objectives.**  

Of course, to do this, we need a lot of data. **Since I didn't want to analyze every single job ad manually, I thought ChatGPT could do it for me.** I wasn't satisfied with the premium tools I found online (which often charge a lot) and wanted more flexibility in automating data collection, analysis, and statistics reporting. This script only handles the data analysis part, with the help of ChatGPT.

## The Full Workflow

The whole process largely relies on the amazing [Obsidian](https://obsidian.md/). This software acts as my database, and by leveraging some modules, we can easily create a great interface for making queries and visualizing statistics.

### Collecting Ads

This part is not automated. I don't scrape entire job platforms with a bot, but I save the job ads I find relevant from the various email alerts I set up earlier.  

- I navigate to the job ad page.
- I use the browser extension [Obsidian Web Clipper](https://obsidian.md/clipper) to convert the page into a Markdown file and save it directly to my Vault inside a "job ad inbox" folder.
- Obsidian Web Clipper already automatically creates a few "properties" (date, source, title) in the Markdown files in the form of YAML front matter.

### Analyzing Ads

This is where the script comes in. Check the "Getting Started" section to learn how to use it. Using your ChatGPT account credentials and the token you purchased from their platform, the script will do the following:

- Create a GPT assistant and a chat thread (if it doesn't exist yet).
- For each job ad you saved in your inbox:
  - It will filter out the YAML front matter, links, and images to save tokens.
  - It will send the Markdown content to your GPT assistant and collect its analysis in a JSON-formatted response.
  - It will populate the YAML front matter of your Markdown file with ChatGPT's analysis and save it in an output folder.

That's it! You can always tinker with the script and the `response-format` to collect different or more accurate data. I set it to my specific needs—feel free to make this tool yours.  

Remember to use the `reset` command described below whenever you want to modify the Assistant.

### Statistics Reports

This part is handled in Obsidian again, this time using the wonderful [Dataview plugin](https://blacksmithgu.github.io/obsidian-dataview/). It uses a language similar to SQL called "DQL" to query and treat your Markdown files as a database.  

From there, you can explore all the properties you set up for your Markdown files. Create a leaderboard of the most in-demand skills in a specific town, compare existing opportunities based on experience level, role, specialization, salaries, etc. Adapt the stats to whatever you're curious about.

## Getting Started

1. Clone this repository. Make sure you have Node.js installed on your device.
2. Run `npm i` to install dependencies.
3. Create a `.env` file at the root of the project folder with the following contents:

   ```env
   OPENAI_API_KEY=<your-openai-api-key>
   INPUT_PATH=<optional-path-to-your-job-ad-input-folder>
   OUTPUT_PATH=<optional-path-to-your-job-ad-output-folder>
   ```

   If you don't specify `INPUT_PATH` or `OUTPUT_PATH`, the script will create folders in the root directory once run.

4. Ensure you have Markdown files in your input folder; otherwise, nothing will happen.
5. ⚠️ You need tokens on OpenAI to make this work. Include only the Markdown files you need to analyze in the input folder to avoid wasting tokens.
6. Run `npm start`. Once the script is finished, the output files will appear in the OUTPUT_PATH.

## Rebuild the Assistant

There are several reasons to rebuild the assistant:

- You changed the Assistant parameters, instructions, models, etc., and you want to apply the changes.
- The thread is getting too long, and the Assistant is starting to become incoherent.

It might be a good idea to reset the Assistant from time to time, even if you don't change the parameters. Creating a new thread this way may yield better results.

To rebuild the Assistant, simply run `npm run reset`. This will delete the previous assistant and thread, then create new ones.  

## Other instructions

### Trim skills

TODO