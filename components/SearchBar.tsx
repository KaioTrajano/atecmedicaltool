
import React, { useState } from 'react';

interface SearchBarProps {
  onSearch: (query: string, mode: 'single' | 'bulk') => void;
  isSearching: boolean;
}

const SearchBar: React.FC<SearchBarProps> = ({ onSearch, isSearching }) => {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<'single' | 'bulk'>('single');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    onSearch(query, mode);
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Abas compactas */}
      <div className="flex justify-center mb-5 p-1 bg-white border border-slate-100 rounded-full w-fit mx-auto shadow-sm">
        <button
          onClick={() => setMode('single')}
          type="button"
          className={`px-5 py-2 text-[8px] font-black uppercase tracking-widest rounded-full transition-all duration-300 ${
            mode === 'single' ? 'bg-[#00D17B] text-white shadow-md' : 'text-slate-400'
          }`}
        >
          Única
        </button>
        <button
          onClick={() => setMode('bulk')}
          type="button"
          className={`px-5 py-2 text-[8px] font-black uppercase tracking-widest rounded-full transition-all duration-300 ${
            mode === 'bulk' ? 'bg-[#00D17B] text-white shadow-md' : 'text-slate-400'
          }`}
        >
          Lista
        </button>
      </div>

      <form onSubmit={handleSubmit} className="relative">
        <div className="bg-white rounded-[1.2rem] sm:rounded-[2rem] border border-slate-200 shadow-md overflow-hidden transition-all focus-within:border-[#00D17B] focus-within:ring-2 focus-within:ring-emerald-500/5">
          {mode === 'single' ? (
            <div className="flex items-center px-4 sm:px-6 bg-white">
              <input
                type="text"
                className="w-full py-4 sm:py-6 text-sm sm:text-lg bg-white outline-none placeholder-slate-200 text-slate-800 font-bold tracking-tight"
                placeholder="Ex: Afastador Sen Muller..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          ) : (
             <textarea
                className="w-full p-4 sm:p-8 text-sm sm:text-lg bg-white outline-none resize-none h-28 sm:h-40 placeholder-slate-200 text-slate-800 font-bold tracking-tight"
                placeholder="Cole sua lista cirúrgica aqui..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
          )}
        </div>
        
        <button
          type="submit"
          disabled={isSearching}
          className="absolute right-1.5 bottom-1.5 sm:right-3 sm:bottom-3 w-10 h-10 sm:w-14 sm:h-14 bg-[#00D17B] rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/30 hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
        >
          {isSearching ? (
            <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
          ) : (
            <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          )}
        </button>
      </form>
    </div>
  );
};

export default SearchBar;
