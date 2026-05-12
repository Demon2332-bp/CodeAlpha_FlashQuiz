import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, onSnapshot, updateDoc, collection } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { Session, Quiz, Participant } from './types';
import { Trophy, Clock, CheckCircle, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { playSound } from './audio';

export default function ParticipantSession() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState(0);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [streak, setStreak] = useState(0);

  const participantId = sessionId ? localStorage.getItem(`flashquiz_pid_${sessionId}`) : null;

  useEffect(() => {
    if (!sessionId || !participantId) {
      navigate('/join');
      return;
    }
    
    // Listen to session
    const unsubSession = onSnapshot(doc(db, 'sessions', sessionId), (sDoc) => {
      if (sDoc.exists()) {
        const sData = sDoc.data() as Session;
        setSession(sData);
      } else {
        navigate('/join');
      }
    });

    // Listen to participant
    const unsubPart = onSnapshot(doc(db, 'sessions', sessionId, 'participants', participantId), (pDoc) => {
      if (pDoc.exists()) setParticipant({ ...pDoc.data(), id: pDoc.id } as Participant);
      setLoading(false);
    });

    // Listen to all participants for ranking
    const unsubAllParts = onSnapshot(collection(db, 'sessions', sessionId, 'participants'), (pSnap) => {
      const ps = pSnap.docs.map(p => ({ ...p.data(), id: p.id } as Participant));
      ps.sort((a, b) => b.score - a.score);
      setParticipants(ps);
    });

    return () => { unsubSession(); unsubPart(); unsubAllParts(); };
  }, [sessionId, participantId]);

  useEffect(() => {
    if (!session?.quizId) return;
    const quizRef = doc(db, 'quizzes', session.quizId);
    const unsubQuiz = onSnapshot(quizRef, (qDoc) => {
      if (qDoc.exists()) setQuiz(qDoc.data() as Quiz);
    });
    return () => unsubQuiz();
  }, [session?.quizId]);

  // Timer effect
  useEffect(() => {
    if (session?.status === 'active' && session.questionEndTime) {
      const interval = setInterval(() => {
        const remaining = Math.max(0, Math.floor((session.questionEndTime - Date.now()) / 1000));
        if (remaining <= 5 && remaining > 0 && remaining !== timeLeft) {
          playSound('tick');
        }
        setTimeLeft(remaining);
      }, 250);
      return () => clearInterval(interval);
    }
  }, [session?.status, session?.questionEndTime]);

  // Confetti on finish
  useEffect(() => {
    if (session?.status === 'finished') {
      const duration = 5 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

      const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

      const interval: any = setInterval(function() {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          return clearInterval(interval);
        }

        const particleCount = 50 * (timeLeft / duration);
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
      }, 250);

      playSound('correct'); 
      return () => clearInterval(interval);
    }
  }, [session?.status]);

  const handleSelectOption = async (optionId: string, isCorrect: boolean) => {
    if (!session || !quiz || !participant || !participantId || !sessionId) return;
    if (session.status !== 'active') return;
    
    const qIndexStr = session.currentQuestionIndex.toString();
    // If they already answered, block
    if (participant.answers && participant.answers[qIndexStr]) return;
    if (timeLeft <= 0) return;

    if (isCorrect) {
      confetti({ particleCount: 100, spread: 60, origin: { y: 0.8 }, colors: ['#22c55e', '#a855f7'] });
      playSound('correct');
      setStreak(prev => prev + 1);
    } else {
      playSound('wrong');
      setStreak(0);
    }

    const baseScore = isCorrect ? 100 + Math.floor((timeLeft / quiz.timerPerQuestion) * 100) : 0;
    const streakBonus = isCorrect && streak >= 2 ? 50 : 0;
    const scoreAwarded = baseScore + streakBonus;
    
    try {
      const pRef = doc(db, 'sessions', sessionId, 'participants', participantId);
      const newAnswers = { ...participant.answers, [qIndexStr]: { optionId, isCorrect, scoreReceived: scoreAwarded } };
      await updateDoc(pRef, {
        answers: newAnswers,
        score: (participant.score || 0) + scoreAwarded
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `sessions/${sessionId}/participants/${participantId}`);
    }
  };

  if (loading) return <div className="text-center py-20 animate-pulse text-xl">Loading game state...</div>;
  if (!session || !quiz || !participant) return null;

  const currentQIndex = session.currentQuestionIndex;
  const currentQ = quiz.questions[currentQIndex];
  const qIndexStr = currentQIndex.toString();
  const answered = participant.answers?.[qIndexStr];
  const timerExpired = timeLeft === 0;

  const currentRank = participants.findIndex(p => p.id === participantId) + 1;
  const ordinal = (n: number) => {
    const s = ["th", "st", "nd", "rd"], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  return (
    <div className="space-y-6">
      
      {/* Header bar */}
      {session.status !== 'finished' && (
        <div className="flex flex-col sm:flex-row justify-between items-center bg-black/20 p-4 sm:p-6 rounded-3xl border-b-[6px] border-black/10 shadow-md gap-4">
          <div className="flex items-center gap-4 bg-white/10 px-5 py-2.5 rounded-full border-2 border-white/20">
             <div className="w-12 h-12 rounded-full border-[3px] border-white max-sm:hidden bg-white/20 overflow-hidden shadow-sm">
               <img src={participant.avatarUrl || `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${participant.name}`} alt={participant.name} className="w-full h-full object-cover" />
             </div>
             <div>
                <div className="text-xs uppercase tracking-[1px] text-white/80 font-bold max-sm:hidden">Participant</div>
                <div className="text-lg font-black">{participant.name}</div>
             </div>
          </div>
          
          <div className="text-center flex-1">
            <div className="text-sm font-bold text-white/70 uppercase truncate">{session.status === 'active' ? quiz?.subject : 'Welcome'}</div>
            {session.status === 'active' && (
              <div className="flex flex-col items-center">
                <div className="text-2xl sm:text-3xl font-black text-vibrant-yellow drop-shadow-md">
                  Question {session.currentQuestionIndex + 1} of {quiz?.questions.length}
                </div>
                {participants.length > 1 && (
                  <div className="text-xs font-black bg-white/10 px-3 py-1 rounded-full border border-white/20 mt-1 uppercase tracking-widest text-vibrant-pink animate-pulse">
                    You are in {ordinal(currentRank)} place
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
             <div className="text-right">
               <div className="text-xs font-bold text-white/70 uppercase tracking-widest">Total Score</div>
               <div className="text-3xl font-black drop-shadow-md">{participant.score}</div>
             </div>
             {session.status === 'active' && (
               <div className="relative w-[60px] h-[60px] sm:w-[80px] sm:h-[80px] flex items-center justify-center shrink-0">
                 {/* Progress Ring Background */}
                 <svg className="absolute inset-0 w-full h-full -rotate-90">
                   <circle
                     cx="50%"
                     cy="50%"
                     r="45%"
                     fill="transparent"
                     stroke="rgba(255,255,255,0.1)"
                     strokeWidth="8"
                   />
                   <motion.circle
                     cx="50%"
                     cy="50%"
                     r="45%"
                     fill="transparent"
                     stroke={timeLeft <= 5 ? "#ef4444" : "#fbbf24"}
                     strokeWidth="8"
                     strokeLinecap="round"
                     initial={{ pathLength: 1 }}
                     animate={{ 
                       pathLength: timeLeft / quiz.timerPerQuestion,
                       stroke: timeLeft <= 5 ? "#ef4444" : "#fbbf24"
                     }}
                     transition={{ duration: 0.5, ease: "linear" }}
                   />
                 </svg>
                 
                 <motion.div 
                   animate={{ 
                     scale: timeLeft <= 5 ? [1, 1.1, 1] : 1,
                     color: timeLeft <= 5 ? "#ef4444" : "#ffffff"
                   }}
                   transition={{ duration: 0.5, repeat: timeLeft <= 5 ? Infinity : 0 }}
                   className="text-2xl sm:text-3xl font-black drop-shadow-md z-10"
                 >
                   {timeLeft}
                 </motion.div>
               </div>
             )}
          </div>
        </div>
      )}

      {session.status === 'waiting' && (
        <div className="bg-white text-vibrant-text p-12 rounded-[32px] text-center border-[4px] border-black/10 shadow-[0_12px_24px_rgba(0,0,0,0.15)] flex flex-col items-center justify-center min-h-[50vh]">
          <div className="w-20 h-20 border-[6px] border-vibrant-pink border-t-vibrant-yellow rounded-full animate-spin mb-8 shadow-lg"></div>
          <h2 className="text-4xl sm:text-5xl font-black mb-4 drop-shadow-sm">You're in!</h2>
          <p className="text-gray-500 font-bold text-xl">See your name on the host's screen.</p>
        </div>
      )}

      {session.status === 'active' && !currentQ && (
        <div className="bg-white text-vibrant-text p-12 rounded-[32px] text-center border-[4px] border-black/10 shadow-[0_12px_24px_rgba(0,0,0,0.15)] flex flex-col items-center justify-center min-h-[50vh]">
          <div className="w-20 h-20 border-[6px] border-vibrant-pink border-t-vibrant-yellow rounded-full animate-spin mb-8 shadow-lg"></div>
          <h2 className="text-3xl sm:text-4xl font-black mb-4 drop-shadow-sm">Mentor is preparing the next question...</h2>
          <p className="text-gray-500 font-bold text-xl">Get ready! 🔥</p>
        </div>
      )}

      {session.status === 'active' && currentQ && (
        <AnimatePresence mode="wait">
          <motion.div 
            key={currentQIndex}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            className="flex flex-col items-center justify-center space-y-8 py-4"
          >
            <div className="bg-white text-vibrant-text w-full max-w-[860px] p-8 md:p-10 rounded-[32px] text-center shadow-[0_12px_0_rgba(0,0,0,0.2),0_20px_40px_rgba(0,0,0,0.1)] relative">
              <div className="absolute -top-5 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[20px] border-l-transparent border-r-[20px] border-r-transparent border-t-[20px] border-t-white"></div>
              {currentQ.imageUrl && (
                <div className="mb-6 max-h-48 overflow-hidden rounded-2xl border-2 border-black/5 bg-black/5">
                  <img src={currentQ.imageUrl} alt="Context" className="w-full h-48 object-contain" />
                </div>
              )}
              <h2 className="text-3xl md:text-4xl font-bold leading-snug">{currentQ.text}</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-[860px]">
              {currentQ.options.map((o, idx) => {
                const isSelected = answered?.optionId === o.id;
                const showCorrect = timerExpired || answered;
                
                const cardStyles = [
                  "bg-vibrant-blue border-vibrant-blue-border text-white",
                  "bg-vibrant-pink border-vibrant-pink-border text-white",
                  "bg-vibrant-cardyellow border-vibrant-cardyellow-border text-white",
                  "bg-vibrant-green border-vibrant-green-border text-white"
                ];
                
                const baseStyle = cardStyles[idx % 4];
                
                let btnStateClass = `${baseStyle} hover:-translate-y-1 shadow-[0_8px_0_rgba(0,0,0,0.15)]`;
                
                if (isSelected && answered?.isCorrect) {
                   btnStateClass = "bg-vibrant-green border-vibrant-green-border text-white -translate-y-1 shadow-[0_12px_0_rgba(0,0,0,0.15),0_0_30px_rgba(0,210,132,0.4)]";
                } else if (isSelected && !answered?.isCorrect) {
                   btnStateClass = "bg-[#FF4E4E] border-[#D63333] text-white";
                } else if (showCorrect && o.isCorrect) {
                   btnStateClass = "bg-vibrant-green border-vibrant-green-border text-white -translate-y-1 shadow-[0_12px_0_rgba(0,0,0,0.15),0_0_30px_rgba(0,210,132,0.4)]";
                } else if (showCorrect) {
                   btnStateClass = `${baseStyle} opacity-50 grayscale transition-all`;
                }

                return (
                  <button
                    key={o.id}
                    disabled={!!answered || timerExpired}
                    onClick={() => handleSelectOption(o.id, o.isCorrect)}
                    className={`relative min-h-[120px] md:min-h-[140px] rounded-[24px] border-[4px] flex items-center justify-center text-center font-bold text-2xl px-6 transition-all duration-100 ${btnStateClass}`}
                  >
                    {o.text}
                    {showCorrect && o.isCorrect && (
                      <div className="absolute -top-4 -right-4 bg-white text-vibrant-green w-10 h-10 rounded-full flex items-center justify-center font-bold text-xl shadow-[0_4px_10px_rgba(0,0,0,0.2)]">✓</div>
                    )}
                    {isSelected && !answered?.isCorrect && (
                      <div className="absolute -top-4 -right-4 bg-white text-red-500 w-10 h-10 rounded-full flex items-center justify-center font-bold text-xl shadow-[0_4px_10px_rgba(0,0,0,0.2)]">✗</div>
                    )}
                  </button>
                );
              })}
            </div>
            
            {answered && (
              <motion.div 
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex flex-col items-center mt-4"
              >
                <div className={`text-4xl md:text-5xl font-black drop-shadow-md mb-2 ${answered.isCorrect ? 'text-vibrant-yellow' : 'text-red-400'}`}>
                  {answered.isCorrect ? `+${answered.scoreReceived} POINTS!` : 'ALMOST!'}
                </div>
                {answered.isCorrect && streak >= 2 && (
                   <motion.div 
                     initial={{ scale: 0.5, rotate: -10 }}
                     animate={{ scale: 1, rotate: 0 }}
                     className="bg-vibrant-pink text-white px-4 py-1 rounded-full text-lg font-black italic mb-4 shadow-lg border-2 border-white/20"
                   >
                     🔥 {streak} CARDS STREAK! (+50 BONUS)
                   </motion.div>
                )}
                
                <div className="flex gap-2.5">
                  {quiz.questions.map((_, i) => {
                    const qAns = participant.answers?.[i.toString()];
                    let dotClass = "bg-white/30";
                    if (qAns?.isCorrect) dotClass = "bg-vibrant-green shadow-[0_0_8px_var(--color-vibrant-green)]";
                    else if (qAns && !qAns.isCorrect) dotClass = "bg-red-500";
                    else if (i === currentQIndex) dotClass = "bg-vibrant-yellow shadow-[0_0_10px_var(--color-vibrant-yellow)]";
                    
                    return <div key={i} className={`w-3.5 h-3.5 rounded-full ${dotClass}`}></div>;
                  })}
                </div>
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>
      )}

      {session.status === 'finished' && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white text-vibrant-text rounded-[32px] p-12 text-center border-[4px] border-black/10 shadow-[0_12px_24px_rgba(0,0,0,0.15)] flex flex-col items-center"
        >
          <div className="flex gap-4">
            <div className="w-24 h-24 rounded-full border-[4px] border-white shadow-[0_8px_0_rgba(0,0,0,0.15)] bg-slate-100 overflow-hidden mb-8 relative -rotate-6">
              <img src={participant.avatarUrl || `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${participant.name}`} className="w-full h-full object-cover" alt="" />
            </div>
            <div className="w-24 h-24 bg-vibrant-yellow rounded-full flex items-center justify-center border-[4px] border-vibrant-yellow-dark shadow-[0_4px_0_var(--color-vibrant-yellow-shadow)] mb-8 rotate-6 z-10">
              <Trophy size={48} className="text-[#222]" strokeWidth={3} />
            </div>
          </div>
          <h1 className="text-5xl font-black mb-4 drop-shadow-sm">Quiz Completed!</h1>
          <p className="text-2xl font-bold text-gray-500 mb-10">You scored <span className="text-vibrant-green text-3xl ml-2 drop-shadow-sm">{participant.score}</span> points.</p>
          
          <div className="bg-black/5 p-6 rounded-2xl mb-10 border-2 border-black/5 w-full max-w-lg mx-auto">
            <blockquote className="text-xl font-medium text-gray-600">
              "You didn’t just play the quiz — you gained knowledge, skills, and confidence. And that matters more than winning."
            </blockquote>
          </div>
          
          <button 
            onClick={() => navigate('/')}
            className="w-full max-w-sm flex items-center justify-center gap-3 px-8 py-4 bg-vibrant-blue text-white border-[4px] border-vibrant-blue-border shadow-[0_4px_0_var(--color-vibrant-blue-border)] hover:-translate-y-1 hover:shadow-[0_6px_0_var(--color-vibrant-blue-border)] rounded-2xl font-bold text-xl transition-all active:translate-y-1 active:shadow-none"
          >
            Back to Home
          </button>
        </motion.div>
      )}
    </div>
  );
}
