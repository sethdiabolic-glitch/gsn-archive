import { loadProfile } from "./lib/member";
import { AccountMenu, ProfilePage, NotificationsPage, CommentsPage, NoticeCard, NoticesAdmin, LoginRequired, ModerationPage } from "./MemberArea";
import { ImageViewerLink } from "./ImageViewerLink";
import type { PublicArchive } from "./lib/public-archive";
import { HypotheticalSummary } from './HypotheticalSummary';
import { useEntryDraft } from './useEntryDraft';
import { draftKey } from './lib/drafts';
import { RevisionHistory } from './RevisionHistory';
import { FeatEvidence } from './FeatEvidence';
import { referenceWarnings } from './lib/reference-tools';
import { Portrait } from './Portrait';
import { TagSearch } from './TagSearch';
import { GalleryFilterBar, useGalleryFilters } from './GalleryFilters';
import { cleanTag, uniqueTags, tagKey, filterArtworks, defaultGalleryFilters } from './lib/gallery';
import { ArchiveReferences, ReferenceInline, useArchiveReferences } from './ArchiveReferences';
import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { RichEntryEditor } from './RichEntryEditor';
import { RichDocument } from './RichDocument';
import { FeatFields } from './FeatFields';
import { visibleFeats, hasFeatData, type EntryFeats } from './lib/entry-feats';
import { CommsBanner, MuteToggle, playVoice, rollVoice, entryLines, victoryLine, voicePercents, type VoiceLine } from './VoiceComms';
import { isEntryHtml, plainEntryText } from './lib/entry-content';
import { useNavigate, useRouterState, useBlocker } from '@tanstack/react-router';
import { getArt, isGsnAdmin, submitArtBatch, supabase, uploadArchiveImage, uploadArchiveFile, type Artwork, type ArtworkRating } from './lib/community';
import { deleteArchiveEntry, loadArchive, saveArchiveEntry, loadArchiveAliases } from './lib/archive';
import {
  Archive, ArrowLeft, ArrowRight, BookOpen, ChevronRight, CircleDot, Database,
  FileText, FolderArchive, Gauge, GitCompare, Layers3, Menu, Pencil, Plus, Palette,
  Radar, ScanSearch, Lightbulb, Search, Shield, Swords, Trash2, X, Image, Upload, Check, AlertTriangle, LogIn,
} from 'lucide-react';

type Category = 'characters' | 'heretics' | 'raptures' | 'infra' | 'weapons' | 'theories' | 'appendix';
type Tier = 'EX' | 'S' | 'A' | 'B' | 'C' | 'D' | 'Undefined';
type NoteMarker = '♤' | '○' | '●' | '□' | '♡' | '◇' | '♧' | '☆' | '¤';
type ArchiveNote = { marker: NoteMarker; author: string; text: string };
type ArchiveImage = { url: string; alt?: string; tags: string[] };
type Entry = EntryFeats & {
  id?: string;
  name: string;
  cls: string;
  tag: string;
  summary: string;
  speed: string;
  strength: string;
  durability: string;
  hypothetical?: string;
  extra?: { label: string; value: string }[];
  tier?: Tier;
  image?: string;
  images?: ArchiveImage[];
  notes?: ArchiveNote[];
  createdAt?: string;
  voices?: (VoiceLine | undefined)[];
  victoryVoice?: VoiceLine | undefined;
  voiceVersion?: number;
};
type LegalTerms = { content: string; updated_at?: string };
type DatabaseState = Record<Category, Entry[]> & { settings?: { name: string; data: any }[] };

const categoryMeta: Record<Category, { label: string; color: string; icon: typeof Archive }> = {
  characters: { label: 'Characters', color: '#e21f2f', icon: Shield },
  heretics: { label: 'Heretics', color: '#ab82e8', icon: Radar },
  raptures: { label: 'Raptures', color: '#57c29b', icon: CircleDot },
  infra: { label: 'Structures', color: '#65a7d8', icon: Layers3 },
  weapons: { label: 'Weapons', color: '#d4b86a', icon: Swords },
  theories: { label: 'Theories', color: '#e0a64e', icon: Lightbulb },
  appendix: { label: 'Appendix', color: '#9299a4', icon: BookOpen },
};
const categories = Object.keys(categoryMeta) as Category[];
const isTheory = (c: Category) => c === 'theories';
const tiers: Tier[] = ['EX', 'S', 'A', 'B', 'C', 'D', 'Undefined'];
const noteMarkers: NoteMarker[] = ['♤', '○', '●', '□', '♡', '◇', '♧', '☆', '¤'];
const defaultTerms: LegalTerms = { content: 'These Terms of Use are maintained by GSN Arena. Replace this text with the current legal terms approved for publication.', updated_at: new Date().toISOString() };
const tierColors: Record<Tier, string> = {
  EX: '#ab82e8', S: '#ff3b45', A: '#e8a33d', B: '#d4b86a', C: '#65a7d8', D: '#57c29b', Undefined: '#9299a4',
};

function useLocation(): [string, (path: string) => void] {
  const location = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();
  return [location, useCallback((path: string) => void navigate({ to: path }), [navigate])];
}

const defaultData: DatabaseState = {
  characters: [
    { name: 'Pretty', cls: 'Standard Nikke', tag: 'FILE 001', summary: 'Reaction time measured in single-digit milliseconds. Specs sit closest to Liliweiss with a large gap remaining between them.', speed: '1–5ms reaction time', strength: 'N/A', durability: '100–300 kJ plate stop', hypothetical: 'Closing the gap to Liliweiss would require plate durability scaling into the megajoule range — at that point standard combat armor would need to be reclassified as anti-fortress grade.', tier: 'B' },
    { name: 'Mint', cls: 'Tetra Entertainment', tag: 'FILE 002', summary: 'Early file in the series, establishing lighter baseline feats before the scale of later entries.', speed: 'N/A', strength: 'N/A', durability: 'N/A', hypothetical: 'As a Tetra-line entertainment unit built from the same preset template as Anis and Prika, further feat data would likely track close to that family baseline.', tier: 'Undefined' },
    { name: 'Rapi (Red Hood)', cls: 'Elysion — Attacker', tag: 'FILE 003, 006', summary: 'Throw speed reaching Mach 21.8 at peak. Leg thrust while carrying 6 tons exceeds a Space Shuttle main engine. Soloed a Rapture horde while dying and corrupted, then immediately fought Anachiro.', speed: 'Mach 4.4–21.8 throw speed', strength: '2,058,000 N leg thrust', durability: '30–50G sustained', hypothetical: 'The corrupted-state charged shot was produced while dying, mid-combat, with no preparation. An uncorrupted, fully rested execution could plausibly exceed the 1 Megajoule figure.', tier: 'A', extra: [{ label: 'Charged shot', value: '~1 Megajoule' }, { label: 'Recoil (corrupted)', value: '3,333x lethal' }] },
    { name: 'Anis', cls: 'Tetra Entertainment', tag: 'FILE 004', summary: 'Frame approached Goddessium melting point while still operational. Output equivalent to half of global human energy consumption, sustained.', speed: 'N/A', strength: '10 Terawatts continuous', durability: 'Frame stable near 3,000°C', hypothetical: 'Sustained output any further past this threshold would push the frame past Goddessium melting point entirely.', tier: 'A' },
    { name: 'Neon', cls: 'Missilis — Defender', tag: 'FILE 005', summary: 'Immune to E2 crystal corruption, poison, and corrosion. Only bypassed once, by a toxin targeting her core directly rather than her body.', speed: 'N/A', strength: 'Scaled to geological-event tier', durability: 'Immune to dark matter corruption', hypothetical: 'If her immunity extends to novel corrupting agents beyond the ones tested, she could function as a living containment unit.', tier: 'B' },
    { name: 'Bahamut', cls: 'Missilis — Researcher', tag: 'FILE 007', summary: 'Created E2 crystals. Built the Ark artificial dimension. Made Only One from the Commander genetic material. Chronically underestimated, apparently on purpose.', speed: 'N/A', strength: 'N/A', durability: 'N/A', hypothetical: 'If the surface-level eccentricity is deliberate camouflage, the actual ceiling of her capability is unknown by design.', tier: 'Undefined' },
    { name: 'Cinderella', cls: 'Pilgrim — Unknown Unit', tag: 'FILE 008', summary: 'Tanks a blade that bisects Tyrant-class Raptures. Dodges anti-ship rifle fire at point-blank range. Blaster output rivals a nuclear warhead per second, sustained.', speed: '107 km/h sideways evasion', strength: '70 PJ/s sustained blaster', durability: '3+ MJ impact threshold', hypothetical: 'At sustained output beyond current levels, the blast would begin ionizing the surrounding atmosphere — turning the air into a secondary conductor.', tier: 'EX' },
    { name: 'Laplace', cls: 'Matis — Special Ops', tag: 'FILE 009', summary: 'Cleared a Rapture front line at zero charge, then swept a full square kilometer in five seconds via a plasma beam, absorbing recoil equivalent to 3.5 MOABs.', speed: '50–100 km/h micro-bursts', strength: '162 MJ / 5-second sweep', durability: '540,000x lethal recoil tolerance', hypothetical: 'Scaled to sustained fire rather than burst charge, the beam would strip matter past liquid state entirely.', tier: 'S' },
    { name: 'ENNIK', cls: 'Ark Judicial System', tag: 'FILE 010', summary: 'Not a body. An infrastructure. Runs 7 million camera feeds, serves as judge and lawyer to 500,000 people, and decided on her own that she should hold these roles.', speed: 'N/A', strength: 'N/A', durability: 'N/A', hypothetical: 'If shadow integration had been chosen over amputation, ENNIK prosperity calculations would become consciously non-deterministic.', tier: 'S', extra: [{ label: 'Parameters', value: '5–20 Trillion' }, { label: 'Power draw', value: '~207 Megawatts' }, { label: 'Camera feeds', value: '7,000,000 simultaneous' }] },
    { name: 'Nihilister', cls: 'Heretic — Dragon Form', tag: 'SPECIAL EDITION', summary: 'Dragon form weighs half a Titanic. Human form density exceeds osmium by a factor of 20,000. Breathes fire hot enough to reduce a 100m² area to lava within a minute.', speed: 'N/A', strength: '6.7 MJ/s sustained flame', durability: '30,272 tons — survived Mach 5.8 impact', hypothetical: 'If her durability threshold sits above the one confirmed impact she has tanked, current numbers may represent a floor rather than her ceiling.', tier: 'S' },
  ],
  heretics: [
    { name: 'Anachiro', cls: 'Anti-Nikke Unit', tag: 'REF', summary: 'Dodges anti-Nikke rounds fired at Mach 4–22 and predicted Rapi return shot despite the shooter being mid-corruption.', speed: 'Dodges Mach 4–22 fire', strength: 'N/A', durability: '300,000+ J defense threshold', tier: 'A' },
  ],
  raptures: [
    { name: 'Mirror', cls: 'Grimm Model', tag: 'REF', summary: 'Standard Grimm-tier durability, used as the baseline for Cinderella single-shot penetration calculation.', speed: 'N/A', strength: 'N/A', durability: '300,000 J', tier: 'C' },
  ],
  infra: [
    { name: 'AA Pillar', cls: 'Terraforming Structure', tag: 'SIDE POST', summary: 'An ICBM-sized structure that converts terrain to glass — the one material dark matter cannot assimilate. Absorbed a partial Gluttony overload north of 300 Petajoules.', speed: 'N/A', strength: '1–5 Exajoules total output', durability: 'Survived direct Gluttony contact', tier: 'S' },
    { name: 'The Ark', cls: 'Habitable Structure', tag: 'REF', summary: '10,000 km² of mechanical infrastructure, functionally the size of an advanced city. Every block, street and corner under near-total surveillance.', speed: 'N/A', strength: 'N/A', durability: '10,000 km² surface area', tier: 'A' },
  ],
  weapons: [],
  theories: [],
  appendix: [
    { name: 'Goddessium', cls: 'Material', tag: 'GLOSSARY', summary: 'The titanium-derived material composing Nikke bodies. Density ~4,500 kg/m³, several times stronger than titanium, with properties that behave more biological than purely mechanical.', speed: 'N/A', strength: 'N/A', durability: 'N/A' },
    { name: 'Raptium', cls: 'Material', tag: 'GLOSSARY', summary: 'The material composing Rapture bodies. Structurally related to Goddessium, but not identical — origin still under speculation.', speed: 'N/A', strength: 'N/A', durability: 'N/A' },
    { name: 'Plasma', cls: 'Physics term', tag: 'GLOSSARY', summary: 'Ionized matter — a state where electrons are stripped from atoms, carrying both energy and physical mass. Unlike a pure light-based laser, plasma can transfer real recoil force.', speed: 'N/A', strength: 'N/A', durability: 'N/A' },
    { name: 'Megajoule', cls: 'Unit of energy', tag: 'GLOSSARY', summary: 'A unit of energy equal to 1 million joules. For reference, a 2-ton vehicle hitting something at 390 km/h releases roughly 3 megajoules.', speed: 'N/A', strength: 'N/A', durability: 'N/A' },
    { name: 'Petajoule', cls: 'Unit of energy', tag: 'GLOSSARY', summary: 'A unit of energy equal to one quadrillion joules. The Satan II warhead yields roughly 209 petajoules.', speed: 'N/A', strength: 'N/A', durability: 'N/A' },
    { name: 'Core', cls: 'Component', tag: 'GLOSSARY', summary: 'The central component present in both Nikkes and Raptures, functioning as both a power source and — per recent theory — something closer to a biological heart.', speed: 'N/A', strength: 'N/A', durability: 'N/A' },
  ],
};

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const getStoredData = (): DatabaseState => {
  try {
    const stored = localStorage.getItem('gsnArenaData');
    if (stored) return { ...clone(defaultData), ...JSON.parse(stored) };
  } catch { /* fall back to the authored archive */ }
  return clone(defaultData);
};

