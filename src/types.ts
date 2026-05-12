export interface QuizOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface QuizQuestion {
  text: string;
  options: QuizOption[];
  imageUrl?: string;
}

export interface Quiz {
  id?: string;
  adminId: string;
  title: string;
  subject: string;
  timerPerQuestion: number;
  questions: QuizQuestion[];
  createdAt: number;
}

export type SessionStatus = 'waiting' | 'active' | 'finished';

export interface Session {
  id?: string;
  adminId: string;
  quizId: string;
  status: SessionStatus;
  currentQuestionIndex: number;
  questionEndTime: number;
  createdAt: number;
}

export interface ParticipantAnswer {
  optionId: string;
  isCorrect: boolean;
  scoreReceived: number;
}

export interface Participant {
  id?: string;
  name: string;
  score: number;
  avatarUrl?: string;
  answers: Record<string, ParticipantAnswer>;
  createdAt: number;
}
