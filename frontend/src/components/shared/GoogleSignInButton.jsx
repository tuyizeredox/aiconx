import { useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { GoogleAuth } from '@southdevs/capacitor-google-auth';
import { GoogleLogin } from '@react-oauth/google';
import { Loader2 } from 'lucide-react';

const GoogleGIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path fill="#FFFFFF" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#FFFFFF" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FFFFFF" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="#FFFFFF" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

/**
 * On a Capacitor native build, the web GoogleLogin button can't work — Google
 * blocks its sign-in iframe inside embedded WebViews. Falls back to the
 * native Google Sign-In plugin there, but calls the same onSuccess/onError
 * handlers with the same { credential } shape so callers don't need to care.
 */
const GoogleSignInButton = ({ onSuccess, onError }) => {
  const [isSigningIn, setIsSigningIn] = useState(false);

  if (!Capacitor.isNativePlatform()) {
    return (
      <GoogleLogin
        onSuccess={onSuccess}
        onError={onError}
        type="icon"
        text="signin_with"
        theme="filled_blue"
        shape="circle"
        size="large"
      />
    );
  }

  const handleNativeSignIn = async () => {
    setIsSigningIn(true);
    try {
      const user = await GoogleAuth.signIn();
      if (!user?.authentication?.idToken) {
        throw new Error('No ID token received from Google Sign-In.');
      }
      await onSuccess({ credential: user.authentication.idToken });
    } catch (err) {
      onError(err);
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleNativeSignIn}
      disabled={isSigningIn}
      aria-label="Sign in with Google"
      className="h-11 w-11 rounded-full bg-[#1a73e8] flex items-center justify-center shadow-md disabled:opacity-70 active:scale-95 transition-transform"
    >
      {isSigningIn ? <Loader2 className="h-5 w-5 animate-spin text-white" /> : <GoogleGIcon className="h-5 w-5" />}
    </button>
  );
};

export default GoogleSignInButton;
