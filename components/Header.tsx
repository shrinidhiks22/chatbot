
import React from 'react';
import { View, Language, SUPPORTED_LANGUAGES } from '../types';
import { BotIcon, ChatIcon, MicIcon, GlobeIcon } from './icons';

interface HeaderProps {
  currentView: View;
  onViewChange: (view: View) => void;
  currentLanguage: Language;
  onLanguageChange: (language: Language) => void;
}

const Header: React.FC<HeaderProps> = ({ currentView, onViewChange, currentLanguage, onLanguageChange }) => {

  const handleLanguageSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedLang = SUPPORTED_LANGUAGES.find(l => l.code === e.target.value);
    if (selectedLang) {
      onLanguageChange(selectedLang);
    }
  };

  return (
    <header className="bg-brand-green-dark text-white p-4 shadow-md flex justify-between items-center flex-wrap">
      <div className="flex items-center space-x-3 mb-2 sm:mb-0">
        <BotIcon className="w-8 h-8"/>
        <h1 className="text-xl md:text-2xl font-bold">Farmer Query Assistant</h1>
      </div>
      <div className="flex items-center space-x-2">
        <div className="flex items-center bg-gray-900/20 rounded-full">
            <GlobeIcon className="w-5 h-5 text-white ml-3"/>
            <select
                value={currentLanguage.code}
                onChange={handleLanguageSelect}
                className="bg-transparent text-white p-2 rounded-full focus:outline-none focus:ring-2 focus:ring-white/50 appearance-none"
                aria-label="Select language"
            >
                {SUPPORTED_LANGUAGES.map(lang => (
                    <option key={lang.code} value={lang.code} className="text-black">
                        {lang.name}
                    </option>
                ))}
            </select>
        </div>

        <div className="flex items-center bg-brand-green rounded-full p-1">
          <button
            onClick={() => onViewChange('chat')}
            className={`px-3 py-1.5 text-sm font-semibold rounded-full flex items-center space-x-2 transition-colors duration-300 ${
              currentView === 'chat' ? 'bg-white text-brand-green-dark' : 'text-white'
            }`}
          >
            <ChatIcon className="w-5 h-5" />
            <span>Chat</span>
          </button>
          <button
            onClick={() => onViewChange('live')}
            className={`px-3 py-1.5 text-sm font-semibold rounded-full flex items-center space-x-2 transition-colors duration-300 ${
              currentView === 'live' ? 'bg-white text-brand-green-dark' : 'text-white'
            }`}
          >
            <MicIcon className="w-5 h-5"/>
            <span>Live</span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
