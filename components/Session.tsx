import React, { useState, useEffect, useRef } from 'react';
import { StudySessionData, QuestionType, PlayerStats, StudyConcept, InputContext, DeepDiveContent } from '../types';
import { STABILITY_BONUS, STABILITY_PENALTY } from '../constants';
import Visualizer from './Visualizer';
import { evaluateSocraticAnswer, generateDeepDive, generateConceptChallenge, evaluateChallenge } from '../services/geminiService';
import { 
    ShieldCheck, ShieldAlert, Brain, Cpu, CheckCircle2, XCircle, 
    Database, PlayCircle, BookOpen, Sparkles, ChevronRight,
    Zap, Lock, Unlock, Download, Activity, Terminal, ArrowLeft, Loader2
} from 'lucide-react';

interface SessionProps {
  data: StudySessionData;
  context: InputContext;
  apiKey: string;
  onExit: () => void;
}

type ViewMode = 'DATA_CORE' | 'SIMULATION';
type ConceptMode = 'OVERVIEW' | 'DEEP_DIVE' | 'SYNC_PROTOCOL';
type MobileView = 'LIST' | 'FOCUS';

const Session: React.FC<SessionProps> = ({ data, context, apiKey, onExit }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('DATA_CORE');
  const [concepts, setConcepts] = useState<StudyConcept[]>(data.concepts);
  
  // Mobile Responsiveness State
  const [mobileView, setMobileView] = useState<MobileView>('LIST');

  // Data Core State
  const [activeConceptId, setActiveConceptId] = useState<string | null>(null);
  const [conceptMode, setConceptMode] = useState<ConceptMode>('OVERVIEW');
  const [deepDiveData, setDeepDiveData] = useState<Record<string, DeepDiveContent>>({});
  const [loadingDeepDive, setLoadingDeepDive] = useState(false);
  const [challengeQ, setChallengeQ] = useState<string | null>(null);
  const [challengeAnswer, setChallengeAnswer] = useState('');
  const [challengeFeedback, setChallengeFeedback] = useState<{passed: boolean, msg: string} | null>(null);
  const [loadingChallenge, setLoadingChallenge] = useState(false);

  // Quiz State
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [stats, setStats] = useState<PlayerStats>({ syncedNodes: 0, stability: 50, streak: 0 });
  const [history, setHistory] = useState<{ time: number; stability: number }[]>([{ time: 0, stability: 50 }]);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [socraticInput, setSocraticInput] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'neutral', msg: string } | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [quizComplete, setQuizComplete] = useState(false);

  const currentQ = data.questions[currentQIndex];
  const activeConcept = concepts.find(c => c.id === activeConceptId);
  const scrollRef = useRef<HTMLDivElement>(null);

  // -- Helpers --
  const updateStability = (delta: number) => {
    setStats(prev => {
      const newStability = Math.max(0, Math.min(100, prev.stability + delta));
      const newHistory = [...history, { time: history.length, stability: newStability }];
      if (newHistory.length > 20) newHistory.shift();
      setHistory(newHistory);
      return {
        ...prev,
        stability: newStability,
        streak: delta > 0 ? prev.streak + 1 : 0
      };
    });
  };

  const handleMobileBack = () => {
    setMobileView('LIST');
  };

  // -- Data Core Interactions --
  const handleConceptSelect = (id: string) => {
    setActiveConceptId(id);
    setConceptMode('OVERVIEW');
    setChallengeQ(null);
    setChallengeAnswer('');
    setChallengeFeedback(null);
    setMobileView('FOCUS');
  };

  const fetchDeepDive = async () => {
    if (!activeConcept) return;
    if (deepDiveData[activeConcept.id]) {
        setConceptMode('DEEP_DIVE');
        return;
    }
    
    setLoadingDeepDive(true);
    try {
        const data = await generateDeepDive(activeConcept.term, context, apiKey);
        setDeepDiveData(prev => ({...prev, [activeConcept.id]: data}));
        setConceptMode('DEEP_DIVE');
    } catch (e) {
        console.error(e);
    } finally {
        setLoadingDeepDive(false);
    }
  };

  const initSyncProtocol = async () => {
    if (!activeConcept) return;
    setLoadingChallenge(true);
    setConceptMode('SYNC_PROTOCOL');
    setChallengeQ(null);
    setChallengeAnswer('');
    setChallengeFeedback(null);
    try {
        const q = await generateConceptChallenge(activeConcept.term, context, apiKey);
        setChallengeQ(q);
    } catch(e) {
        setChallengeQ("Error generating protocol. Try again.");
    } finally {
        setLoadingChallenge(false);
    }
  };

  const submitSyncChallenge = async () => {
    if (!activeConcept || !challengeQ || !challengeAnswer) return;
    setLoadingChallenge(true);
    try {
        const result = await evaluateChallenge(challengeQ, challengeAnswer, context, apiKey);
        setChallengeFeedback({ passed: result.passed, msg: result.feedback });
        
        if (result.passed) {
             setConcepts(prev => prev.map(c => c.id === activeConcept.id ? {...c, mastered: true} : c));
             updateStability(10);
             setStats(s => ({...s, syncedNodes: s.syncedNodes + 1}));
        } else {
             updateStability(-5);
        }
    } catch (e) {
        console.error(e);
    } finally {
        setLoadingChallenge(false);
    }
  };

  // -- Quiz Interactions --
  const handleChoiceSubmit = () => {
    if (selectedOption === null) return;
    const isCorrect = selectedOption === currentQ.correctOptionIndex;
    if (isCorrect) {
      setFeedback({ type: 'success', msg: currentQ.explanation });
      updateStability(STABILITY_BONUS);
    } else {
      setFeedback({ type: 'error', msg: `Incorrect. ${currentQ.explanation}` });
      updateStability(-STABILITY_PENALTY);
    }
  };

  const handleSocraticSubmit = async () => {
    if (!socraticInput.trim()) return;
    setIsEvaluating(true);
    try {
        const evaluation = await evaluateSocraticAnswer(currentQ.question, socraticInput, context, apiKey);
        const passed = evaluation.score >= 70;
        setFeedback({
            type: passed ? 'success' : 'error',
            msg: `[EVALUATION]: ${evaluation.feedback} (Score: ${evaluation.score}/100)`
        });
        updateStability(passed ? STABILITY_BONUS * 1.5 : -STABILITY_PENALTY);
    } catch (e) {
        setFeedback({ type: 'error', msg: "Communication with evaluation core failed." });
    } finally {
        setIsEvaluating(false);
    }
  };

  const nextQuestion = () => {
    if (currentQIndex < data.questions.length - 1) {
        setCurrentQIndex(prev => prev + 1);
        setSelectedOption(null);
        setSocraticInput('');
        setFeedback(null);
    } else {
        setQuizComplete(true);
    }
  };

  // -- Renderers --

  const renderLeftPanel = () => (
      <div className="h-full flex flex-col gap-4">
          <div className="glass-panel p-6 rounded-xl border-l-4 border-cyan-500">
              <h1 className="font-display text-xl lg:text-2xl font-bold text-white mb-2">{data.title}</h1>
              <p className="text-xs text-slate-300 font-mono leading-relaxed">{data.summary}</p>
          </div>

          <div className="flex-1 glass-panel rounded-xl p-4 overflow-y-auto custom-scrollbar">
              <h3 className="text-xs font-tech text-slate-400 mb-4 tracking-widest uppercase">
                  {viewMode === 'DATA_CORE' ? 'Neural Network Nodes' : 'Simulation Sequence'}
              </h3>
              
              {viewMode === 'DATA_CORE' ? (
                  <div className="space-y-3">
                      {concepts.map((concept) => (
                          <button
                            key={concept.id}
                            onClick={() => handleConceptSelect(concept.id)}
                            className={`
                                w-full text-left p-4 rounded-lg border transition-all duration-300 relative overflow-hidden group
                                ${activeConceptId === concept.id 
                                    ? 'bg-cyan-950/40 border-cyan-500/50' 
                                    : 'bg-slate-900/40 border-slate-700 hover:border-slate-500'}
                            `}
                          >
                              <div className={`absolute inset-0 bg-gradient-to-r ${concept.mastered ? 'from-cyan-500/10' : 'from-transparent'} to-transparent opacity-50`} />
                              <div className="flex items-center justify-between relative z-10">
                                  <div>
                                      <div className="flex items-center gap-2 mb-1">
                                          {concept.mastered ? (
                                              <Lock className="w-3 h-3 text-cyan-400" />
                                          ) : (
                                              <Unlock className="w-3 h-3 text-slate-400" />
                                          )}
                                          <span className={`font-display text-sm font-bold ${activeConceptId === concept.id ? 'text-white' : 'text-slate-300'}`}>
                                              {concept.term}
                                          </span>
                                      </div>
                                      <div className="h-1 w-12 bg-slate-800 rounded-full overflow-hidden">
                                          <div className={`h-full ${concept.mastered ? 'bg-cyan-400' : 'bg-slate-700'}`} style={{width: concept.mastered ? '100%' : '30%'}} />
                                      </div>
                                  </div>
                                  <ChevronRight className={`w-4 h-4 ${activeConceptId === concept.id ? 'text-cyan-400' : 'text-slate-600'}`} />
                              </div>
                          </button>
                      ))}
                  </div>
              ) : (
                <div className="space-y-2">
                     {data.questions.map((q, idx) => (
                         <div 
                            key={q.id} 
                            className={`p-3 rounded border text-xs font-mono flex items-center justify-between ${idx === currentQIndex ? 'bg-purple-900/20 border-purple-500/50 text-white' : 'bg-slate-900/50 border-slate-800 text-slate-400'}`}
                        >
                            <span>NODE_0{idx + 1}</span>
                            {idx < currentQIndex && <CheckCircle2 className="w-3 h-3 text-green-500" />}
                         </div>
                     ))}
                </div>
              )}
          </div>
          
          <div className="h-48 shrink-0">
             <Visualizer stats={stats} history={history} />
          </div>
      </div>
  );

  const renderFocusChamber = () => {
    if (viewMode === 'SIMULATION') return renderSimulation();

    // Mobile specific: If nothing selected, guide user
    if (!activeConcept) {
        return (
            <div className="h-full glass-panel rounded-xl flex flex-col items-center justify-center text-slate-500 p-12 text-center">
                <Brain className="w-16 h-16 mb-6 text-slate-700 animate-pulse" />
                <h2 className="text-xl font-display text-slate-400 mb-2">NO ACTIVE NODE SELECTED</h2>
                <p className="font-mono text-sm max-w-sm">Select a concept node from the neural network to initiate uplink and synchronization.</p>
                {/* Mobile helper only */}
                <button 
                  onClick={() => setMobileView('LIST')} 
                  className="lg:hidden mt-8 px-6 py-2 bg-slate-800 text-slate-300 rounded font-tech"
                >
                  SELECT NODE
                </button>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col gap-4 lg:gap-6 animate-fade-in overflow-hidden">
             {/* Mobile Back Button */}
             <div className="lg:hidden">
                <button 
                    onClick={handleMobileBack}
                    className="flex items-center gap-2 text-slate-400 hover:text-white font-mono text-xs px-2 py-1 bg-slate-800/50 rounded w-fit"
                >
                    <ArrowLeft className="w-4 h-4" /> RETURN_TO_GRID
                </button>
             </div>

            {/* Header / Stats for Concept */}
            <div className="glass-panel p-4 lg:p-6 rounded-xl border-b-2 border-cyan-500/20 flex flex-col sm:flex-row justify-between items-start sm:items-center relative overflow-hidden shrink-0 gap-4">
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-900/10 to-transparent pointer-events-none" />
                <div>
                    <h2 className="text-2xl lg:text-3xl font-display font-bold text-white mb-2">{activeConcept.term}</h2>
                    <div className="flex gap-4">
                        <span className={`px-2 py-1 rounded text-[10px] font-mono border ${activeConcept.mastered ? 'bg-cyan-900/30 border-cyan-500 text-cyan-400' : 'bg-red-900/30 border-red-500 text-red-400'}`}>
                            STATUS: {activeConcept.mastered ? 'SYNCHRONIZED' : 'UNSTABLE'}
                        </span>
                        <span className="px-2 py-1 rounded text-[10px] font-mono bg-slate-800 border border-slate-700 text-slate-400">
                            ID: {activeConcept.id.substring(0, 8)}
                        </span>
                    </div>
                </div>
                <div className="flex gap-2 w-full sm:w-auto justify-end">
                    <button 
                        onClick={() => setConceptMode('OVERVIEW')}
                        className={`p-3 rounded-lg border transition-all flex-1 sm:flex-none justify-center flex ${conceptMode === 'OVERVIEW' ? 'bg-slate-700 border-slate-500 text-white' : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-white'}`}
                        title="Overview"
                    >
                        <Activity className="w-5 h-5" />
                    </button>
                    <button 
                        onClick={fetchDeepDive}
                        className={`p-3 rounded-lg border transition-all flex-1 sm:flex-none justify-center flex ${conceptMode === 'DEEP_DIVE' ? 'bg-purple-900/40 border-purple-500 text-white' : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-white'}`}
                        title="Deep Dive"
                    >
                        <Database className="w-5 h-5" />
                    </button>
                    <button 
                         onClick={initSyncProtocol}
                         disabled={activeConcept.mastered}
                         className={`p-3 rounded-lg border transition-all flex-1 sm:flex-none justify-center flex ${conceptMode === 'SYNC_PROTOCOL' ? 'bg-cyan-900/40 border-cyan-500 text-white' : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-white disabled:opacity-30'}`}
                         title="Sync Protocol"
                    >
                        <Zap className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 glass-panel rounded-xl p-4 lg:p-8 overflow-y-auto custom-scrollbar relative">
                {conceptMode === 'OVERVIEW' && (
                    <div className="space-y-8 animate-in slide-in-from-bottom-2 duration-300">
                        <section>
                            <h3 className="text-xs font-tech text-cyan-400 mb-2 uppercase tracking-widest flex items-center gap-2">
                                <Terminal className="w-3 h-3" /> Definition
                            </h3>
                            <p className="text-base lg:text-lg text-slate-200 leading-relaxed font-body border-l-2 border-slate-700 pl-4">
                                {activeConcept.definition}
                            </p>
                        </section>
                        <section className="bg-slate-900/50 p-6 rounded-lg border border-slate-800">
                            <h3 className="text-xs font-tech text-purple-400 mb-2 uppercase tracking-widest flex items-center gap-2">
                                <Sparkles className="w-3 h-3" /> Analogy Construct
                            </h3>
                            <p className="text-slate-300 italic font-serif">
                                "{activeConcept.analogy}"
                            </p>
                        </section>
                        {!activeConcept.mastered && (
                            <div className="mt-8 flex justify-center">
                                <button 
                                    onClick={fetchDeepDive}
                                    className="flex items-center gap-2 text-xs lg:text-sm font-mono text-slate-500 hover:text-cyan-400 transition-colors"
                                >
                                    <Download className="w-4 h-4" /> REQUEST_ADDITIONAL_DATA_PACKETS
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {conceptMode === 'DEEP_DIVE' && (
                    <div className="animate-in fade-in duration-300">
                        {loadingDeepDive ? (
                            <div className="flex flex-col items-center justify-center h-64 text-purple-400">
                                <Brain className="w-12 h-12 animate-pulse mb-4" />
                                <p className="font-mono text-xs animate-pulse text-center">DOWNLOADING GRADUATE SCHEMATICS...</p>
                            </div>
                        ) : deepDiveData[activeConcept.id] ? (
                            <div className="space-y-8">
                                <div className="p-1 bg-gradient-to-r from-purple-500/20 to-transparent rounded mb-4">
                                    <p className="text-[10px] font-mono text-purple-300 px-2 py-1">ADVANCED KNOWLEDGE UNLOCKED</p>
                                </div>
                                
                                <section>
                                    <h4 className="font-display text-white text-lg mb-2">Theoretical Underpinnings</h4>
                                    <p className="text-slate-300 text-sm leading-relaxed">{deepDiveData[activeConcept.id].theoreticalUnderpinnings}</p>
                                </section>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <section>
                                        <h4 className="font-display text-white text-lg mb-2">Real World Application</h4>
                                        <p className="text-slate-300 text-sm leading-relaxed">{deepDiveData[activeConcept.id].realWorldApplication}</p>
                                    </section>
                                    <section>
                                        <h4 className="font-display text-white text-lg mb-2">Interdisciplinary Link</h4>
                                        <p className="text-slate-300 text-sm leading-relaxed">{deepDiveData[activeConcept.id].interdisciplinaryConnection}</p>
                                    </section>
                                </div>
                            </div>
                        ) : null}
                    </div>
                )}

                {conceptMode === 'SYNC_PROTOCOL' && (
                    <div className="animate-in zoom-in-95 duration-300 h-full flex flex-col">
                         {loadingChallenge && !challengeQ ? (
                             <div className="flex-1 flex flex-col items-center justify-center text-cyan-400">
                                 <Cpu className="w-12 h-12 animate-spin mb-4" />
                                 <p className="font-mono text-xs text-center">GENERATING SYNCHRONIZATION CHALLENGE...</p>
                             </div>
                         ) : (
                             <>
                                <div className="mb-6">
                                    <div className="flex items-center gap-2 mb-4 text-cyan-400">
                                        <ShieldAlert className="w-5 h-5" />
                                        <h3 className="font-display font-bold">ACTIVE RECALL CHALLENGE</h3>
                                    </div>
                                    <p className="text-lg text-white font-tech">{challengeQ}</p>
                                </div>

                                <textarea 
                                    value={challengeAnswer}
                                    onChange={(e) => setChallengeAnswer(e.target.value)}
                                    disabled={loadingChallenge || (!!challengeFeedback && challengeFeedback.passed)}
                                    placeholder="Enter your response to stabilize this node..."
                                    className="flex-1 w-full bg-slate-950/50 border border-slate-700 rounded-lg p-4 text-sm font-mono text-slate-300 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 resize-none transition-all"
                                />

                                {challengeFeedback && (
                                    <div className={`mt-4 p-4 rounded border ${challengeFeedback.passed ? 'bg-green-900/20 border-green-500/30' : 'bg-red-900/20 border-red-500/30'}`}>
                                        <div className="flex items-center gap-2 mb-2">
                                            {challengeFeedback.passed ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <XCircle className="w-4 h-4 text-red-400" />}
                                            <span className={`font-bold text-sm ${challengeFeedback.passed ? 'text-green-400' : 'text-red-400'}`}>
                                                {challengeFeedback.passed ? 'SYNC SUCCESSFUL' : 'SYNC FAILED'}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-300">{challengeFeedback.msg}</p>
                                    </div>
                                )}

                                <div className="mt-4 flex justify-end">
                                    <button
                                        onClick={submitSyncChallenge}
                                        disabled={!challengeAnswer || loadingChallenge || (!!challengeFeedback && challengeFeedback.passed)}
                                        className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-tech rounded transition-all flex items-center gap-2"
                                    >
                                        {loadingChallenge ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                                        EXECUTE PROTOCOL
                                    </button>
                                </div>
                             </>
                         )}
                    </div>
                )}
            </div>
        </div>
    );
  };

  const renderSimulation = () => {
    if (quizComplete) {
        return (
            <div className="h-full glass-panel rounded-xl flex flex-col items-center justify-center animate-fade-in p-6 text-center">
                <div className="w-24 h-24 bg-purple-900/20 rounded-full flex items-center justify-center mb-6 border border-purple-500/50 relative">
                    <div className="absolute inset-0 rounded-full animate-ping bg-purple-500/10" />
                    <Brain className="w-12 h-12 text-purple-400" />
                </div>
                <h2 className="text-3xl font-display text-white mb-2">SIMULATION COMPLETE</h2>
                <p className="text-slate-400 font-mono mb-8">Final Stability: {stats.stability}%</p>
                <div className="flex flex-col sm:flex-row gap-4">
                    <button 
                        onClick={() => setViewMode('DATA_CORE')}
                        className="px-8 py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-tech tracking-wider transition-all"
                    >
                        RETURN TO CORE
                    </button>
                    <button 
                        onClick={onExit}
                        className="px-8 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-tech tracking-wider transition-all"
                    >
                        EXIT SYSTEM
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full glass-panel rounded-xl p-4 lg:p-8 overflow-y-auto custom-scrollbar flex flex-col">
             {/* Mobile Back Button */}
             <div className="lg:hidden mb-4">
                <button 
                    onClick={handleMobileBack}
                    className="flex items-center gap-2 text-slate-400 hover:text-white font-mono text-xs px-2 py-1 bg-slate-800/50 rounded w-fit"
                >
                    <ArrowLeft className="w-4 h-4" /> CANCEL SIM
                </button>
             </div>

             <div className="max-w-3xl mx-auto w-full">
                 <div className="flex items-center justify-between mb-8">
                     <span className="font-mono text-xs text-purple-400 border border-purple-500/30 px-2 py-1 rounded bg-purple-900/10">
                         SIMULATION PHASE ACTIVE
                     </span>
                     <span className="font-display text-xl text-slate-500">
                         {currentQIndex + 1} / {data.questions.length}
                     </span>
                 </div>

                 <h3 className="text-xl lg:text-2xl font-display text-white mb-8 leading-relaxed">
                     {currentQ.question}
                 </h3>

                 <div className="space-y-4 mb-8">
                     {currentQ.type === QuestionType.SOCRATIC_DEFENSE ? (
                         <textarea 
                            value={socraticInput}
                            onChange={(e) => setSocraticInput(e.target.value)}
                            disabled={!!feedback || isEvaluating}
                            className="w-full h-48 bg-slate-900/50 border border-slate-700 rounded-lg p-4 font-mono text-sm text-slate-300 focus:border-purple-500 transition-all resize-none"
                            placeholder="Construct your argument..."
                        />
                     ) : (
                         currentQ.options?.map((opt, idx) => (
                             <button
                                key={idx}
                                onClick={() => !feedback && setSelectedOption(idx)}
                                disabled={!!feedback}
                                className={`w-full p-4 text-left rounded-lg border transition-all ${selectedOption === idx ? 'bg-purple-900/30 border-purple-500 text-white' : 'bg-slate-900/30 border-slate-700 text-slate-400 hover:bg-slate-800'}`}
                             >
                                 <span className="font-mono mr-4 opacity-50">{idx + 1}.</span>
                                 {opt}
                             </button>
                         ))
                     )}
                 </div>

                 <div className="flex justify-end" ref={scrollRef}>
                     {!feedback ? (
                         <button
                            onClick={currentQ.type === QuestionType.SOCRATIC_DEFENSE ? handleSocraticSubmit : handleChoiceSubmit}
                            disabled={currentQ.type === QuestionType.SOCRATIC_DEFENSE ? !socraticInput : selectedOption === null}
                            className="px-8 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded font-tech font-bold transition-all disabled:opacity-50"
                         >
                             {isEvaluating ? 'ANALYZING...' : 'SUBMIT ANSWER'}
                         </button>
                     ) : (
                         <div className={`w-full p-6 rounded border ${feedback.type === 'success' ? 'bg-green-900/10 border-green-500/30' : 'bg-red-900/10 border-red-500/30'}`}>
                             <p className={`mb-4 ${feedback.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>{feedback.msg}</p>
                             <button onClick={nextQuestion} className="px-6 py-2 bg-slate-800 text-white rounded hover:bg-slate-700 font-tech text-sm">
                                 CONTINUE
                             </button>
                         </div>
                     )}
                 </div>
             </div>
        </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden h-full">
      {/* Top Bar - View Switcher */}
      <div className="h-14 flex justify-between items-center mb-6 shrink-0">
           <div className="flex gap-2 sm:gap-4">
               <button 
                  onClick={() => { setViewMode('DATA_CORE'); setMobileView('LIST'); }}
                  className={`px-4 lg:px-6 py-2 rounded-lg font-display text-xs lg:text-sm tracking-wider transition-all border ${viewMode === 'DATA_CORE' ? 'bg-cyan-950/50 border-cyan-500 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.1)]' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
               >
                   DATA_CORE
               </button>
               <button 
                  onClick={() => { setViewMode('SIMULATION'); setMobileView('FOCUS'); }}
                  className={`px-4 lg:px-6 py-2 rounded-lg font-display text-xs lg:text-sm tracking-wider transition-all border ${viewMode === 'SIMULATION' ? 'bg-purple-950/50 border-purple-500 text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.1)]' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
               >
                   SIMULATION
               </button>
           </div>
           <button onClick={onExit} className="text-xs font-mono text-red-500/50 hover:text-red-400 transition-colors">
               TERMINATE
           </button>
      </div>

      {/* Main Grid Layout */}
      <div className="flex-1 lg:grid lg:grid-cols-12 lg:gap-6 relative overflow-hidden flex flex-col">
          {/* Left Panel / List View */}
          <div className={`
             lg:col-span-4 h-full flex flex-col overflow-hidden transition-all duration-300
             ${mobileView === 'LIST' ? 'flex' : 'hidden lg:flex'}
          `}>
              {renderLeftPanel()}
          </div>

          {/* Right Panel / Focus View */}
          <div className={`
             lg:col-span-8 h-full flex flex-col overflow-hidden transition-all duration-300
             ${mobileView === 'FOCUS' ? 'flex' : 'hidden lg:flex'}
          `}>
              {renderFocusChamber()}
          </div>
      </div>
    </div>
  );
};

export default Session;