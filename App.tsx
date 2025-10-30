
import React, { useState } from 'react';
import Header from './components/Header';
import ChatView from './components/ChatView';
import LiveView from './components/LiveView';
import { View, Language, SUPPORTED_LANGUAGES } from './types';

const App: React.FC = () => {
  const [view, setView] = useState<View>('chat');
  const [language, setLanguage] = useState<Language>(SUPPORTED_LANGUAGES[0]);

  return (
    <div className="bg-brand-cream min-h-screen font-sans flex flex-col">
      <Header 
        currentView={view} 
        onViewChange={setView}
        currentLanguage={language}
        onLanguageChange={setLanguage}
      />
      <main className="flex-grow flex items-center justify-center p-4">
        <div className="w-full max-w-3xl h-full max-h-[85vh] bg-white rounded-2xl shadow-2xl flex flex-col">
          {view === 'chat' ? <ChatView language={language} /> : <LiveView language={language} />}
        </div>
      </main>
    </div>
  );
};

export default App;
