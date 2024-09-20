import OpenAI from 'openai'
const openai = new OpenAI()

export const createAssistant = async () => {
  const assistant = await openai.beta.assistants.create({
    name: "Job ad analyzer",
    instructions: "You are an assistant specialized in extracting data from job ads submitted to you. The user will send you job ads fully redacted in markdown format, you will analyze them and extract the informations detailed in the JSON response format attached. Whatever the language of the job ad, you should always answer in english.",
    model: "gpt-4o",
  })

  const thread = await openai.beta.threads.create()

  return {assistant, thread}
}

export const createMessage = async () => {
  const message = await openai.beta.threads.messages.create(
    thread.id,
    {
      role: "user",
      content: "I need to solve the equation `3x + 11 = 14`. Can you help me?"
    }
  )
}