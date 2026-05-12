import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { User } from 'firebase/auth';
import { doc, getDoc, onSnapshot, updateDoc, collection } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { Session, Quiz, Participant } from './types';
import { Users, Play, ChevronRight, Trophy, PenTool, Send, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { playSound } from './audio';

export default function AdminSession({ user }: { user: User }) {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState(0);
  const autoAdvanceRef = useRef<{ currentIndex: number | null }>({ currentIndex: null });

  // Mentor Mode State
  const [mentorQText, setMentorQText] = useState('');
  const [mentorOptions, setMentorOptions] = useState([
    { id: '1', text: '', isCorrect: true },
    { id: '2', text: '', isCorrect: false },
    { id: '3', text: '', isCorrect: false },
    { id: '4', text: '', isCorrect: false },
  ]);
  const [mentorTimer, setMentorTimer] = useState(30);

  useEffect(() => {
    if (!sessionId) return;
    const sessionRef = doc(db, 'sessions', sessionId);
    const unsub = onSnapshot(sessionRef, (sDoc) => {
      if (sDoc.exists()) {
        const sData = sDoc.data() as Session;
        setSession(sData);
      }
      setLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.GET, `sessions/${sessionId}`));

    const partsRef = collection(db, 'sessions', sessionId, 'participants');
    const unsubParts = onSnapshot(partsRef, (pSnap) => {
      const ps = pSnap.docs.map(p => ({ ...p.data(), id: p.id } as Participant));
      ps.sort((a,b) => b.score - a.score);
      setParticipants(ps);
    }, (err) => handleFirestoreError(err, OperationType.LIST, `sessions/${sessionId}/participants`));

    return () => {
      unsub();
      unsubParts();
    };
  }, [sessionId]);

  useEffect(() => {
    if (!session?.quizId) return;
    const quizRef = doc(db, 'quizzes', session.quizId);
    const unsubQuiz = onSnapshot(quizRef, (qDoc) => {
      if (qDoc.exists()) {
        setQuiz(qDoc.data() as Quiz);
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, `quizzes/${session.quizId}`));

    return () => unsubQuiz();
  }, [session?.quizId]);

  const startQuiz = async () => {
    if (!sessionId || !quiz) return;
    playSound('start');
    try {
      await updateDoc(doc(db, 'sessions', sessionId), {
        status: 'active',
        currentQuestionIndex: 0,
        questionEndTime: Date.now() + (quiz.timerPerQuestion * 1000)
      });
    } catch(e) { handleFirestoreError(e, OperationType.UPDATE, `sessions/${sessionId}`); }
  };

  const nextQuestion = async () => {
    if (!sessionId || !session || !quiz) return;
    await updateDoc(doc(db, 'sessions', sessionId), {
      currentQuestionIndex: session.currentQuestionIndex + 1,
      questionEndTime: Date.now() + (quiz.timerPerQuestion * 1000)
    });
  };

  const endQuiz = async () => {
    if (!sessionId) return;
    await updateDoc(doc(db, 'sessions', sessionId), { status: 'finished' });
    confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
    playSound('end');
  };

  const publishMentorQuestion = async () => {
    if (!sessionId || !quiz || !session) return;
    if (!mentorQText || mentorOptions.some(o => !o.text)) {
      alert("Please fill all fields.");
      return;
    }

    try {
      const newQ = { text: mentorQText, options: mentorOptions };
      const newQuestions = [...quiz.questions, newQ];
      
      // Update Quiz with full document representation to pass standard validation
      await updateDoc(doc(db, 'quizzes', session.quizId), {
        questions: newQuestions,
        timerPerQuestion: mentorTimer
      });

      // Update session to reflect new timer
      await updateDoc(doc(db, 'sessions', sessionId), {
        currentQuestionIndex: session.currentQuestionIndex,
        questionEndTime: Date.now() + (mentorTimer * 1000)
      });
      
      // Reset composer
      setMentorQText('');
      setMentorOptions(mentorOptions.map((o, i) => ({...o, text: '', isCorrect: i === 0})));
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `quizzes/${session.quizId}`);
    }
  };

  if (loading) return <div>Loading Control Panel...</div>;
  if (!session || !quiz) return <div>Session not found</div>;

  const currentQ = quiz.questions[session.currentQuestionIndex];

  useEffect(() => {
    if (!session || session.status !== 'active') {
      setTimeLeft(0);
      return;
    }

    const updateTime = () => {
      const remaining = Math.max(0, Math.floor((session.questionEndTime - Date.now()) / 1000));
      setTimeLeft(remaining);
    };

    updateTime();
    const interval = window.setInterval(updateTime, 250);
    return () => window.clearInterval(interval);
  }, [session]);

  useEffect(() => {
    if (!session || !quiz || session.status !== 'active') return;

    if (timeLeft > 0) {
      autoAdvanceRef.current.currentIndex = null;
      return;
    }

    if (session.currentQuestionIndex >= quiz.questions.length - 1) {
      endQuiz();
      return;
    }

    if (autoAdvanceRef.current.currentIndex === session.currentQuestionIndex) return;
    autoAdvanceRef.current.currentIndex = session.currentQuestionIndex;

    const timeout = window.setTimeout(() => {
      nextQuestion();
    }, 1000);

    return () => window.clearTimeout(timeout);
  }, [session, quiz, timeLeft]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-black/20 p-8 rounded-[32px] text-center space-y-4 border-[6px] border-black/10 shadow-[0_12px_24px_rgba(0,0,0,0.15)] flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="text-left bg-white/10 p-6 rounded-2xl border-2 border-white/20">
          <h2 className="text-sm font-bold text-white/70 uppercase tracking-widest mb-1">Join at</h2>
          <div className="text-2xl font-black text-white bg-black/20 px-4 py-2 rounded-xl border border-white/10">{window.location.origin.replace(/^https?:\/\//, '')}/join</div>
        </div>
        <div className="bg-vibrant-yellow px-10 py-6 rounded-3xl border-[6px] border-vibrant-yellow-dark shadow-[0_6px_0_var(--color-vibrant-yellow-shadow)] -rotate-2 transform hover:rotate-0 transition-transform">
          <div className="text-sm font-bold text-[#222]/60 uppercase tracking-widest mb-1">Game Code</div>
          <div className="text-6xl sm:text-7xl font-black tracking-widest text-[#222]">
            {sessionId}
          </div>
        </div>
      </div>

      {session.status === 'waiting' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-center justify-between bg-black/10 p-6 rounded-3xl border border-white/10">
            <h3 className="text-3xl font-black flex items-center gap-3 drop-shadow-sm">
              <Users className="text-vibrant-pink" size={36} strokeWidth={3} />
              {participants.length} Player{participants.length !== 1 ? 's' : ''} Waiting
            </h3>
            <button 
              disabled={participants.length === 0}
              onClick={startQuiz}
              className="bg-vibrant-green text-vibrant-text font-black px-10 py-4 rounded-2xl flex items-center gap-3 hover:-translate-y-1 transition-all disabled:opacity-50 disabled:hover:translate-y-0 text-xl border-[4px] border-vibrant-green-border shadow-[0_4px_0_var(--color-vibrant-green-border)] hover:shadow-[0_8px_0_var(--color-vibrant-green-border)] active:translate-y-1 active:shadow-none mt-4 sm:mt-0 z-10"
            >
              <Play fill="currentColor" size={24} />
              Start Quiz
            </button>
          </div>
          <div className="bg-[#1a0f3c] p-8 rounded-[40px] h-[500px] border-[6px] border-black/20 relative overflow-hidden shadow-inner">
            <h3 className="absolute top-8 left-0 right-0 text-center text-3xl font-black text-white/50 z-10 pointer-events-none drop-shadow-sm">
              Players are joining... Get ready! 🔥
            </h3>
            
            <AnimatePresence>
              {participants.map((p, i) => {
                const colors = ['bg-vibrant-blue', 'bg-vibrant-pink', 'bg-vibrant-cardyellow', 'bg-vibrant-green'];
                const color = colors[i % colors.length];
                
                // Deterministic pseudo-random position
                const seed = p.name.length + i * 17;
                const top = 20 + (seed % 65) + '%';
                const left = 5 + ((seed * 13) % 75) + '%';
                const dur = 6 + (seed % 5) + 's';
                const delay = '-' + (seed % 10) + 's';

                return (
                  <motion.div 
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    key={p.id} 
                    style={{ top, left, animationDuration: dur, animationDelay: delay }}
                    className={`absolute flex flex-col items-center gap-2 font-black text-xl text-white drop-shadow-md animate-float-name`}
                  >
                    <div className={`w-20 h-20 rounded-full border-[4px] border-white/40 shadow-[0_8px_0_rgba(0,0,0,0.2)] bg-white/10 backdrop-blur-sm p-1 overflow-hidden pointer-events-none`}>
                       <img src={p.avatarUrl || `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${p.name}`} alt={p.name} className="w-full h-full object-cover rounded-full" />
                    </div>
                    {p.name}
                  </motion.div>
                )
              })}
            </AnimatePresence>
            {participants.length === 0 && <div className="absolute inset-0 flex items-center justify-center text-white/40 font-bold text-2xl z-0">Waiting for players to join...</div>}
          </div>
        </div>
      )}

      {session.status === 'active' && (
        <div className="space-y-6">
          {session.currentQuestionIndex >= quiz.questions.length ? (
            <div className="bg-white text-vibrant-text p-8 sm:p-12 rounded-[40px] shadow-[0_12px_24px_rgba(0,0,0,0.15)] border-[6px] border-black/10 relative overflow-hidden">
             <div className="absolute -top-12 -right-12 bg-vibrant-pink opacity-10 w-64 h-64 rounded-full blur-3xl pointer-events-none"></div>
             
             <h2 className="text-4xl font-black mb-8 flex items-center gap-3 drop-shadow-sm"><PenTool className="text-vibrant-pink" size={36} strokeWidth={3} /> Write Next Question</h2>
             
             <textarea 
                value={mentorQText} 
                onChange={e => setMentorQText(e.target.value)} 
                placeholder="Question Text..."
                className="w-full bg-black/5 border-[4px] border-transparent rounded-[24px] px-6 py-5 text-3xl font-black mb-8 focus:outline-none focus:border-vibrant-blue focus:bg-white transition-all resize-none shadow-inner z-10 relative"
                rows={2}
             />

             <div className="grid sm:grid-cols-2 gap-6 mb-8 z-10 relative">
               {mentorOptions.map((opt, idx) => (
                  <div key={opt.id} onClick={() => {
                        const newOpts = mentorOptions.map(o => ({...o, isCorrect: o.id === opt.id}));
                        setMentorOptions(newOpts);
                      }} 
                      className={`relative cursor-pointer rounded-3xl p-2 transition-all border-[4px] ${opt.isCorrect ? 'border-vibrant-green bg-vibrant-green/10 shadow-[0_4px_0_var(--color-vibrant-green-border)]' : 'border-black/10 bg-black/5 hover:border-black/20 hover:-translate-y-1'}`}
                  >
                     <div className="flex items-center absolute right-4 top-0 bottom-0 pointer-events-none">
                       {opt.isCorrect ? <CheckCircle className="text-vibrant-green bg-white rounded-full" size={32} strokeWidth={3} /> : <div className="w-8 h-8 rounded-full border-[3px] border-black/20 bg-white/50" />}
                     </div>
                     <input 
                       value={opt.text}
                       onChange={e => {
                         const n = [...mentorOptions];
                         n[idx].text = e.target.value;
                         setMentorOptions(n);
                       }}
                       placeholder={`Option ${idx + 1}`}
                       className="w-full bg-transparent border-none px-4 py-4 pr-14 focus:outline-none text-vibrant-text font-bold text-2xl placeholder-gray-400"
                       onClick={e => e.stopPropagation()}
                     />
                  </div>
               ))}
             </div>
             
             <div className="flex flex-col xl:flex-row items-center gap-6 z-10 relative mt-4">
                <select 
                   value={mentorTimer} 
                   onChange={e => setMentorTimer(Number(e.target.value))}
                   className="w-full xl:w-auto bg-black/5 border-[4px] border-black/10 rounded-2xl px-6 py-5 font-black text-2xl focus:outline-none focus:border-vibrant-blue focus:bg-white cursor-pointer"
                >
                   <option value={15}>15 Seconds</option>
                   <option value={30}>30 Seconds</option>
                   <option value={60}>60 Seconds</option>
                </select>
                
                <button 
                   onClick={publishMentorQuestion}
                   className="w-full flex-1 bg-vibrant-blue text-white border-[4px] border-vibrant-blue-border shadow-[0_6px_0_var(--color-vibrant-blue-border)] hover:shadow-[0_8px_0_var(--color-vibrant-blue-border)] hover:-translate-y-1 active:translate-y-1 active:shadow-none px-8 py-5 rounded-[24px] font-black text-2xl sm:text-3xl transition-all flex items-center justify-center gap-4 whitespace-nowrap"
                >
                   Send to Students <Send size={28} strokeWidth={3} />
                </button>
             </div>
             
             <div className="mt-12 pt-8 border-t-[4px] border-dashed border-black/10 text-center z-10 relative">
                <button onClick={endQuiz} className="text-red-500 font-black text-xl hover:text-red-600 transition-colors uppercase tracking-widest border-b-[3px] border-transparent hover:border-red-600 pb-1">
                   End Live Session
                </button>
             </div>
           </div>
          ) : (
           <>
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-black/20 p-6 rounded-3xl border border-white/10 shadow-md">
              <span className="text-white/80 font-bold uppercase tracking-widest text-lg bg-black/20 px-4 py-2 rounded-xl">Question {session.currentQuestionIndex + 1} / {quiz.questions.length || '?'}</span>
              
              <div className="flex gap-4 w-full sm:w-auto">
                {timeLeft === 0 && (
                  <button 
                    onClick={endQuiz}
                    className="flex-1 sm:flex-none bg-white text-red-500 hover:bg-gray-100 px-6 py-3 rounded-2xl font-black flex items-center justify-center gap-2 border-[4px] border-gray-200 shadow-[0_4px_0_var(--color-gray-200)] hover:-translate-y-1 hover:shadow-[0_6px_0_var(--color-gray-200)] active:translate-y-1 active:shadow-none transition-all"
                  >
                    Finish
                  </button>
                )}
                <button 
                  onClick={nextQuestion}
                  disabled={timeLeft > 0}
                  className="flex-1 sm:flex-none bg-vibrant-blue hover:opacity-90 px-6 py-3 rounded-2xl font-black text-white flex items-center justify-center gap-2 border-[4px] border-vibrant-blue-border shadow-[0_4px_0_var(--color-vibrant-blue-border)] hover:-translate-y-1 hover:shadow-[0_6px_0_var(--color-vibrant-blue-border)] active:translate-y-1 active:shadow-none transition-all disabled:opacity-50 disabled:hover:translate-y-0 disabled:shadow-[0_4px_0_var(--color-vibrant-blue-border)]"
                >
                  {timeLeft > 0 ? 'Waiting for answers...' : 'Next Question'}
                  <ChevronRight strokeWidth={3} />
                </button>
              </div>
            </div>
            
            <div className="bg-white text-vibrant-text p-10 rounded-[40px] text-center border-[6px] border-black/10 shadow-[0_12px_24px_rgba(0,0,0,0.15)] relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-3 bg-slate-100">
                   <motion.div 
                      key={`timer-${session.currentQuestionIndex}`}
                      initial={{ width: '100%' }}
                      animate={{ width: `${(Math.max(0, timeLeft) / quiz.timerPerQuestion) * 100}%` }}
                      transition={{ ease: "linear", duration: 1 }}
                      className={`h-full ${timeLeft < 5 ? 'bg-red-500' : 'bg-vibrant-pink'}`}
                   />
              </div>
              {currentQ?.imageUrl && (
                <div className="mt-8 max-w-lg mx-auto overflow-hidden rounded-2xl border-[4px] border-black/5 shadow-inner">
                  <img src={currentQ.imageUrl} alt="Question" className="w-full h-48 object-contain bg-black/5" />
                </div>
              )}
              <h2 className="text-4xl md:text-5xl font-black mb-12 mt-6 leading-tight max-w-4xl mx-auto">{currentQ?.text || 'Loading...'}</h2>
              <div className="grid sm:grid-cols-2 gap-6 w-full max-w-4xl mx-auto">
                {currentQ?.options.map(o => (
                  <div key={o.id} className={`p-6 rounded-3xl font-black text-2xl border-[6px] flex items-center justify-between ${o.isCorrect ? 'bg-vibrant-green text-white border-vibrant-green-border shadow-[0_6px_0_var(--color-vibrant-green-border)]' : 'bg-white/5 border-black/5 text-gray-400'}`}>
                    {o.text} {o.isCorrect && <span className="bg-white text-vibrant-green w-10 h-10 rounded-full flex items-center justify-center font-black shadow-sm">✓</span>}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[#1a0f3c] rounded-[40px] p-10 border-[6px] border-black/20 shadow-inner">
              <h3 className="text-3xl font-black mb-8 flex items-center gap-3 drop-shadow-sm text-white"><Trophy className="text-vibrant-yellow" strokeWidth={3} size={36}/> Live Leaderboard</h3>
              <div className="grid gap-4 lg:grid-cols-2">
                {participants.slice(0, 10).map((p, i) => (
                  <div key={p.id} className="flex items-center justify-between p-5 bg-white/10 rounded-3xl border-2 border-white/10 backdrop-blur-sm">
                    <div className="flex items-center gap-4">
                      <span className="font-black text-white/30 w-8 text-2xl text-center">{i + 1}</span>
                      <div className="w-12 h-12 rounded-full border-2 border-white/20 bg-white/10 overflow-hidden shrink-0">
                         <img src={p.avatarUrl || `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${p.name}`} alt="" className="w-full h-full object-cover" />
                      </div>
                      <span className="font-black text-2xl text-white truncate max-w-[150px] sm:max-w-[180px]">{p.name}</span>
                    </div>
                    <span className="font-black bg-vibrant-yellow text-vibrant-text px-5 py-2 rounded-2xl border-[4px] border-vibrant-yellow-dark shadow-[0_4px_0_var(--color-vibrant-yellow-shadow)] text-xl shrink-0">{p.score} pts</span>
                  </div>
                ))}
                {participants.length === 0 && <div className="text-white/40 font-bold italic text-xl col-span-2">No participants yet...</div>}
              </div>
            </div>
           </>
          )}
        </div>
      )}

      {session.status === 'finished' && (
        <div className="text-center py-20 space-y-6 bg-black/10 rounded-[32px] p-8 border border-white/10 shadow-xl">
          <div className="w-24 h-24 bg-vibrant-yellow rounded-full flex items-center justify-center border-[4px] border-vibrant-yellow-dark shadow-[0_4px_0_var(--color-vibrant-yellow-shadow)] mb-8 mx-auto">
            <Trophy size={48} className="text-[#222]" strokeWidth={3} />
          </div>
          <h2 className="text-5xl sm:text-6xl font-black text-white drop-shadow-md">Quiz Finished!</h2>
          <p className="text-2xl text-white/80 font-bold">Here's the final podium</p>

          <div className="max-w-2xl mx-auto mt-16 space-y-6 text-left">
              {participants.slice(0, 3).map((p, i) => {
               const podiumBg = i === 0 ? 'bg-vibrant-yellow text-vibrant-text border-vibrant-yellow-dark' : i === 1 ? 'bg-gray-300 text-[#222] border-gray-400' : 'bg-[#CD7F32] text-white border-[#A0522D]';
               const rankIcon = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
               return (
                <motion.div 
                  initial={{ x: -50, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: i * 0.3 }}
                  key={p.id} 
                  className={`flex items-center justify-between p-6 rounded-3xl border-[4px] shadow-lg ${podiumBg}`}
                >
                  <div className="flex items-center gap-6">
                    <span className="text-4xl">{rankIcon}</span>
                    <div className="w-16 h-16 rounded-full overflow-hidden border-[4px] border-white/50 bg-white/20">
                      <img src={p.avatarUrl || `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${p.name}`} className="w-full h-full object-cover" alt="" />
                    </div>
                    <span className="font-black text-3xl">{p.name}</span>
                  </div>
                  <span className="font-black text-4xl">{p.score}</span>
                </motion.div>
               )
             })}
          </div>
        </div>
      )}
    </div>
  );
}
