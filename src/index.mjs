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
} from './utils/utils.mjs'

import {
    createAssistant,
    deleteAssistant,
    deleteThread,
    postMessageAndGetResponse,
} from './utils/chatpgt-utils.mjs'

import { responseFormat } from './prompting/response-format.mjs'
import { skillMapping } from './utils/skills-mapping.mjs'

dotenv.config()
export const inputPath = process.env.INPUT_PATH || './input-files'
export const outputPath = process.env.OUTPUT_PATH || './output-files'
let assistantId = process.env.ASSISTANT_ID
let threadId = process.env.THREAD_ID
let total_prompt_tokens = 0
let total_completion_tokens = 0
let total_total_tokens = 0

/**
 * Will create a chatGPT assistant on your account and write
 * the assistant and thread ID in your .env file
 */
const createAssistantAndStoreIds = async () => {
    console.log(`⏳ Creating a new chat GPT assistant and a new thread...`)
    const response = await createAssistant({
        name: "Job ad analyzer",
        instructions: "You are an assistant specialized in extracting data from job ads submitted to you. The user will send you job ads fully redacted in markdown format, you will analyze them and extract the informations detailed in the JSON response format attached. Whatever the language of the job ad, you should always answer in english.",
        model: "gpt-4o-mini",
        temperature: 0.2,
        response_format: {
            type: "json_schema",
            json_schema: responseFormat,
        }
    })
    console.log(`🤖 Assistant and thread created!`)

    assistantId = response.assistant.id
    threadId = response.thread.id

    updateEnvFile('ASSISTANT_ID', assistantId)
    updateEnvFile('THREAD_ID', threadId)
}

/**
 * Use .env variables to delete ancient thread and assistant and rebuild one
 * It will store the new variables in the .env file.
 */
export const resetAssistant = async () => {
    // If the assistant doesn't exist yet, create and update the IDs.
    if (!assistantId && !threadId) {
        console.log(`❌ The assistant and thread ids that you are trying to delete are missing from the env...`)
        await createAssistantAndStoreIds()
        return
    }
    console.log(`⏳ Resetting assistant!`)

    if (threadId) {
        await deleteThread(threadId)
        updateEnvFile('THREAD_ID', '')
    }

    if (assistantId) {
        await deleteAssistant(assistantId)
        updateEnvFile('ASSISTANT_ID', '')
    }

    await createAssistantAndStoreIds()
    console.log(`✅ Reset completed!`)
}

/**
 * Will read a markdown file contents, and clean the data that is not useful
 * for the chatGPT analysis
 */
export const readAndFilterMarkdownFile = async (file, justRead) => {
    console.log(`⏳  Reading "${file}"...`)
    const filePath = path.join(inputPath, file)
    const fileContents = fs.readFileSync(filePath, 'utf-8')

    // Copy the contents into two variables
    let originalContents = fileContents
    if (justRead) return originalContents
    let filteredContents = fileContents

    // Remove YAML front matter from `filteredContents`
    filteredContents = removeYAMLFrontMatter(filteredContents)

    // Add the filename as an H1 title to `filteredContents`
    const fileNameWithoutExt = path.basename(file, '.md').replace('(READ) - ', '')
    filteredContents = `# ${fileNameWithoutExt}\n\n${filteredContents}`

    // Remove markdown links and images from `filteredContents`
    filteredContents = removeMarkdownLinksAndImages(filteredContents)
    console.log(`💌 File contents filtered and ready to be sent!`)
    return { originalContents, filteredContents }
}

/**
 * Map skills to return them with correct lowercase name.
 * This allow to avoid many synonyms by using as much possible the same name
 * for skills.
 * Remove duplicates
 */
export const mapSkills = (skills) => {
    const newSkills = skills.map(skill => {
        let newSkill = skill.toLowerCase()
        for (const trueSkill in skillMapping) {
            if (skillMapping[trueSkill].includes(newSkill)) {
                console.log(`🧼 Changed skill '${newSkill}' to '${trueSkill}'`)
                newSkill = trueSkill
                break
            }
        }
        return newSkill
    })
    return [...new Set(newSkills)] // remove duplicates

}

/**
 * Use response from chatGPT to write a new file as output
 */
