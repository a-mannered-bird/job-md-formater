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
    deleteAssistant,
    deleteThread,
    postMessageAndGetResponse,
} from './chatpgt-utils.mjs'

import {responseFormat} from './response-format.mjs'
import {skillMapping} from './skills-mapping.mjs'

dotenv.config() 
const inputPath = process.env.INPUT_PATH || './input-files'
const outputPath = process.env.OUTPUT_PATH || './output-files'
let assistantId = process.env.ASSISTANT_ID
let threadId = process.env.THREAD_ID

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
    if (!assistantId || !threadId) {
        console.log(`❌ The assistant or thread ids that you are trying to delete are missing from the env...`)
        await createAssistantAndStoreIds()
        return
    }
    console.log(`⏳ Resetting assistant!`)
    await deleteThread(threadId)
    await deleteAssistant(assistantId)
    await createAssistantAndStoreIds()
    console.log(`✅ Reset completed!`)
}

/**
 * Will read a markdown file contents, and clean the data that is not useful
 * for the chatGPT analysis
 */
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

/**
 * Map skills to return them with correct lowercase name.
 * This allow to avoid many synonyms by using as much possible the same name
 * for skills.
 * Remove duplicates
 */
const mapSkills = (skills) => {
    const newSkills = skills.map(skill => {
        let newSkill = skill.toLowerCase()
        for (const trueSkill in skillMapping) {
            if (skillMapping[trueSkill].includes(newSkill)) {
                console.log(`🧼 Changed skill '${newSkill}' to '${trueSkill}`)
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
        job_region: ['Solar system', 'the moon'], // TODO: Hardcoded value because I'm looking in specific spaces
        job_experience: newProperties.experience,
        job_skills: mapSkills(newProperties.skills),
        job_type: 'CDI',
        job_hours: newProperties.work_hours,
        job_ethical: newProperties.is_ethical,
        job_flexibility: newProperties.is_flexible,
        job_attractive: newProperties.is_attractive,
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
 * Run the script for every markdown file in the input folder.
 */
export const processMarkdownFiles = async () => {

    // Ensure input folder exists
    if (!process.env.INPUT_PATH) {
        checkOrCreateDir(inputPath)
    }

    // Collect markdown files
    const markdownFiles = [collectMarkdownFiles(inputPath)[0]]
    if (markdownFiles.length === 0) return

    // Ensure output folder exists
    checkOrCreateDir(outputPath)

    // If the assistant doesn't exist yet, create and update the IDs.
    if (!assistantId || !threadId) {
        await createAssistantAndStoreIds()
    }

    for (const fileTitle of markdownFiles) {
        let {originalContents, filteredContents} = await readAndFilterMarkdownFile(fileTitle)
        
        console.log(`🤖 Submitting file contents to your chat GPT assistant...`)
        const latestMessage = await postMessageAndGetResponse(assistantId, threadId, filteredContents)
        const messageValue = latestMessage.content[0].text.value
        const parsedMessage = JSON.parse(messageValue)
        // const parsedMessage = {employer: 'Mutualité Chrétienne', role: 'Other', description: 'Mutualité Chrétienne is seeking an AI Architect to enhance the well-being and health of over 4.5 million members through innovative data analytics and business intelligence solutions.', experience: 5, skills: ['data science', 'team management', 'project management', 'change management', 'ICT architecture frameworks', 'data architecture', 'Dutch', 'French' ], work_hours: 40, is_ethical: true, is_flexible: true, is_attractive: true }
        console.log(`📄 The results just came in!`, parsedMessage)

        await writeOutputFile(fileTitle, originalContents, parsedMessage)
    }
}
