import type { User } from 'firebase/auth';
import { Activity, TrendingUp, Zap } from 'lucide-react';

interface HeroSectionProps {
  user: User | null;
}

const HeroSection = ({ user }: HeroSectionProps) => {
  // Wyciągamy imię z displayName (np. "Jan" z "Jan Kowalski")
  const firstName = user?.displayName?.split(' ')[0] || 'Athlete';

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white shadow-xl mb-10 dark:from-teal-600 dark:to-emerald-800 animate-in fade-in slide-in-from-top-4 duration-700">
      
      {/* Dekoracyjne tła (blobs) */}
      <div className="absolute top-0 right-0 -mr-16 -mt-16 h-64 w-64 rounded-full bg-white/10 blur-3xl"></div>
      <div className="absolute bottom-0 left-0 -ml-16 -mb-16 h-48 w-48 rounded-full bg-black/10 blur-2xl"></div>

      <div className="relative z-10 p-8 md:p-10 flex flex-col md:flex-row items-center justify-between gap-8">
        
        {/* Tekst Powitalny */}
        <div className="text-center md:text-left space-y-3 flex-1">
          <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-2 border border-white/20 shadow-sm">
            <Zap size={14} className="text-yellow-300 fill-current" />
            <span>Daily Goal: Active</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight leading-tight">
            Ready to move,<br/> {firstName}?
          </h1>
          <p className="text-teal-50 text-lg font-medium max-w-md">
            Track your progress, challenge friends, and beat your personal bests today.
          </p>
        </div>

        {/* Statystyki (bez przycisku Log Activity) */}
        <div className="flex flex-col gap-5 w-full md:w-auto min-w-[240px]">
            {/* Małe statystyki (wizualne) */}
            <div className="flex items-center justify-between gap-4 text-sm font-medium text-white/90 bg-black/20 backdrop-blur-sm px-5 py-3 rounded-xl border border-white/10">
                <div className="flex items-center gap-2">
                    <Activity size={18} className="text-emerald-300" /> 
                    <span>3 this week</span>
                </div>
                <div className="h-4 w-px bg-white/20"></div>
                <div className="flex items-center gap-2">
                    <TrendingUp size={18} className="text-emerald-300" /> 
                    <span>+12% vs last</span>
                </div>
            </div>
        </div>

      </div>
    </div>
  );
};

export default HeroSection;