import * as fs from 'fs'
import * as path from 'path'

// Helper function to check if the path exists
function checkOrCreateDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true })
        console.log(`Created directory: ${dirPath}`)
    }
}

// Helper function to collect markdown files from a folder
function collectMarkdownFiles(dirPath) {
    try {
        const files = fs.readdirSync(dirPath)
        const markdownFiles = files.filter(file => file.endsWith('.md'))
        if (markdownFiles.length === 0) {
            console.log(`No markdown files found in ${dirPath}`)
            return []
        }
        return markdownFiles
    } catch (err) {
        console.error(`Error reading directory ${dirPath}: ${err.message}`)
        return []
    }
}

// Helper function to add "Foo: Bar" to the YAML front matter
function addFooBarToYAML(content) {
    const yamlRegex = /^---\n[\s\S]*?\n---/
    const match = content.match(yamlRegex)
    if (match) {
        const yamlContent = match[0]
        const updatedYAML = yamlContent.replace(/---$/, 'Foo: Bar\n---')
        return content.replace(yamlRegex, updatedYAML)
    } else {
        // If there's no YAML front matter, add it at the beginning
        return `---\nFoo: Bar\n---\n${content}`
    }
}

// Helper function to remove YAML front matter from content
function removeYAMLFrontMatter(content) {
    const yamlRegex = /^---\n[\s\S]*?\n---\n/
    return content.replace(yamlRegex, '')
}

// Helper function to remove markdown links and images
function removeMarkdownLinksAndImages(content) {
    return content.replace(/!\[.*?\]\(.*?\)/g, '') // Remove images
                  .replace(/\[.*?\]\(.*?\)/g, '')  // Remove links
}

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

        console.log(filteredContents)

        // Add "Foo: Bar" to the YAML front matter in `originalContents`
        originalContents = addFooBarToYAML(originalContents)

        // Create the duplicate markdown file in the output folder
        const outputFilePath = path.join(outputPath, file)
        fs.writeFileSync(outputFilePath, originalContents, 'utf-8')
        console.log(`Processed and saved: ${outputFilePath}`)
    })
}

// Execute the script
processMarkdownFiles()
