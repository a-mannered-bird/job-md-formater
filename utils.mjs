import * as fs from 'fs'

// Helper function to check if the path exists
export const checkOrCreateDir = (dirPath) => {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true })
        console.log(`Created directory: ${dirPath}`)
    }
}

// Helper function to collect markdown files from a folder
export const collectMarkdownFiles = (dirPath) => {
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
export const addFooBarToYAML = (content) => {
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
export const removeYAMLFrontMatter = (content) => {
    const yamlRegex = /^---\n[\s\S]*?\n---\n/
    return content.replace(yamlRegex, '')
}

// Helper function to remove markdown links and images
export const removeMarkdownLinksAndImages = (content) => {
    return content.replace(/!\[.*?\]\(.*?\)/g, '') // Remove images
                  .replace(/\[.*?\]\(.*?\)/g, '')  // Remove links
}
