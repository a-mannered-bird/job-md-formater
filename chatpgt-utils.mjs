import OpenAI from 'openai'
import * as dotenv from 'dotenv'

dotenv.config()
const openai = new OpenAI()

export const createAssistant = async (config) => {
  // Create a new chat GPT assistant that will analyze the markdown job description
  const assistant = await openai.beta.assistants.create(config)

  // Create a new thread on the assistant
  const thread = await openai.beta.threads.create()

  return {assistant, thread}
}

export const deleteAssistant = async (assistantId) => {
  console.log(`🗑 Deleting assistant ${assistantId}`)
  const response = await openai.beta.assistants.del(assistantId)
  console.log(response)
}

export const deleteThread = async (threadId) => {
  console.log(`🗑 Deleting thread ${threadId}`)
  const response = await openai.beta.threads.del(threadId);
  console.log(response)
}


export const postMessageAndGetResponse = async (assistant_id, thread_id, content) => {
  
  // Post the user message to the thread
  const message = await openai.beta.threads.messages.create(
    thread_id, {role: "user", content}
  )

  // Start a run on the thread -> AI is responding
  let run = await openai.beta.threads.runs.createAndPoll(
    thread_id, {assistant_id}
  )

  // Wait until run is finished to fetch the messages
  if (run.status === 'completed') {
    const messages = await openai.beta.threads.messages.list(
      thread_id
    )
    return messages.data[0]
  } else {
    console.log(`The chat GPT run has failed with status ${run.status}`)
  }
}