function allEntries(data: DatabaseState) {
  return categories.flatMap((category) => data[category].map((item) => ({ item, category })));
}

function iconFor(category: Category) {
  const Icon = categoryMeta[category].icon;
  return <Icon size={16} strokeWidth={1.7} />;
}

function AppContent({ initialArchive }: { initialArchive?: PublicArchive | null | undefined }) {
  const [location, setLocation] = useLocation();
  const [data, setData] = useState<DatabaseState>(() => initialArchive ? initialArchive as unknown as DatabaseState : getStoredData());
  // currentUser = anyone signed in (needed to submit community art).
  // mode only becomes 'editor' once that signed-in user is confirmed as an
  // admin by the database — never just because someone is signed in.
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [mode, setMode] = useState<'public' | 'editor'>('public');
  const [archiveReady, setArchiveReady] = useState(Boolean(initialArchive));
  const [archiveSource, setArchiveSource] = useState<'remote' | 'cache' | 'unconfigured'>(initialArchive ? 'remote' : 'cache');
  const [archiveRefresh, setArchiveRefresh] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSync, setLastSync] = useState(() => { try { return localStorage.getItem('gsnArenaLastSync') || ''; } catch { return ''; } });
  const [aliases, setAliases] = useState<Array<{ category: string; name: string; entry_id: string }>>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [toast, setToast] = useState('');
  const [editing, setEditing] = useState<{ category: Category; entry?: Entry } | null>(null);
  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [artError, setArtError] = useState('');
  const [artLoading, setArtLoading] = useState(true);
  const [terms, setTerms] = useState<LegalTerms>(() => { if (!initialArchive) { try { return JSON.parse(localStorage.getItem('gsnArenaTerms') || 'null') || defaultTerms; } catch { return defaultTerms; } } const row = initialArchive['settings']?.find(item => item['name'] === 'terms'); return row && typeof row['content'] === 'string' ? { content: row['content'] } : defaultTerms; });
  const [artRefresh, setArtRefresh] = useState(0);
  const [imageTags, setImageTags] = useState<string[]>(() => { if (!initialArchive) { try { return JSON.parse(localStorage.getItem('gsnArenaTags') || '[]'); } catch { return []; } } const tags = initialArchive['settings']?.find(item => item['name'] === 'image_tags')?.['tags']; return Array.isArray(tags) ? tags.filter((tag): tag is string => typeof tag === 'string') : []; });
  useEffect(() => { try { localStorage.setItem('gsnArenaTags', JSON.stringify(imageTags)); } catch {} }, [imageTags]);
  const removeImageTag = async (tag: string) => {
    const next = imageTags.filter((t) => t !== tag);
    try { if (archiveSource !== 'remote') throw new Error('Reconnect before editing shared tags.'); await saveArchiveEntry('settings', 'image_tags', { name: 'image_tags', tags: next }); setImageTags(next); setToast(`Tag "${tag}" removed`); }
    catch (error) { setToast(error instanceof Error ? `Tag save failed: ${error.message}` : 'Tag save failed'); }
  };
  const addImageTag = async (tag: string) => {
    const clean = cleanTag(tag);
    if (!clean || imageTags.some((t) => tagKey(t) === tagKey(clean))) return;
    const next = [...imageTags, clean].sort((a, b) => a.localeCompare(b));
    try { if (archiveSource !== 'remote') throw new Error('Reconnect before editing shared tags.'); await saveArchiveEntry('settings', 'image_tags', { name: 'image_tags', tags: next }); setImageTags(next); setToast(`Tag "${clean}" added`); }
    catch (error) { setToast(error instanceof Error ? `Tag save failed: ${error.message}` : 'Tag save failed'); }
  };
  useEffect(() => {
    let cancelled = false;
    setRefreshing(true);
    loadArchive(getStoredData()).then(async ({ data: remote, source }) => {
      if (cancelled) return;
      const empty = Object.fromEntries(categories.map(category => [category, []]));
      const merged = source === 'remote' ? { ...empty, ...remote } as DatabaseState : remote;
      setData(merged);
      setArchiveSource(source);
      const settings = merged.settings || [];
      const termsRow = settings.find(item => item.name === 'terms') as any;
      const remoteTerms = termsRow?.content ? termsRow : termsRow?.data;
      if (remoteTerms?.content) setTerms({ content: remoteTerms.content, updated_at: remoteTerms.updated_at });
      const tagRow = settings.find(item => item.name === 'image_tags') as any;
      const tags = tagRow?.tags ?? tagRow?.data?.tags;
      if (Array.isArray(tags)) setImageTags(uniqueTags(tags));
      if (source === 'remote') {
        const now = new Date().toISOString();
        setLastSync(now);
        try { localStorage.setItem('gsnArenaLastSync', now); } catch { /* Storage may be disabled. */ }
        try { const next = await loadArchiveAliases(); if (!cancelled) setAliases(next); }
        catch { if (!cancelled) setToast('Archive loaded, but historical links could not be loaded. Check the database migration.'); }
      }
    }).finally(() => { if (!cancelled) { setArchiveReady(true); setRefreshing(false); } });
    return () => { cancelled = true; };
  }, [mode, archiveRefresh]);
  useEffect(() => {
    let cancelled = false;
    setArtLoading(true);
    getArt().then(next => { if (!cancelled) { setArtworks(next); setArtError(''); } })
      .catch(() => { if (!cancelled) setArtError('Artwork could not be refreshed. Any artwork still shown may be outdated.'); }).finally(() => { if (!cancelled) setArtLoading(false); });
    return () => { cancelled = true; };
  }, [artRefresh]);
  useEffect(() => {
    if (!supabase) return;
    let active=true, request=0, identity:string|null=null;
    const applySession = (user: any) => {
      if(!active)return;
      const generation=++request;
      setCurrentUser(user || null);
      if(!user || identity!==user.id)setMode('public');
      identity=user?.id||null;
      if(!user)return;
      // Auth callbacks run under Supabase's session lock. Defer calls that need that lock.
      setTimeout(()=>{if(active)void isGsnAdmin().then(admin=>{if(active&&generation===request)setMode(admin?'editor':'public');}).catch(()=>{if(active&&generation===request)setMode('public');});},0);
    };
    supabase.auth.getUser().then(({ data: auth }) => {if(active)applySession(auth.user);});
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => applySession(session?.user));
    return () => {active=false;request++;listener.subscription.unsubscribe();};
  }, []);
  const [showAuth, setShowAuth] = useState(false);
  const signInAsAdmin = () => {
    if (!supabase) { setToast('Connect Supabase first — see COMMUNITY-SETUP.md.'); return; }
    setShowAuth(true);
  };
  const signOut = async () => { if (supabase) await supabase.auth.signOut(); setMode('public'); setCurrentUser(null); };

  useEffect(() => {
    try { localStorage.setItem('gsnArenaData', JSON.stringify(data)); } catch {}
  }, [data]);
  useEffect(() => { try { localStorage.setItem('gsnArenaTerms', JSON.stringify(terms)); } catch {} }, [terms]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 7000);
    return () => window.clearTimeout(timer);
  }, [toast]);
  useEffect(() => setSidebarOpen(false), [location]);
  useEffect(() => { document.body.style.overflow = sidebarOpen ? 'hidden' : ''; return () => { document.body.style.overflow = ''; }; }, [sidebarOpen]);

  const navigate = (path: string) => setLocation(path);
  const saveEntry = async (category: Category, entry: Entry, originalName?: string) => {
    if (!originalName && category !== 'appendix' && !entry.createdAt) entry = { ...entry, createdAt: new Date().toISOString() };
    try {
      if (archiveSource !== 'remote') throw new Error('Reconnect and reload the shared archive before publishing. Your draft is still here.');
      await saveArchiveEntry(category, entry.name, entry, originalName);
      setData((previous) => {
        const list = [...previous[category]];
        const index = originalName ? list.findIndex((item) => item.name === originalName) : -1;
        if (index >= 0) list[index] = entry;
        else list.unshift(entry);
        return { ...previous, [category]: list };
      });
      setArchiveRefresh(value => value + 1);
      setEditing(null);
      setToast(`${entry.name} published to the shared archive`);
    } catch (error) {
      setToast(error instanceof Error ? `Save failed: ${error.message}` : 'Save failed');
      throw error;
    }
  };
  const deleteEntry = async (category: Category, name: string) => {
    if (!window.confirm(`Remove ${name} from the shared archive?`)) return;
    try {
      if (archiveSource !== 'remote') throw new Error('Reconnect before deleting shared entries.');
      await deleteArchiveEntry(category, name);
      setData((previous) => ({ ...previous, [category]: previous[category].filter((item) => item.name !== name) }));
      setToast(`${name} removed from the shared archive`);
    } catch (error) {
      setToast(error instanceof Error ? `Delete failed: ${error.message}` : 'Delete failed');
    }
  };
  const openEntry = (category: Category, name: string) => navigate(`/entry/${category}/${encodeURIComponent(name)}`);
  const parsed = location.split('/').filter(Boolean);
  const requestedPage = parsed[0] || 'home';
  const allowedPages = mode === 'editor'
    ? ['home', 'tier-list', 'compare', 'terms', 'editor', 'community', 'community-editor', 'notices', 'profile', 'notifications', 'comments', 'entry', ...categories]
    : ['home', 'tier-list', 'compare', 'terms', 'community', 'profile', 'notifications', 'comments', 'entry', ...categories];
  const page = allowedPages.includes(requestedPage) ? requestedPage : (mode === 'editor' ? 'editor' : 'home');
  const activeCategory = categories.includes(page as Category) ? page as Category : null;
  const requestedEntry = page === 'entry' ? (() => { try { return decodeURIComponent(parsed.slice(2).join('/')); } catch { return ''; } })() : '';
  const alias = aliases.find(item => item.category === parsed[1] && item.name === requestedEntry);
  const activeEntry = alias ? data[alias.category as Category]?.find(item => item.id === alias.entry_id)?.name || requestedEntry : requestedEntry;
  const entryCategory = page === 'entry' && categories.includes(parsed[1] as Category) ? parsed[1] as Category : null;

  const currentTitle = page === 'home' ? 'Archive overview' :
    page === 'tier-list' ? 'Tier list' :
      page === 'compare' ? 'Compare' :
        page === 'terms' ? 'Terms of Use' :
          page === 'editor' ? 'Archive database' :
          page === 'community' ? 'Community art' :
            page === 'community-editor' ? 'Community moderation' :
              page === 'profile' ? 'Profile' : page === 'notifications' ? 'Notifications' : page === 'comments' ? 'Discussion' : page === 'notices' ? 'Notices' : page === 'entry' ? 'Dossier' : activeCategory ? categoryMeta[activeCategory].label : 'Archive';

  useEffect(() => {
    if (page === 'entry' && activeEntry !== requestedEntry && entryCategory) {
      void setLocation(`/entry/${entryCategory}/${encodeURIComponent(activeEntry)}`);
    }
  }, [activeEntry, requestedEntry, entryCategory, page, setLocation]);

  if (!archiveReady) return <div className="auth-screen"><div className="auth-card"><div className="eyebrow">GSN Arena / uplink</div><h1 className="display-title">Loading <em>archive</em></h1><p className="lede">Connecting to the shared archive…</p></div>

  </div>;

  return (
    <ArchiveReferences entries={allEntries(data).map(({ item, category }) => ({ ...item, category }))} aliases={aliases} navigate={setLocation}><div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <button className="sidebar-close" type="button" aria-label="Close navigation" onClick={() => setSidebarOpen(false)}><X size={18} /></button>
        <div className="brand-block">
          <div className="brand-line">
            <img className="brand-logo" src="/gsn-logo.png" alt="GSN Arena" />
            <div className="brand-name">GSN <span>ARENA</span></div>
          </div>
          <p className="brand-sub">Intelligence archive / v19.04</p>
        </div>
        <nav className="nav-section" aria-label="Primary navigation">
          <div className="nav-label">Command</div>
          <NavButton active={page === 'home'} icon={<Archive size={16} />} onClick={() => navigate('/')}>Overview</NavButton>
          <NavButton active={page === 'tier-list'} icon={<Gauge size={16} />} onClick={() => navigate('/tier-list')}>Tier List</NavButton>
          <NavButton active={page === 'compare'} icon={<GitCompare size={16} />} onClick={() => navigate('/compare')}>Compare</NavButton>
          <NavButton active={page === 'terms'} icon={<FileText size={16} />} onClick={() => navigate('/terms')}>Terms</NavButton>
          <div className="nav-label" style={{ marginTop: 18 }}>Archive sectors</div>
          {categories.map((category) => (
            <NavButton key={category} active={activeCategory === category} icon={iconFor(category)} accent={`var(--category-${category})`} count={data[category].length} onClick={() => navigate(`/${category}`)}>
              {categoryMeta[category].label}
            </NavButton>
          ))}
          {mode === 'public' && <>
            <div className="nav-label" style={{ marginTop: 18 }}>Community</div>
            <NavButton active={page === 'community'} icon={<Image size={16} />} onClick={() => navigate('/community')}>Community Art</NavButton>
          </>}
          {currentUser && <><div className="nav-label">Your console</div><NavButton active={page === 'profile'} icon={<Image size={16}/>} onClick={() => navigate('/profile')}>Profile / My Images</NavButton><NavButton active={page === 'notifications'} icon={<CircleDot size={16}/>} onClick={() => navigate('/notifications')}>Notifications</NavButton></>}
          {mode === 'editor' && <>
            <div className="nav-label" style={{ marginTop: 18 }}>Community</div>
            <NavButton active={page === 'community'} icon={<Image size={16} />} onClick={() => navigate('/community')}>Community Art</NavButton>
            <NavButton active={page === 'notices'} icon={<FileText size={16}/>} onClick={() => navigate('/notices')}>Notices</NavButton><NavButton active={page === 'community-editor'} icon={<Check size={16} />} onClick={() => navigate('/community-editor')}>Moderation</NavButton>
            <div className="nav-label" style={{ marginTop: 18 }}>Maintenance</div>
            <NavButton active={page === 'editor'} icon={<Database size={16} />} onClick={() => navigate('/editor')}>Database Editor</NavButton>
            <NavButton active={page === 'terms'} icon={<FileText size={16} />} onClick={() => navigate('/terms')}>Edit Terms</NavButton>
          </>}
        </nav>
        <div className="sidebar-foot">
          {mode === 'editor'
            ? <><strong>EDITOR MODE</strong><br />Signed in as {currentUser?.email || 'admin'}.<br />Changes affect the archive.<br /><button className="btn ghost mini" type="button" onClick={signOut} style={{ marginTop: 8 }}>Sign out</button></>
            : <><strong>PUBLIC ARCHIVE</strong><br />Read-only archive access.<br />Community uploads are moderated.<br />{currentUser ? <button className="btn ghost mini" type="button" onClick={signOut} style={{ marginTop: 8 }}>Sign out ({currentUser.email})</button> : <button className="btn ghost mini" type="button" onClick={signInAsAdmin} style={{ marginTop: 8 }}><LogIn size={12} /> Sign in</button>}</>}
        </div>
      </aside>

      <div className="main-wrap">
        <div className="mobile-topbar">
          <button className="menu-button" type="button" aria-label="Open navigation" data-testid="button-open-navigation" onClick={() => setSidebarOpen(true)}><Menu size={18} /></button>
          <div className="mobile-brand"><img src="/gsn-logo.png" alt="" />GSN <span>ARENA</span></div>
          <button className="menu-button" type="button" aria-label="Search archive" data-testid="button-mobile-search" onClick={() => setSearchOpen(true)}><Search size={17} /></button>
        </div>
        <header className="topbar">
          <div className="crumb"><span>GSN /</span><strong>{currentTitle}</strong></div>
          <button className="search-trigger" type="button" data-testid="button-search-archive" onClick={() => setSearchOpen(true)}><Search size={15} /><span>Search the archive</span><kbd>⌘ K</kbd></button>
          <MuteToggle /><AccountMenu key={currentUser?.id || "guest"} user={currentUser} onSignIn={signInAsAdmin} onSignOut={signOut} />
        </header>
        <main className={`content ${editing ? 'content-editing' : ''}`}><NoticeCard />
          {archiveSource !== 'remote' && <div className="notice-box" role="status"><strong>{archiveSource === 'unconfigured' ? 'Shared storage is not configured.' : 'Showing saved or built-in content. Updates could not be loaded.'}</strong><p>{lastSync ? `Last synced: ${new Date(lastSync).toLocaleString()}` : 'No successful sync has been recorded in this browser.'} Publishing is unavailable until the shared archive reconnects.</p><button className="btn" disabled={refreshing} onClick={() => setArchiveRefresh(value => value + 1)}>{refreshing ? 'Connecting…' : 'Retry connection'}</button></div>}
          {editing ? <EditorModal key={`${editing.category}/${editing.entry?.id || editing.entry?.name || 'new'}`} userId={currentUser?.id || 'anonymous'} initial={editing.entry} category={editing.category} onClose={() => setEditing(null)} onSave={saveEntry} /> : <>
          {page === 'profile' && (currentUser ? <ProfilePage key={currentUser.id} user={currentUser} onChanged={() => setArtRefresh(v=>v+1)}><ProfileSubmission tags={imageTags} onSubmitted={() => setArtRefresh(v=>v+1)}/></ProfilePage> : <LoginRequired onSignIn={signInAsAdmin}/>)}
          {page === 'notifications' && (currentUser ? <NotificationsPage key={currentUser.id}/> : <LoginRequired onSignIn={signInAsAdmin}/>)}
          {page === 'comments' && <CommentsPage key={`${parsed[1]}/${currentUser?.id || 'guest'}`} entryId={parsed[1] || ''} user={currentUser} isAdmin={mode === 'editor'} onSignIn={signInAsAdmin}/>}
          {page === 'notices' && mode === 'editor' && <NoticesAdmin/>}
          {page === 'home' && <HomePage data={data} navigate={navigate} openEntry={openEntry} />}
          {activeCategory && <CategoryPage category={activeCategory} data={data} openEntry={openEntry} />}
          {page === 'tier-list' && <TierListPage data={data} openEntry={openEntry} />}
          {page === 'compare' && <ComparePage data={data} openEntry={openEntry} />}
          {page === 'terms' && <TermsPage terms={terms} editable={mode === 'editor'} onSave={async (next) => { try { if (archiveSource !== 'remote') throw new Error('Reconnect before publishing terms.'); await saveArchiveEntry('settings', 'terms', next); setTerms(next); setToast('Terms of Use published to the shared archive'); } catch (error) { setToast(error instanceof Error ? `Terms save failed: ${error.message}` : 'Terms save failed'); } }} />}
          {mode === 'editor' && page === 'editor' && <EditorPage tags={imageTags} onAddTag={addImageTag} onRemoveTag={removeImageTag} data={data} onEdit={(category, entry) => setEditing({ category, entry })} onDelete={deleteEntry} onAdd={(category) => setEditing({ category })} />}
          {page === 'community' && artError && <div className="notice-box" role="alert">{artError} <button className="btn" onClick={() => setArtRefresh(value => value + 1)}>Retry</button></div>}
          {page === 'community' && <CommunityArtPage loading={artLoading} loadError={artError} isAdmin={mode === 'editor'} tags={imageTags} userId={currentUser?.id} onToast={setToast} artworks={artworks} onSubmitted={() => setArtRefresh((v) => v + 1)} />}
          {mode === 'editor' && page === 'community-editor' && <CommunityModerationPage onChanged={() => setArtRefresh((v) => v + 1)} />}
          {page === 'entry' && entryCategory && <DossierPage category={entryCategory} name={activeEntry} data={data} onBack={() => window.history.length > 1 ? window.history.back() : navigate('/')} onEdit={mode === 'editor' ? (entry) => setEditing({ category: entryCategory, entry }) : undefined} />}
          {page === 'entry' && !entryCategory && <NotFound navigate={navigate} />}
          </>}
        </main>
      </div>
      {sidebarOpen && <button className="modal-backdrop" type="button" aria-label="Close navigation" data-testid="button-close-navigation" onClick={() => setSidebarOpen(false)} style={{ zIndex: 15, background: 'rgba(0,0,0,.5)' }} />}
      {searchOpen && <SearchModal data={data} term={searchTerm} setTerm={setSearchTerm} onClose={() => { setSearchOpen(false); setSearchTerm(''); }} onOpen={(category, name) => { setSearchOpen(false); setSearchTerm(''); openEntry(category, name); }} />}
      <CommsBanner />
      {toast && <div className="toast" role="status" data-testid="status-toast">{toast}</div>}
      {showAuth && <EmailAuthModal onClose={() => setShowAuth(false)} />}
    </div></ArchiveReferences>
  );
}

