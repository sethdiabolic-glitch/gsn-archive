import { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

export type VoiceLine = { url: string; text: string };
export type VoiceEvent = { name: string; image?: string | undefined; category: string; line: VoiceLine; victory?: boolean };
const EVT = 'gsn-voice';
const MUTE_KEY = 'gsnVoiceMuted';
export function isMuted() { try { return localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; } }

type VoiceHolder = { voices?: (VoiceLine | undefined)[] | undefined; victoryVoice?: VoiceLine | undefined; voiceVersion?: number | undefined };

/** Entry-open lines. Legacy entries stored 4 lines + victory in slot 5. */
export function entryLines(e: VoiceHolder | undefined): VoiceLine[] {
  if (!e?.voices) return [];
  const list = e.voiceVersion === 2 ? e.voices : e.voices.slice(0, 4);
  return list.filter((v): v is VoiceLine => !!v?.url);
}
export function victoryLine(e: VoiceHolder | undefined): VoiceLine | undefined {
  if (!e) return undefined;
  if (e.voiceVersion === 2) return e.victoryVoice?.url ? e.victoryVoice : undefined;
  const v = e.voices?.[4];
  return v?.url ? v : undefined;
}

/** Linear descending weights: line 1 most common. 4 lines → 40/30/20/10. */
export function voicePercents(count: number): number[] {
  const total = (count * (count + 1)) / 2;
  return Array.from({ length: count }, (_, i) => Math.round(((count - i) / total) * 1000) / 10);
}

export function rollVoice(lines: VoiceLine[]): VoiceLine | undefined {
  if (!lines.length) return undefined;
  const w = lines.map((_, i) => lines.length - i);
  let r = Math.random() * w.reduce((s, x) => s + x, 0);
  for (let i = 0; i < lines.length; i++) { r -= w[i]!; if (r <= 0) return lines[i]; }
  return lines[lines.length - 1];
}

export function playVoice(e: VoiceEvent) { window.dispatchEvent(new CustomEvent<VoiceEvent>(EVT, { detail: e })); }

export function MuteToggle({ className = '' }: { className?: string }) {
  const [muted, setMuted] = useState(false);
  useEffect(() => setMuted(isMuted()), []);
  const toggle = () => { const next = !muted; setMuted(next); try { localStorage.setItem(MUTE_KEY, next ? '1' : '0'); } catch { /* ignore */ } window.dispatchEvent(new Event('gsn-mute')); };
  return <button type="button" className={`mute-toggle ${muted ? 'muted' : ''} ${className}`} onClick={toggle} aria-pressed={muted} aria-label={muted ? 'Unmute voice lines' : 'Mute voice lines'} title={muted ? 'Voice lines off' : 'Voice lines on'}>{muted ? <VolumeX size={16} /> : <Volume2 size={16} />}</button>;
}

export function CommsBanner() {
  const [current, setCurrent] = useState<VoiceEvent | null>(null);
  const [leaving, setLeaving] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => {
    const stop = () => { audio.current?.pause(); audio.current = null; window.clearTimeout(timer.current); };
    const dismiss = (delay: number) => { window.clearTimeout(timer.current); timer.current = window.setTimeout(() => { setLeaving(true); timer.current = window.setTimeout(() => { setCurrent(null); setLeaving(false); }, 450); }, delay); };
    const onVoice = (ev: Event) => {
      const detail = (ev as CustomEvent<VoiceEvent>).detail;
      if (isMuted()) return;
      stop(); setLeaving(false); setCurrent(detail);
      const a = new Audio(detail.line.url); audio.current = a;
      a.onended = () => dismiss(1500);
      a.onerror = () => dismiss(3500);
      dismiss(30000);
      a.play().catch(() => dismiss(3500));
    };
    const onMute = () => { if (isMuted()) { stop(); setCurrent(null); } };
    window.addEventListener(EVT, onVoice); window.addEventListener('gsn-mute', onMute);
    return () => { window.removeEventListener(EVT, onVoice); window.removeEventListener('gsn-mute', onMute); stop(); };
  }, []);
  if (!current) return null;
  return <div className={`comms-banner ${leaving ? 'leaving' : ''}`} role="status" style={{ '--profile-glow': `var(--category-${current.category})` } as React.CSSProperties}>
    <div className="comms-avatar">{current.image ? <img src={current.image} alt="" /> : <span>{current.name.slice(0, 1)}</span>}</div>
    <div className="comms-divider" aria-hidden="true" />
    <div className="comms-text"><div className="comms-head">{current.name.toUpperCase()} // {current.victory ? 'VICTORY' : 'COMM CHANNEL'} // SECURE</div><p>{current.line.text || '…'}</p></div>
    <div className="comms-wave" aria-hidden="true"><i /><i /><i /><i /></div>
  </div>;
}
