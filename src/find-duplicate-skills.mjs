import matter from 'gray-matter'
import * as path from 'path'
import * as fs from 'fs'

import { getInputFiles, readAndFilterMarkdownFile, mapSkills, outputPath } from './index.mjs'
import { createAssistant, postMessageAndGetResponse, deleteAssistant, deleteThread } from './utils/chatpgt-utils.mjs'
import { responseFormat } from './prompting/find_duplicate_skills_response.mjs'
import { skillsMapping } from './utils/skills-mapping.mjs'
import { blacklistedKeys, blacklistedMapping } from './utils/blacklisted.mjs'
import readline from 'readline'

/**
 * 
 */
const findDuplicateSkills = async (existingKeys, skills) => {
    // Create the assistant
    console.log(`⏳ Creating a new chat GPT assistant and a new thread...`)
    const response = await createAssistant({
        name: "Find duplicate skills",
        instructions: `
You will receive an javascript array of strings as input. It is a list of skills that have been collected from many job ads. Your job is to group together duplicate skills by following this process:
1. First analyse which skills from the \`skills\` input array mean exactly the same thing and put them in an array. These arrays will be called "Duplicates Arrays", and each skill inside will be a called a "Duplicate".
2. Discard "Duplicates Arrays" that have a \`length\` inferior to 2.
3. For each "Duplicates Array" that has a \`length\` of 2 and more, you will have to pick one of the "Duplicate" as the "Best Name" for the skill it represents.
4. Finally, send the results of your work in the response format specified.
        `,
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
    console.log(`⏳ Sending the list of skills...`)
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
}

const cleanSkillsMapping = (skills, existingKeys) => {
  const processedSkills = {}

  for (const [key, values] of Object.entries(skills)) {
    const filteredValues = values.filter(value => {
      return value !== key && !existingKeys.includes(value)
    })
    if (filteredValues.length > 0) {
      processedSkills[key] = filteredValues
    }
  }

  return processedSkills
}

/**
 * 
 * @returns 
 */
const extractSkills = () => {
  const existingKeys = Object.keys(skillsMapping)
  const skillsMapped = [].concat(...Object.values(skillsMapping))
  return { existingKeys, skillsMapped }
}

/**
 * 
 * @param {*} alreadyMapped 
 * @param {*} existingKeys 
 * @returns 
 */
export const collectUnmappedSkills = async (alreadyMapped, existingKeys) => {
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
      if (alreadyMapped.includes(skill)) return
      allSkills.add(skill)
    })
  }
  
  return Array.from(allSkills) // convert Set to Array
}
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

const askForConfirmation = (question) => {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y')
    })
  })
}

const exitScript = () => {
  console.log('Operation cancelled by the user.')
  rl.close()
  process.exit(0)
}

/**
 * sort new skill mapping alphabetically by key
 */
const sortMapping = (mapObject) => {
  return Object.keys(mapObject)
    .sort()
    .reduce((acc, key) => {
      acc[key] = mapObject[key]
      return acc
    }, {})
}

const remapSkills = async (skills) => {
  const newSkillsMapping = {...skillsMapping}
  let confirmed = await askForConfirmation('❓ Do you want to proceed with remapping skills? (y/n): ')
  if (!confirmed) exitScript()
  let newGroupsCount = 0
  let newDuplicatesCount = 0
  const rejectedKeys = []
  const rejectedDuplicates = {}
  for (const [key, duplicates] of Object.entries(skills)) {
    // If the key has been refused before, we don't iterate on it
    if (blacklistedKeys.includes(key)) {
      console.log(`❌ Ignoring the key ${key} has it been refused before.`)
      continue
    }
    const keyExists = !!newSkillsMapping[key]
    if (!keyExists) {
      confirmed = await askForConfirmation(`❓ Add a new skill group based on the following name: "${key}"? (y/n):`)
      if (!confirmed) {
        rejectedKeys.push(key)
        continue
      }
      newGroupsCount++
    }

    const newValues = (newSkillsMapping[key] || [])
    for (const duplicate of duplicates) {
      if (blacklistedMapping[key].includes(duplicate)) {
        console.log(`❌ Ignoring the duplicate ${duplicate} has it been refused before in key ${key}.`)
        continue
      }
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

  const sortedNewSkillsMapping = sortMapping(newSkillsMapping)
  const sortedBlacklistedMapping = sortMapping(blacklistedMapping)
  const newBlacklistedKeys = blacklistedKeys.concat(rejectedKeys).sort()
  
  console.log(`${newGroupsCount} new groups and ${newDuplicatesCount} new duplicates skills.`)
  if (!newGroupsCount && !newDuplicatesCount) console.log('Nice try chat GPT... 🤷')
  else {
    console.log("💾 Editing skills-mapping.mjs with our new skill mapping:", sortedNewSkillsMapping)
    fs.writeFileSync(
      path.join(process.cwd(), 'src/utils', 'skills-mapping.mjs'),
      `export const skillsMapping = ${JSON.stringify(sortedNewSkillsMapping, null, 2)}`
    )
  }

  if (rejectedKeys.length > 0 || Object.keys(rejectedDuplicates).length > 0) {
    console.log("💾 Editing blacklisted.mjs with the rejected keys:", rejectedKeys)
    console.log("💾 Editing blacklisted.mjs with the rejected duplicates:", rejectedDuplicates)
    fs.writeFileSync(
      path.join(process.cwd(), 'src/utils', 'blacklisted.mjs'),`
export const blacklistedKeys = ${JSON.stringify(newBlacklistedKeys, null, 2)}
export const blacklistedMapping = ${JSON.stringify(sortedBlacklistedMapping, null, 2)}
`)}
}

const { existingKeys, skillsMapped } = extractSkills()
const unmappedSkills = await collectUnmappedSkills(skillsMapped)
unmappedSkills.sort()
// const skills = await findDuplicateSkills(existingKeys, unmappedSkills)
const skills = { 'api design': [ 'api integrations', 'api rest' ], cloud: [ 'cloud deployment', 'cloud solutions design' ], 'data management': [ 'data manipulation', 'data migration support' ], 'data science': [ 'data analysis', 'data engineering' ], devops: [ 'devsecops' ], 'front-end development': [ 'front-end application analysis' ], 'microsoft azure': [ 'microsoft azure certifications' ], 'non-relational databases': [ 'nosql databases' ], 'relational databases': [ 'sql databases' ], 'software development': [ 'software architecture' ], 'ui/ux design': [ 'ui/ux principles' ], 'web services': [ 'webservices' ] }
const processedSkills = cleanSkillsMapping(skills, existingKeys)
remapSkills(processedSkills)