function NavButton({ active, icon, children, onClick, accent, count }: { active: boolean; icon: React.ReactNode; children: React.ReactNode; onClick: () => void; accent?: string; count?: number }) {
  const destinations: Record<string, string> = { Overview: '/', 'Tier List': '/tier-list', Compare: '/compare', Terms: '/terms', 'Community Art': '/community', Moderation: '/community-editor', 'Database Editor': '/editor', 'Edit Terms': '/terms', Structures: '/infra' };
  const href = destinations[String(children)] || `/${String(children).toLowerCase()}`;
  return <a href={href} className={`nav-item ${active ? 'active' : ''}`} onClick={event => { if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); onClick(); }} aria-current={active ? 'page' : undefined} style={accent ? { '--nav-accent': accent } as React.CSSProperties : undefined} data-testid={`nav-${String(children).toLowerCase().replaceAll(' ', '-')}`}>
    <span className="nav-icon">{icon}</span><span className="nav-text">{children}</span>
    {count !== undefined && <span className="nav-count">[ {String(count).padStart(2, '0')} ]</span>}
    <span className="nav-chevron" aria-hidden="true"><ChevronRight size={13} /></span>
  </a>;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
function NewEntries({ data, openEntry }: { data: DatabaseState; openEntry: (category: Category, name: string) => void }) {
  const fresh = allEntries(data).filter(({ item, category }) => category !== 'appendix' && item.createdAt && Date.now() - new Date(item.createdAt).getTime() < WEEK_MS)
    .sort((a, b) => (b.item.createdAt || '').localeCompare(a.item.createdAt || ''));
  if (!fresh.length) return null;
  const n = fresh.length;
  const radius = n === 1 ? 0 : Math.max(150, Math.round(90 / Math.tan(Math.PI / n)));
  return <section className="new-entries">
    <div className="section-head"><div><div className="eyebrow">Filed this week</div><h2>New Entries</h2></div><p>{String(n).padStart(2, '0')} new</p></div>
    <div className="orbit-stage"><div className={`orbit-ring ${n > 1 ? 'spin' : ''}`} style={{ animationDuration: `${Math.max(12, n * 5)}s` } as React.CSSProperties}>
      {fresh.map(({ item, category }, i) => <button key={`${category}-${item.name}`} type="button" className="new-card" onClick={() => openEntry(category, item.name)}
        style={{ '--card-color': categoryMeta[category].color, transform: `rotateY(${(360 / n) * i}deg) translateZ(${radius}px)` } as React.CSSProperties}>
        <div className="new-card-ring">{item.image ? <img src={item.image} alt={item.name} /> : <span>{item.name.charAt(0)}</span>}</div>
        <div className="new-card-name">{item.name}</div>
      </button>)}
    </div></div>
  </section>;
}

