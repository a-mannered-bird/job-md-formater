import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'
import {
    checkOrCreateDir,
    collectMarkdownFiles,
    addFooBarToYAML,
    removeYAMLFrontMatter,
    removeMarkdownLinksAndImages,
} from './utils.mjs'

// Main function
function processMarkdownFiles() {
    const inputPath = process.env.INPUT_PATH || './input-files'
    const outputPath = process.env.OUTPUT_PATH || './output-files'

    // Ensure input folder exists
    if (!process.env.INPUT_PATH) {
        checkOrCreateDir(inputPath)
    }

    // Collect markdown files
    const markdownFiles = collectMarkdownFiles(inputPath)
    if (markdownFiles.length === 0) return

    // Ensure output folder exists
    checkOrCreateDir(outputPath)

    markdownFiles.forEach(file => {
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

        // console.log(filteredContents)

        // Add "Foo: Bar" to the YAML front matter in `originalContents`
        originalContents = addFooBarToYAML(originalContents)

        // Create the duplicate markdown file in the output folder
        const outputFilePath = path.join(outputPath, file)
        fs.writeFileSync(outputFilePath, originalContents, 'utf-8')
        console.log(`Processed and saved: ${outputFilePath}`)
    })
}

// Execute the script
dotenv.config()
processMarkdownFiles()
