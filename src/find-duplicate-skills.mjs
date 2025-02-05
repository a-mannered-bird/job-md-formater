import matter from 'gray-matter'
import * as path from 'path'
import * as fs from 'fs'

import { getInputFiles, readAndFilterMarkdownFile, mapSkills, outputPath } from './index.mjs'
import { createAssistant, postMessageAndGetResponse, deleteAssistant, deleteThread } from './utils/chatpgt-utils.mjs'
import { responseFormat } from './prompting/find_duplicate_skills_response.mjs'
import { skillsMapping as oldSkillsMapping } from './utils/skills-mapping.mjs'
import { blacklistedKeys, blacklistedMapping } from './utils/blacklisted.mjs'
import readline from 'readline'

/**
 * Function to find duplicate skills using a GPT assistant
 * @param {Array<string>} existingKeys - Array of existing skill keys
 * @param {Array<string>} skills - Array of skills to be processed
 */
const findDuplicateSkills = async (existingKeys, skills) => {
  try {
    // Create the assistant
    console.log(`⏳ Creating a new chat GPT assistant and a new thread...`)
    const response = await createAssistant({
      name: "Find duplicate skills",
      instructions: `
You will receive a JavaScript array of strings as input. It is a list of skills that have been collected from many job ads. Your job is to group together duplicate skills by following this process:
1. First, analyze which skills from the \`skills\` input array mean exactly the same thing and put them in an array. These arrays will be called "Duplicates Arrays", and each skill inside will be called a "Duplicate".
2. Discard "Duplicates Arrays" that have a \`length\` inferior to 2.
3. For each "Duplicates Array" that has a \`length\` of 2 and more, you will have to pick one of the "Duplicate" as the "Best Name" for the skill it represents.
4. Finally, send the results of your work in the response format specified.`,
      model: "gpt-4o-mini",
      temperature: 0.01,
      response_format: {
        type: "json_schema",
        json_schema: responseFormat,
      }
    })
    console.log(`🤖 Assistant and thread created!`)

    // Send message
    const message = `const skills = ${JSON.stringify(skills)}`
    console.log(`⏳ Sending the list of ${skills.length} skills...`)
    const { latestMessage, run } = await postMessageAndGetResponse(response.assistant.id, response.thread.id, message)

    // Check results
    const { prompt_tokens, completion_tokens, total_tokens } = run.usage
    const messageValue = latestMessage.content[0].text.value
    const parsedMessage = JSON.parse(messageValue)
    console.log(`📄 The results just came in!`, parsedMessage)
    console.log(`💸 Tokens consumed for this run - ${prompt_tokens} Prompt - ${completion_tokens} Completion - ${total_tokens} Total`)

    // Delete the assistant
    await deleteAssistant(response.assistant.id)
    await deleteThread(response.thread.id)

    return parsedMessage.skills
  } catch (error) {
    console.error(`❌ An error occurred: ${error.message}`)
  }
}

/**
 * Function to clean a new skills mapping by removing the already recorded skills and keys
 * @param {Object} skillsMapping - Skills mapping to be cleaned
 * @param {Array<string>} skillsAlreadyMapped - Skills that have already been mapped
 * @returns {Object} - new Skills mapping cleaned
 */
const cleanSkillsMapping = (skillsMapping, skillsAlreadyMapped) => {
  const processedSkills = {}

  for (const [key, values] of Object.entries(skillsMapping)) {
    const filteredValues = values.filter(value => {
      return value !== key && !skillsAlreadyMapped.includes(value)
    })
    if (filteredValues.length > 0) {
      processedSkills[key] = filteredValues
    }
  }

  return processedSkills
}

/**
 * Extract the existing keys and skills mapped from the skillsMapping object
 * @returns {Object} - Object containing the existingKeys in an array and skills already mapped in another
 */
const extractSkills = () => {
  const existingKeys = Object.keys(oldSkillsMapping)
  const skillsMapped = [].concat(...Object.values(oldSkillsMapping))
  return { existingKeys, skillsMapped }
}

/**
 * Recover all skills from the input markdown files.
 * Filter out the skills that are already mapped from the output
 * @param {Array<string>} alreadyMappedSkills - This array of string will be filtered out of the results
 * @returns {Array<string>} - An array of strings that are not present in the skillsMapping
 */
export const collectUnmappedSkills = async (alreadyMappedSkills) => {
  const markdownFiles = await getInputFiles()
  const allSkills = new Set()

  for (const fileTitle of markdownFiles) {
    const contents = await readAndFilterMarkdownFile(fileTitle, true)
    const convertedFile = matter(contents)
    if (!convertedFile.data.job_skills) {
      console.log(`🚨 No job_skills found in ${fileTitle}`)
      continue
    }
    convertedFile.data.job_skills.forEach(skill => {
      if (alreadyMappedSkills.includes(skill)) return
      allSkills.add(skill)
    })
  }

  return Array.from(allSkills) // convert Set to Array
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

/**
 * Ask the user for confirmation before continuing the script
 * 
 * @param {string} question - Binary question that will be asked in the terminal
 * @returns {Promise<boolean>} - The answer of the user (yes or no, true or false)
 */
const askForConfirmation = (question) => {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y')
    })
  })
}

/**
 * Exit the script
 */