function HomePage({ data, navigate, openEntry }: { data: DatabaseState; navigate: (path: string) => void; openEntry: (category: Category, name: string) => void }) {
  const total = allEntries(data).length;
  const scored = allEntries(data).filter(({ item }) => item.tier && item.tier !== 'Undefined').length;
  return (
    <>
      <NewEntries data={data} openEntry={openEntry} />
      <section className="hero-panel">
        <div className="hero-copy">
          <div className="hero-kicker">Field intelligence / open access</div>
          <h1 className="hero-title">The archive<br /><span>does not blink.</span></h1>
          <p>GSN Arena is a maintained dossier of feats, materials, structures, and combat potential across the Nikke frontier. Every number is a claim. Every claim can be examined.</p>
          <button className="btn primary" type="button" data-testid="button-browse-archive" onClick={() => navigate('/characters')} style={{ marginTop: 22 }}>Browse the archive <ArrowRight size={15} /></button>
        </div>
        <div className="hero-visual"><img className="hero-logo" src="/gsn-logo.png" alt="GSN Arena insignia" /><span className="hero-stamp">CLASSIFIED / COMMUNITY RECORD</span></div>
      </section>
      <CuboidTicker navigate={navigate} />
      <div className="stats-grid">
        <Stat value={total} label="Filed entries" />
        <Stat value={scored} label="Tier-assessed" />
        <Stat value={categories.length} label="Archive sectors" />
        <Stat value="v19.04" label="Current index" />
      </div>
      <div className="section-head"><div><div className="eyebrow">Select a sector</div><h2>Archive sectors</h2></div><p>{String(categories.length).padStart(2, '0')} active channels</p></div>
      <div className="archive-grid">
        {categories.map((category, index) => {
          const meta = categoryMeta[category];
          return <button className="archive-card" key={category} type="button" data-index={`0${index + 1}`} style={{ '--card-color': meta.color } as React.CSSProperties} onClick={() => navigate(`/${category}`)} data-testid={`card-sector-${category}`}>
            <div className="archive-card-top"><span className="archive-icon">{iconFor(category)}</span><span className="archive-count">{String(data[category].length).padStart(2, '0')}</span></div>
            <div><div className="archive-name">{meta.label}</div><div className="archive-meta">{category === 'appendix' ? 'Terms & references' : isTheory(category) ? 'Lore investigations' : 'Dossier records'} <ChevronRight size={12} style={{ verticalAlign: 'middle' }} /></div></div>
          </button>;
        })}
      </div>
    </>
  );
}

const tickerItems: { icon: typeof Radar; text: string; to: string }[] = [
  { icon: Radar, text: 'Explore the world beyond the battlefield', to: '/infra' },
  { icon: BookOpen, text: 'Read dossiers on your favorite Nikkes', to: '/characters' },
  { icon: Swords, text: 'Explore what your Units can really do', to: '/compare' },
  { icon: Lightbulb, text: 'Dig deep into theories surrounding the world of Goddess of Victory', to: '/theories' },
  { icon: Palette, text: 'Browse art from across the Nikke universe', to: '/community' },
];
function CuboidTicker({ navigate }: { navigate: (path: string) => void }) {
  const [index, setIndex] = useState(0);
  const [nextIndex, setNextIndex] = useState<number | null>(null);
  const [landed, setLanded] = useState(false);
  const [paused, setPaused] = useState(false);
  const n = tickerItems.length;
  useEffect(() => {
    if (paused || nextIndex !== null) return;
    const t = window.setTimeout(() => { setLanded(false); setNextIndex((index + 1) % n); }, 3400);
    return () => window.clearTimeout(t);
  }, [index, nextIndex, paused, n]);
  useEffect(() => {
    if (nextIndex === null) return;
    const t = window.setTimeout(() => { setIndex(nextIndex); setNextIndex(null); setLanded(true); }, 900);
    return () => window.clearTimeout(t);
  }, [nextIndex]);
  const current = tickerItems[index]!;
  const upcoming = nextIndex === null ? null : tickerItems[nextIndex];
  return <div className="cuboid" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
    <div className="cuboid-label">ARK // DIRECTIVES</div>
    <button type="button" className="cuboid-stage" onClick={() => navigate(current.to)} aria-label={current.text} data-testid="cuboid-ticker">
      <div className={`cuboid-roller${upcoming ? ' is-rolling' : ''}`}>
        <div className={`cuboid-face cuboid-front${landed ? ' is-landed' : ''}`}>
          <span className="cuboid-icon"><current.icon size={34} strokeWidth={1.5} /></span>
          <span className="cuboid-text">{current.text}</span>
          <ChevronRight size={20} className="cuboid-go" />
        </div>
        {upcoming && <div className="cuboid-face cuboid-next" aria-hidden="true">
          <span className="cuboid-icon"><upcoming.icon size={34} strokeWidth={1.5} /></span>
          <span className="cuboid-text">{upcoming.text}</span>
          <ChevronRight size={20} className="cuboid-go" />
        </div>}
      </div>
    </button>
    <div className="cuboid-dots">{tickerItems.map((item, i) => <button type="button" key={item.to} aria-label={item.text} className={i === (nextIndex ?? index) ? 'on' : ''} disabled={nextIndex !== null} onClick={() => { if (i !== index) { setLanded(false); setNextIndex(i); } }} />)}</div>
  </div>;
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return <div className="stat-box"><span className="stat-num">{value}</span><span className="stat-label">{label}</span></div>;
}

function CategoryPage({ category, data, openEntry }: { category: Category; data: DatabaseState; openEntry: (category: Category, name: string) => void }) {
  const [filter, setFilter] = useState('');
  const entries = useMemo(() => data[category].filter((entry) => `${entry.name} ${entry.cls} ${plainEntryText(entry.summary)}`.toLowerCase().includes(filter.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name)), [category, data, filter]);
  const meta = categoryMeta[category];
  return (
    <>
      <div className="eyebrow" style={{ color: meta.color }}>Archive sector / {meta.label}</div>
      <h1 className="display-title">{meta.label}</h1>
      <p className="lede">{isTheory(category) ? 'Theories and speculation surrounding the world of Goddess of Victory. Open a file to read the full investigation.' : category === 'appendix' ? 'Reference terms used throughout the archive. Select a term to inspect its working definition.' : `Field dossiers and calculated feats filed under the ${meta.label.toLowerCase()} channel.`}</p>
      <div className="toolbar"><div className="input-wrap"><Search size={15} /><input className="text-input" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder={`Filter ${meta.label.toLowerCase()}...`} aria-label={`Filter ${meta.label}`} data-testid={`input-filter-${category}`} /></div><span style={{ color: 'var(--muted)', font: '11px var(--font-mono)' }}>{entries.length} / {data[category].length} records</span></div>
      {entries.length ? <div className="entry-grid">{entries.map((entry) => <EntryCard key={entry.name} category={category} entry={entry} color={meta.color} openEntry={openEntry} />)}</div> : <EmptyState text="No records match this filter." />}
    </>
  );
}

function EntryCard({ category, entry, color, openEntry }: { category: Category; entry: Entry; color: string; openEntry: (category: Category, name: string) => void }) {
  return <a className="entry-card" href={`/entry/${category}/${encodeURIComponent(entry.name)}`} style={{ '--entry-color': color } as React.CSSProperties} onClick={event => { if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); openEntry(category, entry.name); }} data-testid={`card-entry-${entry.name.replaceAll(' ', '-').toLowerCase()}`}>
    <div><div className="entry-card-header"><span className="entry-tag">{entry.tag}</span><span className="entry-code">{entry.tier || 'UNRATED'}</span></div><div className="entry-name-row">{entry.image ? <div className="entry-avatar category-glow" style={{ '--profile-glow': `var(--category-${category})` } as React.CSSProperties}><img src={entry.image} alt="" /></div> : null}<div className="entry-name">{entry.name}</div></div><div className="entry-class">{entry.cls}</div><p className="entry-summary">{plainEntryText(entry.summary)}</p></div>
    <div className="entry-foot"><span>{category === 'appendix' ? 'REFERENCE TERM' : isTheory(category) ? 'THEORY FILE' : hasFeatData(entry) ? 'FEAT DATA AVAILABLE' : 'PARTIAL RECORD'}</span><span className="entry-arrow"><ArrowRight size={15} /></span></div>
  </a>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="empty-state"><FileText size={26} /><div>{text}</div></div>;
}

