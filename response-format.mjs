export const responseFormat = {
  "name": "job_ad_analysis",
  "strict": true,
  "schema": {
    "type": "object",
    "properties": {
      "employer": {
        "type": "string",
        "description": "The name of the legal structure that is hiring."
      },
      "role": {
        "type": "string",
        "description": "The name of the role expected to be played by the new recruit. If it's not related to the web or the mobile domain, return the 'Other' value",
        "enum": ["Front-End Developer", "Back-End Developer", "Full-Stack Developer", "DevOps Engineer", "Mobile Developer", "Security Engineer", "Other"]
      },
      "description": {
        "type": "string",
        "description": "Describe in a few lines who is hiring and for what purpose."
      },
      "experience": {
        "type": "integer",
        "description": "The number of years of previous experience expected of the new recruit."
      },
      "skills": {
        "type": "array",
        "items": {
          "type": "string",
          "description": "List as many skills expected of the new recruit as you can. It could be soft skills, hard skills, natural languages (such as like English, French, Dutch, German, etc...), name of technologies, programming languages, code frameworks, code libraries, softwares, theoritical skills, expertise fields. Don't include technology version numbers in their names."
        }
      },
      "work_hours": {
        "type": "integer",
        "description": "The number of work hours that the new recruit is expected to do. By default, it's 40 hours."
      },
      "is_ethical": {
        "type": "boolean",
        "description": "Only return true if the job is involved in areas such as sustainable development, the circular economy, medical innovation, healthy eating, solidarity and gender equality."
      },
      "is_remote": {
        "type": "boolean",
        "description": "Only return true if the job conditions include partially or totally working remotely."
      }
    },
    "additionalProperties": false,
    "required": [
      "employer",
      "role",
      "description",
      "experience",
      "skills",
      "work_hours",
      "is_ethical",
      "is_remote"
    ]
  }
}