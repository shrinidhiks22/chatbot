

import { useState, useEffect } from 'react';

export const useTextToSpeech = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const synthRef = typeof window !== 'undefined' ? window.speechSynthesis : null;

  const speak = (text: string, lang: string) => {
    if (synthRef && text) {
      // Cancel any previous speech
      if (isSpeaking) {
        synthRef.cancel();
      }
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      synthRef.speak(utterance);
    }
  };

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (synthRef && isSpeaking) {
        synthRef.cancel();
      }
    };
  }, [synthRef, isSpeaking]);

  return { speak, isSpeaking };
};
