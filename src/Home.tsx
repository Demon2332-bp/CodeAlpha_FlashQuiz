import React, { useState } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { Participant } from './types';
import { Rocket, Sparkles } from 'lucide-react';
import { playSound } from './audio';

export default function Home() {
  const navigate = useNavigate();
  const [joinCode, setJoinCode] = useState('');
  const [name, setName] = useState('');
  const [avatarSeed, setAvatarSeed] = useState(Math.random().toString(36).substring(7));
  const [error, setError] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!joinCode.trim() || !name.trim()) {
      setError('Please enter both name and code');
      return;
    }

    setIsJoining(true);
    playSound('correct'); 

    try {
      const sessionRef = doc(db, 'sessions', joinCode);
      const sessionSnap = await getDoc(sessionRef);

      if (!sessionSnap.exists()) {
        setError('No such code exists with any quiz.');
        setIsJoining(false);
        return;
      }

      if (sessionSnap.data().status === 'finished') {
        setError('This session has already finished.');
        setIsJoining(false);
        return;
      }

      let participantId = localStorage.getItem(`flashquiz_pid_${joinCode}`);
      const avatarUrl = `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${avatarSeed || name.trim()}`;

      if (!participantId) {
        participantId = Math.random().toString(36).substring(2, 10);
        const partRef = doc(db, 'sessions', joinCode, 'participants', participantId);
        
        const newPart: Participant = {
          name: name.trim(),
          score: 0,
          avatarUrl,
          answers: {},
          createdAt: Date.now()
        };
        
        await setDoc(partRef, newPart);
        localStorage.setItem(`flashquiz_pid_${joinCode}`, participantId);
      }

      navigate(`/play/${joinCode}`);
    } catch (err: any) {
      console.error(err);
      setError('Failed to join session');
      handleFirestoreError(err, OperationType.GET, 'sessions');
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center pt-8 sm:pt-16 space-y-12">
       {/* 🎴 Flashcard Stack UI */}
       <div className="relative w-48 h-48 md:w-64 md:h-64 mb-6 mt-4">
          {/* Green Card */}
          <motion.div 
             animate={{ rotate: [10, 15, 10], y: [0, -5, 0] }}
             transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
             className="absolute inset-0 bg-[#6BCB77] rounded-[32px] border-[6px] border-white/40 shadow-xl origin-bottom-right"
             style={{ transform: 'rotate(15deg) translateX(20px)' }}
          />
          {/* Red Card */}
          <motion.div 
             animate={{ rotate: [-10, -15, -10], y: [0, 5, 0] }}
             transition={{ repeat: Infinity, duration: 5, ease: "easeInOut", delay: 0.2 }}
             className="absolute inset-0 bg-[#FF6B6B] rounded-[32px] border-[6px] border-white/40 shadow-xl origin-bottom-left"
             style={{ transform: 'rotate(-15deg) translateX(-20px)' }}
          />
          {/* Blue Card */}
          <motion.div 
             animate={{ rotate: [5, 10, 5], y: [0, -5, 0] }}
             transition={{ repeat: Infinity, duration: 4.5, ease: "easeInOut", delay: 0.5 }}
             className="absolute inset-0 bg-[#4D96FF] rounded-[32px] border-[6px] border-white/40 shadow-[0_8px_16px_rgba(0,0,0,0.2)] origin-center"
             style={{ transform: 'translateY(-10px)' }}
          />
          {/* Yellow Front Card */}
          <motion.div 
             animate={{ y: [0, -10, 0] }}
             transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
             className="absolute inset-0 bg-[#FFD93D] rounded-[32px] border-[8px] border-white/50 shadow-[0_16px_32px_rgba(0,0,0,0.3)] flex items-center justify-center"
          >
             <div className="w-20 h-20 md:w-28 md:h-28 bg-white/30 rounded-full border-[6px] border-white/60 backdrop-blur-md flex items-center justify-center shadow-inner">
               <span className="text-6xl md:text-7xl text-white font-black drop-shadow-lg opacity-90">?</span>
             </div>
          </motion.div>
       </div>

       {/* Avatar Selection */}
       <div className="flex flex-col items-center gap-4">
          <motion.div 
            whileHover={{ scale: 1.1, rotate: 5 }}
            onClick={() => {
              setAvatarSeed(Math.random().toString(36).substring(7));
              playSound('pop');
            }}
            className="w-24 h-24 rounded-full border-[6px] border-white/50 bg-white/10 backdrop-blur-md cursor-pointer overflow-hidden shadow-xl"
          >
            <img src={`https://api.dicebear.com/7.x/fun-emoji/svg?seed=${avatarSeed || name || 'default'}`} alt="Avatar" className="w-full h-full object-cover" />
          </motion.div>
          <p className="text-white/40 text-xs font-bold uppercase tracking-widest">Tap to shuffle avatar</p>
       </div>

       {/* Form */}
       <motion.form 
         initial={{ opacity: 0, y: 20 }}
         animate={{ opacity: 1, y: 0 }}
         transition={{ delay: 0.2 }}
         onSubmit={handleJoin}
         className="w-full max-w-md space-y-6"
       >
          <div className="space-y-4">
             <input 
               type="text" 
               placeholder="Enter Quiz Code"
               value={joinCode}
               onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
               className="w-full bg-white/10 border-[4px] border-white/20 focus:border-white focus:bg-white/20 text-white placeholder-white/60 rounded-[32px] px-6 py-6 text-2xl font-black text-center outline-none transition-all shadow-inner tracking-widest backdrop-blur-sm"
             />
             <input 
               type="text" 
               placeholder="Enter Your Name"
               value={name}
               onChange={(e) => setName(e.target.value)}
               maxLength={15}
               className="w-full bg-white/10 border-[4px] border-white/20 focus:border-white focus:bg-white/20 text-white placeholder-white/60 rounded-[32px] px-6 py-6 text-2xl font-black text-center outline-none transition-all shadow-inner backdrop-blur-sm"
             />
          </div>

          {error && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[#FF6B6B] font-black text-center bg-[#FF6B6B]/10 py-3 rounded-2xl border-2 border-[#FF6B6B]/20 backdrop-blur-md">
              {error}
            </motion.p>
          )}

          <motion.button
             whileHover={{ scale: 1.02, y: -4 }}
             whileTap={{ scale: 0.98, y: 2 }}
             disabled={isJoining}
             className="w-full bg-gradient-to-r from-[#4D96FF] to-[#b75fef] text-white border-[6px] border-white/30 shadow-[0_8px_0_rgba(0,0,0,0.2)] hover:shadow-[0_12px_24px_rgba(77,150,255,0.4)] px-8 py-6 rounded-[32px] font-black text-3xl transition-all flex items-center justify-center gap-4 group mt-6 relative overflow-hidden"
          >
             <div className="absolute inset-0 bg-white/30 w-1/2 -skew-x-12 -translate-x-full group-hover:animate-shimmer" />
             {isJoining ? 'Joining...' : <>Join Quiz <Rocket size={32} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" /></>}
          </motion.button>
       </motion.form>

       <motion.div 
         initial={{ opacity: 0 }}
         animate={{ opacity: 1 }}
         transition={{ delay: 0.5 }}
         className="pt-8 w-full max-w-sm flex flex-col items-center gap-4 mt-8"
       >
         <button 
            onClick={() => navigate('/admin')}
            className="flex items-center justify-center gap-2 px-8 py-4 bg-white text-[#1a0f3c] border-4 border-white hover:bg-white/90 hover:border-white/90 rounded-[32px] font-black text-xl transition-all shadow-[0_6px_0_rgba(255,255,255,0.4)] active:translate-y-1 active:shadow-none hover:-translate-y-1 w-full"
         >
           <Sparkles size={24} className="text-vibrant-pink" />
           Host a Quiz
         </button>
       </motion.div>
    </div>
  );
}