function TierListPage({ data, openEntry }: { data: DatabaseState; openEntry: (category: Category, name: string) => void }) {
  const entries = allEntries(data).filter(({ category }) => !isTheory(category));
  return <>
    <div className="eyebrow" style={{ color: 'var(--gold)' }}>Power index / comparative scale</div>
    <h1 className="display-title">Tier <em>List</em></h1>
    <p className="tier-note">Ranked by raw specs and documented feats, not game mechanics. Undefined means more data is needed — not that a unit is weak.</p>
    <div className="tier-list">{tiers.map((tier) => {
      const members = entries.filter(({ item }) => (item.tier || 'Undefined') === tier);
      const n = members.length; const cols = n <= 4 ? Math.max(n, 1) : n < 8 ? 4 : Math.max(6, Math.ceil(n / 2));
      return <div className="tier-row" key={tier}><div className="tier-label" title={tier} style={{ color: tierColors[tier], borderTop: `3px solid ${tierColors[tier]}` }}>{tier === 'Undefined' ? 'U' : tier}</div><div className="tier-members" style={{ '--tier-cols': cols } as React.CSSProperties}>{members.length ? members.map(({ item, category }) => <button className="tier-member" type="button" key={`${category}-${item.name}`} onClick={() => openEntry(category, item.name)} data-testid={`tier-member-${item.name.replaceAll(' ', '-').toLowerCase()}`}><div className="tier-avatar category-glow" style={{ '--profile-glow': `var(--category-${category})` } as React.CSSProperties}>{item.image ? <img src={item.image} alt="" /> : item.name.charAt(0)}</div><span className="tier-member-name">{item.name}</span></button>) : <span style={{ color: 'var(--faint)', font: '11px var(--font-mono)' }}>No confirmed placements</span>}</div></div>;
    })}</div>
  </>;
}

type CombatantRef = { category: Category; name: string };

function CombatantAvatar({ entry, category, size }: { entry: Entry; category: Category; size: 'small' | 'big' }) {
  return <div className={`gsn-av ${size} category-glow`} style={{ '--profile-glow': `var(--category-${category})` } as React.CSSProperties}>{entry.image ? <img src={entry.image} alt={entry.name} /> : entry.name.charAt(0)}</div>;
}

function ComparePage({ data }: { data: DatabaseState; openEntry: (category: Category, name: string) => void }) {
  const [, navigate] = useLocation();
  const combatantCategories: Category[] = ['characters', 'heretics', 'raptures'];
  const combatants = combatantCategories.flatMap((category) => data[category].map((item) => ({ item, category })));
  const [selection, setSelection] = useState<{ a: CombatantRef | null; b: CombatantRef | null }>({ a: null, b: null });
  const [picker, setPicker] = useState<'a' | 'b' | null>(null);
  const [pending, setPending] = useState<CombatantRef | null>(null);
  const [roll, setRoll] = useState<number | null>(null);
  const find = (ref: CombatantRef | null) => ref ? combatants.find(({ item, category }) => category === ref.category && item.name === ref.name) : undefined;
  const left = find(selection.a);
  const right = find(selection.b);
  const choose = () => {
    if (!picker || !pending) return;
    setSelection((current) => ({ ...current, [picker]: pending }));
    setPicker(null);
    setPending(null);
    setRoll(Math.random());
  };
  const winner = left && right && roll !== null ? (roll < .5 ? left : right) : undefined;
  useEffect(() => {
    if (picker) return;
    const line = victoryLine(winner?.item);
    if (winner && line) playVoice({ name: winner.item.name, image: winner.item.image, category: winner.category, line, victory: true });
  }, [roll, winner?.item.name]);

  if (picker) return <div className="gsn-upgrade-compare">
    <button className="back-link" type="button" onClick={() => { setPicker(null); setPending(null); }}>← Return to comparison</button>
    <div className="eyebrow compare-accent">Combatant selection / {picker === 'a' ? 'Alpha' : 'Beta'}</div>
    <h1 className="display-title">Select <em>Combatant {picker.toUpperCase()}</em></h1>
    <p className="lede">Five profiles per row. Select a profile, then confirm it.</p>
    {combatantCategories.map((category) => <section key={category}>
      <div className="picker-section-title">{categoryMeta[category].label}</div>
      <div className="gsn-upgrade-picker">{combatants.filter((record) => record.category === category).map((record) => {
        const ref = { category: record.category, name: record.item.name };
        const taken = selection.a?.name === ref.name || selection.b?.name === ref.name;
        const selected = pending?.category === ref.category && pending.name === ref.name;
        return <button key={`${ref.category}-${ref.name}`} type="button" className={`gsn-upgrade-picker-card${taken ? ' disabled' : ''}${selected ? ' selected' : ''}`} onClick={() => setPending(ref)} disabled={taken}>
          <CombatantAvatar entry={record.item} category={record.category} size="small" /><span>{record.item.name}</span>
        </button>;
      })}</div>
    </section>)}
    <div className="gsn-upgrade-confirm"><span>{pending ? <>Selected: <strong>{pending.name}</strong></> : 'Select a profile'}</span><button className="btn primary" type="button" disabled={!pending} onClick={choose}>Confirm combatant</button></div>
  </div>;

  const fighter = (side: 'a' | 'b', record: typeof left, label: string) => <div className="gsn-upgrade-fighter">
    <div className="eyebrow">{label}</div>
    {record ? <><CombatantAvatar entry={record.item} category={record.category} size="big" /><strong>{record.item.name}</strong><small>{categoryMeta[record.category].label.toUpperCase()}</small></> : <div className="empty-state">AWAITING SUBJECT</div>}
    <button className="btn primary" type="button" onClick={() => { setPicker(side); setPending(selection[side]); }}>{record ? 'Change fighter' : 'Choose fighter'}</button>
  </div>;
  const loser = winner === left ? right : left;

  return <div className="gsn-upgrade-compare">
    <div className="eyebrow compare-accent">Simulation chamber / 1v1 / for fun</div>
    <h1 className="display-title">Compare <em>combatants</em></h1>
    <p className="lede">Pick two filed subjects and let the archive decide.</p>
    <div className="notice-box"><p><strong>Heads up: </strong>for now Compare picks a random winner. It is just for fun, not a power scale. Real rankings live on the Tier List.</p><div className="row-actions"><button className="btn ghost" type="button" onClick={() => navigate('/community')}>Share an idea</button><button className="btn ghost" type="button" onClick={() => navigate('/tier-list')}>Open Tier List</button></div></div>
    <div className="gsn-upgrade-arena">{fighter('a', left, 'COMBATANT A')}{fighter('b', right, 'COMBATANT B')}<div className="gsn-upgrade-vs"><span>VS</span></div></div>
    {winner && loser && <div className="gsn-upgrade-result"><div className="gsn-upgrade-winner"><div className="crown" aria-hidden="true">♛</div><div className="word">Winner!</div><CombatantAvatar entry={winner.item} category={winner.category} size="big" /><div className="name">{winner.item.name}</div><small>chosen at random</small></div><div className="gsn-upgrade-narrative">The archive rolled the dice and {winner.item.name} beat {loser.item.name}. It is a coin flip for now, so don’t start a war over it.</div><div className="gsn-upgrade-score"><button className="btn ghost" type="button" onClick={() => setRoll(Math.random())}>Roll again</button></div></div>}
  </div>;
}

function DossierPage({ category, name, data, onBack, onEdit }: { category: Category; name: string; data: DatabaseState; onBack: () => void; onEdit?: ((entry: Entry) => void) | undefined }) {
  const entry = data[category].find((item) => item.name === name);
  useEffect(() => {
    const line = rollVoice(entryLines(entry));
    if (entry && line) playVoice({ name: entry.name, image: entry.image, category, line });
  }, [category, name]);
  if (!entry) return <NotFound navigate={onBack} />;
  const meta = categoryMeta[category];
  const feats = visibleFeats(entry);
  return <article className="dossier">
    <button className="back-link" type="button" onClick={onBack} data-testid="button-back-dossier"><ArrowLeft size={14} /> Return to {meta.label}</button>
    <div className="dossier-top"><div><div className="dossier-tag" style={{ color: meta.color }}>{entry.tag} / {meta.label}</div><h1 className="dossier-title">{entry.name}</h1><div className="dossier-class">{entry.cls}</div></div><div className="dossier-actions">{onEdit && <button className="btn" type="button" onClick={() => onEdit(entry)} data-testid="button-edit-dossier"><Pencil size={14} /> Edit file</button>}</div></div>
    {entry.image && <Portrait src={entry.image} name={entry.name} category={category} />}
    <div className="dossier-summary"><EntryBody text={entry.summary} data={data} /></div>
    {entry.images?.length ? <div className="dossier-images">{(entry.images || []).map((image, index) => <figure key={`${image.url}-${index}`}><ImageViewerLink src={image.url} title={image.alt || `${entry.name} — image ${index + 1}`} back={`/entry/${category}/${encodeURIComponent(entry.name)}`}><img src={image.url} alt={image.alt || entry.name} loading="lazy" /></ImageViewerLink><figcaption>{image.tags?.length ? image.tags.map((tag) => `#${tag}`).join(' ') : 'ARCHIVE IMAGE'}</figcaption></figure>)}</div> : null}
    {!isTheory(category) && feats.length > 0 && <div className="specs">{feats.map(({ key, label, value, source }) => <div className="spec" key={key}><div className="spec-label">{label}</div><div className="spec-value">{value}</div><FeatEvidence source={source} /></div>)}</div>}
    {entry.extra?.length ? <><div className="block-title">Additional measurements</div><div className="extra-grid">{entry.extra.map((item) => <div className="spec" key={item.label}><div className="spec-label">{item.label}</div><div className="spec-value">{item.value}</div></div>)}</div></> : null}
    {entry.hypothetical && !isTheory(category) ? <HypotheticalSummary key={`${category}/${entry.id || entry.name}`}><EntryBody text={entry.hypothetical} data={data} /></HypotheticalSummary> : null}
    {entry.notes?.length ? <><div className="block-title">Notes</div><div className="archive-notes">{entry.notes.map((note, index) => <div className="archive-note" key={index}><span className="note-marker">{note.marker}</span><div><strong>{note.author || 'Community note'}</strong><p><ReferenceText text={note.text} data={data} /></p></div></div>)}</div></> : null}
    {entry.id && <a className="comment-section-link" href={`/comments/${entry.id}`}>》Comment section <MessageCount entryId={entry.id}/> <ArrowRight size={18}/></a>}
    <div className="block-title">Record note</div><p style={{ color: 'var(--muted)', font: '12px/1.7 var(--font-mono)' }}>This dossier is a community-maintained interpretation. Approved records can be revised from the database editor.</p>
  </article>;
}

