'use client';

import { useState, useEffect, useRef } from 'react';

export default function ConversationPage() {
  const [messages, setMessages] = useState([
    { role: 'ai', text: "Hello! I'm your English tutor. What would you like to talk about today?" }
  ]);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState('');
  
  const recognitionRef = useRef(null);
  const chatContainerRef = useRef(null);
  const voicesRef = useRef([]);

  // Load voices for speech synthesis
  useEffect(() => {
    const loadVoices = () => {
      voicesRef.current = window.speechSynthesis.getVoices().filter(v => v.lang.startsWith('en'));
    };
    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  // Initialize Speech Recognition
  useEffect(() => {
    if (typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event) => {
        let currentTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        setTranscript(currentTranscript);
      };

      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error', event.error);
        setIsRecording(false);
        if (event.error !== 'no-speech') {
          setError(`Error: ${event.error}. Please try again.`);
        }
      };

      recognitionRef.current.onend = () => {
        setIsRecording(false);
      };
    } else {
      setError('Speech Recognition is not supported in your browser. Please use Chrome or Edge.');
    }
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, transcript]);

  // Handle when recording stops and we have a transcript
  useEffect(() => {
    if (!isRecording && transcript && !isProcessing) {
      handleUserMessage(transcript);
    }
  }, [isRecording]);

  const toggleRecording = () => {
    if (!recognitionRef.current) return;
    setError('');

    if (isRecording) {
      recognitionRef.current.stop();
    } else {
      // Stop any ongoing AI speech before listening
      window.speechSynthesis.cancel();
      setTranscript('');
      try {
        recognitionRef.current.start();
        setIsRecording(true);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleUserMessage = async (userText) => {
    if (!userText.trim()) return;
    
    // Add user message to UI
    const newMessages = [...messages, { role: 'user', text: userText }];
    setMessages(newMessages);
    setTranscript('');
    setIsProcessing(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          history: messages,
          message: userText
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get response');
      }

      // Add AI response to UI
      setMessages(prev => [...prev, { role: 'ai', text: data.text }]);
      
      // Speak AI response
      speakText(data.text);

    } catch (err) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const speakText = (text) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      
      const voices = voicesRef.current;
      const preferredVoice = voices.find(v => v.name.includes('Google') && v.lang === 'en-US') 
                          || voices.find(v => v.lang === 'en-US') 
                          || voices[0];
                          
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }
      
      window.speechSynthesis.speak(utterance);
    }
  };

  return (
    <div className="interactive-wrap" style={{ maxWidth: '800px' }}>
      <div className="page-header fade-up" style={{ textAlign: 'center' }}>
        <h1 className="page-title">
          AI <span className="gradient-text">Conversation</span>
        </h1>
        <p className="page-sub">Practice your speaking skills with our intelligent AI tutor.</p>
      </div>

      <div className="interactive-card fade-up d1" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', height: '600px' }}>
        
        {/* Chat History */}
        <div 
          ref={chatContainerRef}
          style={{ 
            flex: 1, 
            overflowY: 'auto', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '1rem',
            padding: '1rem',
            marginBottom: '1rem',
            background: 'var(--bg-2)',
            borderRadius: '16px',
            border: '1px solid var(--border)'
          }}
        >
          {messages.map((msg, idx) => (
            <div 
              key={idx} 
              style={{
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '80%',
                padding: '1rem 1.25rem',
                borderRadius: '16px',
                borderBottomRightRadius: msg.role === 'user' ? '4px' : '16px',
                borderBottomLeftRadius: msg.role === 'ai' ? '4px' : '16px',
                background: msg.role === 'user' ? 'linear-gradient(135deg, var(--indigo), var(--violet))' : 'var(--surface)',
                color: msg.role === 'user' ? 'white' : 'var(--text-1)',
                border: msg.role === 'ai' ? '1px solid var(--border-bright)' : 'none',
                boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
                lineHeight: '1.5'
              }}
            >
              {msg.role === 'ai' && <div style={{ fontSize: '0.8rem', color: 'var(--text-2)', marginBottom: '4px', fontWeight: 'bold' }}>AI Tutor</div>}
              {msg.text}
            </div>
          ))}
          
          {/* Live Transcript Bubble */}
          {transcript && (
            <div 
              style={{
                alignSelf: 'flex-end',
                maxWidth: '80%',
                padding: '1rem 1.25rem',
                borderRadius: '16px',
                borderBottomRightRadius: '4px',
                background: 'transparent',
                border: '1px dashed var(--indigo)',
                color: 'var(--text-2)',
                lineHeight: '1.5'
              }}
            >
              <em>{transcript}...</em>
            </div>
          )}

          {isProcessing && (
            <div style={{ alignSelf: 'flex-start', padding: '1rem', color: 'var(--text-2)' }}>
              <div className="spinner" style={{ width: '20px', height: '20px', margin: '0' }} />
            </div>
          )}
        </div>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
            {error}
          </div>
        )}

        {/* Controls */}
        <div style={{ textAlign: 'center', marginTop: 'auto' }}>
          <button
            className={`mic-btn ${isRecording ? 'recording' : ''}`}
            onClick={toggleRecording}
            disabled={isProcessing}
            style={{ margin: '0 auto', width: '80px', height: '80px', fontSize: '2rem' }}
          >
            {isRecording ? '⏹' : '🎤'}
          </button>
          
          <p style={{ color: 'var(--text-2)', fontSize: '0.9rem', marginTop: '1rem' }}>
            {isRecording 
              ? '🔴 Listening... click to stop and send' 
              : isProcessing 
                ? 'AI is thinking...' 
                : 'Click the mic to speak to your tutor'
            }
          </p>
        </div>
      </div>
    </div>
  );
}