const writeOutputFile = async (title, contents, newProperties) => {
    const newMarkdownProperties = {
        job_employer: newProperties.employer,
        job_role: newProperties.role,
        job_description: newProperties.description,
        job_region: ['Belgium', 'Brussels'], // I'm putting here hardcoded value because I look only in specific cities, so I don't need an AI to tell me that
        job_experience: newProperties.experience,
        job_skills: mapSkills(newProperties.skills),
        job_type: newProperties.contract_type,
        job_hours: newProperties.work_hours,
        job_ethical: newProperties.is_ethical,
        job_remote: newProperties.is_remote,
    }
    const convertedFile = matter(contents)
    convertedFile.data.tags.push('job-ad-analyzed')
    const outputContents = matter.stringify(convertedFile.content, {
        ...convertedFile.data,
        ...newMarkdownProperties,
    })

    // Create the duplicate markdown file in the output folder
    const outputFilePath = path.join(outputPath, title)
    fs.writeFileSync(outputFilePath, outputContents, 'utf-8')
    console.log(`💾 Processed and saved: ${outputFilePath}`)
}

/**
 * 
 */
export const getInputFiles = async () => {
    // Ensure input folder exists
    if (!process.env.INPUT_PATH) {
        checkOrCreateDir(inputPath)
    }

    // Collect markdown files
    const markdownFiles = collectMarkdownFiles(inputPath)
    // const markdownFiles = [collectMarkdownFiles(inputPath)[0]]
    if (markdownFiles.length === 0) return

    // Ensure output folder exists
    checkOrCreateDir(outputPath)
    return markdownFiles
}

/**
 * Run the script for every markdown file in the input folder.
 */
export const processMarkdownFiles = async () => {

    const markdownFiles = getInputFiles()

    // If the assistant doesn't exist yet, create and update the IDs.
    if (!assistantId || !threadId) {
        await createAssistantAndStoreIds()
    }

    for (const fileTitle of markdownFiles) {
        let { originalContents, filteredContents } = await readAndFilterMarkdownFile(fileTitle)

        console.log(`🤖 Submitting file contents to your chat GPT assistant...`)
        const { latestMessage, run } = await postMessageAndGetResponse(assistantId, threadId, filteredContents)
        // const run = {id: 'run_YNXGSmWFykl1QfK1GNjFGGMf', object: 'thread.run', created_at: 1728687963, assistant_id: 'asst_Ym6UazfMHz0zhF3LHRmnaYdJ', thread_id: 'thread_NzXSnm8CJzaAGMdPCb3xGst5', status: 'completed', started_at: 1728687964, expires_at: null, cancelled_at: null, failed_at: null, completed_at: 1728687966, required_action: null, last_error: null, model: 'gpt-4o-mini', instructions: 'You are an assistant specialized in extracting data from job ads submitted to you. The user will send you job ads fully redacted in markdown format, you will analyze them and extract the informations detailed in the JSON response format attached. Whatever the language of the job ad, you should always answer in english.', tools: [], tool_resources: {}, metadata: {}, temperature: 0.2, top_p: 1, max_completion_tokens: null, max_prompt_tokens: null, truncation_strategy: { type: 'auto', last_messages: null }, incomplete_details: null, usage: { prompt_tokens: 4206, completion_tokens: 106, total_tokens: 4312 }, response_format: {type: 'json_schema', json_schema: {name: 'job_ad_analysis', description: null, schema: {}, strict: true } }, tool_choice: 'auto', parallel_tool_calls: true }
        const { prompt_tokens, completion_tokens, total_tokens } = run.usage
        const messageValue = latestMessage.content[0].text.value
        const parsedMessage = JSON.parse(messageValue)
        // const parsedMessage = {employer: 'Mutualité Chrétienne', role: 'Other', description: 'Mutualité Chrétienne is seeking an AI Architect to enhance the well-being and health of over 4.5 million members through innovative data analytics and business intelligence solutions.', experience: 5, skills: ['data science', 'team management', 'project management', 'change management', 'ICT architecture frameworks', 'data architecture', 'Dutch', 'French' ], work_hours: 40, is_ethical: true, is_remote: true }
        console.log(`📄 The results just came in!`, parsedMessage)
        console.log(`💸 Tokens consumed for this run - ${prompt_tokens} Prompt - ${completion_tokens} Completion - ${total_tokens} Total`)
        total_prompt_tokens += prompt_tokens
        total_completion_tokens += completion_tokens
        total_total_tokens += total_tokens

        await writeOutputFile(fileTitle, originalContents, parsedMessage)
        console.log(`---`)
    }

    if (markdownFiles.length > 1) {
        console.log(`💸 Tokens consumed in total - ${total_prompt_tokens} Prompt - ${total_completion_tokens} Completion - ${total_total_tokens} Total`)
    }
}
