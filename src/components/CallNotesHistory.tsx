import { Phone, Calendar, Clock, TrendingUp, CheckCircle, Mail, ExternalLink } from 'lucide-react';
import { motion } from 'motion/react';

interface CallNote {
  callSid: string;
  callDate: string;
  duration: number;
  transcript?: string;
  summary: string;
  keyPoints: string[];
  nextSteps: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
  recordingUrl?: string;
  emailedAt?: string;
}

interface CallNotesHistoryProps {
  callNotes?: CallNote[];
}

export default function CallNotesHistory({ callNotes = [] }: CallNotesHistoryProps) {
  if (!callNotes || callNotes.length === 0) {
    return (
      <div className="p-8 rounded-custom border border-zinc-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <Phone className="w-5 h-5 text-honey" />
          <h3 className="font-bold text-midnight">Call History</h3>
        </div>
        <p className="text-sm text-charcoal/60">No calls recorded yet. Use the "Call" button above to initiate an AI-monitored call.</p>
      </div>
    );
  }

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return 'text-sage bg-sage/10';
      case 'negative':
        return 'text-red-500 bg-red-500/10';
      default:
        return 'text-charcoal/60 bg-zinc-100';
    }
  };

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return '😊';
      case 'negative':
        return '😕';
      default:
        return '😐';
    }
  };

  return (
    <div className="p-8 rounded-custom border border-zinc-200 bg-white shadow-sm space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Phone className="w-5 h-5 text-honey" />
          <h3 className="font-bold text-midnight">Call History</h3>
        </div>
        <span className="text-xs font-bold text-charcoal/40 uppercase tracking-widest">
          {callNotes.length} Call{callNotes.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="space-y-4">
        {callNotes.map((note, index) => (
          <motion.div
            key={note.callSid}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="p-6 rounded-xl border border-zinc-100 bg-zinc-50/50 space-y-4"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2 flex-grow">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2 text-sm text-midnight font-medium">
                    <Calendar className="w-4 h-4 text-honey" />
                    {new Date(note.callDate).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-charcoal/60">
                    <Clock className="w-4 h-4" />
                    {Math.floor(note.duration / 60)}m {note.duration % 60}s
                  </div>
                  {note.emailedAt && (
                    <div className="flex items-center gap-1 text-xs text-sage">
                      <Mail className="w-3 h-3" />
                      Emailed
                    </div>
                  )}
                </div>
                <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold ${getSentimentColor(note.sentiment)}`}>
                  <span>{getSentimentIcon(note.sentiment)}</span>
                  <span className="capitalize">{note.sentiment}</span>
                </div>
              </div>
              {note.recordingUrl && (
                <a
                  href={note.recordingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-honey hover:text-honey/80 bg-honey/10 hover:bg-honey/20 rounded-lg transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                  Listen
                </a>
              )}
            </div>

            {/* Summary */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-charcoal/40 uppercase tracking-widest">Summary</h4>
              <p className="text-sm text-midnight leading-relaxed">{note.summary}</p>
            </div>

            {/* Key Points */}
            {note.keyPoints && note.keyPoints.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-charcoal/40 uppercase tracking-widest">Key Points</h4>
                <ul className="space-y-1.5">
                  {note.keyPoints.map((point, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-charcoal/80">
                      <TrendingUp className="w-3.5 h-3.5 text-honey mt-0.5 shrink-0" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Next Steps */}
            {note.nextSteps && note.nextSteps.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-charcoal/40 uppercase tracking-widest">Next Steps</h4>
                <ul className="space-y-1.5">
                  {note.nextSteps.map((step, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-charcoal/80">
                      <CheckCircle className="w-3.5 h-3.5 text-sage mt-0.5 shrink-0" />
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Transcript Preview */}
            {note.transcript && note.transcript !== 'Audio transcription in progress...' && (
              <details className="space-y-2">
                <summary className="text-xs font-bold text-charcoal/40 uppercase tracking-widest cursor-pointer hover:text-midnight transition-colors">
                  View Transcript
                </summary>
                <div className="p-4 bg-white rounded-lg border border-zinc-200 text-xs text-charcoal/70 leading-relaxed max-h-60 overflow-y-auto">
                  {note.transcript}
                </div>
              </details>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