function EditorPage({ data, onEdit, onDelete, onAdd, tags, onAddTag, onRemoveTag }: { tags: string[]; onAddTag: (t: string) => void; onRemoveTag: (t: string) => void; data: DatabaseState; onEdit: (category: Category, entry: Entry) => void; onDelete: (category: Category, name: string) => void; onAdd: (category: Category) => void }) {
  const [category, setCategory] = useState<Category>('characters');
  const [newTag, setNewTag] = useState('');
  return <>
    <div className="eyebrow" style={{ color: 'var(--blue)' }}>Maintenance console / shared archive</div>
    <h1 className="display-title">Archive <em>database</em></h1>
    <p className="lede">Create, revise, and remove archive records from one control panel. With Supabase connected, approved changes are shared with the public site.</p>
    <div className="toolbar"><select className="select-input" value={category} onChange={(event) => setCategory(event.target.value as Category)} aria-label="Editor category" data-testid="select-editor-category">{categories.map((item) => <option key={item} value={item}>{categoryMeta[item].label}</option>)}</select><button className="btn primary" type="button" onClick={() => onAdd(category)} data-testid="button-add-entry"><Plus size={15} /> New entry</button></div>
    <div className="editor-list">{data[category].map((entry) => <div className="editor-row" key={entry.name}><div className="editor-row-main"><div className="editor-row-name">{entry.name}</div><div className="editor-row-meta">{entry.cls} / {entry.tier || 'Undefined'} / {entry.tag}</div></div><div className="row-actions"><button className="btn ghost" type="button" onClick={() => onEdit(category, entry)} data-testid={`button-edit-${entry.name.replaceAll(' ', '-').toLowerCase()}`}><Pencil size={13} /> Edit</button><button className="btn danger" type="button" onClick={() => onDelete(category, entry.name)} data-testid={`button-delete-${entry.name.replaceAll(' ', '-').toLowerCase()}`}><Trash2 size={13} /> Remove</button></div></div>)}</div>
    {!data[category].length && <EmptyState text="This sector is empty. Start a new record." />}
    <div className="section-head" style={{ marginTop: 36 }}><div><div className="eyebrow">Image library</div><h2>Predefined tags</h2></div><p>Used on archive and community images</p></div>
    <div className="tag-picker">{tags.length ? tags.map((t) => <span className="tag-chip on" key={t}>#{t} <button type="button" className="tag-x" aria-label={`Remove ${t}`} onClick={() => onRemoveTag(t)}><X size={11} /></button></span>) : <span className="tag-empty">No tags yet.</span>}
      <span className="tag-new"><input className="text-input" value={newTag} onChange={(e) => setNewTag(e.target.value)} placeholder="New tag" /><button type="button" className="btn primary mini" onClick={() => { onAddTag(newTag); setNewTag(''); }}><Plus size={12} /> Add tag</button></span></div>
  </>;
}

function ImagePickButton({ onUrl }: { onUrl: (url: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  return <label className="btn ghost pick-btn">{busy ? 'Uploading…' : <><Upload size={13}/> Choose image</>}
    <input type="file" accept="image/*" hidden disabled={busy} onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; setBusy(true); setErr(''); try { onUrl(await uploadArchiveImage(f)); } catch (x) { setErr(x instanceof Error ? x.message : 'Upload failed'); } finally { setBusy(false); } }} />
    {err && <span className="form-error">{err}</span>}</label>;
}

function VoiceSlot({ label, value, onChange }: { label: string; value: VoiceLine | undefined; onChange: (v: VoiceLine | undefined) => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [playing, setPlaying] = useState<HTMLAudioElement | null>(null);
  const preview = () => { if (playing) { playing.pause(); setPlaying(null); return; } if (!value?.url) return; const a = new Audio(value.url); a.onended = () => setPlaying(null); void a.play(); setPlaying(a); };
  return <div className="voice-slot"><div className="voice-slot-label">{label}</div>
    <div className="voice-slot-row">
      <label className="btn ghost mini pick-btn">{busy ? 'Uploading…' : <><Upload size={12} /> {value?.url ? 'Replace audio' : 'Choose audio'}</>}<input type="file" accept="audio/*" hidden disabled={busy} onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; if (f.size > 10 * 1024 * 1024) { setErr('Keep audio under 10 MB.'); return; } setBusy(true); setErr(''); try { onChange({ url: await uploadArchiveFile(f), text: value?.text || '' }); } catch (x) { setErr(x instanceof Error ? x.message : 'Upload failed'); } finally { setBusy(false); } }} /></label>
      {value?.url && <button type="button" className="btn ghost mini" onClick={preview}>{playing ? 'Stop' : 'Play'}</button>}
      <button type="button" className="btn ghost mini" onClick={() => onChange(undefined)}><X size={12} /> Remove</button>
    </div>
    <input className="text-input" value={value?.text || ''} disabled={!value?.url} placeholder={value?.url ? 'Line text shown in the notification' : 'Upload audio first'} onChange={(e) => value && onChange({ ...value, text: e.target.value })} />
    {err && <span className="form-error">{err}</span>}
  </div>;
}

function TagPicker({ selected, tags, onChange, onAddTag }: { selected: string[]; tags: string[]; onChange: (tags: string[]) => void; onAddTag: (tag: string) => void }) {
  const [draft, setDraft] = useState('');
  const toggle = (t: string) => onChange(selected.includes(t) ? selected.filter((x) => x !== t) : [...selected, t]);
  return <div className="tag-picker">
    {tags.length ? tags.map((t) => <button type="button" key={t} className={`tag-chip ${selected.includes(t) ? 'on' : ''}`} onClick={() => toggle(t)}>#{t}</button>) : <span className="tag-empty">No tags yet — create one.</span>}
    <span className="tag-new"><input className="text-input" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="New tag" /><button type="button" className="btn ghost mini" onClick={() => { if (draft.trim()) { onAddTag(draft); onChange([...selected, draft.trim()]); setDraft(''); } }}><Plus size={12}/> Tag</button></span>
  </div>;
}

function EditorModal({ initial, category, onClose, onSave, userId }: { userId: string; initial?: Entry | undefined; category: Category; onClose: () => void; onSave: (category: Category, entry: Entry, originalName?: string) => Promise<void> }) {
  const [form, setForm] = useState<Entry>(initial ? clone(initial) : { name: '', cls: '', tag: 'LOCAL FILE', summary: '', speed: 'N/A', strength: 'N/A', durability: 'N/A', hypothetical: '', tier: 'Undefined', notes: [], images: [] });
  const context = useArchiveReferences();
  const base = useMemo<Entry>(() => initial ? clone(initial) : { name: '', cls: '', tag: 'LOCAL FILE', summary: '', speed: 'N/A', strength: 'N/A', durability: 'N/A', hypothetical: '', tier: 'Undefined', notes: [], images: [] }, [initial]);
  const isEditing = Boolean(initial);
  const [documentField, setDocumentField] = useState<'summary' | 'hypothetical' | null>(null);
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const [evidenceBusy, setEvidenceBusy] = useState(false);
  const dirty = JSON.stringify(form) !== JSON.stringify(base);
  const draft = useEntryDraft(draftKey(userId, category, initial?.id || initial?.name || 'new'), base, form, dirty);
  const issues = referenceWarnings([form.summary, form.hypothetical || '', ...(form.notes || []).map(note => note.text)], context?.entries || [], context?.aliases || [], { name: form.name, category, ...(initial?.id ? { id: initial.id } : {}) });
  useBlocker({ shouldBlockFn: () => saving || evidenceBusy || (dirty && !window.confirm('Leave without publishing your dossier changes?')), enableBeforeUnload: dirty || evidenceBusy || saving });
  const close = () => { if (!saving && !evidenceBusy && (!(dirty || draft.candidate) || window.confirm('Discard your unsaved dossier changes and local recovery draft?'))) { draft.clear(); onClose(); } };
  const setField = (key: keyof Entry, value: any) => setForm((previous) => ({ ...previous, [key]: value }));
  const [lines, setLinesState] = useState<(VoiceLine | undefined)[]>(() => entryLines(initial));
  const percents = voicePercents(lines.length);
  const setLines = (next: (VoiceLine | undefined)[]) => { setLinesState(next); setForm((p) => ({ ...p, voices: next.filter((x): x is VoiceLine => !!x?.url), victoryVoice: victoryLine(p), voiceVersion: 2 })); };
  const addNote = () => setField('notes', [...(form.notes || []), { marker: '○', author: 'Community', text: '' }]);
  const updateNote = (index: number, patch: Partial<ArchiveNote>) => setField('notes', (form.notes || []).map((n, i) => i === index ? { ...n, ...patch } : n));
  const submit = async (event: React.FormEvent) => { event.preventDefault(); if (saving || evidenceBusy) return; if (draft.candidate) { setSaveError('Choose Recover draft or Discard stored draft before publishing.'); return; } if (!form.name.trim() || !form.cls.trim() || !plainEntryText(form.summary)) { setSaveError('Name, classification and actual summary are required.'); return; } if (issues.length && !window.confirm(`Reference check: ${issues.map(issue => `${issue.name}: ${issue.message}`).join('\n')}\n\nPublish anyway?`)) return; setSaving(true); setSaveError(''); try { await onSave(category, { ...form, name: form.name.trim(), cls: form.cls.trim(), summary: form.summary.trim() }, initial?.name); draft.clear(); } catch (error) { setSaveError(error instanceof Error ? error.message : 'Save failed. Your draft has been kept.'); } finally { setSaving(false); } };
  if (documentField) return <RichEntryEditor key={documentField} draftStatus={draft.status} onDraftChange={html => { if (!draft.candidate) draft.save({ ...form, [documentField]: html }); }} title={`${form.name || 'New dossier'} / ${documentField === 'summary' ? 'Actual summary' : 'Hypothetical summary'}`} value={form[documentField] || ''} onBack={() => { draft.save(form); setDocumentField(null); }} onSave={(html) => { setField(documentField, html); draft.save({ ...form, [documentField]: html }); setDocumentField(null); }} />;
  return <form className="dossier-edit-screen" onSubmit={submit}><button className="back-link" type="button" onClick={close} disabled={saving || evidenceBusy}><ArrowLeft size={14} /> Return to {isEditing ? form.name || 'entry' : 'archive'}</button><div className="edit-screen-head"><div><span className="eyebrow">Archive / dossier editor / {categoryMeta[category].label}</span><h1 className="display-title">{isEditing ? <>Edit <em>{form.name}</em></> : <>New <em>dossier</em></>}</h1></div><button className="btn primary" type="submit" disabled={saving || evidenceBusy}><Database size={14}/> {saving ? 'Publishing…' : 'Save file'}</button></div><div className="edit-screen-body">
    {draft.candidate && <div className="notice-box" role="status"><strong>Unpublished draft found · {new Date(draft.candidate.updatedAt).toLocaleString()}</strong><p>{draft.conflict ? 'The published entry has changed since this draft. Review recovered fields before saving.' : 'Recover your previous editing session, or discard it.'}</p><div className="row-actions"><button type="button" className="btn" onClick={() => { const recovered = draft.candidate!.data; setForm(recovered); setLinesState(entryLines(recovered)); draft.accept(); }}>Recover draft</button><button type="button" className="btn ghost" onClick={draft.clear}>Discard stored draft</button></div></div>}
    {draft.status && <p className="draft-status" role="status">{draft.status}</p>}
    <details className="editor-section" open><summary>Identity and classification</summary><div className="form-grid">
    <div className="field"><label>Name</label><input className="text-input" value={form.name} onChange={e => setField('name', e.target.value)} required /></div>
    <div className="field"><label>Classification</label><input className="text-input" value={form.cls} onChange={e => setField('cls', e.target.value)} required /></div>
    <div className="field"><label>File marker</label><input className="text-input" value={form.tag} onChange={e => setField('tag', e.target.value)} /></div>
    {!isTheory(category) && <div className="field"><label>Tier placement</label><select className="select-input" value={form.tier || 'Undefined'} onChange={e => setField('tier', e.target.value)}>{tiers.map(t => <option key={t}>{t}</option>)}</select></div>}
    </div></details><details className="editor-section" open><summary>Summaries and optional feats</summary><div className="form-grid">
    <div className="field full summary-field"><label>Actual summary / feats</label><button className="document-launch" type="button" disabled={Boolean(draft.candidate)} onClick={() => setDocumentField('summary')}><span className="document-launch-icon"><FileText size={20} /></span><span><strong>Open actual summary editor</strong><small>{plainEntryText(form.summary).slice(0, 110) || 'No summary written yet'}</small></span><Pencil size={16}/></button></div>
    {!isTheory(category) && <><FeatFields value={form} onBusyChange={setEvidenceBusy} onChange={patch => setForm(previous => ({ ...previous, ...(typeof patch === 'function' ? patch(previous) : patch) }))} />
    <div className="field full summary-field"><label>Hypothetical summary</label><button className="document-launch" type="button" disabled={Boolean(draft.candidate)} onClick={() => setDocumentField('hypothetical')}><span className="document-launch-icon"><FileText size={20} /></span><span><strong>Open hypothetical editor</strong><small>{plainEntryText(form.hypothetical || '').slice(0, 110) || 'No hypothesis written yet'}</small></span><Pencil size={16}/></button></div></>}
    </div></details><details className="editor-section" open><summary>Images</summary><div className="form-grid">
    <div className="field full"><label>Primary profile image</label><div className="image-pick-row">{form.image ? <img className="image-thumb profile-preview" src={form.image} alt="" /> : null}<ImagePickButton onUrl={(url) => setField('image', url)} />{form.image ? <button type="button" className="btn ghost mini" onClick={() => setField('image', '')}><X size={12}/> Remove</button> : null}</div></div>
    </div></details><details className="editor-section"><summary>Voice lines</summary><div className="form-grid">
    <div className="field full"><div className="edit-section-label">Voice lines</div><div className="note-guide">Add as many lines as you like. One plays when someone opens this entry — line 1 is the most common and the chances adjust automatically. The victory line plays when this character wins in Compare.</div>
      {lines.map((line, i) => <VoiceSlot key={i} label={`Line ${i + 1} · ${percents[i]}% chance`} value={line} onChange={(v) => setLines(v ? lines.map((x, j) => j === i ? v : x) : lines.filter((_, j) => j !== i))} />)}
      <button type="button" className="btn ghost" onClick={() => setLines([...lines, undefined])}><Plus size={13}/> Add voice line</button>
      {!isTheory(category) && <VoiceSlot label="Victory line · plays on Compare win" value={victoryLine(form)} onChange={(v) => setForm((p) => ({ ...p, voices: lines.filter((x): x is VoiceLine => !!x?.url), victoryVoice: v, voiceVersion: 2 }))} />}</div>
    </div></details><details className="editor-section"><summary>Notes</summary><div className="form-grid">
    <div className="field full"><div className="editor-section-head"><label>Notes</label><button type="button" className="btn ghost" onClick={addNote}><Plus size={13}/> Add note</button></div><div className="note-guide">Seth marker: ♤ · Community markers: ○ ● □ ♡ ◇ ♧ ☆ ¤</div>{(form.notes || []).map((note, index) => <div className="editor-subrow note-row" key={index}><select className="select-input note-marker-select" value={note.marker} onChange={e => updateNote(index,{marker:e.target.value as NoteMarker})}>{noteMarkers.map(m=><option key={m}>{m}</option>)}</select><input className="text-input" value={note.author} onChange={e => updateNote(index,{author:e.target.value})} placeholder="Author" /><textarea className="text-area" value={note.text} onChange={e => updateNote(index,{text:e.target.value})} placeholder="Note text. Use *Term* for references." /></div>)}</div>
  </div></details>
    <details className="editor-section"><summary>Revision history</summary><RevisionHistory entryId={initial?.id} onRestore={data => {
      if (draft.candidate) { setSaveError('Recover or discard the stored draft before restoring a revision.'); return; }
      if (!['name', 'cls', 'summary', 'speed', 'strength', 'durability'].every(key => typeof data[key] === 'string')) { setSaveError('This revision is missing required entry fields.'); return; }
      const restored = { ...base, ...data, ...(initial?.id ? { id: initial.id } : {}) } as Entry; setForm(restored); setLinesState(entryLines(restored)); draft.save(restored);
    }} /></details>
    <section className="reference-audit" aria-label="Reference check"><h3>Reference check</h3>{issues.length ? <ul>{issues.map(issue => <li key={issue.name}><strong>{issue.name}</strong>: {issue.message}</li>)}</ul> : <p>No unresolved or self-referencing marked names found.</p>}</section>
    {saveError && <div className="form-error" role="alert">{saveError}</div>}</div><div className="edit-screen-foot"><span>{saving ? 'Publishing…' : dirty ? 'Unsaved changes · not published' : 'No unpublished field changes'}</span><div><button className="btn ghost" type="button" onClick={close} disabled={saving || evidenceBusy}>Cancel</button><button className="btn primary" type="submit" disabled={saving || evidenceBusy}><Database size={14}/> {saving ? 'Publishing…' : 'Save to archive'}</button></div></div></form>;
}

function EntryBody({ text, data }: { text: string; data: DatabaseState }) {
  if (isEntryHtml(text)) return <RichDocument value={text} />;
  return <div className="rich-document entry-document">{text.split(/\n\n+/).map((paragraph, index) => <p key={index} style={{ whiteSpace: 'pre-line' }}><ReferenceText text={paragraph} data={data} /></p>)}</div>;
}

function ReferenceText({ text }: { text: string; data: DatabaseState }) {
  return <ReferenceInline text={text} />;
}

function EmailAuthModal({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true); setError(''); setMessage('');
    try {
      if (mode === 'signin') {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
        onClose();
      } else {
        const { error: err } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
        if (err) throw err;
        setMessage('Account created. Check your email to confirm, then sign in.');
        setMode('signin');
      }
    } catch (err: any) {
      setError(err?.message || 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  };
  return <div className="modal-backdrop"><form className="modal" onSubmit={submit}>
    <div className="modal-head"><h2>{mode === 'signin' ? 'Sign in' : 'Create account'}</h2><button className="btn ghost" type="button" aria-label="Close sign in" onClick={onClose}><X size={17} /></button></div>
    <div className="modal-body"><div className="form-grid">
      <div className="field full"><label>Email</label><input className="text-input" type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" /></div>
      <div className="field full"><label>Password</label><input className="text-input" type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} /></div>
      {error && <div className="field full" style={{ color: 'var(--red)', font: '12px var(--font-mono)' }}>{error}</div>}
      {message && <div className="field full" style={{ color: 'var(--blue)', font: '12px var(--font-mono)' }}>{message}</div>}
      <div className="field full" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="btn primary" type="submit" disabled={busy}>{busy ? 'Working…' : mode === 'signin' ? 'Sign in' : 'Create account'}</button>
        <button className="btn ghost" type="button" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); setMessage(''); }}>
          {mode === 'signin' ? 'Need an account? Sign up' : 'Have an account? Sign in'}
        </button>
      </div>
    </div></div>
  </form></div>;
}

