
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Chat, Part } from '@google/genai';
import { Message, Language } from '../types';
import { SendIcon, ImageIcon, MicIcon, VolumeUpIcon, StopCircleIcon } from './icons';
import { useSpeechToText } from '../hooks/useSpeechToText';
import { useTextToSpeech } from '../hooks/useTextToSpeech';

// Helper function to convert file to base64
const fileToGenerativePart = async (file: File): Promise<Part> => {
  const base64EncodedDataPromise = new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.readAsDataURL(file);
  });
  return {
    inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
  };
};

interface ChatViewProps {
    language: Language;
}

const ChatView: React.FC<ChatViewProps> = ({ language }) => {
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', text: 'Hello! How can I help you today? Ask me about your crops, soil, or any farming questions.', sender: 'bot' },
  ]);
  const [input, setInput] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatHistoryRef = useRef<HTMLDivElement>(null);

  const { isListening, transcript, startListening, stopListening } = useSpeechToText(language.code);
  const { speak, isSpeaking } = useTextToSpeech();

  const chatRef = useRef<Chat | null>(null);

  // Reset chat when language changes
  useEffect(() => {
    chatRef.current = null;
    setMessages([
      { id: '1', text: 'Hello! How can I help you today? Ask me about your crops, soil, or any farming questions.', sender: 'bot' },
    ]);
  }, [language]);

  useEffect(() => {
    if (transcript) {
      setInput(transcript);
    }
  }, [transcript]);
  
  useEffect(() => {
    chatHistoryRef.current?.scrollTo(0, chatHistoryRef.current.scrollHeight);
  }, [messages]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim() && !image) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: input,
      sender: 'user',
      image: imagePreview || undefined,
    };
    setMessages((prev) => [...prev, userMessage]);

    setIsLoading(true);

    // Reset inputs after capturing their values
    const currentInput = input;
    const currentImage = image;
    setInput('');
    setImage(null);
    setImagePreview(null);
    if(fileInputRef.current) fileInputRef.current.value = '';

    try {
        if (!chatRef.current) {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            chatRef.current = ai.chats.create({ 
                model: 'gemini-2.5-flash',
                config: {
                    systemInstruction: `You are a helpful farming assistant. The user is speaking ${language.name}. Respond ONLY in ${language.name}.`,
                }
            });
        }
        
        const botMessageId = (Date.now() + 1).toString();
        setMessages((prev) => [...prev, { id: botMessageId, text: '', sender: 'bot' }]);
        
        const parts: Part[] = [];
        if (currentInput.trim()) {
            parts.push({ text: currentInput });
        }
        if (currentImage) {
            parts.push(await fileToGenerativePart(currentImage));
        }

        const result = await chatRef.current.sendMessageStream({ 
            message: parts,
            model: 'gemini-2.5-flash-lite',
        });

        let fullResponse = '';
        for await (const chunk of result) {
            const chunkText = chunk.text;
            fullResponse += chunkText;
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === botMessageId ? { ...msg, text: fullResponse } : msg
              )
            );
        }
        speak(fullResponse, language.code);

    } catch (error) {
      console.error('Error sending message:', error);
      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), text: 'Sorry, I encountered an error. Please try again.', sender: 'bot' },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMicClick = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  return (
    <div className="flex flex-col h-full bg-brand-light-gray">
      <div ref={chatHistoryRef} className="flex-grow p-6 overflow-y-auto space-y-6">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex items-end gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.sender === 'bot' && <div className="w-8 h-8 bg-brand-green rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">AI</div>}
            <div className={`max-w-xs md:max-w-md p-4 rounded-2xl ${msg.sender === 'user' ? 'bg-brand-green text-white rounded-br-none' : 'bg-gray-200 text-gray-800 rounded-bl-none'}`}>
              {msg.image && <img src={msg.image} alt="User upload" className="rounded-lg mb-2 max-h-48" />}
              <p className="whitespace-pre-wrap">{msg.text}</p>
              {msg.sender === 'bot' && msg.text && !isLoading && (
                <button onClick={() => speak(msg.text, language.code)} disabled={isSpeaking} className="mt-2 text-brand-green-dark disabled:text-gray-400">
                  <VolumeUpIcon className="w-5 h-5"/>
                </button>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
            <div className="flex items-end gap-3 justify-start">
                <div className="w-8 h-8 bg-brand-green rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">AI</div>
                <div className="max-w-xs md:max-w-md p-4 rounded-2xl bg-gray-200 text-gray-800 rounded-bl-none">
                    <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-brand-green rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-brand-green rounded-full animate-bounce delay-150"></div>
                        <div className="w-2 h-2 bg-brand-green rounded-full animate-bounce delay-300"></div>
                    </div>
                </div>
            </div>
        )}
      </div>

      <div className="p-4 border-t bg-white">
        {imagePreview && (
          <div className="relative w-24 h-24 mb-2">
            <img src={imagePreview} alt="Preview" className="w-full h-full object-cover rounded-md" />
            <button onClick={() => { setImage(null); setImagePreview(null); }} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        )}
        <div className="flex items-center space-x-2">
          <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageChange} className="hidden" />
          <button onClick={() => fileInputRef.current?.click()} className="p-2 text-gray-500 hover:text-brand-green transition-colors">
            <ImageIcon className="w-6 h-6" />
          </button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && !isLoading && handleSendMessage()}
            placeholder={isListening ? "Listening..." : "Type your question..."}
            className="flex-grow px-4 py-2 border rounded-full focus:outline-none focus:ring-2 focus:ring-brand-green"
            disabled={isLoading}
          />
          <button onClick={handleMicClick} className={`p-2 transition-colors ${isListening ? 'text-red-500' : 'text-gray-500 hover:text-brand-green'}`}>
            {isListening ? <StopCircleIcon className="w-6 h-6" /> : <MicIcon className="w-6 h-6" />}
          </button>
          <button onClick={handleSendMessage} disabled={isLoading || (!input.trim() && !image)} className="p-2 bg-brand-green text-white rounded-full disabled:bg-gray-400 hover:bg-brand-green-dark transition-colors">
            <SendIcon className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatView;
