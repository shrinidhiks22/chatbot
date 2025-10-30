
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, LiveSession, LiveServerMessage, Modality } from '@google/genai';
import { createBlob, decodeAudioData } from '../utils/audioUtils';
import { Transcript, Language } from '../types';
import { MicIcon, PlayIcon, StopIcon } from './icons';

type ConnectionState = 'idle' | 'connecting' | 'connected' | 'error' | 'closed';

interface LiveViewProps {
    language: Language;
}

const LiveView: React.FC<LiveViewProps> = ({ language }) => {
    const [connectionState, setConnectionState] = useState<ConnectionState>('idle');
    const [transcripts, setTranscripts] = useState<Transcript[]>([]);

    const sessionPromiseRef = useRef<Promise<LiveSession> | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const nextStartTimeRef = useRef<number>(0);
    const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

    const currentInputTranscription = useRef<string>('');
    const currentOutputTranscription = useRef<string>('');
    
    const stopConversation = useCallback(async () => {
        if (sessionPromiseRef.current) {
            try {
                const session = await sessionPromiseRef.current;
                session.close();
            } catch (e) {
                console.error("Error closing session", e);
            }
        }
        
        scriptProcessorRef.current?.disconnect();
        mediaStreamSourceRef.current?.disconnect();
        // Check if context is running before closing
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            audioContextRef.current.close();
        }

        scriptProcessorRef.current = null;
        mediaStreamSourceRef.current = null;
        audioContextRef.current = null;
        sessionPromiseRef.current = null;
        
        setConnectionState('idle');
    }, []);

    // Stop conversation if language changes
    useEffect(() => {
        if(connectionState === 'connected' || connectionState === 'connecting') {
            stopConversation();
        }
    }, [language, connectionState, stopConversation]);


    const startConversation = async () => {
        setConnectionState('connecting');
        setTranscripts([]);
        currentInputTranscription.current = '';
        currentOutputTranscription.current = '';

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

            sessionPromiseRef.current = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                config: {
                    responseModalities: [Modality.AUDIO],
                    inputAudioTranscription: {},
                    outputAudioTranscription: {},
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
                    systemInstruction: `You are a friendly and helpful agricultural assistant for farmers. The user is speaking ${language.name}. Respond ONLY in ${language.name}. Keep your answers concise and clear.`,
                },
                callbacks: {
                    onopen: () => {
                        setConnectionState('connected');
                        mediaStreamSourceRef.current = audioContextRef.current!.createMediaStreamSource(stream);
                        scriptProcessorRef.current = audioContextRef.current!.createScriptProcessor(4096, 1, 1);
                        
                        scriptProcessorRef.current.onaudioprocess = (audioProcessingEvent) => {
                            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                            const pcmBlob = createBlob(inputData);
                            sessionPromiseRef.current?.then((session) => {
                                session.sendRealtimeInput({ media: pcmBlob });
                            });
                        };
                        
                        mediaStreamSourceRef.current.connect(scriptProcessorRef.current);
                        scriptProcessorRef.current.connect(audioContextRef.current!.destination);
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        handleTranscription(message);
                        await handleAudio(message);
                    },
                    onerror: (e: ErrorEvent) => {
                        console.error('Live session error:', e);
                        setConnectionState('error');
                        stopConversation();
                    },
                    onclose: () => {
                        setConnectionState('closed');
                        stopMediaDevices(stream);
                    },
                },
            });

        } catch (error) {
            console.error('Failed to start conversation:', error);
            setConnectionState('error');
        }
    };
    
    const handleTranscription = (message: LiveServerMessage) => {
        if (message.serverContent?.outputTranscription) {
            currentOutputTranscription.current += message.serverContent.outputTranscription.text;
        }
        if (message.serverContent?.inputTranscription) {
            currentInputTranscription.current += message.serverContent.inputTranscription.text;
        }

        if (message.serverContent?.turnComplete) {
            const finalInput = currentInputTranscription.current.trim();
            const finalOutput = currentOutputTranscription.current.trim();

            setTranscripts(prev => [
                ...prev,
                ...(finalInput ? [{ id: `user-${Date.now()}`, text: finalInput, sender: 'user' as const }] : []),
                ...(finalOutput ? [{ id: `bot-${Date.now()}`, text: finalOutput, sender: 'bot' as const }] : []),
            ]);
            
            currentInputTranscription.current = '';
            currentOutputTranscription.current = '';
        }
    };

    const handleAudio = async (message: LiveServerMessage) => {
        const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData.data;
        if (audioData && outputAudioContextRef.current) {
             const ctx = outputAudioContextRef.current;
             nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
             const audioBuffer = await decodeAudioData(audioData, ctx);
             const source = ctx.createBufferSource();
             source.buffer = audioBuffer;
             source.connect(ctx.destination);
             source.addEventListener('ended', () => audioSourcesRef.current.delete(source));
             source.start(nextStartTimeRef.current);
             nextStartTimeRef.current += audioBuffer.duration;
             audioSourcesRef.current.add(source);
        }

        if (message.serverContent?.interrupted) {
            for (const source of audioSourcesRef.current.values()) {
                source.stop();
            }
            audioSourcesRef.current.clear();
            nextStartTimeRef.current = 0;
        }
    };
    
    const stopMediaDevices = (stream: MediaStream) => {
        stream.getTracks().forEach(track => track.stop());
    }

    useEffect(() => {
        return () => {
            if (connectionState === 'connected' || connectionState === 'connecting') {
                stopConversation();
            }
        };
    }, [connectionState, stopConversation]);

    const getStatusText = () => {
        switch (connectionState) {
            case 'idle': return `Click start to begin a live conversation in ${language.name}.`;
            case 'connecting': return 'Connecting to the live session... Please wait.';
            case 'connected': return 'Connected. Start speaking now.';
            case 'error': return 'An error occurred. Please try again.';
            case 'closed': return 'Session closed.';
            default: return '';
        }
    };
    
    return (
        <div className="flex flex-col h-full p-6 text-center bg-brand-light-gray">
             <div className="flex-grow overflow-y-auto mb-4 text-left space-y-4">
                {transcripts.map((t) => (
                    <div key={t.id} className={`flex items-start gap-3 ${t.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`p-3 rounded-lg max-w-xl ${t.sender === 'user' ? 'bg-brand-green text-white' : 'bg-gray-200'}`}>
                            <span className="font-bold text-sm capitalize">{t.sender}</span>
                            <p>{t.text}</p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="flex-shrink-0">
                <p className="text-gray-600 mb-4 h-10">{getStatusText()}</p>
                {connectionState !== 'connected' && connectionState !== 'connecting' ? (
                     <button onClick={startConversation} className="px-8 py-4 bg-brand-green text-white font-bold rounded-full shadow-lg hover:bg-brand-green-dark transition-transform transform hover:scale-105 flex items-center justify-center mx-auto">
                        <PlayIcon className="w-6 h-6 mr-2" />
                        Start Conversation
                    </button>
                ) : (
                    <div className="flex flex-col items-center">
                        <button onClick={stopConversation} className="px-8 py-4 bg-red-500 text-white font-bold rounded-full shadow-lg hover:bg-red-600 transition-transform transform hover:scale-105 flex items-center justify-center mx-auto mb-4">
                            <StopIcon className="w-6 h-6 mr-2" />
                            End Conversation
                        </button>
                        <div className="flex items-center text-brand-green-dark">
                            <MicIcon className="w-6 h-6 mr-2 animate-pulse"/>
                            <span>Listening...</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LiveView;
