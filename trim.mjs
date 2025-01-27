import matter from 'gray-matter'
import * as path from 'path'
import * as fs from 'fs'

import { getInputFiles, readAndFilterMarkdownFile, mapSkills, outputPath } from './index.mjs'

export const processMarkdownFiles = async () => {
  const markdownFiles = await getInputFiles()
  console.log(markdownFiles)

  for (const fileTitle of markdownFiles) {
    let contents = await readAndFilterMarkdownFile(fileTitle, true)
    const convertedFile = matter(contents)
    if (!convertedFile.data.job_skills) {
      console.log(`🚨 No job_skills found in ${fileTitle}`)
      continue
    }
    convertedFile.data.job_skills = mapSkills(convertedFile.data.job_skills)
    const outputContents = matter.stringify(convertedFile.content, convertedFile.data)

    const outputFilePath = path.join(outputPath, fileTitle)
    fs.writeFileSync(outputFilePath, outputContents, 'utf-8')
    console.log(`💾 Processed and saved: ${outputFilePath}`)
  }
}

processMarkdownFiles()