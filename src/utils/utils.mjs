import * as fs from 'fs'
import * as path from 'path'

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

// Function to update or add key-value pair in .env file
export const updateEnvFile = (key, value, envFilePath = '.env') => {
    const filePath = path.resolve(envFilePath)

    // Read the .env file
    let envContent = ''
    try {
        envContent = fs.readFileSync(filePath, 'utf-8')
    } catch (err) {
        console.log(`Creating new .env file at ${filePath}`)
    }

    const lines = envContent.split('\n')
    let keyFound = false
    const newLines = lines.map(line => {
        const [currentKey] = line.split('=')

        // Check if the current line contains the key we want to update
        if (currentKey === key) {
            keyFound = true
            if (!value) return `` // If value is empty, empty the line
            return `${key}=${value}` // Update the key with the new value
        }

        return line
    }).filter((line) => !!line)

    // If the key was not found, add it to the end of the file
    if (!keyFound) {
        newLines.push(`${key}=${value}`)
    }

    // Write the updated content back to the .env file
    fs.writeFileSync(filePath, newLines.join('\n'), 'utf-8')
    if (!value) {
        return console.log(`🗑 Deleted line ${key} from .env file:`)
    }
    console.log(`💾 Updated .env file: ${key}=${value}`)
}