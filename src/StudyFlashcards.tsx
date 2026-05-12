import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { Quiz } from './types';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, RotateCcw, Home, Eye, Shuffle, RefreshCw, Play, Pause, List } from 'lucide-react';

export default function StudyFlashcards() {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [shuffledQuestions, setShuffledQuestions] = useState<Quiz['questions']>([]);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');

  useEffect(() => {
    async function fetchQuiz() {
      if (!quizId) return;
      try {
        const quizSnap = await getDoc(doc(db, 'quizzes', quizId));
        if (quizSnap.exists()) {
          const data = quizSnap.data() as Quiz;
          setQuiz({ id: quizSnap.id, ...data } as Quiz);
          setShuffledQuestions(data.questions);
        }
      } catch (error) {
        console.error("Error fetching quiz:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchQuiz();
  }, [quizId]);

  const shuffleCards = () => {
    if (!quiz) return;
    const shuffled = [...quiz.questions].sort(() => Math.random() - 0.5);
    setShuffledQuestions(shuffled);
    setCurrentIndex(0);
    setIsFlipped(false);
  };

  const restart = () => {
    setCurrentIndex(0);
    setIsFlipped(false);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') nextCard();
      if (e.key === 'ArrowLeft') prevCard();
      if (e.key === ' ' || e.key === "Enter") {
        e.preventDefault();
        setIsFlipped(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, quiz, isFlipped]);

  useEffect(() => {
    let timer: any;
    if (isAutoPlaying) {
      timer = setInterval(() => {
        if (isFlipped) {
          nextCard();
        } else {
          setIsFlipped(true);
        }
      }, 3000);
    }
    return () => clearInterval(timer);
  }, [isAutoPlaying, isFlipped, currentIndex]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
      </div>
    );
  }

  if (!quiz || shuffledQuestions.length === 0) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold mb-4">Quiz not found or has no cards.</h2>
        <button onClick={() => navigate('/admin')} className="px-6 py-2 bg-white/10 rounded-xl">Back to Dashboard</button>
      </div>
    );
  }

  const currentQuestion = shuffledQuestions[currentIndex];
  const correctAnswer = currentQuestion.options.find(o => o.isCorrect)?.text || "No answer provided";

  const nextCard = () => {
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % shuffledQuestions.length);
    }, 150);
  };

  const prevCard = () => {
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev - 1 + shuffledQuestions.length) % shuffledQuestions.length);
    }, 150);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 pt-6">
      <div className="flex items-center justify-between">
        <button 
          onClick={() => navigate('/admin')}
          className="flex items-center gap-2 text-white/60 hover:text-white transition-colors"
        >
          <Home size={20} />
          <span className="font-bold">Dashboard</span>
        </button>
        <div className="text-center">
          <h1 className="text-2xl font-black">{quiz.title}</h1>
          <p className="text-white/40 text-sm font-bold uppercase tracking-widest">{quiz.subject}</p>
        </div>
        <div className="text-white/60 font-black text-lg flex items-center gap-4">
          <button 
            onClick={() => {
              setViewMode(viewMode === 'card' ? 'list' : 'card');
              setIsAutoPlaying(false);
            }}
            className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-vibrant-blue text-white' : 'hover:bg-white/10'}`}
            title="Toggle List View"
          >
            <List size={20} />
          </button>
          <span>{currentIndex + 1} / {shuffledQuestions.length}</span>
        </div>
      </div>

      {viewMode === 'list' ? (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-4 pb-20"
        >
          {shuffledQuestions.map((q, i) => (
            <div key={i} className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border-2 border-white/10 flex flex-col md:flex-row gap-6">
              <div className="flex-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-vibrant-pink block mb-2">Question {i + 1}</span>
                <p className="text-xl font-bold">{q.text}</p>
              </div>
              <div className="flex-1 bg-white/5 rounded-xl p-4 border border-white/5">
                <span className="text-[10px] font-black uppercase tracking-widest text-vibrant-green block mb-2">Answer</span>
                <p className="text-xl font-bold text-vibrant-yellow">{q.options.find(o => o.isCorrect)?.text}</p>
              </div>
            </div>
          ))}
        </motion.div>
      ) : (
        <>
          {/* Progress Bar */}
          <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
            <motion.div 
              className="h-full bg-vibrant-yellow"
              initial={{ width: 0 }}
              animate={{ width: `${((currentIndex + 1) / shuffledQuestions.length) * 100}%` }}
            />
          </div>

          <div className="relative h-[400px] w-full">
        <AnimatePresence mode="popLayout">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, x: 100, rotate: 2 }}
            animate={{ opacity: 1, x: 0, rotate: 0 }}
            exit={{ opacity: 0, x: -100, rotate: -2 }}
            transition={{ type: 'spring', stiffness: 260, damping: 25 }}
            className="absolute inset-0 perspective-[1000px]"
          >
            <motion.div
              initial={false}
              animate={{ rotateY: isFlipped ? 180 : 0 }}
              transition={{ duration: 0.6, type: "spring", stiffness: 260, damping: 20 }}
              style={{ transformStyle: 'preserve-3d' }}
              onClick={() => setIsFlipped(!isFlipped)}
              className="relative w-full h-full cursor-pointer group"
            >
              {/* Front Face */}
              <div 
                style={{ backfaceVisibility: 'hidden' }}
                className="absolute inset-0 bg-white/10 text-white border-[8px] border-white/20 backdrop-blur-xl rounded-[40px] p-8 flex flex-col items-center justify-center text-center shadow-2xl group-hover:border-white/30 transition-colors"
              >
                <div className="absolute top-6 left-6 text-xs font-black uppercase tracking-widest opacity-50">
                  Question
                </div>
                
                <h2 className={`font-black tracking-tight drop-shadow-lg ${currentQuestion.text.length > 50 ? 'text-2xl' : 'text-3xl sm:text-4xl'}`}>
                  {currentQuestion.text}
                </h2>

                <div className="absolute bottom-6 flex items-center gap-2 opacity-50 font-bold text-sm">
                  <RotateCcw size={16} />
                  Tap to Flip
                </div>
              </div>

              {/* Back Face */}
              <div 
                style={{ 
                  backfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)'
                }}
                className="absolute inset-0 bg-white text-vibrant-text border-[8px] border-vibrant-yellow rounded-[40px] p-8 flex flex-col items-center justify-center text-center shadow-2xl"
              >
                <div className="absolute top-6 left-6 text-xs font-black uppercase tracking-widest text-vibrant-pink/50">
                  Answer
                </div>
                
                <h2 className={`font-black tracking-tight ${correctAnswer.length > 50 ? 'text-2xl' : 'text-3xl sm:text-4xl'}`}>
                  {correctAnswer}
                </h2>

                <div className="absolute bottom-6 flex items-center gap-2 text-vibrant-text/50 font-bold text-sm">
                  <RotateCcw size={16} className="rotate-180" />
                  Tap to See Question
                </div>
              </div>
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-center gap-4">
        <button
          onClick={prevCard}
          className="w-14 h-14 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center border-2 border-white/20 transition-all active:scale-95"
          title="Previous Card"
        >
          <ChevronLeft size={28} />
        </button>

        <button
          onClick={shuffleCards}
          className="w-14 h-14 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center border-2 border-white/20 transition-all active:scale-95 text-vibrant-blue"
          title="Shuffle Cards"
        >
          <Shuffle size={24} />
        </button>

        <button
          onClick={() => setIsFlipped(!isFlipped)}
          className="px-6 py-4 bg-vibrant-yellow text-vibrant-text font-black text-lg rounded-2xl border-[6px] border-vibrant-yellow-dark shadow-[0_6px_0_var(--color-vibrant-yellow-shadow)] hover:-translate-y-1 active:translate-y-1 active:shadow-none transition-all flex items-center gap-2"
        >
          <Eye size={20} />
          {isFlipped ? 'Show Front' : 'Show Back'}
        </button>

        <button
          onClick={() => {
            setIsAutoPlaying(!isAutoPlaying);
            if (!isAutoPlaying) {
              setViewMode('card');
            }
          }}
          className={`px-6 py-4 rounded-2xl border-[6px] transition-all font-black text-lg flex items-center gap-2 ${isAutoPlaying ? 'bg-vibrant-pink text-white border-vibrant-pink-border shadow-[0_6px_0_rgba(255,107,107,0.3)]' : 'bg-white/10 text-white border-white/20 hover:bg-white/20 shadow-[0_6px_0_rgba(255,255,255,0.05)]'}`}
          title="Auto-Play Mode"
        >
          {isAutoPlaying ? <Pause size={20} /> : <Play size={20} />}
          {isAutoPlaying ? 'Stop Auto' : 'Auto Play'}
        </button>

        <button
          onClick={restart}
          className="w-14 h-14 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center border-2 border-white/20 transition-all active:scale-95 text-vibrant-pink"
          title="Restart"
        >
          <RotateCcw size={24} />
        </button>

        <button
          onClick={nextCard}
          className="w-14 h-14 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center border-2 border-white/20 transition-all active:scale-95"
          title="Next Card"
        >
          <ChevronRight size={28} />
        </button>
      </div>

      <div className="text-center pt-4">
          <p className="text-white/40 text-sm italic">Tip: Use arrow keys or space to navigate</p>
      </div>
     </>
    )}
  </div>
);
}
