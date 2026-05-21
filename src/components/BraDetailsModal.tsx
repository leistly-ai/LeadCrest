import { useEffect, useRef, useState } from 'react';
import { X, PenLine, RotateCcw } from 'lucide-react';

const PROPERTY_TYPES = [
  'Detached',
  'Semi-Detached',
  'Townhouse',
  'Condominium Apartment',
  'Condominium Townhouse',
  'Link',
  'Multiplex',
  'Vacant Land',
  'Commercial',
  'Other',
];

/** Add N calendar days to a YYYY-MM-DD string */
const addDays = (dateStr: string, days: number): string => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

export interface BraDetails {
  brokerageName: string;
  brokeragePhone: string;
  brokerageAddress: string;
  propertyType: string;
  propertyStreet: string;
  propertyUnit: string;
  propertyCity: string;
  propertyProvince: string;
  propertyPostalCode: string;
  geographicLocation: string;
  startDate: string;
  expiryDate: string;
  commission: string;
  agentSignatureDataUrl: string;
  agentInitialsDataUrl: string;
}

interface Props {
  agentName: string;
  agentBrokerage: string;
  agentPhone?: string;
  agentAddress?: string;
  onConfirm: (details: BraDetails) => void;
  onCancel: () => void;
}

const today = new Date().toISOString().split('T')[0];
const defaultExpiry = addDays(today, 90);

