import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'

import {
    addFooBarToYAML,
    checkOrCreateDir,
    collectMarkdownFiles,
    updateEnvFile,
    removeMarkdownLinksAndImages,
    removeYAMLFrontMatter,
} from './utils.mjs'

import {
    createAssistant,
    postMessageAndGetResponse,
} from './job-ad-analyzer.mjs'

import {response_format} from './response_format.mjs'


const createAssistantAndStoreIds = async () => {
    console.log(`⏳ Creating a new chat GPT assistant and a new thread...`)
    const response = await createAssistant({
        name: "Job ad analyzer",
        instructions: "You are an assistant specialized in extracting data from job ads submitted to you. The user will send you job ads fully redacted in markdown format, you will analyze them and extract the informations detailed in the JSON response format attached. Whatever the language of the job ad, you should always answer in english.",
        model: "gpt-4o-2024-08-06", // TODO: Make it work with gpt-4o and not gpt-4o-mini
        temperature: 0.2,
        response_format: {
            type: "json_schema",
            json_schema: response_format,
        }
    })
    const ids = {
        assistantId: response.assistant.id,
        threadId: response.thread.id,
    }
    console.log(`🤖 Assistant and thread created!`)

    updateEnvFile('ASSISTANT_ID', ids.assistantId)
    updateEnvFile('THREAD_ID', ids.threadId)

    return ids
}

// Main function
async function processMarkdownFiles() {
    const inputPath = process.env.INPUT_PATH || './input-files'
    const outputPath = process.env.OUTPUT_PATH || './output-files'
    let assistantId = process.env.ASSISTANT_ID
    let threadId = process.env.THREAD_ID

    // Ensure input folder exists
    if (!process.env.INPUT_PATH) {
        checkOrCreateDir(inputPath)
    }

    // Collect markdown files
    const markdownFiles = collectMarkdownFiles(inputPath)
    if (markdownFiles.length === 0) return

    // Ensure output folder exists
    checkOrCreateDir(outputPath)

    // If the assistant doesn't exist yet, create and update the IDs.
    if (!assistantId || !threadId) {
        const ids = await createAssistantAndStoreIds()
        assistantId = ids.assistantId
        threadId = ids.threadId
    }
    

    markdownFiles.forEach(async file => {
        console.log(`⏳  Reading "${file}"...`)
        const filePath = path.join(inputPath, file)
        const fileContents = fs.readFileSync(filePath, 'utf-8')

        // Copy the contents into two variables
        let originalContents = fileContents
        let filteredContents = fileContents

        // Remove YAML front matter from `filteredContents`
        filteredContents = removeYAMLFrontMatter(filteredContents)

        // Add the filename as an H1 title to `filteredContents`
        const fileNameWithoutExt = path.basename(file, '.md').replace('(READ) - ', '')
        filteredContents = `# ${fileNameWithoutExt}\n\n${filteredContents}`

        // Remove markdown links and images from `filteredContents`
        filteredContents = removeMarkdownLinksAndImages(filteredContents)
        
        console.log(`🤖  File filtered! Submitting it to your chat GPT assistant...`)
        const latestMessage = await postMessageAndGetResponse(assistantId, threadId, filteredContents)
        console.log(latestMessage.content[0].text)

        // // Add "Foo: Bar" to the YAML front matter in `originalContents`
        // originalContents = addFooBarToYAML(originalContents)

        // // Create the duplicate markdown file in the output folder
        // const outputFilePath = path.join(outputPath, file)
        // fs.writeFileSync(outputFilePath, originalContents, 'utf-8')
        // console.log(`Processed and saved: ${outputFilePath}`)
    })
}

// Execute the script
dotenv.config()
processMarkdownFiles()
