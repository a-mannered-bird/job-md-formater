export const responseFormat = {
  "name": "find-duplicate-skills",
  "strict": false,
  "schema": {
    "type": "object",
    "properties": {
      "skills": {
        "type": "object",
        "additionalProperties": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "List of duplicate skill names grouped under the True Name."
        },
        "description": "An object where each key is the True Name of a skill, and the value is a list of duplicate names for that skill."
      }
    },
    "required": ["skills"],
    "description": "Structured output that groups duplicate skills under a True Name."
  }
}