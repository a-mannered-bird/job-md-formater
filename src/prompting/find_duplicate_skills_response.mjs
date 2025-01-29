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
          "description": "List of \"Duplicate\" skill names grouped under the \"Best Name.\""
        },
        "description": "An object where each key is the \"Best Name\" of a skill, and the value is a list of duplicate names for that skill, or \"Duplicates Array\"."
      }
    },
    "required": ["skills"],
    "description": "Structured output that groups duplicate skills under a \"Best Name.\""
  }
}