import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { User } from 'firebase/auth';
import { collection, doc, setDoc, getDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { Quiz, QuizQuestion } from './types';
import { Plus, Trash, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function CreateQuiz({ user }: { user: User }) {
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const editId = queryParams.get('edit');

  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [timerPerQuestion, setTimer] = useState<number>(30);
  const [questions, setQuestions] = useState<QuizQuestion[]>([
    {
      text: '',
      options: [
        { id: '1', text: '', isCorrect: true },
        { id: '2', text: '', isCorrect: false },
        { id: '3', text: '', isCorrect: false },
        { id: '4', text: '', isCorrect: false },
      ]
    }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (editId) {
      const fetchQuizToEdit = async () => {
        try {
          const docRef = doc(db, 'quizzes', editId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists() && docSnap.data().adminId === user.uid) {
            const data = docSnap.data() as Quiz;
            setTitle(data.title);
            setSubject(data.subject);
            setTimer(data.timerPerQuestion);
            setQuestions(data.questions);
            setIsEditing(true);
          }
        } catch (error) {
          console.error("Error fetching quiz for edit:", error);
        }
      };
      fetchQuizToEdit();
    }
  }, [editId, user.uid]);

  const handleAddQuestion = () => {
    setQuestions([...questions, {
      text: '',
      options: [
        { id: Math.random().toString(36).substring(7), text: '', isCorrect: true },
        { id: Math.random().toString(36).substring(7), text: '', isCorrect: false },
        { id: Math.random().toString(36).substring(7), text: '', isCorrect: false },
        { id: Math.random().toString(36).substring(7), text: '', isCorrect: false },
      ]
    }]);
  };

  const handleRemoveQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const setCorrectOption = (qIndex: number, optionId: string) => {
    const newQ = [...questions];
    newQ[qIndex].options = newQ[qIndex].options.map(opt => ({
      ...opt,
      isCorrect: opt.id === optionId
    }));
    setQuestions(newQ);
  };

  const handleSave = async () => {
    if (!title || !subject || questions.length === 0) return alert('Please fill missing basic fields.');
    // Check if questions are valid
    const valid = questions.every(q => q.text && q.options.every(o => o.text));
    if (!valid) return alert('Please fill in all question text and option fields.');

    setIsSubmitting(true);
    try {
      const qs = [...questions];
      const quizRef = isEditing && editId ? doc(db, 'quizzes', editId) : doc(collection(db, 'quizzes'));
      const newQuiz: Quiz = {
        adminId: user.uid,
        title,
        subject,
        timerPerQuestion,
        questions: qs,
        createdAt: Date.now()
      };
      await setDoc(quizRef, newQuiz);
      navigate('/admin');
    } catch (e: any) {
      console.error(e);
      alert("Error saving: " + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 pb-32">
      <div className="bg-black/10 p-6 rounded-3xl border border-white/10 shadow-lg">
        <h1 className="text-4xl font-black drop-shadow-md">{isEditing ? 'Edit Flashcard Set' : 'Create New Quiz'}</h1>
        <p className="text-white/80 mt-1 font-medium">{isEditing ? 'Update your cards and settings.' : 'Add questions and configure settings.'}</p>
      </div>

      <div className="bg-white text-vibrant-text p-8 rounded-[32px] space-y-6 border-[4px] border-black/10 shadow-lg">
        <h2 className="text-2xl font-black">Quiz Settings</h2>
        <div className="grid sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-bold text-gray-500 mb-2 uppercase tracking-wide">Quiz Title</label>
            <input 
              type="text" 
              value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. History 101"
              className="w-full bg-black/5 border-[3px] border-black/10 rounded-2xl px-5 py-4 placeholder-gray-400 font-bold focus:outline-none focus:border-vibrant-blue focus:ring-4 focus:ring-vibrant-blue/20 transition-all text-xl"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-500 mb-2 uppercase tracking-wide">Subject</label>
            <input 
              type="text" 
              value={subject} onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. World History"
              className="w-full bg-black/5 border-[3px] border-black/10 rounded-2xl px-5 py-4 placeholder-gray-400 font-bold focus:outline-none focus:border-vibrant-blue focus:ring-4 focus:ring-vibrant-blue/20 transition-all text-xl"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-500 mb-2 uppercase tracking-wide">Timer per question</label>
            <select 
              value={timerPerQuestion} onChange={(e) => setTimer(Number(e.target.value))}
              className="w-full bg-black/5 border-[3px] border-black/10 rounded-2xl px-5 py-4 focus:outline-none focus:border-vibrant-blue focus:ring-4 focus:ring-vibrant-blue/20 transition-all font-bold text-xl"
            >
              <option value={15}>15 Seconds</option>
              <option value={30}>30 Seconds</option>
              <option value={60}>60 Seconds</option>
            </select>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <h2 className="text-3xl font-black drop-shadow-sm ml-2">Flashcard Questions</h2>
        <AnimatePresence>
          {questions.map((q, qIndex) => (
            <motion.div 
              key={qIndex}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white text-vibrant-text border-[4px] border-black/10 p-8 rounded-[32px] space-y-6 relative shadow-lg"
            >
              <div className="flex justify-between items-start">
                <h3 className="font-black text-2xl text-vibrant-pink">Card {qIndex + 1}</h3>
                {questions.length > 1 && (
                  <button onClick={() => handleRemoveQuestion(qIndex)} className="text-gray-400 hover:text-red-500 p-2 transition-colors bg-black/5 hover:bg-black/10 rounded-xl">
                    <Trash size={24} />
                  </button>
                )}
              </div>
              
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Question (Front)</label>
                <textarea 
                  value={q.text} onChange={(e) => {
                    const n = [...questions]; n[qIndex].text = e.target.value; setQuestions(n);
                  }}
                  placeholder="Type your question here..."
                  rows={2}
                  className="w-full bg-black/5 border-[3px] border-black/10 rounded-2xl px-5 py-4 focus:outline-none focus:border-vibrant-pink focus:ring-4 focus:ring-vibrant-pink/20 resize-none font-bold text-2xl placeholder-gray-400 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Image URL (Optional)</label>
                <input 
                  type="text"
                  value={q.imageUrl || ''} 
                  onChange={(e) => {
                    const n = [...questions]; n[qIndex].imageUrl = e.target.value; setQuestions(n);
                  }}
                  placeholder="Insert image URL (https://...)"
                  className="w-full bg-black/5 border-[3px] border-black/10 rounded-2xl px-5 py-3 focus:outline-none focus:border-vibrant-blue focus:ring-4 focus:ring-vibrant-blue/20 font-bold placeholder-gray-400 transition-all"
                />
              </div>

              <div className="space-y-4">
                <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-1">Answer Options (Correct one is the Card Back)</label>
                <div className="grid sm:grid-cols-2 gap-4">
                  {q.options.map((opt, optIndex) => {
                    return (
                    <div key={opt.id} 
                      onClick={() => setCorrectOption(qIndex, opt.id)}
                      className={`relative cursor-pointer rounded-2xl p-2 transition-all border-[4px] ${opt.isCorrect ? 'border-vibrant-green bg-vibrant-green/10' : 'border-black/10 bg-black/5 hover:border-black/20'}`}
                    >
                      <div className="flex items-center absolute right-4 top-0 bottom-0 pointer-events-none">
                        {opt.isCorrect ? <CheckCircle className="text-vibrant-green" size={28} strokeWidth={3} /> : <div className="w-7 h-7 rounded-full border-2 border-black/20" />}
                      </div>
                      <input 
                        type="text"
                        className="w-full bg-transparent border-none px-4 py-3 pr-12 focus:outline-none text-vibrant-text font-bold text-xl placeholder-gray-400"
                        placeholder={`Option ${optIndex + 1}`}
                        value={opt.text}
                        onChange={(e) => {
                          const n = [...questions];
                          n[qIndex].options[optIndex].text = e.target.value;
                          setQuestions(n);
                        }}
                        onClick={(e) => e.stopPropagation()} 
                      />
                    </div>
                  )})}
                </div>
              </div>
              <p className="text-sm font-bold text-gray-400 mt-2">Click an option container to mark it as the correct answer.</p>
            </motion.div>
          ))}
        </AnimatePresence>

        <button 
          onClick={handleAddQuestion}
          className="w-full py-6 bg-black/10 border-[4px] border-dashed border-white/30 text-white font-black text-2xl hover:bg-black/20 hover:border-white/50 rounded-[32px] flex items-center justify-center gap-3 transition-all mt-8"
        >
          <Plus size={32} strokeWidth={3} />
          Add Another Question
        </button>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-6 bg-vibrant-header/90 backdrop-blur-xl border-t-[6px] border-black/10 flex justify-center z-50 shadow-[0_-10px_20px_rgba(0,0,0,0.2)]">
        <button 
          disabled={isSubmitting}
          onClick={handleSave}
          className="bg-vibrant-yellow text-[#222] font-black text-2xl px-16 py-4 rounded-3xl border-[6px] border-vibrant-yellow-dark shadow-[0_6px_0_var(--color-vibrant-yellow-shadow)] hover:-translate-y-1 hover:shadow-[0_8px_0_var(--color-vibrant-yellow-shadow)] active:translate-y-1 active:shadow-none transition-all disabled:opacity-50 disabled:hover:translate-y-0"
        >
          {isSubmitting ? 'Saving...' : 'Save & Publish'}
        </button>
      </div>
    </div>
  );
}
