import React, { useState, ChangeEvent } from 'react';
import { FileText, Upload, BrainCircuit, File as FileIcon, X } from 'lucide-react';
import { InputContext } from '../types';

interface IngestProps {
  onStart: (input: InputContext) => void;
}

const Ingest: React.FC<IngestProps> = ({ onStart }) => {
  const [text, setText] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [loadedFile, setLoadedFile] = useState<{ name: string, type: string, data: string } | null>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    // Reset text if file is loaded
    setText('');

    if (file.type === "text/plain" || file.name.endsWith('.md') || file.name.endsWith('.txt')) {
        const reader = new FileReader();
        reader.onload = (e) => {
            if (e.target?.result) setText(e.target.result as string);
        };
        reader.readAsText(file);
        setLoadedFile(null);
    } else if (file.type === "application/pdf") {
        const reader = new FileReader();
        reader.onload = (e) => {
            if (e.target?.result) {
                const base64String = (e.target.result as string).split(',')[1];
                setLoadedFile({
                    name: file.name,
                    type: file.type,
                    data: base64String
                });
            }
        };
        reader.readAsDataURL(file);
    } else {
        alert("Currently supported formats: PDF, TXT, MD");
    }
  };

  const handleStart = () => {
    if (loadedFile) {
        onStart({
            type: 'file',
            content: loadedFile.data,
            mimeType: loadedFile.type,
            fileName: loadedFile.name
        });
    } else if (text.length > 50) {
        onStart({
            type: 'text',
            content: text
        });
    }
  };

  const isReady = (text.length > 50) || !!loadedFile;

  return (
    <div className="w-full max-w-4xl mx-auto p-6 animate-fade-in">
      <div className="text-center mb-12 space-y-4">
        <h2 className="text-5xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-600">
          UPLOAD ARTIFACT
        </h2>
        <p className="text-slate-400 font-tech text-xl tracking-wider uppercase">
          Initialize Neural Synchronization
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left: Drag & Drop */}
        <div 
          className={`
            relative h-96 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center p-8 transition-all duration-300
            ${dragActive ? 'border-cyan-500 bg-cyan-950/30' : 'border-slate-700 bg-slate-900/50'}
            hover:border-cyan-400/50 hover:bg-slate-800/50
          `}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <div className="absolute inset-0 bg-grid-slate-800/[0.1] rounded-2xl pointer-events-none" />
          <Upload className={`w-16 h-16 mb-6 ${dragActive ? 'text-cyan-400' : 'text-slate-500'}`} />
          <p className="text-lg font-tech text-slate-300 mb-2">Drag Artifact Here</p>
          <p className="text-sm text-slate-500 mb-6">PDF, TXT, MD supported.</p>
          
          <label className="cursor-pointer px-6 py-3 bg-cyan-900/30 border border-cyan-500/30 rounded-lg text-cyan-400 font-tech hover:bg-cyan-500 hover:text-white transition-all group z-10">
            <span className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              SELECT FILE
            </span>
            <input 
              type="file" 
              className="hidden" 
              onChange={handleFileChange}
              accept=".pdf,.txt,.md"
            />
          </label>
        </div>

        {/* Right: Content View or File View */}
        <div className="h-96 flex flex-col glass-panel rounded-2xl p-1 relative">
            {loadedFile ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 animate-in fade-in zoom-in duration-300">
                    <div className="w-20 h-20 bg-red-900/20 rounded-xl flex items-center justify-center mb-4 border border-red-500/30 relative overflow-hidden group">
                        <div className="absolute inset-0 bg-red-500/10 group-hover:bg-red-500/20 transition-colors" />
                        <FileIcon className="w-10 h-10 text-red-400" />
                    </div>
                    <h3 className="font-display text-xl text-white mb-1 truncate max-w-xs">{loadedFile.name}</h3>
                    <span className="text-xs font-mono text-red-400 bg-red-900/30 px-2 py-1 rounded border border-red-500/30 uppercase">
                        {loadedFile.type.split('/')[1]} DETECTED
                    </span>
                    <button 
                        onClick={() => setLoadedFile(null)}
                        className="mt-6 text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1"
                    >
                        <X className="w-3 h-3" /> REMOVE ARTIFACT
                    </button>
                </div>
            ) : (
                <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Or paste raw academic text here..."
                    className="flex-1 bg-transparent p-6 text-slate-300 font-mono text-sm resize-none focus:outline-none custom-scrollbar"
                />
            )}
            
            <div className="h-16 border-t border-slate-800 flex items-center justify-between px-6 bg-slate-950/50 rounded-b-xl">
                <span className="text-xs font-tech text-slate-500">
                    {loadedFile ? 'BINARY DATA READY' : `${text.length} CHARACTERS`}
                </span>
                <button
                    onClick={handleStart}
                    disabled={!isReady}
                    className={`
                        flex items-center gap-2 px-6 py-2 rounded-lg font-tech font-bold tracking-wider transition-all
                        ${isReady 
                            ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-900/50 hover:scale-105' 
                            : 'bg-slate-800 text-slate-600 cursor-not-allowed'}
                    `}
                >
                    <BrainCircuit className="w-5 h-5" />
                    INITIALIZE
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Ingest;