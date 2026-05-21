import { useState } from 'react';
import { Phone, PhoneCall, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CallLeadButtonProps {
  leadId: string;
  leadName: string;
  leadPhone: string;
  onCallInitiated?: () => void;
}

export default function CallLeadButton({ leadId, leadName, leadPhone, onCallInitiated }: CallLeadButtonProps) {
  const [calling, setCalling] = useState(false);
  const [callStatus, setCallStatus] = useState<'idle' | 'connecting' | 'in-call' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [callSid, setCallSid] = useState<string | null>(null);

  const initiateCall = async () => {
    setCalling(true);
    setCallStatus('connecting');
    setError(null);

    try {
      const response = await fetch('/api/calls/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId,
          leadName,
          leadPhone
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to initiate call');
      }

      const data = await response.json();
      setCallSid(data.callSid);
      setCallStatus('in-call');

      if (onCallInitiated) {
        onCallInitiated();
      }

      // Poll for call completion
      pollCallStatus(data.callSid);
    } catch (err: any) {
      console.error('Call initiation error:', err);
      setError(err.message || 'Failed to initiate call');
      setCallStatus('error');
      setCalling(false);
    }
  };

  const pollCallStatus = async (sid: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/calls/status/${sid}`);
        if (!response.ok) {
          clearInterval(pollInterval);
          return;
        }

        const data = await response.json();

        if (data.status === 'completed' || data.status === 'failed' || data.status === 'no-answer') {
          clearInterval(pollInterval);
          setCalling(false);

          if (data.status === 'completed') {
            setCallStatus('success');
            setTimeout(() => setCallStatus('idle'), 3000);
          } else {
            setCallStatus('error');
            setError(data.status === 'no-answer' ? 'No answer' : 'Call failed');
            setTimeout(() => setCallStatus('idle'), 3000);
          }
        }
      } catch (err) {
        console.error('Poll error:', err);
        clearInterval(pollInterval);
      }
    }, 3000);

    // Stop polling after 30 minutes
    setTimeout(() => clearInterval(pollInterval), 30 * 60 * 1000);
  };

  return (
    <div className="relative">
      <button
        onClick={initiateCall}
        disabled={calling || !leadPhone}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm ${
          callStatus === 'success'
            ? 'bg-sage text-white'
            : callStatus === 'error'
            ? 'bg-red-500 text-white'
            : 'bg-honey hover:bg-honey/90 text-white'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {calling ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            {callStatus === 'connecting' ? 'Connecting...' : 'In Call...'}
          </>
        ) : callStatus === 'success' ? (
          <>
            <CheckCircle2 className="w-4 h-4" />
            Call Completed
          </>
        ) : callStatus === 'error' ? (
          <>
            <XCircle className="w-4 h-4" />
            {error || 'Call Failed'}
          </>
        ) : (
          <>
            <PhoneCall className="w-4 h-4" />
            Call {leadName.split(' ')[0]}
          </>
        )}
      </button>

      <AnimatePresence>
        {callStatus === 'in-call' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute top-full left-0 right-0 mt-2 p-4 bg-white rounded-xl border border-zinc-200 shadow-lg z-10"
          >
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-sage/10 flex items-center justify-center">
                  <Phone className="w-5 h-5 text-sage animate-pulse" />
                </div>
                <div>
                  <p className="font-bold text-midnight text-sm">Call in Progress</p>
                  <p className="text-xs text-charcoal/60">AI assistant is listening and taking notes</p>
                </div>
              </div>
              <div className="text-[10px] text-charcoal/40 space-y-1">
                <p>✓ 3-way conference call active</p>
                <p>✓ AI transcription enabled</p>
                <p>✓ Notes will be emailed after call ends</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!leadPhone && (
        <p className="absolute top-full left-0 mt-1 text-xs text-red-500">
          No phone number available
        </p>
      )}
    </div>
  );
}
