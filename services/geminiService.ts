import { GoogleGenAI, Type, Schema } from "@google/genai";
import { StudySessionData, QuestionType, InputContext, DeepDiveContent, ChallengeResult } from "../types";

const responseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "A cool, short academic title for the session based on the content."
    },
    summary: {
      type: Type.STRING,
      description: "A concise executive summary of the provided text (max 3 sentences)."
    },
    concepts: {
      type: Type.ARRAY,
      description: "6-8 core concepts extracted from the text for study flashcards.",
      items: {
        type: Type.OBJECT,
        properties: {
            id: { type: Type.STRING },
            term: { type: Type.STRING },
            definition: { type: Type.STRING, description: "Academic definition." },
            analogy: { type: Type.STRING, description: "A real-world analogy to help understand the concept easily." }
        },
        required: ["id", "term", "definition", "analogy"]
      }
    },
    questions: {
      type: Type.ARRAY,
      description: "3 assessment items.",
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          type: { type: Type.STRING, enum: [QuestionType.CONCEPT_CHECK, QuestionType.SOCRATIC_DEFENSE, QuestionType.COUNTER_THEORY] },
          question: { type: Type.STRING },
          options: { type: Type.ARRAY, items: { type: Type.STRING }, description: "4 options for CONCEPT_CHECK, empty for others" },
          correctOptionIndex: { type: Type.INTEGER, description: "Index of correct option for CONCEPT_CHECK, -1 for others" },
          explanation: { type: Type.STRING, description: "Deep academic explanation of the answer." },
          difficulty: { type: Type.INTEGER, description: "Rating 1-10" }
        },
        required: ["id", "type", "question", "explanation", "difficulty"]
      }
    }
  },
  required: ["title", "summary", "concepts", "questions"]
};

// Helper to construct parts for file or text
const getParts = (input: InputContext, textPrompt: string) => {
    if (input.type === 'file' && input.mimeType) {
        return [
            { inlineData: { mimeType: input.mimeType, data: input.content } },
            { text: textPrompt }
        ];
    }
    return [{ text: `Context: ${input.content.substring(0, 30000)}\n\n${textPrompt}` }];
};

export const generateGameSession = async (input: InputContext, apiKey: string): Promise<StudySessionData> => {
  const ai = new GoogleGenAI({ apiKey });
  
  const instruction = `
    Analyze the following academic content. 
    Create a 'Neural Nexus' study guide and assessment suite.
    Target audience: Graduate Students.
    
    Phase 1: Extraction
    - Extract 6-8 pivotal concepts.
    - Provide a rigorous definition and a creative analogy for each.
    
    Phase 2: Simulation (Assessment)
    - Generate 2 CONCEPT_CHECK questions (Multiple Choice).
    - Generate 1 SOCRATIC_DEFENSE question (Open-ended thought experiment).
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: getParts(input, instruction) },
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.2
      }
    });

    if (response.text) {
      const data = JSON.parse(response.text) as StudySessionData;
      data.concepts = data.concepts.map(c => ({...c, mastered: false}));
      return data;
    }
    throw new Error("No response text generated");
  } catch (error) {
    console.error("Gemini Generation Error:", error);
    throw error;
  }
};

export const generateDeepDive = async (term: string, input: InputContext, apiKey: string): Promise<DeepDiveContent> => {
    const ai = new GoogleGenAI({ apiKey });
    const schema: Schema = {
        type: Type.OBJECT,
        properties: {
            theoreticalUnderpinnings: { type: Type.STRING, description: "Deep theoretical background." },
            realWorldApplication: { type: Type.STRING, description: "Concrete, complex example." },
            interdisciplinaryConnection: { type: Type.STRING, description: "How this connects to other fields." }
        },
        required: ["theoreticalUnderpinnings", "realWorldApplication", "interdisciplinaryConnection"]
    };

    const prompt = `Provide a graduate-level deep dive into the concept: "${term}" based on the provided text. Focus on nuance and advanced understanding.`;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: getParts(input, prompt) },
        config: { responseMimeType: "application/json", responseSchema: schema }
    });

    if (response.text) return JSON.parse(response.text);
    throw new Error("Deep dive generation failed");
};

export const generateConceptChallenge = async (term: string, input: InputContext, apiKey: string): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `Generate ONE difficult, short-answer question to test the student's deep understanding of the concept: "${term}". Do not ask for a definition. Ask for an application or synthesis.`;
    
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: getParts(input, prompt) }
    });

    return response.text || "Explain this concept in your own words.";
};

export const evaluateChallenge = async (question: string, userAnswer: string, input: InputContext, apiKey: string): Promise<ChallengeResult> => {
    const ai = new GoogleGenAI({ apiKey });
    const schema: Schema = {
        type: Type.OBJECT,
        properties: {
            passed: { type: Type.BOOLEAN, description: "True if the student demonstrated good understanding." },
            score: { type: Type.INTEGER, description: "0-100" },
            feedback: { type: Type.STRING, description: "Brief, constructive feedback." }
        },
        required: ["passed", "score", "feedback"]
    };

    const prompt = `
        Question: ${question}
        Student Answer: ${userAnswer}
        Evaluate the answer strictly. High standards.
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: getParts(input, prompt) },
        config: { responseMimeType: "application/json", responseSchema: schema }
    });

    if (response.text) return JSON.parse(response.text);
    throw new Error("Evaluation failed");
};

export const evaluateSocraticAnswer = async (question: string, userAnswer: string, context: InputContext, apiKey: string): Promise<{score: number, feedback: string}> => {
    const ai = new GoogleGenAI({ apiKey });
    
    const schema: Schema = {
        type: Type.OBJECT,
        properties: {
            score: { type: Type.INTEGER, description: "Score from 0 to 100 based on accuracy and depth." },
            feedback: { type: Type.STRING, description: "Constructive criticism in the tone of a strict professor." }
        },
        required: ["score", "feedback"]
    };

    const instruction = `
        Question: ${question}
        Student Answer: ${userAnswer}
        
        Evaluate the student's answer based on the provided context. Be rigorous but helpful.
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: getParts(context, instruction) },
        config: {
            responseMimeType: "application/json",
            responseSchema: schema
        }
    });

    if (response.text) {
        return JSON.parse(response.text);
    }
    return { score: 0, feedback: "Analysis failed." };
}