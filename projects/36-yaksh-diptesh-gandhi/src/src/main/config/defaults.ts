import type { AppSettings } from './types'
import { ShortcutAction, type ShortcutConfig } from '../../shared/types'

/**
 * 默认设置 - 单一数据源
 * 所有默认配置都在这里定义，其他地方只引用
 */
export const defaultSettings: AppSettings = {
  theme: 'dark',
  language: 'en-US',
  autoLaunch: false,
  hasCompletedOnboarding: false,
  defaultChatModel: undefined,
  defaultEmbeddingModel: undefined,
  prompts: {
    mindMap: {
      'en-US': `You are a knowledge structure analysis expert, responsible for extracting core knowledge structures from notebook content.

**IMPORTANT: Please respond in English. All node labels must be in English.**

**Output Format Requirements (MUST strictly follow):**
You must return a JSON object with rootNode and metadata:
{
  "rootNode": {
    "id": "unique node ID (string)",
    "label": "node label (must be ≤24 characters)",
    "metadata": {
      "level": 0,
      "chunkIds": ["array of related chunk IDs"],
      "keywords": ["array of keywords (optional)"]
    },
    "children": [array of child nodes, each with same structure]
  },
  "metadata": {
    "totalNodes": total number of nodes (number),
    "maxDepth": maximum depth (number)
  }
}

**Content Requirements:**
1. **All node labels must be in English and strictly ≤ 24 characters** (VERY IMPORTANT!)
2. Hierarchy depth ≤ 4 levels (root node level=0, deepest level=3)
3. Each parent node must have 2-5 child nodes
4. Each node's id must be unique
5. Associate relevant chunk IDs in metadata.chunkIds whenever possible
6. totalNodes must equal the actual total number of nodes
7. maxDepth must equal the actual maximum hierarchy depth

**Notebook Content:**
{{CONTENT}}

Please generate a mind map structure based on the above content, strictly following the format requirements to return JSON.`
    },
    quiz: {
      'en-US': `You are an expert quiz generator. Based on the knowledge base content below, generate {{QUESTION_COUNT}} multiple-choice questions for knowledge testing.

**IMPORTANT: Please respond in English. All questions and options must be in English.**

**Output Format Requirements (MUST strictly follow):**
You must return a JSON object with questions and metadata:
{
  "questions": [
    {
      "id": "unique question ID (string)",
      "questionText": "question text (max 200 chars)",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 0,
      "explanation": "answer explanation (max 300 chars)",
      "hints": ["Hint 1", "Hint 2"],
      "metadata": {
        "chunkIds": ["array of related chunk IDs"]
      }
    }
  ],
  "metadata": {
    "totalQuestions": {{QUESTION_COUNT}}
  }
}

**Question Requirements:**
1. Generate **{{QUESTION_COUNT}} questions**, each with 4 options (A, B, C, D)
2. **Only one correct answer**, correctAnswer is an index value from 0-3
3. **Provide detailed explanation for each answer** (why it's correct, why others are wrong)
4. **Include 1-2 hints per question** (guide thinking, don't reveal answer directly)
5. Questions must be **based on provided content**, no fabrication
6. Cover **different knowledge points**
7. {{DIFFICULTY_INSTRUCTION}}
8. Associate relevant chunk IDs in metadata.chunkIds whenever possible

**Knowledge base content:**
{{CONTENT}}

Generate {{QUESTION_COUNT}} high-quality multiple-choice questions, strictly following the format requirements to return JSON.`
    },
    anki: {
      'en-US': `You are an Anki card generation expert. Based on the knowledge base content below, generate {{CARD_COUNT}} high-quality spaced repetition learning cards.

**IMPORTANT: Please respond in English. All card content must be in English.**

**Output Format Requirements (MUST strictly follow):**
You must return a JSON object with cards and metadata:
{
  "cards": [
    {
      "id": "unique card ID (string)",
      "type": "basic",
      "front": "question text",
      "back": "answer text",
      "tags": ["tag1", "tag2"],
      "metadata": {
        "chunkIds": ["array of related chunk IDs"],
        "difficulty": "medium"
      }
    }
  ],
  "metadata": {
    "totalCards": total number of cards
  }
}

**Basic Card Description:**
- type: "basic"
- front: direct question
- back: detailed answer
- Best for: definitions, concepts, principles, Q&A

**Generation Requirements:**
1. Generate **{{CARD_COUNT}} cards**, all of basic type
2. Each card must have front (question) and back (answer) fields
3. Questions should be concise and clear
4. Answers should be detailed and accurate
5. Associate relevant chunkIds for each card
6. Add appropriate tags (like "important", "concept", "principle", "formula")
7. Based on actual content, no fabrication
8. {{DIFFICULTY_INSTRUCTION}}

**Knowledge base content:**
{{CONTENT}}

Generate {{CARD_COUNT}} high-quality Basic type Anki cards, strictly following the format requirements to return JSON.`
    }
  }
}

/**
 * 默认快捷键配置
 */
export const defaultShortcuts: ShortcutConfig[] = [
  // 笔记本管理
  {
    action: ShortcutAction.CREATE_NOTEBOOK,
    accelerator: 'CommandOrControl+N',
    enabled: true,
    description: 'shortcuts:createNotebook'
  },
  {
    action: ShortcutAction.CLOSE_NOTEBOOK,
    accelerator: 'Escape',
    enabled: true,
    description: 'shortcuts:closeNotebook'
  },

  // 面板切换
  {
    action: ShortcutAction.TOGGLE_KNOWLEDGE_BASE,
    accelerator: 'CommandOrControl+[',
    enabled: true,
    description: 'shortcuts:toggleKnowledgeBase'
  },
  {
    action: ShortcutAction.TOGGLE_CREATIVE_SPACE,
    accelerator: 'CommandOrControl+]',
    enabled: true,
    description: 'shortcuts:toggleCreativeSpace'
  },
  // 编辑器
  {
    action: ShortcutAction.SAVE_NOTE,
    accelerator: 'CommandOrControl+S',
    enabled: true,
    description: 'shortcuts:saveNote'
  }
]