const exitScript = () => {
  console.log('Operation cancelled by the user.')
  rl.close()
  process.exit(0)
}

/**
 * Sort new skill mapping alphabetically by key
 * 
 * @param {Object} - SkillsMapping object to reorder
 * @returns {Object} - Reordered skillsMapping object
 */
const sortMapping = (mapObject) => {
  return Object.keys(mapObject)
    .sort()
    .reduce((acc, key) => {
      acc[key] = mapObject[key]
      return acc
    }, {})
}

/**
 * Edit skillsMapping.mjs file in a step by step process, going through each suggestion
 * from chatGPT. Also remember the rejected suggestions into a blacklisted.mjs file.
 * 
 * @param {Object} suggestedSkillsMapping - Skills mapping object suggested by ChatGPT
 */
const remapSkills = async (suggestedSkillsMapping) => {
  const newSkillsMapping = { ...oldSkillsMapping }

  let confirmed = await askForConfirmation('❓ Do you want to proceed with remapping skills? (y/n): ')
  if (!confirmed) exitScript()

  let newGroupsCount = 0
  let newDuplicatesCount = 0
  const rejectedKeys = []
  const rejectedDuplicates = {}

  for (const [key, duplicates] of Object.entries(suggestedSkillsMapping)) {

    // Abort iteration on Blacklisted keys that have been rejected before
    if (blacklistedKeys.includes(key)) {
      console.log(`❌ Ignoring the key ${key} as it has been rejected before.`)
      continue
    }

    // Check if we need to create a new skill group
    const keyExists = !!newSkillsMapping[key]
    if (!keyExists) {
      confirmed = await askForConfirmation(`❓ Add a new skill group based on the following name: "${key}"? (y/n):`)
      if (!confirmed) {
        rejectedKeys.push(key)
        continue
      }
      newGroupsCount++
    }

    // Iterate on each duplicate belong to a skill group
    const newValues = (newSkillsMapping[key] || [])
    for (const duplicate of duplicates) {

      // Ignore blacklisted duplicates
      if ((blacklistedMapping[key] || []).includes(duplicate)) {
        console.log(`❌ Ignoring the duplicate ${duplicate} has it been refused before in key ${key}.`)
        continue
      }

      // Ask user if the duplicate gets added to the skill group or blacklisted
      confirmed = await askForConfirmation(`❓ Do you confirm that "${duplicate}" is the same skill as "${key}"? (y/n):`)
      if (!confirmed) {
        blacklistedMapping[key] = (blacklistedMapping[key] || []).concat([duplicate])
        rejectedDuplicates[key] = (rejectedDuplicates[key] || []).concat([duplicate])
      } else {
        newValues.push(duplicate)
        newDuplicatesCount++
      }
    }
    newSkillsMapping[key] = newValues
  }
  
  rl.close()

  // Sorting results alphabetically before editing
  const sortedNewSkillsMapping = sortMapping(newSkillsMapping)
  const sortedBlacklistedMapping = sortMapping(blacklistedMapping)
  const newBlacklistedKeys = blacklistedKeys.concat(rejectedKeys).sort()

  // Editing skillsMapping.mjs file with results
  console.log(`${newGroupsCount} new groups and ${newDuplicatesCount} new duplicates skills.`)
  if (!newGroupsCount && !newDuplicatesCount) console.log('Nice try chat GPT... 🤷')
  else {
    console.log("💾 Editing skills-mapping.mjs with our new skill mapping:", sortedNewSkillsMapping)
    fs.writeFileSync(
      path.join(process.cwd(), 'src/utils', 'skills-mapping.mjs'),
      `export const skillsMapping = ${JSON.stringify(sortedNewSkillsMapping, null, 2)}`
    )
  }

    // Editing blacklisted.mjs file with results
  if (rejectedKeys.length > 0 || Object.keys(rejectedDuplicates).length > 0) {
    console.log("💾 Editing blacklisted.mjs with the rejected keys:", rejectedKeys)
    console.log("💾 Editing blacklisted.mjs with the rejected duplicates:", rejectedDuplicates)
    fs.writeFileSync(
      path.join(process.cwd(), 'src/utils', 'blacklisted.mjs'), `
export const blacklistedKeys = ${JSON.stringify(newBlacklistedKeys, null, 2)}
export const blacklistedMapping = ${JSON.stringify(sortedBlacklistedMapping, null, 2)}
`)
  }
}

const { existingKeys, skillsMapped } = extractSkills()
const unmappedSkills = await collectUnmappedSkills(skillsMapped)
unmappedSkills.sort()
const skills = await findDuplicateSkills(existingKeys, unmappedSkills)
// const skills = { 'api design': ['api integrations', 'api rest'], cloud: ['cloud deployment', 'cloud solutions design'], 'data management': ['data manipulation', 'data migration support'], 'data science': ['data analysis', 'data engineering'], devops: ['devsecops'], 'front-end development': ['front-end application analysis'], 'microsoft azure': ['microsoft azure certifications'], 'non-relational databases': ['nosql databases'], 'relational databases': ['sql databases'], 'software development': ['software architecture'], 'ui/ux design': ['ui/ux principles'], 'web services': ['webservices'] }
const processedSkills = cleanSkillsMapping(skills, existingKeys)
remapSkills(processedSkills)