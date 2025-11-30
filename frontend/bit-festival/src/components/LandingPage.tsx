import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "../lib/firebase";
import { Activity, Users, TrendingUp, Zap, ArrowRight, ShieldCheck, Globe } from 'lucide-react';

const LandingPage = () => {
  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login error:", error);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white font-sans transition-colors duration-200">
      
      {/* NAVBAR */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="text-2xl font-bold flex items-center gap-2">
            <Activity className="text-teal-500" />
            <span>Active<span className="text-teal-500">Connect</span></span>
          </div>
          <div className="flex items-center gap-4">
            <button 
                onClick={handleLogin}
                className="hidden sm:block text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-teal-500 transition-colors"
            >
                Log In
            </button>
            <button 
                onClick={handleLogin}
                className="px-6 py-2.5 bg-teal-500 hover:bg-teal-600 text-white rounded-full font-medium transition-all shadow-lg shadow-teal-200 dark:shadow-none hover:scale-105 active:scale-95"
            >
                Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* HERO SECTION */}
      <section className="pt-32 pb-20 px-6 relative overflow-hidden">
        {/* Background Blobs */}
        <div className="absolute top-20 right-0 w-[500px] h-[500px] bg-teal-500/10 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-500/10 rounded-full blur-[100px] pointer-events-none"></div>

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 px-4 py-2 rounded-full text-sm font-bold mb-8 animate-fade-in-up border border-teal-100 dark:border-teal-800">
            <Zap size={16} className="fill-current" />
            <span>The #1 Social Fitness Platform</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 leading-tight">
            Connect through <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-emerald-600">Movement.</span>
          </h1>
          
          <p className="text-xl text-gray-500 dark:text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
            Track your activities, challenge friends, and discover new routes in your city. 
            Join a community that moves with you every step of the way.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button 
              onClick={handleLogin}
              className="w-full sm:w-auto px-8 py-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-2xl font-bold text-lg hover:scale-105 transition-transform flex items-center justify-center gap-2 shadow-xl"
            >
              Join Now <ArrowRight size={20} />
            </button>
            <button className="w-full sm:w-auto px-8 py-4 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-2xl font-bold text-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
              Learn More
            </button>
          </div>
        </div>
      </section>

      {/* FEATURES GRID */}
      <section className="py-20 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Why ActiveConnect?</h2>
            <p className="text-gray-500 dark:text-gray-400">Everything you need to stay motivated and connected.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center mb-6">
                <Activity size={24} />
              </div>
              <h3 className="text-xl font-bold mb-3">Track Everything</h3>
              <p className="text-gray-500 dark:text-gray-400 leading-relaxed">
                Log running, cycling, gym sessions, and more. Visualize your progress with detailed analytics and charts on your profile.
              </p>
            </div>
            
            <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-2xl flex items-center justify-center mb-6">
                <Users size={24} />
              </div>
              <h3 className="text-xl font-bold mb-3">Social Motivation</h3>
              <p className="text-gray-500 dark:text-gray-400 leading-relaxed">
                Follow friends, comment on their achievements, and compete on leaderboards. Fitness is better together.
              </p>
            </div>
            
            <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-2xl flex items-center justify-center mb-6">
                <TrendingUp size={24} />
              </div>
              <h3 className="text-xl font-bold mb-3">AI Insights</h3>
              <p className="text-gray-500 dark:text-gray-400 leading-relaxed">
                Get personalized recommendations and weather-based activity scoring to optimize your workouts every day.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* TRUST / SOCIAL PROOF */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
            <div className="flex flex-wrap justify-center gap-8 md:gap-16 opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
                <div className="flex items-center gap-2 font-bold text-xl"><ShieldCheck /> SecureData</div>
                <div className="flex items-center gap-2 font-bold text-xl"><Globe /> GlobalCommunity</div>
                <div className="flex items-center gap-2 font-bold text-xl"><Zap /> FastTrack</div>
            </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-12 border-t border-gray-100 dark:border-gray-800 text-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <p>© 2025 ActiveConnect. All rights reserved.</p>
                <div className="flex gap-6 text-sm">
                    <a href="#" className="hover:text-teal-500 transition-colors">Privacy Policy</a>
                    <a href="#" className="hover:text-teal-500 transition-colors">Terms of Service</a>
                    <a href="#" className="hover:text-teal-500 transition-colors">Contact</a>
                </div>
            </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;