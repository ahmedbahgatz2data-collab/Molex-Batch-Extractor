import React from 'react';
import { ShieldCheck, Cpu } from 'lucide-react';

interface HeaderProps {
  recordCount: number;
  urlCount: number;
  stealthMode?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ recordCount, stealthMode = true }) => {
  return (
    <header className="border-b border-slate-200 bg-white sticky top-0 z-20 shadow-2xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand & Title */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl text-white flex items-center justify-center shadow-xs" style={{ backgroundColor: '#CD3433' }}>
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-base font-bold text-slate-900 tracking-tight">
                Molex Batch Extractor
              </h1>
              <span className="text-[11px] font-semibold px-1.5 py-0.2 rounded font-mono" style={{ color: '#CD3433', backgroundColor: '#FDF2F2', border: '1px solid #F8D7D7' }}>
                v2.0
              </span>
            </div>
            <p className="text-xs text-slate-500 hidden sm:block">
              Extract <code className="font-mono text-[11px] font-semibold" style={{ color: '#CD3433' }}>productNumberDisplay</code>, <code className="font-mono text-[11px] font-semibold" style={{ color: '#CD3433' }}>productNumberHyphen</code>, <code className="font-mono text-[11px] font-semibold" style={{ color: '#CD3433' }}>productNumberSap</code>, and <code className="font-mono text-[11px] font-semibold" style={{ color: '#CD3433' }}>productStatus</code> to Excel (.xlsx)
            </p>
          </div>
        </div>

        {/* Live Status & Quick Actions */}
        <div className="flex items-center space-x-3">
          <div className={`flex items-center space-x-1.5 text-xs px-2.5 py-1.5 rounded-lg border ${
            stealthMode 
              ? 'border-rose-200 text-rose-900' 
              : 'bg-slate-50 border-slate-200 text-slate-600'
          }`} style={stealthMode ? { backgroundColor: '#FDF2F2' } : {}}>
            <ShieldCheck className="w-4 h-4" style={{ color: stealthMode ? '#CD3433' : '#94A3B8' }} />
            <span className="text-xs font-medium">
              {stealthMode ? 'Stealth Engine Active' : 'Standard Fetch'}
            </span>
          </div>

          {recordCount > 0 && (
            <div className="hidden sm:flex items-center space-x-2 text-xs text-slate-700 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: '#CD3433' }}></span>
              <span className="font-semibold text-slate-900">{recordCount}</span>
              <span>parts ready</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
