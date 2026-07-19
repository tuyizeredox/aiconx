import { useState, useRef, useCallback, useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { SpeechRecognition } from "@capacitor-community/speech-recognition";
import { toast } from "sonner";

// Voice-to-text for the AI assistant's mic button.
//
// The Capacitor plugin's own "web" implementation is an unimplemented stub
// (it throws on every call), so on native Android it drives the real
// on-device speech recognizer, while in a regular browser tab we fall back
// to the raw Web Speech API directly. Neither path exists on Firefox or
// iOS Safari, so `isSupported` lets callers hide/disable the mic instead of
// having it silently do nothing when tapped.
export function useVoiceInput({ language, onResult } = {}) {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);
  const isNative = Capacitor.isNativePlatform();

  const hasWebSpeech =
    typeof window !== "undefined" &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  const isSupported = isNative || hasWebSpeech;

  // Web Speech API setup (browser only)
  useEffect(() => {
    if (isNative || !hasWebSpeech) return;

    const WebSpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new WebSpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = language || "en-US";

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      onResult?.(transcript);
      setIsListening(false);
    };

    recognition.onerror = (event) => {
      if (event.error !== "aborted" && event.error !== "no-speech") {
        toast.error("Couldn't catch that — please try again.");
      }
      setIsListening(false);
    };

    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;

    return () => {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      try {
        recognition.abort();
      } catch (e) {
        // already stopped
      }
    };
  }, [language, isNative, hasWebSpeech, onResult]);

  // Native listening-state listener, kept in sync with the plugin's own state
  // (e.g. if the OS cuts recognition off on silence/timeout).
  useEffect(() => {
    if (!isNative) return;

    let handle;
    SpeechRecognition.addListener("listeningState", ({ status }) => {
      setIsListening(status === "started");
    }).then((h) => {
      handle = h;
    });

    return () => {
      handle?.remove();
      SpeechRecognition.stop().catch(() => {});
    };
  }, [isNative]);

  const startNative = useCallback(async () => {
    try {
      const { available } = await SpeechRecognition.available();
      if (!available) {
        toast.error("Voice input isn't available on this device.");
        return;
      }

      let perm = await SpeechRecognition.checkPermissions();
      if (perm.speechRecognition !== "granted") {
        perm = await SpeechRecognition.requestPermissions();
      }
      if (perm.speechRecognition !== "granted") {
        toast.error("Microphone permission is needed for voice input.");
        return;
      }

      setIsListening(true);
      const { matches } = await SpeechRecognition.start({
        language: language || "en-US",
        popup: false,
        partialResults: false,
        maxResults: 1,
      });
      if (matches?.[0]) onResult?.(matches[0]);
    } catch (err) {
      console.error("Native speech recognition error:", err);
      toast.error("Couldn't catch that — please try again.");
    } finally {
      setIsListening(false);
    }
  }, [language, onResult]);

  const toggleListening = useCallback(() => {
    if (isNative) {
      if (isListening) {
        SpeechRecognition.stop().catch(() => {});
      } else {
        startNative();
      }
      return;
    }

    if (!recognitionRef.current) {
      toast.error("Voice input isn't supported in this browser.");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      setIsListening(true);
      try {
        recognitionRef.current.start();
      } catch (err) {
        setIsListening(false);
      }
    }
  }, [isNative, isListening, startNative]);

  return { isSupported, isListening, toggleListening };
}
