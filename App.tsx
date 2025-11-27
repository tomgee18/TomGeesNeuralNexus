import React, { useState, useEffect } from 'react';
import { APP_NAME, APP_VERSION } from './constants';
import { GameState, StudySessionData, InputContext } from './types';
import { generateGameSession } from './services/geminiService';
import Ingest from './components/Ingest';
import Session from './components/Session';
import { Brain, Loader2 } from 'lucide-react';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.INIT);
  const [apiKey, setApiKey] = useState('');
  const [inputContext, setInputContext] = useState<InputContext | null>(null);
  const [sessionData, setSessionData] = useState<StudySessionData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Strictly adhere to process.env.API_KEY usage
    if (process.env.API_KEY) {
        setApiKey(process.env.API_KEY);
        setGameState(GameState.INGESTION);
    } else {
        setError("CRITICAL SYSTEM FAILURE: ENV_KEY_MISSING. Please configure the environment correctly.");
    }
  }, []);

  const handleStartProcessing = async (input: InputContext) => {
    setInputContext(input);
    setGameState(GameState.PROCESSING);
    setError(null);

    try {
        const data = await generateGameSession(input, apiKey);
        setSessionData(data);
        setGameState(GameState.SESSION_ACTIVE);
    } catch (e) {
        console.error(e);
        setError("Neural construction failed. The artifact may be too complex or the connection was interrupted.");
        setGameState(GameState.INGESTION);
    }
  };

  return (
    <div className="min-h-screen w-full bg-nexus-dark text-slate-200 font-body selection:bg-cyan-500/30 flex flex-col">
      {/* Background Elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-900/10 rounded-full blur-[120px] animate-pulse-slow" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-cyan-900/10 rounded-full blur-[120px] animate-pulse-slow" style={{ animationDelay: '2s' }} />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-5 mix-blend-soft-light" />
      </div>

      {/* Main Content Container */}
      <main className="relative z-10 container mx-auto flex-1 flex flex-col p-4 lg:p-6">
        {/* Navbar */}
        <header className="h-16 flex items-center justify-between px-2 lg:px-6 border-b border-white/5 bg-nexus-dark/50 backdrop-blur-sm mb-6 rounded-lg">
            <div className="flex items-center gap-3">
                <Brain className="w-6 h-6 text-cyan-400" />
                <h1 className="font-display font-bold text-xl tracking-widest text-white truncate">
                    {APP_NAME} <span className="hidden sm:inline text-xs font-mono text-slate-500 font-normal">{APP_VERSION}</span>
                </h1>
            </div>
            <div className="text-xs font-mono text-slate-500 flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${apiKey ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="hidden sm:inline">SYSTEM_</span>{apiKey ? 'ONLINE' : 'OFFLINE'}
            </div>
        </header>

        <div className="flex-1 flex flex-col justify-center">
            {error && gameState !== GameState.INGESTION && (
                 <div className="max-w-md mx-auto p-8 glass-panel rounded-xl text-center border border-red-500/30">
                    <h2 className="text-xl font-display text-red-400 mb-2">SYSTEM ALERT</h2>
                    <p className="text-slate-400 text-sm">{error}</p>
                 </div>
            )}

            {gameState === GameState.INGESTION && (
                <>
                    <Ingest onStart={handleStartProcessing} />
                    {error && (
                        <div className="max-w-xl mx-auto mt-4 p-4 bg-red-900/20 border border-red-500/50 rounded-lg text-red-200 text-sm text-center animate-pulse">
                            {error}
                        </div>
                    )}
                </>
            )}

            {gameState === GameState.PROCESSING && (
                <div className="text-center animate-fade-in py-20">
                    <div className="relative w-24 h-24 mx-auto mb-8">
                        <div className="absolute inset-0 border-t-2 border-cyan-500 rounded-full animate-spin" />
                        <div className="absolute inset-2 border-r-2 border-purple-500 rounded-full animate-spin-slow" />
                        <Loader2 className="absolute inset-0 w-full h-full p-6 text-slate-600 animate-pulse" />
                    </div>
                    <h2 className="text-3xl font-display text-white mb-2">ANALYZING ARTIFACT</h2>
                    <p className="text-slate-400 font-mono text-sm animate-pulse">Extracting concepts & neural pathways...</p>
                    <div className="mt-8 max-w-md mx-auto">
                        <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 w-1/2 animate-[translateX_2s_ease-in-out_infinite]" />
                        </div>
                    </div>
                </div>
            )}

            {gameState === GameState.SESSION_ACTIVE && sessionData && inputContext && (
                <Session 
                    data={sessionData} 
                    context={inputContext} 
                    apiKey={apiKey} 
                    onExit={() => setGameState(GameState.INGESTION)} 
                />
            )}
        </div>
      </main>
    </div>
  );
};

export default App;