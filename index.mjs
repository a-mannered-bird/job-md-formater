import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'
import matter from 'gray-matter'

import {
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

dotenv.config() 
const inputPath = process.env.INPUT_PATH || './input-files'
const outputPath = process.env.OUTPUT_PATH || './output-files'
let assistantId = process.env.ASSISTANT_ID
let threadId = process.env.THREAD_ID

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
    console.log(`🤖 Assistant and thread created!`)

    assistantId = response.assistant.id
    threadId = response.thread.id

    updateEnvFile('ASSISTANT_ID', assistantId)
    updateEnvFile('THREAD_ID', threadId)
}

const readAndFilterMarkdownFile = async (file) => {
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
    console.log(`💌 File contents filtered and ready to be sent!`)
    return {originalContents, filteredContents}
}

const processMarkdownFiles = async () => {

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
        await createAssistantAndStoreIds()
    }
    

    markdownFiles.forEach(async file => {
        let {originalContents, filteredContents} = await readAndFilterMarkdownFile(file)
        
        console.log(`🤖 Submitting file contents to your chat GPT assistant...`)
        const latestMessage = await postMessageAndGetResponse(assistantId, threadId, filteredContents)
        const messageValue = latestMessage.content[0].text.value
        const parsedMessage = JSON.parse(messageValue)
        console.log(`📄 The results just came in!`, parsedMessage)

        const newMarkdownProperties = {
            job_employer: parsedMessage.employer,
            job_role: parsedMessage.role,
            job_region: ['Solar System', 'The Moon'], // TODO: Hardcoded value because I'm looking in specific spaces
            job_experience: parsedMessage.experience,
            job_skills: parsedMessage.skills,
            job_type: 'CDI',
            job_hours: parsedMessage.work_hours,
            job_ethical: parsedMessage.is_ethical,
            job_flexibility: parsedMessage.is_flexible,
            job_attractive: parsedMessage.is_attractive,
        }
        const convertedFile = matter(originalContents)
        const outputContents = matter.stringify(convertedFile.content, {
            ...convertedFile.data,
            ...newMarkdownProperties,
        })

        // Create the duplicate markdown file in the output folder
        const outputFilePath = path.join(outputPath, file)
        fs.writeFileSync(outputFilePath, outputContents, 'utf-8')
        console.log(`💾 Processed and saved: ${outputFilePath}`)
    })
}

// Execute the script
processMarkdownFiles()
