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
        "description": "The name of the role expected to be played by the new recruit.",
        "enum": ["Front-End Developer", "Back-End Developer", "Full-Stack Developer", "DevOps Engineer", "Mobile Developer", "Security Engineer", "Other"]
      },
      "experience": {
        "type": "integer",
        "description": "The number of years of previous experience expected of the new recruit."
      },
      "skills": {
        "type": "array",
        "items": {
          "type": "string",
          "description": "The skills expected of the new recruit. It could be soft skills, hard skills, natural languages (such as like English, French, Dutch, German, etc...), name of technologies, programming languages, code frameworks, code libraries, softwares, theoritical skills, expertise fields. Don't include technology version numbers in their names."
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
      "is_flexible": {
        "type": "boolean",
        "description": "Only return true if the job conditions include working from home, having reduced hours, or more than 30 days of holidays."
      },
      "is_attractive": {
        "type": "boolean",
        "description": "Only return true if the job is attractive for my personal tastes. I like anything that has to do with music, video games, ecology. I don't like the following: Finance, banking institutions (unless explicitely ethical), consulting companies, audit companies."
      } 
    },
    "additionalProperties": false,
    "required": [
      "employer",
      "role",
      "experience",
      "skills",
      "work_hours",
      "is_ethical",
      "is_flexible",
      "is_attractive"
    ]
  }
}