function SignatureCanvas({
  label, width = 340, height = 90,
  onChange,
}: {
  label: string; width?: number; height?: number;
  onChange: (dataUrl: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1E3A5F';
  }, []);

  const pos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const r = canvas.getBoundingClientRect();
    const src = 'touches' in e ? e.touches[0] : e;
    return { x: src.clientX - r.left, y: src.clientY - r.top };
  };

  const start = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    drawing.current = true;
    const { x, y } = pos(e);
    const ctx = canvasRef.current!.getContext('2d')!;
    ctx.beginPath(); ctx.moveTo(x, y);
  };

  const move = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing.current) return;
    e.preventDefault();
    const { x, y } = pos(e);
    const ctx = canvasRef.current!.getContext('2d')!;
    ctx.lineTo(x, y); ctx.stroke();
    setEmpty(false);
    onChange(canvasRef.current!.toDataURL('image/png'));
  };

  const end = () => { drawing.current = false; };

  const clear = () => {
    const canvas = canvasRef.current!;
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height);
    setEmpty(true);
    onChange('');
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-charcoal/70">{label}</label>
        {!empty && (
          <button type="button" onClick={clear} className="flex items-center gap-1 text-xs text-charcoal/40 hover:text-red-500 transition-colors">
            <RotateCcw className="w-3 h-3" /> Clear
          </button>
        )}
      </div>
      <div className="relative rounded-xl border-2 border-dashed border-zinc-200 bg-zinc-50 overflow-hidden" style={{ width, height }}>
        <canvas
          ref={canvasRef} width={width} height={height}
          className="cursor-crosshair touch-none"
          onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
          onTouchStart={start} onTouchMove={move} onTouchEnd={end}
        />
        {empty && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-xs text-charcoal/30 flex items-center gap-1.5">
              <PenLine className="w-3.5 h-3.5" /> Draw here
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function BraDetailsModal({ agentName, agentBrokerage, agentPhone = '', agentAddress = '', onConfirm, onCancel }: Props) {
  const [brokerageName, setBrokerageName] = useState(agentBrokerage);
  const [brokeragePhone, setBrokeragePhone] = useState(agentPhone);
  const [brokerageAddress, setBrokerageAddress] = useState(agentAddress);
  const [propertyType, setPropertyType] = useState('');
  const [propertyStreet, setPropertyStreet] = useState('');
  const [propertyUnit, setPropertyUnit] = useState('');
  const [propertyCity, setPropertyCity] = useState('');
  const [propertyProvince, setPropertyProvince] = useState('ON');
  const [propertyPostalCode, setPropertyPostalCode] = useState('');
  const [geographicLocation, setGeographicLocation] = useState('');
  const [startDate, setStartDate] = useState(today);
  const [expiryDate, setExpiryDate] = useState(defaultExpiry);
  const [commission, setCommission] = useState('2.5%');

  // Keep expiry in sync with start date (only if it still matches the auto-calculated value)
  const prevAutoExpiry = useRef(defaultExpiry);
  useEffect(() => {
    const newAuto = addDays(startDate, 90);
    if (expiryDate === prevAutoExpiry.current) {
      setExpiryDate(newAuto);
    }
    prevAutoExpiry.current = newAuto;
  }, [startDate]);
  const [agentSig, setAgentSig] = useState('');
  const [agentInitials, setAgentInitials] = useState('');

  const handleSubmit = () => {
    onConfirm({
      brokerageName,
      brokeragePhone,
      brokerageAddress,
      propertyType,
      propertyStreet,
      propertyUnit,
      propertyCity,
      propertyProvince,
      propertyPostalCode,
      geographicLocation,
      startDate,
      expiryDate,
      commission,
      agentSignatureDataUrl: agentSig,
      agentInitialsDataUrl: agentInitials,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-8 px-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-100">
          <div>
            <h2 className="text-base font-black text-midnight">Complete BRA Details</h2>
            <p className="text-xs text-charcoal/50 mt-0.5">Review before sending to {agentName.split(' ')[0] || 'the lead'}</p>
          </div>
          <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-zinc-100 transition-colors">
            <X className="w-4 h-4 text-charcoal/50" />
          </button>
        </div>

        <div className="p-5 space-y-6 max-h-[75vh] overflow-y-auto">

          {/* Brokerage Details */}
          <section className="space-y-3">
            <h3 className="text-xs font-black text-charcoal/40 uppercase tracking-widest">Brokerage Details</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs font-bold text-charcoal/70 block mb-1">Brokerage Name</label>
                <input
                  value={brokerageName}
                  onChange={e => setBrokerageName(e.target.value)}
                  placeholder="e.g. RE/MAX Rouge River Realty Ltd."
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-honey/40"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-charcoal/70 block mb-1">Tel. No. <span className="text-charcoal/30 font-normal">(optional)</span></label>
                <input
                  type="tel" value={brokeragePhone} onChange={e => setBrokeragePhone(e.target.value)}
                  placeholder="e.g. 416-123-4567"
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-honey/40"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-charcoal/70 block mb-1">Fax No. <span className="text-charcoal/30 font-normal">(optional)</span></label>
                <input
                  placeholder="e.g. 416-123-4568"
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-honey/40"
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-bold text-charcoal/70 block mb-1">Brokerage Address <span className="text-charcoal/30 font-normal">(optional)</span></label>
                <input
                  value={brokerageAddress} onChange={e => setBrokerageAddress(e.target.value)}
                  placeholder="e.g. 123 Main St, Toronto, ON M4B 1B3"
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-honey/40"
                />
              </div>
            </div>
          </section>

          {/* Property */}
          <section className="space-y-3">
            <h3 className="text-xs font-black text-charcoal/40 uppercase tracking-widest">Property <span className="text-charcoal/30 font-normal normal-case tracking-normal">(leave blank if not yet identified)</span></h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-charcoal/70 block mb-1">Property Type</label>
                <select
                  value={propertyType}
                  onChange={e => setPropertyType(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-honey/40 bg-white"
                >
                  <option value="">— Select property type —</option>
                  {PROPERTY_TYPES.map(pt => (
                    <option key={pt} value={pt}>{pt}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="text-xs font-bold text-charcoal/70 block mb-1">Street Address</label>
                  <input
                    value={propertyStreet} onChange={e => setPropertyStreet(e.target.value)}
                    placeholder="e.g. 123 Maple Street"
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-honey/40"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-charcoal/70 block mb-1">Unit <span className="text-charcoal/30 font-normal">(opt.)</span></label>
                  <input
                    value={propertyUnit} onChange={e => setPropertyUnit(e.target.value)}
                    placeholder="e.g. 4B"
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-honey/40"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs font-bold text-charcoal/70 block mb-1">City</label>
                  <input
                    value={propertyCity} onChange={e => setPropertyCity(e.target.value)}
                    placeholder="e.g. Toronto"
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-honey/40"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-charcoal/70 block mb-1">Province</label>
                  <select
                    value={propertyProvince} onChange={e => setPropertyProvince(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-honey/40 bg-white"
                  >
                    {['AB','BC','MB','NB','NL','NS','NT','NU','ON','PE','QC','SK','YT'].map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-charcoal/70 block mb-1">Postal Code</label>
                  <input
                    value={propertyPostalCode}
                    onChange={e => setPropertyPostalCode(e.target.value.toUpperCase())}
                    placeholder="e.g. M4B 1B3"
                    maxLength={7}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-honey/40"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-charcoal/70 block mb-1">Geographic Search Area <span className="text-charcoal/30 font-normal">(if property not yet identified)</span></label>
                <input
                  value={geographicLocation} onChange={e => setGeographicLocation(e.target.value)}
                  placeholder="e.g. City of Toronto, York Region…"
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-honey/40"
                />
              </div>
            </div>
          </section>

          {/* Agreement Term */}
          <section className="space-y-3">
            <h3 className="text-xs font-black text-charcoal/40 uppercase tracking-widest">Agreement Term</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-charcoal/70 block mb-1">Start Date</label>
                <input
                  type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-honey/40"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-charcoal/70 block mb-1">Expiry Date <span className="text-charcoal/30 font-normal">(optional)</span></label>
                <input
                  type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-honey/40"
                />
              </div>
            </div>
          </section>

          {/* Commission */}
          <section className="space-y-3">
            <h3 className="text-xs font-black text-charcoal/40 uppercase tracking-widest">Commission</h3>
            <input
              value={commission} onChange={e => setCommission(e.target.value)}
              placeholder="e.g. 2.5% of the purchase price, or $5,000"
              className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-honey/40"
            />
          </section>

          {/* Agent Signatures */}
          <section className="space-y-4">
            <h3 className="text-xs font-black text-charcoal/40 uppercase tracking-widest">Your Signature & Initials</h3>
            <SignatureCanvas label="Agent Signature (Authorized to bind the Brokerage)" width={400} height={90} onChange={setAgentSig} />
            <SignatureCanvas label="Agent Initials" width={160} height={70} onChange={setAgentInitials} />
          </section>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-5 border-t border-zinc-100 bg-zinc-50 rounded-b-2xl">
          <button onClick={onCancel} className="px-4 py-2 text-sm font-bold text-charcoal/50 hover:text-charcoal transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="flex items-center gap-2 px-5 py-2.5 bg-midnight text-white text-sm font-bold rounded-xl hover:bg-midnight/90 transition-colors"
          >
            Send BRA to Lead →
          </button>
        </div>
      </div>
    </div>
  );
}
