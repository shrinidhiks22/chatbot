
export interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  image?: string;
}

export type View = 'chat' | 'live';

export interface Transcript {
  id: string;
  text: string;
  sender: 'user' | 'bot';
}

export interface Language {
  code: string;
  name: string;
}

export const SUPPORTED_LANGUAGES: Language[] = [
    { code: 'en-US', name: 'English' },
    { code: 'hi-IN', name: 'Hindi' },
    { code: 'bn-IN', name: 'Bengali' },
    { code: 'te-IN', name: 'Telugu' },
    { code: 'mr-IN', name: 'Marathi' },
    { code: 'ta-IN', name: 'Tamil' },
    { code: 'gu-IN', name: 'Gujarati' },
];
