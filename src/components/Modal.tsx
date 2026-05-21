import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export default function Modal({ isOpen, onClose, title, children }: ModalProps) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/50 backdrop-blur-md"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-2xl bg-white rounded-[12px] shadow-[0_20px_40px_rgba(0,0,0,0.15)] overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="flex items-center justify-between px-8 py-6">
              <h2 className="text-[24px] font-bold text-[#1E293B] leading-tight tracking-[0.02em]">{title}</h2>
              <button
                onClick={onClose}
                className="p-2 rounded-full text-[#71717A] hover:text-[#18181B] transition-colors"
              >
                <X className="w-6 h-6 stroke-[1.5]" />
              </button>
            </div>
            <div className="px-8 pb-8 overflow-y-auto custom-scrollbar">
              <div className="text-[#64748B] leading-[1.6] tracking-[0.02em] font-sans">
                {children}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
