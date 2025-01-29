import matter from 'gray-matter'
import * as path from 'path'
import * as fs from 'fs'

import { getInputFiles, readAndFilterMarkdownFile, mapSkills, outputPath } from './index.mjs'
import { createAssistant, postMessageAndGetResponse, deleteAssistant, deleteThread } from './utils/chatpgt-utils.mjs'
import { responseFormat } from './prompting/find_duplicate_skills_response.mjs'
import { skillMapping } from './utils/skills-mapping.mjs'

/**
 * 
 */
const findDuplicateSkills = async (existingkeys, skills) => {
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

const cleanSkillMapping = (skills) => {
  const processedSkills = {}

  for (const [key, values] of Object.entries(skills)) {
    const filteredValues = values.filter(value => value !== key)
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
  const existingkeys = Object.keys(skillMapping)
  const skillsMapped = [].concat(...Object.values(skillMapping))
  return { existingkeys, skillsMapped }
}

/**
 * 
 * @param {*} alreadyMapped 
 * @param {*} existingkeys 
 * @returns 
 */
export const collectUnmappedSkills = async (alreadyMapped, existingkeys) => {
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

const { existingkeys, skillsMapped } = extractSkills()
const unmappedSkills = await collectUnmappedSkills(skillsMapped)
unmappedSkills.sort()
const skills = await findDuplicateSkills(existingkeys, unmappedSkills)
// const skills = { 'agile methodologies': [ 'agile methodologies' ], 'api design': [ 'api design', 'api integrations', 'api rest' ], azure: [ 'azure', 'azure automation', 'azure cli', 'azure landing zones', 'microsoft azure', 'microsoft azure certifications' ], cloud: [ 'cloud', 'cloud deployment', 'cloud solutions design' ], 'data manipulation': [ 'data manipulation', 'data management' ], documentation: [ 'documentation', 'design documentation' ], 'front-end development': [ 'front-end development', 'front-end application analysis' ], 'google cloud': [ 'google cloud', 'google professional cloud devops engineer' ], 'infrastructure as code': [ 'infrastructure as code', 'terraform' ], javascript: [ 'javascript', 'js' ], 'non-relational databases': [ 'non-relational databases', 'mongodb', 'couchbase' ], 'requirements analysis': [ 'requirements analysis', 'functional requirements' ], security: [ 'security', 'firewalls' ], 'stakeholder management': [ 'stakeholder management', 'client-oriented', 'customer-oriented' ], tailwind: [ 'tailwind', 'tailwind css' ], 'team management': [ 'team management', 'teamwork' ] }
const processedSkills = cleanSkillMapping(skills)
console.log(processedSkills)