function TermsPage({ terms, editable, onSave }: { terms: LegalTerms; editable: boolean; onSave: (terms: LegalTerms) => Promise<void> }) {
  const [draft, setDraft] = useState(terms.content);
  useEffect(() => setDraft(terms.content), [terms.content]);
  const [saving, setSaving] = useState(false);
  const save = async () => { setSaving(true); try { await onSave({ content: draft, updated_at: new Date().toISOString() }); } finally { setSaving(false); } };
  return <><div className="eyebrow" style={{ color: 'var(--blue)' }}>Legal / publication control</div><h1 className="display-title">Terms of <em>Use</em></h1><p className="lede">This page is intentionally editable so approved legal wording can be revised without redesigning the archive.</p>{editable ? <div className="terms-editor"><textarea className="text-area" value={draft} onChange={e=>setDraft(e.target.value)} /><div className="terms-actions"><span>Last saved: {terms.updated_at ? new Date(terms.updated_at).toLocaleString() : 'not recorded'}</span><button className="btn primary" onClick={save} disabled={saving}><Check size={14}/> {saving ? 'Publishing…' : 'Publish terms'}</button></div></div> : <article className="terms-display"><ReferenceText text={terms.content} data={getStoredData()} /></article>}</>;
}


function CommunityArtPage({ artworks, onSubmitted, tags, userId, onToast, isAdmin, loading, loadError }: { loading: boolean; loadError: string; isAdmin: boolean; artworks: Artwork[]; onSubmitted: () => void; tags: string[]; userId?: string | undefined; onToast: (m: string) => void }) {
  const { filters, update } = useGalleryFilters();
  const tab = filters.rating;
  const setTab = (rating: ArtworkRating) => update({ rating });
  const [, navigate] = useLocation();
  const [showNsfwNotice, setShowNsfwNotice] = useState(() => filters.rating === 'nsfw');
  useEffect(() => { if (filters.rating === 'nsfw') setShowNsfwNotice(true); }, [filters.rating]);
  const visible = filterArtworks(artworks, filters);
  const [showAuth, setShowAuth] = useState(false);
  const signIn = () => { if (supabase) setShowAuth(true); };
  const PER_PAGE = 24;
  const [pageNo, setPageNo] = useState(0);
  useEffect(() => setPageNo(0), [filters]);
  const pages = Math.max(1, Math.ceil(visible.length / PER_PAGE));
  const current = Math.min(pageNo, pages - 1);
  const shown = tab === 'nsfw' && showNsfwNotice ? [] : visible.slice(current * PER_PAGE, current * PER_PAGE + PER_PAGE);
  const goPage = (n: number) => { setPageNo(n); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  return <>
    <div className="eyebrow" style={{ color: '#d93f7a' }}>Community archive / artist submissions</div>
    <h1 className="display-title">Community <em>Art</em></h1>
    <p className="lede">Artwork submitted by the community. GSN Arena separates general and mature material so visitors can choose what they see.</p>
    <div className="community-toolbar">
      <div className="art-tabs">
        <button className={`btn ${tab === 'sfw' ? 'primary' : 'ghost'}`} onClick={() => setTab('sfw')}>General</button>
        <button className={`btn ${tab === 'nsfw' ? 'primary' : 'ghost'}`} onClick={() => { setTab('nsfw'); setShowNsfwNotice(true); }}>Mature / NSFW</button>
      </div>
      <div className="community-actions">
        {supabase && !userId && <button className="btn ghost" onClick={signIn}><LogIn size={14} /> Sign in</button>}
        <button className="btn primary" onClick={() => navigate('/profile')}><Upload size={14} /> Submit artwork</button>
      </div>
    </div>
    {tab === 'nsfw' && <div className="content-warning"><AlertTriangle size={17} /><div><strong>Mature content section</strong><br /><span>This section may contain sexually explicit or otherwise adult artwork submitted by users. By entering this section, you acknowledge the nature of the material and choose to view it.</span></div></div>}
    <GalleryFilterBar filters={filters} update={update} tags={tags} artworks={artworks} resultCount={visible.length} />
    {loading && <p className="note-guide" role="status">Loading artwork…</p>}
    <div className="art-grid">
      {shown.length ? shown.map((art) => <article className="art-card" key={art.id}><ImageViewerLink src={art.image_url} artworkId={art.id} title={art.title} credit={art.artist_name} mature={art.rating === 'nsfw'} className="art-open"><img src={art.image_url} alt={art.title} loading="lazy" /></ImageViewerLink><div className="art-card-body"><div className="art-card-title">{art.title}</div><div className="art-card-meta">by {art.artist_name}</div>{art.description && <p>{art.description}</p>}{art.tags?.length ? <div className="art-card-meta">{art.tags.map((t) => `#${t}`).join(' ')}</div> : null}{userId && (isAdmin || art.user_id === userId) ? <a className="btn ghost mini" href={isAdmin?'/community-editor':'/profile'}>Manage artwork</a> : null}</div></article>) : <div className="empty-state"><p>{loading ? 'Loading the gallery…' : loadError && !artworks.length ? 'The gallery could not be loaded. Use Retry above.' : artworks.some(art => art.rating === tab) ? 'No artwork matches these filters. Try Match any or remove a tag.' : 'No approved artwork in this section yet.'}</p>{(filters.tags.length > 0 || filters.artist) && <button className="btn" onClick={() => update({ ...defaultGalleryFilters, rating: tab })}>Clear filters</button>}</div>}
    </div>
    {pages > 1 && <nav className="pager" aria-label="Artwork pages"><button type="button" className="btn ghost mini" disabled={current === 0} onClick={() => goPage(current - 1)}><ArrowLeft size={12} /> Prev</button>{Array.from({ length: pages }, (_, i) => <button type="button" key={i} className={`btn mini ${i === current ? 'primary' : 'ghost'}`} aria-current={i === current ? 'page' : undefined} onClick={() => goPage(i)}>{i + 1}</button>)}<button type="button" className="btn ghost mini" disabled={current >= pages - 1} onClick={() => goPage(current + 1)}>Next <ArrowRight size={12} /></button></nav>}

    {showAuth && <EmailAuthModal onClose={() => setShowAuth(false)} />}
    {showNsfwNotice && <div className="modal-backdrop"><div className="warning-modal"><AlertTriangle size={28} /><h2>Mature content ahead</h2><p>This section is reserved for adult/NSFW artwork. Nothing here is presented as part of the core lore archive. If you do not want to view mature material, choose General instead.</p><div className="row-actions"><button className="btn ghost" onClick={() => { setTab('sfw'); setShowNsfwNotice(false); }}>Back to General</button><button className="btn primary" onClick={() => setShowNsfwNotice(false)}>I understand</button></div></div></div>}
  </>;
}

function HashTagInput({ tags, value, onChange }: { tags: string[]; value: string[]; onChange: (v: string[]) => void }) {
  return <TagSearch tags={tags} selected={value} onChange={onChange} />;
}

function MessageCount({entryId}: {entryId:string}) { const [count,setCount]=useState<number|null>(null); useEffect(()=>{let stale=false; if(supabase)void supabase.from('entry_comments').select('id',{count:'exact',head:true}).eq('entry_id',entryId).is('deleted_at',null).then(({count,error})=>{if(!stale&&!error)setCount(count);});return()=>{stale=true;};},[entryId]);return count===null?null:<span>· {count}</span>; }
function ProfileSubmission({tags,onSubmitted}: {tags:string[];onSubmitted:()=>void}) {const [open,setOpen]=useState(false);return <><p>Upload up to 13 images. Submissions stay private until approved. Artist credit can differ from your account username.</p><button className="btn primary" onClick={()=>setOpen(true)}><Upload size={15}/> Submit artwork</button>{open && <ArtworkSubmitModal tags={tags} onClose={()=>setOpen(false)} onSubmitted={()=>{setOpen(false);onSubmitted();window.dispatchEvent(new Event('gsn-my-images-refresh'));}}/>}</>;}

function ArtworkSubmitModal({ onClose, onSubmitted, tags }: { onClose: () => void; onSubmitted: () => void; tags: string[] }) {
  const objectUrls = useRef(new Set<string>());
  useEffect(() => { const urls = objectUrls.current; return () => { urls.forEach(url => URL.revokeObjectURL(url)); }; }, []);
  useEffect(() => { let stale=false; if (supabase) void supabase.auth.getUser().then(async ({data}) => { if(data.user){ const profile=await loadProfile(data.user.id); if(!stale)setArtist(previous=>previous||profile?.username||''); } }).catch(()=>{ /* Username can still be entered manually. */ }); return()=>{stale=true;}; }, []);
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [description, setDescription] = useState('');
  const [rating, setRating] = useState<ArtworkRating>('sfw');
  const [items, setItems] = useState<{ file: File; tags: string[]; title: string; url: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useBlocker({shouldBlockFn:()=>busy,enableBeforeUnload:busy});
  const addFiles = (list: FileList | null) => { if (!list || busy) return; const remaining=13-items.length; const files=Array.from(list); if(files.length>remaining)setError('Maximum 13 images — extras were skipped.'); const next=files.slice(0,remaining).map(file=>{const url=URL.createObjectURL(file);objectUrls.current.add(url);return {file,tags:[] as string[],title:title.trim(),url};});setItems([...items,...next]); };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    if (!artist.trim() || !items.length || items.some((item) => !item.title.trim())) { setError('Please provide an artist username and a title for each image.'); return; }
    if (items.some((i) => i.file.size > 12 * 1024 * 1024)) { setError('Please keep each image under 12 MB.'); return; }
    setBusy(true);
    try { await submitArtBatch({ title: title.trim(), artist_name: artist.trim(), description: description.trim(), rating, onUploaded: file => { setItems(previous => previous.filter(item => { if(item.file===file){URL.revokeObjectURL(item.url);objectUrls.current.delete(item.url);return false;}return true;}));window.dispatchEvent(new Event('gsn-my-images-refresh')); }, items: items.map(({ file, tags: t, title: imageTitle }) => ({ file, tags: t, title: imageTitle })) }); onSubmitted(); }
    catch (err) { setError((err instanceof Error ? err.message : 'Upload failed.') + ' Unsent images remain here; submitted images are in My Images.'); }
    finally { setBusy(false); }
  };
  return <div className="modal-backdrop"><form className="modal" onSubmit={submit}><div className="modal-head"><h2>Submit community artwork</h2><button className="btn ghost" type="button" disabled={busy} onClick={onClose}><X size={17} /></button></div><div className="modal-body"><div className="upload-note"><strong>Up to 13 images.</strong> Each image can have its own tags — type a word or #tag to search. Submissions wait for moderation.</div><div className="form-grid"><div className="field"><label htmlFor="art-title">Artwork title</label><input className="text-input" maxLength={150} disabled={busy} id="art-title" value={title} onChange={e => setTitle(e.target.value)} required /></div><div className="field"><label htmlFor="art-credit">Artist username</label><input className="text-input" maxLength={100} disabled={busy} id="art-credit" value={artist} onChange={e => setArtist(e.target.value)} required /></div><div className="field full"><label htmlFor="art-files">Images ({items.length}/13)</label><input className="text-input" id="art-files" type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif" disabled={busy || items.length >= 13} onChange={e => { addFiles(e.target.files); e.target.value = ''; }} /></div>{items.map((it, i) => <div className="field full batch-item" key={it.url}><img src={it.url} alt="" /><div style={{ flex: 1, display: 'grid', gap: 8 }}><input className="text-input" maxLength={150} disabled={busy} value={it.title} placeholder={`Title for image ${i + 1}`} aria-label={`Title for image ${i + 1}`} onChange={(e) => setItems(items.map((x, j) => j === i ? { ...x, title: e.target.value } : x))} /><HashTagInput tags={tags} value={it.tags} onChange={(v) => setItems(items.map((x, j) => j === i ? { ...x, tags: v } : x))} /></div><button type="button" disabled={busy} aria-label={`Remove image ${i + 1}`} className="btn ghost mini" onClick={() => { URL.revokeObjectURL(it.url); objectUrls.current.delete(it.url); setItems(items.filter((_, j) => j !== i)); }}><X size={12} /></button></div>)}<div className="field"><label htmlFor="art-rating">Section</label><select className="select-input" id="art-rating" value={rating} onChange={e => setRating(e.target.value as ArtworkRating)}><option value="sfw">General</option><option value="nsfw">Mature / NSFW</option></select></div><div className="field full"><label htmlFor="art-description">Description</label><textarea className="text-area" maxLength={1000} disabled={busy} id="art-description" value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional context or caption" /></div></div>{error && <div className="form-error" role="alert">{error}</div>}</div><div className="modal-foot"><button className="btn ghost" type="button" disabled={busy} onClick={onClose}>Cancel</button><button className="btn primary" type="submit" disabled={busy}>{busy ? 'Uploading…' : `Submit ${items.length || ''} for review`}</button></div></form></div>;
}

function CommunityModerationPage({ onChanged }: { onChanged: () => void }) { return <ModerationPage onChanged={onChanged}/>; }

function SearchModal({ data, term, setTerm, onClose, onOpen }: { data: DatabaseState; term: string; setTerm: (value: string) => void; onClose: () => void; onOpen: (category: Category, name: string) => void }) {
  const [sector, setSector] = useState('all');
  const results = useMemo(() => allEntries(data).filter(({ category }) => sector === 'all' || category === sector).filter(({ item }) => `${item.name} ${item.cls} ${plainEntryText(item.summary)} ${(item.images || []).flatMap((im) => (im.tags || []).map((t) => '#' + t + ' ' + t)).join(' ')}`.toLowerCase().includes(term.trim().toLowerCase())).slice(0, 20), [data, term, sector]);
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className="modal search-modal"><div className="modal-head"><h2>Search archive</h2><button className="btn ghost" type="button" aria-label="Close search" data-testid="button-close-search" onClick={onClose}><X size={17} /></button></div><div className="modal-body"><div className="input-wrap"><ScanSearch size={16} /><input className="text-input" autoFocus value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Search names, feats, or #image-tags..." aria-label="Search archive" data-testid="input-search-archive" /></div><label className="field">Sector<select className="select-input" value={sector} onChange={event => setSector(event.target.value)}><option value="all">All sectors</option>{categories.map(category => <option key={category} value={category}>{categoryMeta[category].label}</option>)}</select></label><div className="search-results">{results.length ? results.map(({ item, category }) => <button className="search-result" type="button" key={`${category}-${item.name}`} onClick={() => onOpen(category, item.name)} data-testid={`search-result-${item.name.replaceAll(' ', '-').toLowerCase()}`}><div><strong>{item.name}</strong><div><span>{categoryMeta[category].label} / {item.cls}</span></div></div><ArrowRight size={15} /></button>) : <EmptyState text="No files match. Try a shorter name, a feat keyword, or choose All sectors." />}</div></div></div></div>;
}

function NotFound({ navigate }: { navigate: (path: string) => void }) {
  return <div className="empty-state"><FolderArchive size={30} /><div style={{ font: '700 28px var(--font-display)', color: 'var(--ink)', textTransform: 'uppercase', marginBottom: 8 }}>File not found</div><div>The requested archive path does not exist.</div><button className="btn primary" type="button" onClick={() => navigate('/')} style={{ marginTop: 20 }} data-testid="button-return-overview">Return to overview</button></div>;
}

export function GsnArenaApp({ initialArchive }: { initialArchive?: PublicArchive | null | undefined }) {
  return <AppContent initialArchive={initialArchive} />;
}

function App() {
  return <GsnArenaApp />;
}

export default App;