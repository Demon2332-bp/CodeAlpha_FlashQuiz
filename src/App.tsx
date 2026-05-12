import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, Navigate } from 'react-router-dom';

import Home from './Home';
import AdminDashboard from './AdminDashboard';
import CreateQuiz from './CreateQuiz';
import AdminSession from './AdminSession';
import ParticipantSession from './ParticipantSession';
import StudyFlashcards from './StudyFlashcards';

export interface User {
  uid: string;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let storedUid = localStorage.getItem('flashquiz_uid');
    if (!storedUid) {
      storedUid = 'user_' + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('flashquiz_uid', storedUid);
    }
    setUser({ uid: storedUid });
    setLoading(false);
  }, []);

  if (loading) {
    return <div className="min-h-screen bg-[#1a0f3c] flex items-center justify-center text-white"><span className="animate-pulse font-bold text-2xl">Loading...</span></div>;
  }

  return (
    <BrowserRouter>
      {/* Sleek dark minimalist background */}
      <div className="min-h-screen bg-[#1a0f3c] text-white font-sans selection:bg-black/20">
        <Navbar />
        <main className="container mx-auto p-4 md:p-8 max-w-4xl pt-4">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/admin" element={user ? <AdminDashboard user={user} /> : <Navigate to="/" replace />} />
            <Route path="/admin/create" element={user ? <CreateQuiz user={user} /> : <Navigate to="/" replace />} />
            <Route path="/admin/session/:sessionId" element={user ? <AdminSession user={user} /> : <Navigate to="/" replace />} />
            <Route path="/study/:quizId" element={<StudyFlashcards />} />
            <Route path="/join" element={<Home />} />
            <Route path="/play/:sessionId" element={<ParticipantSession />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

function Navbar() {
  const navigate = useNavigate();

  return (
    <nav className="p-4 sm:px-8 border-b-[4px] border-white/5 bg-[#1a0f3c]">
      <div className="container mx-auto max-w-4xl flex items-center justify-between">
        <div 
          className="text-2xl sm:text-3xl font-black tracking-tight text-white cursor-pointer flex items-center gap-2 hover:opacity-80 transition-opacity"
          onClick={() => navigate('/')}
        >
           <span className="bg-[#FFD93D] text-[#1a0f3c] w-10 h-10 flex items-center justify-center rounded-xl rotate-3 border-[3px] border-white/20">⚡</span>
           <span className="drop-shadow-sm">FlashQuiz</span>
        </div>
      </div>
    </nav>
  );
}
