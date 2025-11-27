export enum GameState {
  INIT = 'INIT',
  INGESTION = 'INGESTION',
  PROCESSING = 'PROCESSING',
  SESSION_ACTIVE = 'SESSION_ACTIVE',
  SESSION_SUMMARY = 'SESSION_SUMMARY'
}

export enum QuestionType {
  CONCEPT_CHECK = 'CONCEPT_CHECK',
  SOCRATIC_DEFENSE = 'SOCRATIC_DEFENSE',
  COUNTER_THEORY = 'COUNTER_THEORY'
}

export interface StudyConcept {
  id: string;
  term: string;
  definition: string;
  analogy: string; // "Explain like I'm 5" or real-world parallel
  mastered: boolean; // Local state tracking
}

export interface DeepDiveContent {
  theoreticalUnderpinnings: string;
  realWorldApplication: string;
  interdisciplinaryConnection: string;
}

export interface ChallengeResult {
  passed: boolean;
  score: number;
  feedback: string;
}

export interface GameQuestion {
  id: string;
  type: QuestionType;
  question: string;
  options?: string[]; 
  correctOptionIndex?: number;
  explanation: string; 
  difficulty: number; 
}

export interface StudySessionData {
  title: string;
  summary: string;
  concepts: StudyConcept[];
  questions: GameQuestion[];
}

export interface PlayerStats {
  syncedNodes: number; // Number of concepts mastered
  stability: number; // 0-100%
  streak: number;
}

export interface InputContext {
  type: 'text' | 'file';
  content: string; // Text string or Base64 string
  mimeType?: string;
  fileName?: string;
}