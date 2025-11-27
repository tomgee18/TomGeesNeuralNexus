import React from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';
import { PlayerStats } from '../types';
import { Activity, Zap } from 'lucide-react';

interface VisualizerProps {
  stats: PlayerStats;
  history: { time: number; stability: number }[];
}

const Visualizer: React.FC<VisualizerProps> = ({ stats, history }) => {
  // Dynamic color based on stability
  const strokeColor = stats.stability > 80 ? '#22d3ee' : stats.stability > 40 ? '#facc15' : '#ef4444';
  const fillColor = stats.stability > 80 ? 'rgba(34, 211, 238, 0.1)' : stats.stability > 40 ? 'rgba(250, 204, 21, 0.1)' : 'rgba(239, 68, 68, 0.1)';

  return (
    <div className="glass-panel rounded-xl p-4 flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${stats.stability > 50 ? 'bg-cyan-900/30 text-cyan-400' : 'bg-red-900/30 text-red-400'}`}>
                <Activity className="w-5 h-5" />
            </div>
            <div>
                <h3 className="font-display text-sm text-slate-400">NEURAL STABILITY</h3>
                <p className="font-tech text-2xl font-bold text-white">{stats.stability.toFixed(1)}%</p>
            </div>
        </div>
        <div className="text-right">
             <div className="flex items-center justify-end gap-2 text-purple-400">
                <Zap className="w-4 h-4" />
                <span className="font-display text-sm">SYNC COUNT</span>
             </div>
             <p className="font-tech text-2xl font-bold text-white">{stats.syncedNodes}</p>
        </div>
      </div>

      <div className="flex-1 min-h-[150px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={history}>
            <defs>
              <linearGradient id="colorStability" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={strokeColor} stopOpacity={0.3}/>
                <stop offset="95%" stopColor={strokeColor} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <XAxis dataKey="time" hide />
            <YAxis domain={[0, 100]} hide />
            <Tooltip 
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }}
                itemStyle={{ color: '#e2e8f0' }}
            />
            <Area 
                type="monotone" 
                dataKey="stability" 
                stroke={strokeColor} 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorStability)" 
                isAnimationActive={true}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      
      {/* Decorative Data Lines */}
      <div className="mt-2 flex justify-between text-[10px] font-mono text-slate-600">
        <span>SYS.MONITOR.ACTIVE</span>
        <span>FREQ: 420Hz</span>
        <span>BUFFER: OK</span>
      </div>
    </div>
  );
};

export default Visualizer;