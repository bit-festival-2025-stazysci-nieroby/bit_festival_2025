import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "../lib/firebase";
import { LogIn } from "lucide-react";

const Login = () => {
  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login error:", error);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-2xl shadow-lg max-w-md w-full text-center border border-gray-100">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-800">
            Active<span className="text-teal-500">Connect</span>
          </h1>
          <p className="text-gray-500 mt-2">Join the active community!</p>
        </div>

        <button
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-3 px-4 rounded-xl transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md"
        >
          <img 
            src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" 
            alt="Google logo" 
            className="w-6 h-6"
          />
          Sign in with Google
        </button>

        <div className="mt-8 pt-6 border-t border-gray-100 text-xs text-gray-400">
          <p className="flex items-center justify-center gap-1">
            <LogIn size={14} /> Secure sign-in via Google
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;