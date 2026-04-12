import { useState, useEffect, useRef, createContext, useContext, useMemo, memo, useCallback } from "react";
import { supabase } from './supabase';

// ─── SAFE SUPABASE SAVE ───────────────────────────────────────
// Prevents data loss: only deletes after confirming items exist,
// rolls back state on error.
const safeSave = async (table, items, setStateFn, prevItems) => {
  if (!items) return;
  // Safety guard: never wipe a table if new list is empty but previous had data
  if (items.length === 0 && prevItems && prevItems.length > 0) {
    console.warn(`[safeSave] Blocked empty save on ${table} — ${prevItems.length} items preserved`);
    return;
  }
  try {
    await supabase.from(table).delete().neq('id', 0);
    // Batch insert in chunks of 100 to avoid timeouts on large imports
    const CHUNK = 100;
    for (let i = 0; i < items.length; i += CHUNK) {
      const chunk = items.slice(i, i + CHUNK).map(item => ({ data: item }));
      await supabase.from(table).insert(chunk);
    }
  } catch (err) {
    console.error(`[safeSave] Error saving ${table}:`, err);
    if (setStateFn && prevItems) setStateFn(prevItems); // rollback
  }
};

// ─── LARGE TABLE SAVE ────────────────────────────────────────
// For large datasets (companies, contacts) — uses smaller chunks
// and sequential inserts to stay within Supabase payload limits
const saveLargeTable = async (table, items) => {
  if (!items || items.length === 0) return;
  try {
    await supabase.from(table).delete().neq('id', 0);
    const CHUNK = 50; // smaller chunks for large payloads
    for (let i = 0; i < items.length; i += CHUNK) {
      const chunk = items.slice(i, i + CHUNK).map(item => ({ data: item }));
      const { error } = await supabase.from(table).insert(chunk);
      if (error) console.error(`[saveLargeTable] chunk error on ${table}:`, error);
    }
  } catch (err) {
    console.error(`[saveLargeTable] Error saving ${table}:`, err);
  }
};

// ─── COLORS ───────────────────────────────────────────────────
const saveProducts = async (items, setStateFn, prevItems) => {
  if (!items) return;
  if (items.length === 0 && prevItems && prevItems.length > 0) {
    console.warn('[saveProducts] Blocked empty save', prevItems.length, 'items preserved');
    return;
  }
  try {
    const { data: existing } = await supabase.from('deriv_products').select('id, data');
    const supabaseIdByJsonId = {};
    (existing || []).forEach(row => { if (row.data?.id) supabaseIdByJsonId[String(row.data.id)] = row.id; });
    const CHUNK = 50;
    for (let i = 0; i < items.length; i += CHUNK) {
      const chunk = items.slice(i, i + CHUNK).map(item => {
        const sid = supabaseIdByJsonId[String(item.id)];
        return sid ? { id: sid, data: item, updated_at: new Date().toISOString() } : { data: item, updated_at: new Date().toISOString() };
      });
      const { error } = await supabase.from('deriv_products').upsert(chunk, { onConflict: 'id' });
      if (error) console.error('[saveProducts] upsert error:', error);
    }
    const currentIds = new Set(items.map(p => String(p.id)));
    const toDelete = (existing || []).filter(r => r.data?.id && !currentIds.has(String(r.data.id))).map(r => r.id);
    if (toDelete.length > 0) await supabase.from('deriv_products').delete().in('id', toDelete);
  } catch (err) {
    console.error('[saveProducts] Error:', err);
    if (setStateFn && prevItems) setStateFn(prevItems);
  }
};

const COLORS = {
  bg: "#0B0B0B",
  surface: "#141414",
  content: "#111111",
  card: "#1C1C1C",
  tableHeader: "#222222",
  border: "#2C2C2C",
  accent: "#D4AF37",
  accentLight: "#F2D675",
  accentDark: "#9C7C1A",
  gold: "#D4AF37",
  green: "#22C55E",
  red: "#EF4444",
  neutral: "#A3A3A3",
  blue: "#4BA3F5",
  orange: "#FF8C42",
  purple: "#B06CF5",
  text: "#F5F5F5",
  textSub: "#CFCFCF",
  textMuted: "#8C8C8C",
  textOnAccent: "#0B0B0B",
  hover: "#242424",
  rowSelected: "#2C2C2C",
};

// ─── DEFAULT CONFIG VALUES ────────────────────────────────────
const DEFAULT_CONFIG = {
  activityStatus: [
    { value: "prospect", label: "Prospect", color: COLORS.orange },
    { value: "client", label: "Client", color: COLORS.green },
    { value: "inactif", label: "Inactif", color: COLORS.textMuted },
  ],
  companyType: [
    { value: "individual", label: "Individual", color: COLORS.blue },
    { value: "legal_entity", label: "Legal Entity", color: COLORS.purple },
  ],
  city: [
    { value: "Paris", label: "Paris" },
    { value: "London", label: "London" },
    { value: "Casablanca", label: "Casablanca" },
    { value: "Kyiv", label: "Kyiv" },
    { value: "Dubai", label: "Dubai" },
  ],
  businessUnit: [
    { value: "morocco", label: "Morocco", color: "#D4AF37" },
    { value: "ukraine", label: "Ukraine", color: "#4B8AE8" },
  ],
  country: [
    { value: "FRANCE", label: "FRANCE" },
    { value: "MOROCCO", label: "MOROCCO" },
    { value: "UKRAINE", label: "UKRAINE" },
    { value: "UNITED KINGDOM", label: "UNITED KINGDOM" },
    { value: "GERMANY", label: "GERMANY" },
    { value: "UNITED STATES", label: "UNITED STATES" },
    { value: "UAE", label: "UAE" },
    { value: "THE NETHERLANDS", label: "THE NETHERLANDS" },
    { value: "BELGIUM", label: "BELGIUM" },
    { value: "SPAIN", label: "SPAIN" },
    { value: "ITALY", label: "ITALY" },
    { value: "TURKEY", label: "TURKEY" },
  ],
  complianceStatus: [
    { value: "not_auth_awaiting", label: "NOT AUTHORIZED – AWAITING VALIDATION", color: COLORS.orange },
    { value: "not_auth_requested", label: "NOT AUTHORIZED – REQUESTED", color: COLORS.gold },
    { value: "authorized", label: "AUTHORIZED", color: COLORS.green },
    { value: "blacklisted", label: "BLACK LISTED", color: COLORS.red },
  ],
  finalAuthStatus: [
    { value: "not_auth_awaiting", label: "NOT AUTHORIZED – AWAITING VALIDATION", color: COLORS.orange },
    { value: "not_auth_requested", label: "NOT AUTHORIZED – REQUESTED", color: COLORS.gold },
    { value: "authorized", label: "AUTHORIZED", color: COLORS.green },
    { value: "blacklisted", label: "BLACK LISTED", color: COLORS.red },
  ],
  roles: [
    { value: "Buyer", label: "Buyer", color: COLORS.green },
    { value: "Exporter", label: "Exporter", color: COLORS.blue },
    { value: "Broker", label: "Broker", color: COLORS.orange },
    { value: "Financial Broker", label: "Financial Broker", color: COLORS.blue },
    { value: "Customs broker", label: "Customs broker", color: COLORS.gold },
    { value: "Surveyor", label: "Surveyor", color: COLORS.purple },
    { value: "Insurer", label: "Insurer", color: COLORS.red },
    { value: "Farm", label: "Farm", color: "#7EC86A" },
    { value: "Elevator", label: "Elevator", color: "#4ECDC4" },
    { value: "Bank", label: "Bank", color: COLORS.accent },
  ],
  contactPositions: [
    { value: "ceo", label: "CEO" },
    { value: "cfo", label: "CFO" },
    { value: "coo", label: "COO" },
    { value: "president", label: "President" },
    { value: "director", label: "Director" },
    { value: "manager", label: "Manager" },
    { value: "analyst", label: "Analyst" },
    { value: "trader", label: "Trader" },
    { value: "lawyer", label: "Lawyer" },
    { value: "accountant", label: "Accountant" },
  ],
  companySize: [
    { value: "Small", label: "Small", color: COLORS.green },
    { value: "Medium", label: "Medium", color: COLORS.blue },
    { value: "Big", label: "Big", color: COLORS.purple },
  ],
  contractsCurrency: [
    { value: "EUR", label: "EUR", color: COLORS.gold },
    { value: "USD", label: "USD", color: COLORS.green },
    { value: "MAD", label: "MAD", color: COLORS.orange },
    { value: "GBP", label: "GBP", color: COLORS.blue },
    { value: "UAH", label: "UAH", color: COLORS.accent },
  ],
  foodFeed: [
    { value: "FOOD", label: "FOOD", color: COLORS.green },
    { value: "FEED", label: "FEED", color: COLORS.orange },
    { value: "FOOD_FEED", label: "FOOD + FEED", color: COLORS.blue },
  ],
  derivUnderlyingCategories: [
    { value: "commodity", label: "COMMODITY" },
    { value: "fx", label: "FX" },
  ],
  derivExchanges: [
    { value: "cme", label: "CME Group" },
    { value: "euronext", label: "Euronext" },
    { value: "ice", label: "ICE" },
    { value: "lme", label: "LME" },
    { value: "matif", label: "MATIF" },
  ],
  derivAccounts: [
    { value: "main", label: "Main Account" },
    { value: "hedge", label: "Hedge Account" },
  ],
  derivVolumeUnits: [
    { value: "mt", label: "MT" },
    { value: "bu", label: "Bushel" },
    { value: "lot", label: "Lot" },
    { value: "kg", label: "KG" },
    { value: "t", label: "Tonne" },
  ],
  derivCurrencies: [
    { value: "EUR", label: "EUR", color: COLORS.gold },
    { value: "USD", label: "USD", color: COLORS.green },
    { value: "GBP", label: "GBP", color: COLORS.blue },
    { value: "MAD", label: "MAD", color: COLORS.orange },
    { value: "UAH", label: "UAH", color: COLORS.accent },
  ],
  derivDecimals: [
    { value: "decimal",  label: "Décimal",  example: "200.25" },
    { value: "1/2",      label: "1/2",      example: "200 1/2" },
    { value: "1/4",      label: "1/4",      example: "200 1/4" },
    { value: "1/8",      label: "1/8",      example: "200 1/8" },
    { value: "1/16",     label: "1/16",     example: "200 1/16" },
    { value: "1/32",     label: "1/32",     example: "200 1/32" },
    { value: "1/64",     label: "1/64",     example: "200 1/64" },
  ],
  derivOpStatuses: [
    { value: "pending", label: "PENDING", color: "#F59E0B" },
    { value: "traded",  label: "TRADED",  color: "#10B981" },
  ],
  derivInstrumentTypes: [
    { value: "future", label: "Future" },
    { value: "option", label: "Option" },
  ],
  derivOpTypes: [
    { value: "hedging", label: "Hedging" },
    { value: "rolling", label: "Rolling" },
    { value: "trade",   label: "Trade"   },
  ],
  derivOpStatusDefault: "",
  derivDefaultFinancingBank: "",
  derivDefaultAccountType: "",
  derivAccountTypes: [
    { value: "hedging",        label: "Hedging",        color: "#22C55E" },
    { value: "speculative",    label: "Speculative",    color: "#EF4444" },
    { value: "global_hedging", label: "Global Hedging", color: "#4BA3F5" },
  ],
  derivFinancingBanks: [],
  derivBusinessUnits: [],
  derivBusinessUnitDefault: "",
  derivDefaultBroker: "",
  derivTarifTypes: [],
  derivOrderTransmissionTypes: [
    { value: "electronic", label: "ELECTRONIC" },
    { value: "manual", label: "MANUAL" },
  ],
  derivOrderTransmissionDefault: "electronic",
  derivOpTypeDefault: "",
  derivInstrumentTypeDefault: "",
  derivCommodities: [
    { value: "corn", label: "Corn", underlyingCategory: "commodity" },
    { value: "soybean", label: "Soybean", underlyingCategory: "commodity" },
    { value: "rapeseed", label: "Rapeseed", underlyingCategory: "commodity" },
    { value: "sunflower", label: "Sunflower", underlyingCategory: "commodity" },
    { value: "barley", label: "Barley", underlyingCategory: "commodity" },
    { value: "sugar", label: "Sugar", underlyingCategory: "commodity" },
    { value: "cotton", label: "Cotton", underlyingCategory: "commodity" },
    { value: "coffee", label: "Coffee", underlyingCategory: "commodity" },
    { value: "cocoa", label: "Cocoa", underlyingCategory: "commodity" },
  ],
  derivProducts: [
    { value: "wheat", label: "Wheat" },
    { value: "corn", label: "Corn" },
    { value: "soybean", label: "Soybean" },
    { value: "rapeseed", label: "Rapeseed" },
    { value: "sunflower", label: "Sunflower" },
    { value: "cotton", label: "Cotton" },
    { value: "sugar", label: "Sugar" },
    { value: "coffee", label: "Coffee" },
    { value: "cocoa", label: "Cocoa" },
    { value: "palm_oil", label: "Palm Oil" },
    { value: "rice", label: "Rice" },
    { value: "barley", label: "Barley" },
  ],
  derivUnderlyingOrigins: ["FRANCE", "UKRAINE", "MOROCCO", "BRAZIL", "ARGENTINA", "UNITED STATES", "AUSTRALIA"],
  companyTimezone: "Europe/Paris",
  companyViews: [],
};

// ─── CONFIG CONTEXT ───────────────────────────────────────────
const ConfigContext = createContext(null);
const useConfig = () => useContext(ConfigContext);

const ConfigProvider = ({ children }) => {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [loaded, setLoaded] = useState(false);
  const [userModified, setUserModified] = useState(false);

  useEffect(() => {
    async function loadConfig() {
      const { data } = await supabase.from('config').select('data').eq('key', 'admin-config').single();
      if (data) {
        const loaded = { ...DEFAULT_CONFIG, ...data.data };
        // Normalize fields that must be arrays but may have been saved as objects
        if (!Array.isArray(loaded.derivAccountTypes)) loaded.derivAccountTypes = DEFAULT_CONFIG.derivAccountTypes;
        if (!Array.isArray(loaded.derivFinancingBanks)) loaded.derivFinancingBanks = DEFAULT_CONFIG.derivFinancingBanks;
        if (!Array.isArray(loaded.derivUnderlyingCategories)) loaded.derivUnderlyingCategories = DEFAULT_CONFIG.derivUnderlyingCategories;
        setConfig(loaded);
      }
      setLoaded(true);
    }
    loadConfig();
  }, []);

  useEffect(() => {
    if (loaded && userModified) {
      async function saveConfig() {
        await supabase.from('config').upsert({ key: 'admin-config', data: config }, { onConflict: 'key' });
      }
      saveConfig();
    }
  }, [config, loaded, userModified]);

  const updateField = (fieldKey, newValues) => {
    setUserModified(true);
    setConfig(prev => ({ ...prev, [fieldKey]: newValues }));
  };

  return (
    <ConfigContext.Provider value={{ config, updateField }}>
      {children}
    </ConfigContext.Provider>
  );
};

// ─── HELPERS ──────────────────────────────────────────────────
const PRIORITY_CONFIG = {
  haute: { label: "Haute", color: COLORS.red },
  moyenne: { label: "Moyenne", color: COLORS.gold },
  basse: { label: "Basse", color: COLORS.green },
};

const COUNTRY_TO_CODE = {
  "france": "FR", "germany": "DE", "spain": "ES", "italy": "IT", "portugal": "PT",
  "netherlands": "NL", "the netherlands": "NL", "belgium": "BE", "switzerland": "CH", "austria": "AT", "sweden": "SE",
  "norway": "NO", "denmark": "DK", "finland": "FI", "poland": "PL", "ukraine": "UA",
  "morocco": "MA", "algeria": "DZ", "tunisia": "TN", "egypt": "EG", "senegal": "SN",
  "usa": "US", "united states": "US", "uk": "GB", "united kingdom": "GB", "canada": "CA",
  "australia": "AU", "japan": "JP", "china": "CN", "india": "IN", "brazil": "BR",
  "turkey": "TR", "russia": "RU", "nigeria": "NG", "south africa": "ZA", "kenya": "KE",
  "ghana": "GH", "ethiopia": "ET", "saudi arabia": "SA", "uae": "AE", "qatar": "QA",
  "argentina": "AR", "mexico": "MX", "chile": "CL", "colombia": "CO",
  "maroc": "MA", "algérie": "DZ", "tunisie": "TN",
  "allemagne": "DE", "espagne": "ES", "italie": "IT", "pays-bas": "NL", "belgique": "BE",
  "suisse": "CH", "états-unis": "US", "royaume-uni": "GB", "mali": "ML",
  "burkina faso": "BF", "niger": "NE",
  "lithuania": "LT", "latvia": "LV", "estonia": "EE", "czechia": "CZ", "czech republic": "CZ",
  "slovakia": "SK", "hungary": "HU", "romania": "RO", "bulgaria": "BG", "croatia": "HR",
  "serbia": "RS", "greece": "GR", "ireland": "IE", "luxembourg": "LU", "iceland": "IS",
  "slovenia": "SI", "albania": "AL", "moldova": "MD", "belarus": "BY", "cyprus": "CY",
  "malta": "MT", "montenegro": "ME", "north macedonia": "MK", "bosnia": "BA",
  "uruguay": "UY", "peru": "PE", "venezuela": "VE", "ecuador": "EC", "bolivia": "BO",
  "paraguay": "PY", "panama": "PA", "costa rica": "CR", "guatemala": "GT", "cuba": "CU",
  "dominican republic": "DO", "haiti": "HT", "honduras": "HN", "el salvador": "SV",
  "nicaragua": "NI", "jamaica": "JM", "trinidad": "TT",
  "libya": "LY", "sudan": "SD", "ivory coast": "CI", "côte d'ivoire": "CI",
  "cameroon": "CM", "tanzania": "TZ", "uganda": "UG", "mozambique": "MZ", "angola": "AO",
  "zambia": "ZM", "zimbabwe": "ZW", "madagascar": "MG", "rwanda": "RW",
  "democratic republic of congo": "CD", "congo": "CG", "somalia": "SO",
  "israel": "IL", "jordan": "JO", "lebanon": "LB", "iraq": "IQ", "iran": "IR",
  "kuwait": "KW", "bahrain": "BH", "oman": "OM", "yemen": "YE", "syria": "SY",
  "pakistan": "PK", "bangladesh": "BD", "sri lanka": "LK", "nepal": "NP",
  "thailand": "TH", "vietnam": "VN", "indonesia": "ID", "malaysia": "MY",
  "philippines": "PH", "singapore": "SG", "south korea": "KR", "north korea": "KP", "korea": "KR",
  "taiwan": "TW", "hong kong": "HK", "myanmar": "MM", "cambodia": "KH",
  "kazakhstan": "KZ", "uzbekistan": "UZ", "azerbaijan": "AZ", "georgia": "GE",
  "armenia": "AM", "afghanistan": "AF", "new zealand": "NZ",
  "marshall islands": "MH", "iles marshall": "MH", "îles marshall": "MH",
  "seychelles": "SC", "republic of seychelles": "SC", "république des seychelles": "SC",
  "liberia": "LR", "republic of liberia": "LR",
};

const getCountryCode = (country) => {
  if (!country) return null;
  const trimmed = country.trim();
  if (trimmed.length === 2) return trimmed.toUpperCase();
  const threeLetter = { "UAE": "AE", "USA": "US", "UK": "GB" };
  if (threeLetter[trimmed.toUpperCase()]) return threeLetter[trimmed.toUpperCase()];
  const normalized = trimmed.toLowerCase().replace(/_/g, " ");
  return COUNTRY_TO_CODE[normalized] || COUNTRY_TO_CODE[trimmed.toLowerCase()] || null;
};

const getCountryLabel = (v, configCountry) => {
  if (!v) return null;
  const normalize = s => s.toLowerCase().replace(/_/g, " ").trim();
  const found = (configCountry || []).find(c => normalize(c.value) === normalize(v) || normalize(c.label) === normalize(v));
  if (found) return found.label;
  const code = getCountryCode(v);
  if (code) {
    const byCode = (configCountry || []).find(c => getCountryCode(c.value) === code || getCountryCode(c.label) === code);
    if (byCode) return byCode.label;
  }
  return v.replace(/_/g, " ");
};

// ─── DATE FORMATTING UTILITY ──────────────────────────────────
// Converts any stored date value (ISO, dd/mm/yyyy, dd.mm.yyyy, Excel serial)
// to "dd/mm/yyyy hh:mm" in the given IANA timezone.
// If the stored value has no time component, hh:mm defaults to "00:00".
const formatComplianceDate = (val, tz) => {
  if (!val && val !== 0) return null;
  const s = val.toString().trim();
  let date = null;

  // Excel serial number (e.g. 44927)
  const n = parseFloat(s);
  if (!isNaN(n) && n > 40000 && n < 60000 && /^\d+(\.\d+)?$/.test(s)) {
    date = new Date(Math.round((n - 25569) * 86400 * 1000));
  }
  // ISO datetime "2024-03-15T14:30:00..." or "2024-03-15T14:30"
  else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) {
    date = new Date(s);
  }
  // ISO date only "2024-03-15"
  else if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    date = new Date(s + 'T00:00:00');
  }
  // dd/mm/yyyy hh:mm  or  dd.mm.yyyy hh:mm
  else if (/^\d{1,2}[\/\.]\d{1,2}[\/\.]\d{4}\s+\d{2}:\d{2}/.test(s)) {
    const [datePart, timePart] = s.split(/\s+/);
    const [d, mo, y] = datePart.split(/[\/\.]/);
    date = new Date(`${y}-${mo.padStart(2,'0')}-${d.padStart(2,'0')}T${timePart}:00`);
  }
  // dd/mm/yyyy  or  dd.mm.yyyy
  else if (/^\d{1,2}[\/\.]\d{1,2}[\/\.]\d{4}$/.test(s)) {
    const [d, mo, y] = s.split(/[\/\.]/);
    date = new Date(`${y}-${mo.padStart(2,'0')}-${d.padStart(2,'0')}T00:00:00`);
  }
  else {
    return s; // unknown format — return as-is
  }

  if (!date || isNaN(date.getTime())) return s;

  const safeZone = (() => { try { Intl.DateTimeFormat(undefined, { timeZone: tz }); return tz; } catch { return 'UTC'; } })();
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: safeZone,
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  // en-GB gives "15/03/2024, 14:30" — normalise to "15/03/2024 14:30"
  return fmt.format(date).replace(',', '');
};

// Returns current datetime string "yyyy-MM-ddTHH:mm" in the given IANA timezone
// (used as value for <input type="datetime-local"> and for auto-stamping)
const nowInTz = (tz) => {
  const safeZone = (() => { try { Intl.DateTimeFormat(undefined, { timeZone: tz }); return tz; } catch { return 'UTC'; } })();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: safeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date());
  const get = t => parts.find(p => p.type === t)?.value || '00';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
};

// ─── SHARED COMPONENTS ────────────────────────────────────────
const Avatar = ({ initials, size = 40, color = COLORS.accent, square = false }) => (
  <div style={{
    width: size, height: size, borderRadius: square ? 10 : "50%", background: `${color}30`,
    border: `2px solid ${color}60`, display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: size * 0.33, fontWeight: 700, color, flexShrink: 0, fontFamily: "'DM Mono', monospace",
  }}>{initials}</div>
);

const Badge = ({ label, color }) => (
  <span style={{ background: `${color}20`, color, border: `1px solid ${color}40`, borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 600, letterSpacing: 0.3 }}>{label}</span>
);

const Tag = ({ label }) => (
  <span style={{ background: COLORS.border, color: COLORS.textSub, borderRadius: 4, padding: "1px 7px", fontSize: 11 }}>{label}</span>
);

const Input = ({ label, value, onChange, type = "text", placeholder, style = {} }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
    {label && <label style={{ fontSize: 12, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5 }}>{label.toUpperCase()}</label>}
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "10px 14px", color: COLORS.text, fontSize: 14, outline: "none", transition: "border-color 0.2s", fontFamily: "inherit", ...style }}
      onFocus={e => e.target.style.borderColor = COLORS.accent}
      onBlur={e => e.target.style.borderColor = COLORS.border}
    />
  </div>
);

const SelectField = ({ label, value, onChange, options }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
    {label && <label style={{ fontSize: 12, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5 }}>{label.toUpperCase()}</label>}
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "10px 14px", color: COLORS.text, fontSize: 14, outline: "none", fontFamily: "inherit" }}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
);

const Modal = ({ title, onClose, children, wide = false }) => {
  useEffect(() => {
    const handleKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div style={{ position: "fixed", inset: 0, background: "#00000088", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 28, width: "100%", maxWidth: wide ? 680 : 560, maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h2 style={{ margin: 0, fontSize: 20, color: COLORS.text, fontFamily: "'Inter', sans-serif" }}>{title}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: COLORS.textSub, cursor: "pointer", fontSize: 22 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
};

const Btn = ({ children, onClick, variant = "primary", style = {}, disabled = false }) => {
  const base = { borderRadius: 8, cursor: disabled ? "not-allowed" : "pointer", fontWeight: 600, fontFamily: "inherit", transition: "all 0.2s", opacity: disabled ? 0.4 : 1, padding: "10px 18px", fontSize: 14 };
  const styles = {
    primary: { background: COLORS.accent, color: COLORS.textOnAccent, border: "none" },
    secondary: { background: "transparent", color: COLORS.accent, border: `1px solid ${COLORS.accent}` },
    danger: { background: `${COLORS.red}20`, color: COLORS.red, border: `1px solid ${COLORS.red}40` },
    success: { background: `${COLORS.green}20`, color: COLORS.green, border: `1px solid ${COLORS.green}40` },
  };
  const hovers = {
    primary: COLORS.accentLight,
    secondary: COLORS.card,
    danger: COLORS.red,
    success: COLORS.green,
  };
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ ...base, ...styles[variant], ...style }}
      onMouseOver={e => { if (!disabled) { e.currentTarget.style.background = hovers[variant]; if (variant === "primary") e.currentTarget.style.color = COLORS.textOnAccent; } }}
      onMouseOut={e => { if (!disabled) { e.currentTarget.style.background = styles[variant].background; e.currentTarget.style.color = styles[variant].color; } }}
    >{children}</button>
  );
};

const CountryFlag = ({ country, size = 36 }) => {
  const code = getCountryCode(country);
  return (
    <div style={{ width: size * 1.5, height: size, borderRadius: 8, overflow: "hidden", flexShrink: 0, border: `1px solid ${COLORS.border}`, background: COLORS.border, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {code
        ? <img src={`https://flagcdn.com/${code.toLowerCase()}.svg`} alt={country} style={{ width: "100%", height: "100%", objectFit: "cover" }}
            onError={e => { e.target.onerror = null; e.target.src = `https://flagcdn.com/w80/${code.toLowerCase()}.png`; }} />
        : <span style={{ fontSize: size * 0.3, color: COLORS.textMuted }}>{country?.slice(0, 2).toUpperCase() || "?"}</span>
      }
    </div>
  );
};

// ─── ADMIN PANEL ──────────────────────────────────────────────
const COLOR_PALETTE = [
  COLORS.orange, COLORS.green, COLORS.blue, COLORS.red, COLORS.gold,
  COLORS.purple, COLORS.accent, "#7EC86A", "#4ECDC4", COLORS.textSub,
  "#FF6B9D", "#00C9A7", "#845EC2", "#F9A825", "#2196F3",
];

const FIELD_DEFINITIONS = [
  { key: "activityStatus", label: "Activity Status", icon: "◉", description: "Statut d'activité des contacts et sociétés", hasColor: true, hasValue: true },
  { key: "companyType", label: "Company Type", icon: "◆", description: "Type de société (Individual, Legal Entity…)", hasColor: true, hasValue: true },
  { key: "city", label: "City", icon: "🏙", description: "Villes disponibles dans les formulaires", hasColor: false, hasValue: false },
  { key: "businessUnit", label: "Business Unit", icon: "◈", description: "Unités métier disponibles", hasColor: true, hasValue: true },
  { key: "country", label: "Country", icon: "🌍", description: "Pays disponibles dans les formulaires", hasColor: false, hasValue: false, sorted: true },
  { key: "complianceStatus", label: "Compliance Status", icon: "🛡", description: "Statuts de conformité", hasColor: true, hasValue: true, hasDisplayLabel: true },
  { key: "finalAuthStatus", label: "Final Authorization Status", icon: "✅", description: "Statuts d'autorisation finale", hasColor: true, hasValue: true, hasDisplayLabel: true },
  { key: "roles", label: "Roles", icon: "◎", description: "Rôles assignables aux sociétés", hasColor: true, hasValue: true },
  { key: "companySize", label: "Company Size", icon: "📐", description: "Taille de la société (Small, Medium, Big)", hasColor: true, hasValue: true },
  { key: "contractsCurrency", label: "Contracts Currency", icon: "💱", description: "Devises utilisées dans les contrats", hasColor: true, hasValue: true },
  { key: "foodFeed", label: "Food / Feed", icon: "🌾", description: "Catégorie de marchandise (Food, Feed, Food + Feed)", hasColor: true, hasValue: true },
  { key: "contactPositions", label: "Contact Positions", icon: "👤", description: "Postes disponibles pour les contacts (CEO, CFO…)", hasColor: false, hasValue: true },
];

const DERIV_FIELD_DEFINITIONS = [
  { key: "derivDecimals",        label: "Decimals", icon: "⅛", description: "Formats de cotation : décimal standard ou fractions (1/8, 1/32…)", hasColor: false, hasValue: false },
  { key: "derivOpStatuses",      label: "Operation Statuses", icon: "🔘", description: "Statuts d'opération disponibles dans la modale", hasColor: true, hasValue: true },
  { key: "derivInstrumentTypes", label: "Instrument Types", icon: "📐", description: "Types d'instruments disponibles dans la modale (Future, Option…)", hasColor: false, hasValue: true },
  { key: "derivOpTypes",    label: "Operation Types", icon: "🔁", description: "Types d'opérations disponibles dans la modale (Hedging, Rolling…)", hasColor: false, hasValue: true },
  { key: "derivExchanges",  label: "Exchanges", icon: "🏛", description: "Bourses disponibles pour les opérations (CME, Euronext…)", hasColor: false, hasValue: true },
  { key: "derivAccounts", label: "Accounts", icon: "💼", description: "Comptes de trading disponibles", hasColor: false, hasValue: true },
  { key: "derivProducts", label: "Instruments", icon: "🌾", description: "Instruments disponibles dans le formulaire de saisie", hasColor: false, hasValue: true },
  { key: "derivVolumeUnits", label: "Volume Units", icon: "📦", description: "Unités de volume utilisées dans les opérations sur dérivés", hasColor: false, hasValue: true },
  { key: "derivCurrencies", label: "Currencies", icon: "💱", description: "Devises disponibles dans le module Derivatives", hasColor: true, hasValue: true },
  { key: "derivCommodities", label: "Underlying", icon: "🌽", description: "Sous-jacents disponibles avec leur catégorie (Commodity / FX)", hasColor: false, hasValue: true },
  { key: "derivUnderlyingOrigins", label: "Underlying Origin", icon: "🌍", description: "Origines géographiques du sous-jacent", hasColor: false, hasValue: false },
  { key: "derivTarifTypes", label: "Tarifs Types", icon: "🏷", description: "Liste des tarifs types de référence pour les opérations sur dérivés", hasColor: false, hasValue: false },
  { key: "derivOrderTransmissionTypes", label: "Order Transmission Types", icon: "📡", description: "Modes de transmission des ordres (Electronic, Manual…)", hasColor: false, hasValue: true },
  { key: "derivAccountTypes",     label: "Account Types",      icon: "🗂", description: "Types de compte (Hedging, Speculative, Global Hedging…)", hasColor: true, hasValue: true },
  { key: "derivFinancingBanks",   label: "Financing Banks",    icon: "🏦", description: "Banques de financement disponibles pour les comptes de trading", hasColor: false, hasValue: true },
];

const FieldEditor = ({ fieldDef, values, onUpdate, defaultValue, onSetDefault }) => {
  const [items, setItems] = useState(values);
  const [newLabel, setNewLabel] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newColor, setNewColor] = useState(COLORS.accent);
  const [dirty, setDirty] = useState(false);
  const [colorPickerIdx, setColorPickerIdx] = useState(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => { setItems(values); setDirty(false); }, [values]);

  const markDirty = (updated) => { setItems(updated); setDirty(true); };
  const markDirtyAndSave = (updated) => { setItems(updated); setDirty(false); onUpdate(fieldDef.key, updated); };

  const addItem = () => {
    if (!newLabel.trim()) return;
    const isCountry = fieldDef.key === "country";
const val = fieldDef.hasValue ? (newValue.trim() || newLabel.toLowerCase().replace(/\s+/g, "_")) : isCountry ? newLabel.toUpperCase() : newLabel;
const item = { value: isCountry ? newLabel.toUpperCase() : val, label: isCountry ? newLabel.toUpperCase() : newLabel.trim() };
    if (fieldDef.hasColor) item.color = newColor;
    markDirtyAndSave([...items, item]);
    setNewLabel(""); setNewValue(""); setNewColor(COLORS.accent);
  };

  const removeItem = (idx) => markDirtyAndSave(items.filter((_, i) => i !== idx));
  const moveUp = (idx) => { if (idx === 0) return; const a = [...items]; [a[idx - 1], a[idx]] = [a[idx], a[idx - 1]]; markDirtyAndSave(a); };
  const moveDown = (idx) => { if (idx === items.length - 1) return; const a = [...items]; [a[idx], a[idx + 1]] = [a[idx + 1], a[idx]]; markDirtyAndSave(a); };
  const updateItem = (idx, key, val) => markDirty(items.map((item, i) => i === idx ? { ...item, [key]: val } : item));

  return (
    <div style={{ background: COLORS.bg, border: `1px solid ${dirty ? COLORS.accent + "60" : COLORS.border}`, borderRadius: 14, marginBottom: 12, overflow: "hidden", transition: "border-color 0.2s" }}>
      <div onClick={() => setExpanded(!expanded)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", cursor: "pointer", userSelect: "none" }}
        onMouseOver={e => e.currentTarget.style.background = `${COLORS.accent}08`}
        onMouseOut={e => e.currentTarget.style.background = "transparent"}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 18, width: 24, textAlign: "center" }}>{fieldDef.icon}</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }}>{fieldDef.label}</div>
            <div style={{ fontSize: 11, color: COLORS.textMuted }}>{fieldDef.description}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", gap: 3 }}>
            {items.slice(0, 5).map((item, i) => (
              <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: item.color || COLORS.textSub }} />
            ))}
          </div>
          <span style={{ fontSize: 11, color: COLORS.textMuted, fontFamily: "'DM Mono', monospace", minWidth: 60, textAlign: "right" }}>
            {items.length} valeur{items.length > 1 ? "s" : ""}
          </span>
          {dirty && (
            <div onClick={e => { e.stopPropagation(); onUpdate(fieldDef.key, items); setDirty(false); }}
              style={{ background: `${COLORS.green}20`, color: COLORS.green, border: `1px solid ${COLORS.green}40`, padding: "4px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              ✓ Sauvegarder
            </div>
          )}
          <span style={{ color: COLORS.textMuted, fontSize: 14, transition: "transform 0.2s", display: "inline-block", transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
        </div>
      </div>

      {expanded && (
        <div style={{ padding: "0 18px 18px", borderTop: `1px solid ${COLORS.border}` }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 14, marginBottom: 14 }}>
            {items.length === 0 && (
              <div style={{ textAlign: "center", color: COLORS.textMuted, fontSize: 13, padding: "16px 0" }}>Aucune valeur — ajoutez-en ci-dessous</div>
            )}
            {(fieldDef.sorted ? [...items].sort((a, b) => a.label.localeCompare(b.label)) : items).map((item, idx) => {
              const realIdx = fieldDef.sorted ? items.findIndex(i => i.value === item.value) : idx;
              return (
                <div key={item.value || idx} style={{ display: "flex", alignItems: "center", gap: 8, background: COLORS.card, borderRadius: 10, padding: "8px 12px", border: `1px solid ${COLORS.border}` }}>
                  {fieldDef.hasColor && (
                    <div style={{ position: "relative", flexShrink: 0 }}>
                      <div title="Changer la couleur" onClick={() => setColorPickerIdx(colorPickerIdx === realIdx ? null : realIdx)}
                        style={{ width: 22, height: 22, borderRadius: 6, background: item.color || COLORS.textSub, cursor: "pointer", border: `2px solid ${COLORS.border}` }} />
                      {colorPickerIdx === realIdx && (
                        <div style={{ position: "absolute", top: 28, left: 0, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 10, zIndex: 50, display: "flex", flexWrap: "wrap", gap: 6, width: 190, boxShadow: "0 8px 24px #00000060" }}>
                          {COLOR_PALETTE.map(c => (
                            <div key={c} onClick={() => { updateItem(realIdx, "color", c); setColorPickerIdx(null); }}
                              style={{ width: 24, height: 24, borderRadius: 6, background: c, cursor: "pointer", border: item.color === c ? `2px solid ${COLORS.text}` : `2px solid transparent` }}
                              onMouseOver={e => e.currentTarget.style.transform = "scale(1.2)"}
                              onMouseOut={e => e.currentTarget.style.transform = "scale(1)"}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  <input value={item.label} onChange={e => updateItem(realIdx, "label", e.target.value)}
                    style={{ flex: 1, background: "transparent", border: "none", color: COLORS.text, fontSize: 13, fontFamily: "inherit", outline: "none" }} />
                  {fieldDef.hasDisplayLabel && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
                      <input
                        value={item.displayLabel || ""}
                        onChange={e => updateItem(realIdx, "displayLabel", e.target.value)}
                        placeholder={`Affichage court (\\n = saut de ligne)`}
                        title="Label d'affichage dans la table — utilisez \\n pour un saut de ligne"
                        style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "4px 8px", color: COLORS.accentLight, fontSize: 11, fontFamily: "'DM Mono', monospace", outline: "none", width: "100%" }}
                      />
                    </div>
                  )}
                  {fieldDef.hasValue && (
                    <span style={{ fontSize: 10, color: COLORS.textMuted, fontFamily: "'DM Mono', monospace", whiteSpace: "nowrap", background: COLORS.bg, padding: "2px 6px", borderRadius: 4 }}>
                      {item.value}
                    </span>
                  )}
                  {fieldDef.hasColor && <Badge label={item.label} color={item.color || COLORS.textSub} />}
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <button onClick={() => moveUp(realIdx)} style={{ background: "none", border: "none", color: COLORS.textMuted, cursor: "pointer", fontSize: 9, padding: "1px 3px", lineHeight: 1 }}>▲</button>
                    <button onClick={() => moveDown(realIdx)} style={{ background: "none", border: "none", color: COLORS.textMuted, cursor: "pointer", fontSize: 9, padding: "1px 3px", lineHeight: 1 }}>▼</button>
                  </div>
                  {onSetDefault && (
                    <div onClick={e => { e.stopPropagation(); onSetDefault(item.value === defaultValue ? "" : item.value); }}
                      title="Définir comme valeur par défaut"
                      style={{ fontSize: 16, color: item.value === defaultValue ? COLORS.gold : COLORS.textMuted, cursor: "pointer", transition: "color 0.15s", flexShrink: 0 }}
                      onMouseOver={e => e.currentTarget.style.color = COLORS.gold}
                      onMouseOut={e => e.currentTarget.style.color = item.value === defaultValue ? COLORS.gold : COLORS.textMuted}>
                      {item.value === defaultValue ? "★" : "☆"}
                    </div>
                  )}
                  <button onClick={() => removeItem(realIdx)} style={{ background: "none", border: "none", color: COLORS.textMuted, cursor: "pointer", fontSize: 18, flexShrink: 0, lineHeight: 1 }}
                    onMouseOver={e => e.currentTarget.style.color = COLORS.red}
                    onMouseOut={e => e.currentTarget.style.color = COLORS.textMuted}
                  >×</button>
                </div>
              );
            })}
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "flex-end", background: `${COLORS.accent}08`, border: `1px dashed ${COLORS.accent}40`, borderRadius: 10, padding: "12px 14px" }}>
            {fieldDef.hasColor && (
              <div style={{ flexShrink: 0 }}>
                <div style={{ fontSize: 10, color: COLORS.textSub, marginBottom: 5, fontWeight: 600 }}>COULEUR</div>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", width: 110 }}>
                  {COLOR_PALETTE.slice(0, 6).map(c => (
                    <div key={c} onClick={() => setNewColor(c)}
                      style={{ width: 20, height: 20, borderRadius: 5, background: c, cursor: "pointer", border: newColor === c ? `2px solid ${COLORS.text}` : `2px solid transparent` }}
                      onMouseOver={e => e.currentTarget.style.transform = "scale(1.15)"}
                      onMouseOut={e => e.currentTarget.style.transform = "scale(1)"}
                    />
                  ))}
                </div>
              </div>
            )}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 10, color: COLORS.textSub, fontWeight: 600 }}>LABEL *</label>
              <input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="Nouvelle valeur..."
                onKeyDown={e => e.key === "Enter" && addItem()}
                style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "8px 12px", color: COLORS.text, fontSize: 13, outline: "none", fontFamily: "inherit" }} />
            </div>
            {fieldDef.hasValue && (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 10, color: COLORS.textSub, fontWeight: 600 }}>CLÉ (optionnel)</label>
                <input value={newValue} onChange={e => setNewValue(e.target.value)} placeholder="Auto-générée si vide"
                  style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "8px 12px", color: COLORS.text, fontSize: 13, outline: "none", fontFamily: "inherit" }} />
              </div>
            )}
            <Btn onClick={addItem} disabled={!newLabel.trim()} style={{ padding: "8px 14px", fontSize: 13, flexShrink: 0 }}>+ Ajouter</Btn>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── DERIV OP STATUS EDITOR ───────────────────────────────────
const DerivOpStatusEditor = ({ config, updateField }) => {
  const items = config.derivOpStatuses || [];
  const [localItems, setLocalItems] = useState(items);
  const [localDefault, setLocalDefault] = useState(config.derivOpStatusDefault || "");
  const [dirty, setDirty] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState(COLORS.accent);

  useEffect(() => {
    setLocalItems(items); setLocalDefault(config.derivOpStatusDefault || ""); setDirty(false);
  }, [config.derivOpStatuses, config.derivOpStatusDefault]);

  const mark = (nextItems, nextDefault) => {
    setLocalItems(nextItems ?? localItems);
    setLocalDefault(nextDefault ?? localDefault);
    setDirty(true);
  };

  const setDefault = (e, value) => {
    e.stopPropagation();
    mark(undefined, localDefault === value ? "" : value);
  };

  const add = () => {
    if (!newLabel.trim()) return;
    mark([...localItems, { value: newLabel.trim().toLowerCase().replace(/\s+/g, "_"), label: newLabel.trim().toUpperCase(), color: newColor }], undefined);
    setNewLabel(""); setNewColor(COLORS.accent);
  };

  const save = (e) => {
    e.stopPropagation();
    updateField("derivOpStatuses", localItems);
    updateField("derivOpStatusDefault", localDefault);
    setDirty(false);
  };

  const PRESET_COLORS = [COLORS.green, COLORS.orange, COLORS.red, COLORS.blue, COLORS.purple, COLORS.gold, COLORS.accent];

  return (
    <div style={{ background: COLORS.bg, border: `1px solid ${dirty ? COLORS.accent + "60" : COLORS.border}`, borderRadius: 14, overflow: "hidden", transition: "border-color 0.2s" }}>
      <div onClick={() => setExpanded(e => !e)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", cursor: "pointer", userSelect: "none" }}
        onMouseOver={e => e.currentTarget.style.background = `${COLORS.accent}08`}
        onMouseOut={e => e.currentTarget.style.background = "transparent"}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 18, width: 24, textAlign: "center" }}>🔘</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }}>Operation Statuses</div>
            <div style={{ fontSize: 11, color: COLORS.textMuted }}>Statuts disponibles dans la modale — ★ pour définir le défaut</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", gap: 5 }}>
            {localItems.map(s => (
              <span key={s.value} style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 5, background: `${s.color}20`, color: s.color, border: `1px solid ${s.color}40` }}>
                {s.label}{localDefault === s.value ? " ★" : ""}
              </span>
            ))}
          </div>
          {dirty && <div onClick={save} style={{ background: `${COLORS.green}20`, color: COLORS.green, border: `1px solid ${COLORS.green}40`, padding: "4px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>✓ Sauvegarder</div>}
          <span style={{ color: COLORS.textMuted, fontSize: 14, transition: "transform 0.2s", display: "inline-block", transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
        </div>
      </div>

      {expanded && (
        <div style={{ padding: "14px 18px", borderTop: `1px solid ${COLORS.border}` }}>
          <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 10 }}>☆ Cliquez sur l'étoile pour définir le statut par défaut dans la modale</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
            {localItems.map((s, idx) => {
              const isDefault = localDefault === s.value;
              return (
                <div key={s.value} style={{ display: "flex", alignItems: "center", gap: 10, background: `${s.color}10`, border: `1px solid ${s.color}30`, borderRadius: 10, padding: "10px 14px" }}>
                  <div style={{ width: 12, height: 12, borderRadius: "50%", background: s.color, flexShrink: 0 }} />
                  <input value={s.label} onChange={e => { const v = e.target.value; mark(localItems.map((x, i) => i === idx ? { ...x, label: v } : x), undefined); }}
                    style={{ flex: 1, background: "transparent", border: "none", color: COLORS.text, fontSize: 13, fontWeight: 700, fontFamily: "inherit", outline: "none" }} />
                  <div style={{ display: "flex", gap: 4 }}>
                    {PRESET_COLORS.map(c => (
                      <div key={c} onClick={() => mark(localItems.map((x, i) => i === idx ? { ...x, color: c } : x), undefined)}
                        style={{ width: 14, height: 14, borderRadius: "50%", background: c, cursor: "pointer", border: s.color === c ? `2px solid #fff` : "2px solid transparent", outline: s.color === c ? `2px solid ${c}` : "none" }} />
                    ))}
                  </div>
                  <div onClick={e => setDefault(e, s.value)} title="Définir comme statut par défaut"
                    style={{ fontSize: 18, color: isDefault ? COLORS.gold : COLORS.textMuted, cursor: "pointer", transition: "color 0.15s" }}
                    onMouseOver={e => e.currentTarget.style.color = COLORS.gold}
                    onMouseOut={e => e.currentTarget.style.color = isDefault ? COLORS.gold : COLORS.textMuted}>
                    {isDefault ? "★" : "☆"}
                  </div>
                  <button onClick={() => mark(localItems.filter((_, i) => i !== idx), localDefault === s.value ? "" : undefined)}
                    style={{ background: "none", border: "none", color: COLORS.textMuted, cursor: "pointer", fontSize: 18, lineHeight: 1 }}
                    onMouseOver={e => e.currentTarget.style.color = COLORS.red}
                    onMouseOut={e => e.currentTarget.style.color = COLORS.textMuted}>×</button>
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end", background: `${COLORS.accent}08`, border: `1px dashed ${COLORS.accent}40`, borderRadius: 10, padding: "12px 14px" }}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 10, color: COLORS.textSub, fontWeight: 600 }}>LABEL *</label>
              <input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="ex: CONFIRMED" onKeyDown={e => e.key === "Enter" && add()}
                style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "8px 12px", color: COLORS.text, fontSize: 13, outline: "none", fontFamily: "inherit" }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 10, color: COLORS.textSub, fontWeight: 600 }}>COULEUR</label>
              <div style={{ display: "flex", gap: 5, padding: "6px 0" }}>
                {PRESET_COLORS.map(c => (
                  <div key={c} onClick={() => setNewColor(c)}
                    style={{ width: 20, height: 20, borderRadius: "50%", background: c, cursor: "pointer", border: newColor === c ? `2px solid #fff` : "2px solid transparent", outline: newColor === c ? `2px solid ${c}` : "none" }} />
                ))}
              </div>
            </div>
            <Btn onClick={add} disabled={!newLabel.trim()} style={{ padding: "8px 14px", fontSize: 13, flexShrink: 0 }}>+ Ajouter</Btn>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── DERIV DECIMALS EDITOR ────────────────────────────────────
const DerivDecimalsEditor = ({ config, updateField }) => {
  // New structure: each entry = { id, exchange, underlying, displayFormat, tickSize }
  // Keeps backward compat: old entries { value, label, example } are shown as legacy
  const items = config.derivDecimals || [];
  const [localItems, setLocalItems] = useState(items);
  const [dirty, setDirty] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const EMPTY_ENTRY = { exchange: "", underlying: "", displayFormat: "decimal", tickSize: "" };
  const [newEntry, setNewEntry] = useState(EMPTY_ENTRY);

  useEffect(() => { setLocalItems(items); setDirty(false); }, [config.derivDecimals]);

  const mark = (next) => { setLocalItems(next); setDirty(true); };
  const normV = v => (v || "").toLowerCase().trim();

  // Detect if entry is new-style (has exchange/underlying) or legacy
  const isNewStyle = entry => entry.exchange !== undefined || entry.underlying !== undefined;

  const addEntry = () => {
    if (!newEntry.exchange || !newEntry.underlying || !newEntry.displayFormat) return;
    // Check duplicate
    const exists = localItems.some(i => normV(i.exchange) === normV(newEntry.exchange) && normV(i.underlying) === normV(newEntry.underlying));
    if (exists) return;
    const next = [...localItems, { ...newEntry, id: Date.now() }];
    mark(next);
    updateField("derivDecimals", next);
    setDirty(false);
    setNewEntry(EMPTY_ENTRY);
  };

  const updateEntry = (idx, field, val) => mark(localItems.map((x, i) => i === idx ? { ...x, [field]: val } : x));
  const removeEntry = (idx) => {
    const next = localItems.filter((_, i) => i !== idx);
    mark(next);
    updateField("derivDecimals", next);
    setDirty(false);
  };

  const newItems = localItems.filter(isNewStyle);
  const legacyItems = localItems.filter(i => !isNewStyle(i));

  const inputStyle = { background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "5px 8px", color: COLORS.text, fontSize: 12, outline: "none", fontFamily: "inherit" };
  const monoStyle = { ...inputStyle, fontFamily: "'DM Mono', monospace" };

  return (
    <div style={{ background: COLORS.bg, border: `1px solid ${dirty ? COLORS.accent + "60" : COLORS.border}`, borderRadius: 14, overflow: "hidden", transition: "border-color 0.2s" }}>
      <div onClick={() => setExpanded(e => !e)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", cursor: "pointer", userSelect: "none" }}
        onMouseOver={e => e.currentTarget.style.background = `${COLORS.accent}08`}
        onMouseOut={e => e.currentTarget.style.background = "transparent"}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 18, width: 24, textAlign: "center" }}>⅛</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }}>Decimals & Tick Size</div>
            <div style={{ fontSize: 11, color: COLORS.textMuted }}>Format d'affichage et tick minimum par exchange/underlying</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 11, color: COLORS.textMuted }}>{newItems.length} règle{newItems.length !== 1 ? "s" : ""}</span>
          {dirty && (
            <div onClick={e => { e.stopPropagation(); updateField("derivDecimals", localItems); setDirty(false); }}
              style={{ background: `${COLORS.green}20`, color: COLORS.green, border: `1px solid ${COLORS.green}40`, padding: "4px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              ✓ Sauvegarder
            </div>
          )}
          <span style={{ color: COLORS.textMuted, fontSize: 14, transition: "transform 0.2s", display: "inline-block", transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
        </div>
      </div>

      {expanded && (
        <div style={{ padding: "14px 18px", borderTop: `1px solid ${COLORS.border}` }}>

          {/* Table header */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 90px 90px 36px", gap: 8, padding: "6px 10px", marginBottom: 6 }}>
            {["Exchange", "Underlying", "Affichage", "Tick min", ""].map(h => (
              <div key={h} style={{ fontSize: 10, fontWeight: 700, color: COLORS.textMuted, letterSpacing: 0.5, textTransform: "uppercase" }}>{h}</div>
            ))}
          </div>

          {/* Existing new-style entries */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
            {newItems.map((entry, idx) => {
              const realIdx = localItems.indexOf(entry);
              const excLabel = (config.derivExchanges || []).find(e => normV(e.value) === normV(entry.exchange))?.label || entry.exchange;
              const undLabel = (config.derivCommodities || []).find(c => normV(c.value) === normV(entry.underlying))?.label || entry.underlying;
              return (
                <div key={entry.id || idx} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 90px 90px 36px", gap: 8, alignItems: "center", background: COLORS.card, borderRadius: 8, padding: "8px 10px", border: `1px solid ${COLORS.border}` }}>
                  <select value={entry.exchange} onChange={e => updateEntry(realIdx, "exchange", e.target.value)} style={inputStyle}>
                    <option value="">— Exchange —</option>
                    {(config.derivExchanges || []).map(ex => <option key={ex.value} value={ex.value}>{ex.label}</option>)}
                  </select>
                  <select value={entry.underlying} onChange={e => updateEntry(realIdx, "underlying", e.target.value)} style={inputStyle}>
                    <option value="">— Underlying —</option>
                    {(config.derivCommodities || []).map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                  <input value={entry.displayFormat} onChange={e => updateEntry(realIdx, "displayFormat", e.target.value)} placeholder="ex: 1/8" style={monoStyle} />
                  <input value={entry.tickSize || ""} onChange={e => updateEntry(realIdx, "tickSize", e.target.value)} placeholder="ex: 2/8" style={monoStyle} />
                  <button onClick={() => removeEntry(realIdx)} style={{ background: "none", border: "none", color: COLORS.textMuted, cursor: "pointer", fontSize: 18 }}
                    onMouseOver={e => e.currentTarget.style.color = COLORS.red}
                    onMouseOut={e => e.currentTarget.style.color = COLORS.textMuted}>×</button>
                </div>
              );
            })}
            {newItems.length === 0 && (
              <div style={{ textAlign: "center", color: COLORS.textMuted, fontSize: 12, padding: "12px 0" }}>Aucune règle définie — ajoutez-en ci-dessous</div>
            )}
          </div>

          {/* Add new entry */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 90px 90px 90px", gap: 8, alignItems: "flex-end", background: `${COLORS.accent}08`, border: `1px dashed ${COLORS.accent}40`, borderRadius: 10, padding: "12px 14px", marginBottom: legacyItems.length > 0 ? 16 : 0 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 10, color: COLORS.textSub, fontWeight: 600 }}>EXCHANGE *</label>
              <select value={newEntry.exchange} onChange={e => setNewEntry(n => ({ ...n, exchange: e.target.value }))} style={inputStyle}>
                <option value="">— Choisir —</option>
                {(config.derivExchanges || []).map(ex => <option key={ex.value} value={ex.value}>{ex.label}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 10, color: COLORS.textSub, fontWeight: 600 }}>UNDERLYING *</label>
              <select value={newEntry.underlying} onChange={e => setNewEntry(n => ({ ...n, underlying: e.target.value }))} style={inputStyle}>
                <option value="">— Choisir —</option>
                {(config.derivCommodities || []).map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 10, color: COLORS.textSub, fontWeight: 600 }}>AFFICHAGE *</label>
              <input value={newEntry.displayFormat} onChange={e => setNewEntry(n => ({ ...n, displayFormat: e.target.value }))} placeholder="ex: 1/8" style={monoStyle} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 10, color: COLORS.textSub, fontWeight: 600 }}>TICK MIN</label>
              <input value={newEntry.tickSize} onChange={e => setNewEntry(n => ({ ...n, tickSize: e.target.value }))} placeholder="ex: 2/8" style={monoStyle} />
            </div>
            <Btn onClick={addEntry} disabled={!newEntry.exchange || !newEntry.underlying || !newEntry.displayFormat} style={{ padding: "8px 10px", fontSize: 12 }}>+ Ajouter</Btn>
          </div>

          {/* Legacy entries */}
          {legacyItems.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 6 }}>Anciens formats (sans exchange/underlying) — migration recommandée</div>
              {legacyItems.map((d, idx) => {
                const realIdx = localItems.indexOf(d);
                return (
                  <div key={idx} style={{ display: "flex", alignItems: "center", gap: 10, background: COLORS.card, borderRadius: 8, padding: "8px 12px", border: `1px solid ${COLORS.border}`, marginBottom: 4 }}>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontWeight: 700, fontSize: 12, color: COLORS.textSub, minWidth: 60 }}>{d.label}</span>
                    <span style={{ fontSize: 11, color: COLORS.textMuted, flex: 1 }}>ex: {d.example}</span>
                    <button onClick={() => removeEntry(realIdx)} style={{ background: "none", border: "none", color: COLORS.textMuted, cursor: "pointer", fontSize: 16 }}>×</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── DERIV BUSINESS UNITS EDITOR ─────────────────────────────
const DerivAutocomplete = ({ form, setForm, requiredError, products = [] }) => {
  const [open, setOpen] = useState(false);
  const allProds = (products.length > 0 ? products : JSON.parse(localStorage.getItem("crm_deriv_products") || "[]"))
    .filter(p => p.active !== false && String(p.active).toLowerCase() !== "false");
  // Filtrer par instrument type si renseigné
  const derivProds = form.type
    ? allProds.filter(p => !p.instrumentType || p.instrumentType.toUpperCase() === form.type.toUpperCase())
    : allProds;
  const query = form.instrument || "";
  const suggestions = query.length > 0
    ? derivProds.filter(p => p.label.toUpperCase().includes(query.toUpperCase()))
    : derivProds;
  // Valid if found in active products OR if it's an existing value (legacy instrument no longer in list)
  const isValid = derivProds.some(p => p.label.toUpperCase() === query.toUpperCase()) || (query.length > 0 && !!form._isEdit);

  const pick = (p) => {
    setForm(f => ({ ...f, instrument: p.label, exchange: p.stoxxExchange || f.exchange, expiryDate: p.expiryDate || "" }));
    setOpen(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, position: "relative" }}>
      <label style={{ fontSize: 11, color: requiredError ? COLORS.red : COLORS.textSub, fontWeight: 600, letterSpacing: 0.5 }}>
        INSTRUMENT <span style={{ color: COLORS.red }}>*</span>
        {form.type && <span style={{ marginLeft: 8, fontSize: 10, color: COLORS.blue, fontWeight: 400 }}>filtré: {form.type}</span>}
      </label>
      <input
        value={query}
        onChange={e => {
          const val = e.target.value;
          const match = derivProds.find(p => p.label.toUpperCase() === val.toUpperCase());
          setForm(f => ({ ...f, instrument: val, exchange: match?.stoxxExchange || (val === "" ? "" : f.exchange) }));
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={form.type ? `Instruments de type ${form.type}…` : "Tapez pour chercher…"}
        autoComplete="off"
        style={{ background: COLORS.bg, border: `1px solid ${requiredError && !query ? COLORS.red : query && !isValid ? COLORS.red + "80" : isValid ? COLORS.green + "60" : COLORS.border}`, borderRadius: open && suggestions.length > 0 ? "8px 8px 0 0" : 8, padding: "10px 14px", color: COLORS.text, fontSize: 14, outline: "none", fontFamily: "inherit" }}
      />
      {open && suggestions.length > 0 && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 300, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderTop: "none", borderRadius: "0 0 8px 8px", boxShadow: "0 8px 24px #00000060", overflow: "hidden" }}>
          {suggestions.map(p => (
            <div key={p.id || p.label} onMouseDown={() => pick(p)}
              style={{ padding: "9px 14px", cursor: "pointer", fontSize: 13, color: COLORS.text, borderBottom: `1px solid ${COLORS.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}
              onMouseOver={e => e.currentTarget.style.background = `${COLORS.accent}15`}
              onMouseOut={e => e.currentTarget.style.background = "transparent"}>
              <span style={{ fontWeight: 600 }}>{p.label.toUpperCase()}</span>
              {p.stoxxExchange && <span style={{ fontSize: 11, color: COLORS.blue }}>🏛 {p.stoxxExchange}</span>}
            </div>
          ))}
        </div>
      )}
      {open && suggestions.length === 0 && form.type && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 300, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderTop: "none", borderRadius: "0 0 8px 8px", padding: "10px 14px" }}>
          <span style={{ fontSize: 12, color: COLORS.textMuted }}>Aucun instrument de type {form.type}</span>
        </div>
      )}
      {requiredError && !query && <span style={{ fontSize: 11, color: COLORS.red }}>⚠ {requiredError}</span>}
      {query && !isValid && <span style={{ fontSize: 11, color: COLORS.red }}>⚠ Valeur non reconnue</span>}
    </div>
  );
};

const DerivBUEditor = ({ config, updateField }) => {
  const allBUs = config.businessUnit || [];
  const selected = config.derivBusinessUnits || [];
  const [expanded, setExpanded] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [localSelected, setLocalSelected] = useState(selected);
  const [localDefault, setLocalDefault] = useState(config.derivBusinessUnitDefault || "");

  useEffect(() => { setLocalSelected(selected); setLocalDefault(config.derivBusinessUnitDefault || ""); setDirty(false); }, [config.derivBusinessUnits, config.derivBusinessUnitDefault]);

  const toggle = (value) => {
    const next = localSelected.includes(value)
      ? localSelected.filter(v => v !== value)
      : [...localSelected, value];
    // Si on désactive la BU par défaut, on la reset
    if (!next.includes(localDefault)) setLocalDefault("");
    setLocalSelected(next);
    setDirty(true);
  };

  const setDefault = (e, value) => {
    e.stopPropagation();
    const next = localDefault === value ? "" : value;
    // S'assurer que la BU est bien activée
    if (next && !localSelected.includes(next)) setLocalSelected(s => [...s, next]);
    setLocalDefault(next);
    setDirty(true);
  };

  const save = (e) => {
    e.stopPropagation();
    updateField("derivBusinessUnits", localSelected);
    updateField("derivBusinessUnitDefault", localDefault);
    setDirty(false);
  };

  return (
    <div style={{ background: COLORS.bg, border: `1px solid ${dirty ? COLORS.accent + "60" : COLORS.border}`, borderRadius: 14, overflow: "hidden", transition: "border-color 0.2s" }}>
      <div onClick={() => setExpanded(e => !e)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", cursor: "pointer", userSelect: "none" }}
        onMouseOver={e => e.currentTarget.style.background = `${COLORS.accent}08`}
        onMouseOut={e => e.currentTarget.style.background = "transparent"}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 18, width: 24, textAlign: "center" }}>◈</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }}>Derivatives Business Units</div>
            <div style={{ fontSize: 11, color: COLORS.textMuted }}>Business Units actives dans le module Derivatives</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end", maxWidth: 400 }}>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {localSelected.map(v => {
              const bu = allBUs.find(b => b.value === v);
              const isDefault = v === localDefault;
              return (
                <span key={v} style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 5, background: COLORS.card, color: COLORS.text, border: `1px solid ${COLORS.border}` }}>
                  {bu?.label || v}{isDefault ? " ★" : ""}
                </span>
              );
            })}
            {localSelected.length === 0 && <span style={{ fontSize: 11, color: COLORS.textMuted }}>Aucune BU active</span>}
          </div>
          {dirty && (
            <div onClick={save} style={{ background: `${COLORS.green}20`, color: COLORS.green, border: `1px solid ${COLORS.green}40`, padding: "4px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
              ✓ Sauvegarder
            </div>
          )}
          <span style={{ color: COLORS.textMuted, fontSize: 14, transition: "transform 0.2s", display: "inline-block", transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
        </div>
      </div>

      {expanded && (
        <div style={{ padding: "14px 18px", borderTop: `1px solid ${COLORS.border}` }}>
          {allBUs.length === 0 && (
            <div style={{ textAlign: "center", color: COLORS.textMuted, fontSize: 13, padding: "16px 0" }}>
              Aucune Business Unit définie — configurez-les dans le bloc CRM
            </div>
          )}
          {localSelected.length > 0 && (
            <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 10 }}>
              ★ Cliquez sur l'étoile pour définir la valeur par défaut dans la modale
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {allBUs.map(bu => {
              const isOn = localSelected.includes(bu.value);
              const isDefault = localDefault === bu.value;
              return (
                <div key={bu.value} onClick={() => toggle(bu.value)}
                  style={{ display: "flex", alignItems: "center", gap: 12, background: isOn ? `${bu.color || COLORS.accent}12` : COLORS.card, border: `1px solid ${isOn ? (bu.color || COLORS.accent) + "40" : COLORS.border}`, borderRadius: 10, padding: "10px 14px", cursor: "pointer", transition: "all 0.15s" }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: `${bu.color || COLORS.accent}20`, border: `1px solid ${bu.color || COLORS.accent}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: bu.color || COLORS.accent, flexShrink: 0 }}>
                    {bu.label.slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text, display: "flex", alignItems: "center", gap: 6 }}>
                      {bu.label}
                      {isDefault && <span style={{ fontSize: 10, background: `${COLORS.gold}25`, color: COLORS.gold, border: `1px solid ${COLORS.gold}40`, borderRadius: 4, padding: "1px 6px", fontWeight: 700 }}>DEFAULT</span>}
                    </div>
                    <div style={{ fontSize: 11, color: COLORS.textMuted, fontFamily: "'DM Mono', monospace" }}>{bu.value}</div>
                  </div>
                  {isOn && (
                    <div onClick={e => setDefault(e, bu.value)} title="Définir comme valeur par défaut"
                      style={{ fontSize: 20, color: isDefault ? COLORS.gold : COLORS.textMuted, cursor: "pointer", transition: "color 0.15s", flexShrink: 0, lineHeight: 1 }}
                      onMouseOver={e => e.currentTarget.style.color = COLORS.gold}
                      onMouseOut={e => e.currentTarget.style.color = isDefault ? COLORS.gold : COLORS.textMuted}>
                      {isDefault ? "★" : "☆"}
                    </div>
                  )}
                  <div style={{ width: 40, height: 22, borderRadius: 11, background: isOn ? (bu.color || COLORS.green) : COLORS.border, position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
                    <div style={{ position: "absolute", top: 3, left: isOn ? 21 : 3, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px #0005" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── UNDERLYING EDITOR ────────────────────────────────────────
// ─── UNDERLYING CATEGORY EDITOR ─────────────────────────────
const UnderlyingCategoryEditor = ({ config, updateField }) => {
  const items = config.derivUnderlyingCategories || [];
  const [localItems, setLocalItems] = useState(items);
  const [newLabel, setNewLabel] = useState("");
  const [dirty, setDirty] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => { setLocalItems(config.derivUnderlyingCategories || []); setDirty(false); }, [JSON.stringify(config.derivUnderlyingCategories)]);

  const markDirty = (updated) => { setLocalItems(updated); setDirty(true); };
  const addItem = () => {
    if (!newLabel.trim()) return;
    const value = newLabel.toLowerCase().trim().replace(/\s+/g, "_");
    if (localItems.some(i => i.value === value)) return;
    markDirty([...localItems, { value, label: newLabel.trim().toUpperCase() }]);
    setNewLabel("");
  };
  const removeItem = (idx) => markDirty(localItems.filter((_, i) => i !== idx));

  return (
    <div style={{ background: COLORS.bg, border: `1px solid ${dirty ? COLORS.accent + "60" : COLORS.border}`, borderRadius: 14, overflow: "hidden", transition: "border-color 0.2s" }}>
      <div onClick={() => setExpanded(e => !e)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", cursor: "pointer", userSelect: "none" }}
        onMouseOver={e => e.currentTarget.style.background = `${COLORS.accent}08`}
        onMouseOut={e => e.currentTarget.style.background = "transparent"}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 18, width: 24, textAlign: "center" }}>🏷</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }}>Underlying Categories</div>
            <div style={{ fontSize: 11, color: COLORS.textMuted }}>Catégories disponibles pour les sous-jacents (ex: COMMODITY, FX)</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {localItems.map(i => (
              <span key={i.value} style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 5, background: COLORS.card, color: COLORS.text, border: `1px solid ${COLORS.border}` }}>{i.label}</span>
            ))}
          </div>
          {dirty && (
            <div onClick={e => { e.stopPropagation(); updateField("derivUnderlyingCategories", localItems); setDirty(false); }}
              style={{ background: `${COLORS.green}20`, color: COLORS.green, border: `1px solid ${COLORS.green}40`, padding: "4px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
              ✓ Sauvegarder
            </div>
          )}
          <span style={{ color: COLORS.textMuted, fontSize: 14, transition: "transform 0.2s", display: "inline-block", transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
        </div>
      </div>
      {expanded && (
        <div style={{ padding: "14px 18px", borderTop: `1px solid ${COLORS.border}` }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
            {localItems.length === 0 && <div style={{ textAlign: "center", color: COLORS.textMuted, fontSize: 13, padding: "16px 0" }}>Aucune catégorie — ajoutez-en ci-dessous</div>}
            {localItems.map((item, idx) => (
              <div key={idx} style={{ display: "flex", alignItems: "center", gap: 8, background: COLORS.card, borderRadius: 10, padding: "8px 12px", border: `1px solid ${COLORS.border}` }}>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: COLORS.text, fontFamily: "'DM Mono', monospace" }}>{item.label}</span>
                <span style={{ fontSize: 11, color: COLORS.textMuted, fontFamily: "'DM Mono', monospace" }}>{item.value}</span>
                <button onClick={() => removeItem(idx)} style={{ background: "none", border: "none", color: COLORS.textMuted, cursor: "pointer", fontSize: 18, lineHeight: 1 }}
                  onMouseOver={e => e.currentTarget.style.color = COLORS.red}
                  onMouseOut={e => e.currentTarget.style.color = COLORS.textMuted}>×</button>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end", background: `${COLORS.accent}08`, border: `1px dashed ${COLORS.accent}40`, borderRadius: 10, padding: "12px 14px" }}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 10, color: COLORS.textSub, fontWeight: 600 }}>LABEL *</label>
              <input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="ex: COMMODITY" onKeyDown={e => e.key === "Enter" && addItem()}
                style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "8px 12px", color: COLORS.text, fontSize: 13, outline: "none", fontFamily: "inherit" }} />
            </div>
            <Btn onClick={addItem} disabled={!newLabel.trim()} style={{ padding: "8px 14px", fontSize: 13, flexShrink: 0 }}>+ Ajouter</Btn>
          </div>
        </div>
      )}
    </div>
  );
};

const UnderlyingEditor = ({ config, updateField }) => {
  const items = config.derivCommodities || [];
  const [newLabel, setNewLabel] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [dirty, setDirty] = useState(false);
  const [localItems, setLocalItems] = useState(items);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => { setLocalItems(items); setDirty(false); }, [config.derivCommodities]);

  const markDirty = (updated) => { setLocalItems(updated); setDirty(true); };

  const addItem = () => {
    if (!newLabel.trim() || !newCategory) return;
    markDirty([...localItems, { value: newLabel.toLowerCase().replace(/\s+/g, "_"), label: newLabel.trim(), underlyingCategory: newCategory }]);
    setNewLabel(""); setNewCategory("");
  };

  const removeItem = (idx) => markDirty(localItems.filter((_, i) => i !== idx));
  const updateItem = (idx, key, val) => markDirty(localItems.map((item, i) => i === idx ? { ...item, [key]: val } : item));
  const moveUp = (idx) => { if (idx === 0) return; const a = [...localItems]; [a[idx-1], a[idx]] = [a[idx], a[idx-1]]; markDirty(a); };
  const moveDown = (idx) => { if (idx === localItems.length-1) return; const a = [...localItems]; [a[idx], a[idx+1]] = [a[idx+1], a[idx]]; markDirty(a); };

  const CAT_COLORS = { commodity: COLORS.green, fx: COLORS.gold };
  const CAT_LABELS = { commodity: "COMMODITY", fx: "FX" };

  return (
    <div style={{ background: COLORS.bg, border: `1px solid ${dirty ? COLORS.accent + "60" : COLORS.border}`, borderRadius: 14, marginBottom: 0, overflow: "hidden", transition: "border-color 0.2s" }}>
      <div onClick={() => setExpanded(!expanded)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", cursor: "pointer", userSelect: "none" }}
        onMouseOver={e => e.currentTarget.style.background = `${COLORS.accent}08`}
        onMouseOut={e => e.currentTarget.style.background = "transparent"}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 18, width: 24, textAlign: "center" }}>🌽</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }}>Underlying</div>
            <div style={{ fontSize: 11, color: COLORS.textMuted }}>Sous-jacents disponibles avec leur catégorie (Commodity / FX)</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end", maxWidth: 500 }}>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {localItems.map(s => (
              <span key={s.value} style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 5, background: COLORS.card, color: COLORS.text, border: `1px solid ${COLORS.border}` }}>
                {s.label}
              </span>
            ))}
          </div>
          {dirty && (
            <div onClick={e => { e.stopPropagation(); updateField("derivCommodities", localItems); setDirty(false); }}
              style={{ background: `${COLORS.green}20`, color: COLORS.green, border: `1px solid ${COLORS.green}40`, padding: "4px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
              ✓ Sauvegarder
            </div>
          )}
          <span style={{ color: COLORS.textMuted, fontSize: 14, transition: "transform 0.2s", display: "inline-block", transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
        </div>
      </div>

      {expanded && (
      <div style={{ padding: "14px 18px", borderTop: `1px solid ${COLORS.border}` }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
          {localItems.length === 0 && <div style={{ textAlign: "center", color: COLORS.textMuted, fontSize: 13, padding: "16px 0" }}>Aucune valeur — ajoutez-en ci-dessous</div>}
          {localItems.map((item, idx) => (
            <div key={idx} style={{ display: "flex", alignItems: "center", gap: 8, background: COLORS.card, borderRadius: 10, padding: "8px 12px", border: `1px solid ${COLORS.border}` }}>
              <input value={item.label} onChange={e => updateItem(idx, "label", e.target.value)}
                style={{ flex: 1, background: "transparent", border: "none", color: COLORS.text, fontSize: 13, fontFamily: "inherit", outline: "none" }} />
              <select value={item.underlyingCategory || ""} onChange={e => updateItem(idx, "underlyingCategory", e.target.value)}
                style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "4px 8px", color: item.underlyingCategory ? (CAT_COLORS[item.underlyingCategory] || COLORS.text) : COLORS.textMuted, fontSize: 12, fontWeight: 600, outline: "none", fontFamily: "inherit" }}>
                <option value="">— Catégorie —</option>
                {(config.derivUnderlyingCategories || [{ value: "commodity", label: "COMMODITY" }, { value: "fx", label: "FX" }]).map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
              {item.underlyingCategory && <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 5, fontWeight: 700, background: `${CAT_COLORS[item.underlyingCategory]}18`, color: CAT_COLORS[item.underlyingCategory] }}>{CAT_LABELS[item.underlyingCategory]}</span>}
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <button onClick={() => moveUp(idx)} style={{ background: "none", border: "none", color: COLORS.textMuted, cursor: "pointer", fontSize: 9, padding: "1px 3px", lineHeight: 1 }}>▲</button>
                <button onClick={() => moveDown(idx)} style={{ background: "none", border: "none", color: COLORS.textMuted, cursor: "pointer", fontSize: 9, padding: "1px 3px", lineHeight: 1 }}>▼</button>
              </div>
              <button onClick={() => removeItem(idx)} style={{ background: "none", border: "none", color: COLORS.textMuted, cursor: "pointer", fontSize: 18, lineHeight: 1 }}
                onMouseOver={e => e.currentTarget.style.color = COLORS.red}
                onMouseOut={e => e.currentTarget.style.color = COLORS.textMuted}>×</button>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "flex-end", background: `${COLORS.accent}08`, border: `1px dashed ${COLORS.accent}40`, borderRadius: 10, padding: "12px 14px" }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 10, color: COLORS.textSub, fontWeight: 600 }}>LABEL *</label>
            <input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="ex: Wheat" onKeyDown={e => e.key === "Enter" && addItem()}
              style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "8px 12px", color: COLORS.text, fontSize: 13, outline: "none", fontFamily: "inherit" }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 10, color: COLORS.textSub, fontWeight: 600 }}>UNDERLYING CATEGORY *</label>
            <select value={newCategory} onChange={e => setNewCategory(e.target.value)}
              style={{ background: COLORS.bg, border: `1px solid ${!newCategory && newLabel ? COLORS.red + "60" : COLORS.border}`, borderRadius: 8, padding: "8px 12px", color: newCategory ? COLORS.text : COLORS.textMuted, fontSize: 13, outline: "none", fontFamily: "inherit" }}>
              <option value="">— Sélectionner —</option>
              {(config.derivUnderlyingCategories || [{ value: "commodity", label: "COMMODITY" }, { value: "fx", label: "FX" }]).map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <Btn onClick={addItem} disabled={!newLabel.trim() || !newCategory} style={{ padding: "8px 14px", fontSize: 13, flexShrink: 0 }}>+ Ajouter</Btn>
        </div>
      </div>
      )}
    </div>
  );
};

// ─── DERIV PRODUCT EDITOR ─────────────────────────────────────
// ─── DERIV PRODUCT IMPORT MODAL ──────────────────────────────
const DERIV_PRODUCT_FIELD_MAP = {
  "label":              ["label", "nom", "name", "product"],
  "stoxxExchange":      ["stoxx exchange", "stoxxexchange", "exchange", "bourse"],
  "instrumentType":     ["instrument type", "instrumenttype", "type instrument", "type"],
  "underlyingCategory": ["underlying category", "underlyingcategory", "catégorie", "categorie", "category"],
  "underlying":         ["underlying", "sous jacent", "commodity", "produit", "sousjacent"],
  "underlyingOrigin":   ["underlying origin", "underlyingorigin", "origine", "origin", "pays origine"],
  "volumeSizePerLot":   ["volume size per lot", "volumesizeperlot", "lot size", "lotsize", "taille lot", "volume lot"],
  "volumeUnit":         ["volume unit", "volumeunit", "unité volume", "unite volume", "unit"],
  "currency":           ["currency", "devise", "monnaie"],
  "decimals":           ["decimals", "décimales", "format cotation"],
  "firstNoticeDay":     ["first notice day", "firstnoticeday", "fnd", "premier préavis"],
  "lastTradingDate":    ["last trading date", "lasttradingdate", "ltd", "dernier jour négociation"],
  "expiryDate":         ["expiry date", "expirydate", "expiration", "échéance"],
  "active":             ["active", "is active", "isactive", "actif"],
};

const normalizeHeaderDP = (h) => h?.toString().toLowerCase().trim()
  .replace(/([a-z])([A-Z])/g, '$1 $2') // camelCase → spaces before normalizing
  .toLowerCase()
  .replace(/[_\-]/g, " ")
  .replace(/\s+/g, " ")
  .trim() || "";

const guessFieldDP = (header) => {
  const norm = normalizeHeaderDP(header);
  const normCompact = norm.replace(/\s/g, ""); // also compare without spaces
  for (const [field, aliases] of Object.entries(DERIV_PRODUCT_FIELD_MAP)) {
    if (aliases.some(a => {
      const ac = a.replace(/\s/g, "");
      return norm === a || normCompact === ac;
    })) return field;
  }
  return null;
};

const DerivProductImportModal = ({ onClose, onImport, config }) => {
  const [step, setStep] = useState("guide");
  const [rawRows, setRawRows] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [mapping, setMapping] = useState({});
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState(null);
  const fileRef = useRef();

  const GUIDE_FIELDS = [
    { field: "label",              format: "Texte",          required: true,  note: "ex: Wheat Futures Dec24" },
    { field: "stoxxExchange",      format: "Texte",          required: true,  note: "Valeur de la liste Exchanges (ex: euronext, cme)" },
    { field: "instrumentType",     format: "Texte",          required: true,  note: "ex: Future, Option" },
    { field: "underlyingCategory", format: "commodity / fx", required: true,  note: "" },
    { field: "underlying",         format: "Texte",          required: true,  note: "Valeur de la liste Underlying (ex: wheat, corn)" },
    { field: "underlyingOrigin",   format: "Texte",          required: true,  note: "ex: FRANCE, UKRAINE" },
    { field: "volumeSizePerLot",   format: "Nombre",         required: true,  note: "ex: 50, 100" },
    { field: "volumeUnit",         format: "Texte",          required: true,  note: "ex: mt, bu, lot" },
    { field: "currency",           format: "Texte",          required: true,  note: "ex: EUR, USD" },
    { field: "decimals",           format: "Texte",          required: false, note: "decimal / 1/2 / 1/4 / 1/8… (défaut: decimal)" },
    { field: "firstNoticeDay",     format: "JJ/MM/AAAA",     required: false, note: "" },
    { field: "lastTradingDate",    format: "JJ/MM/AAAA",     required: true,  note: "" },
    { field: "expiryDate",         format: "JJ/MM/AAAA",     required: false, note: "Options uniquement" },
    { field: "active",             format: "TRUE / FALSE",   required: false, note: "Défaut : TRUE" },
  ];

  const parseDate = (val) => {
    if (!val) return "";
    const s = val.toString().trim();
    const m1 = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (m1) return `${m1[3]}-${m1[2].padStart(2,"0")}-${m1[1].padStart(2,"0")}`;
    if (/^\d{5}$/.test(s)) {
      const d = new Date(Math.round((parseInt(s) - 25569) * 86400 * 1000));
      return d.toISOString().split("T")[0];
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    return s;
  };

  const resolveConfigValue = (configKey, val) => {
    if (!val) return val;
    const norm = v => v?.toString().toLowerCase().trim().replace(/[_\s-]/g, "");
    const normVal = norm(val);
    const list = config[configKey] || [];
    const match = list.find(i => norm(i.value) === normVal || norm(i.label) === normVal);
    return match ? match.value : val.toLowerCase().replace(/\s+/g, "_");
  };

  const handleFile = async (file) => {
    setError("");
    try {
      const XLSX = await import("xlsx");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
      if (!json.length) { setError("Le fichier est vide."); return; }
      const hdrs = json[0].map(h => h?.toString() || "");
      const rows = json.slice(1).filter(r => r.some(c => c !== ""));
      setHeaders(hdrs);
      setRawRows(rows);
      const autoMap = {};
      hdrs.forEach((h, i) => { const g = guessFieldDP(h); if (g && !Object.values(autoMap).includes(g)) autoMap[i] = g; });
      setMapping(autoMap);
      setStep("mapping");
    } catch { setError("Erreur de lecture du fichier."); }
  };

  const doImport = () => {
    setImporting(true);
    const errors = [];
    const valid = [];

    rawRows.forEach((row, i) => {
      const obj = { id: Date.now() + i };
      Object.entries(mapping).forEach(([ci, f]) => { if (f) obj[f] = row[ci]?.toString().trim() || ""; });

      if (obj.stoxxExchange) obj.stoxxExchange = resolveConfigValue("derivExchanges", obj.stoxxExchange);
      if (obj.underlyingCategory) obj.underlyingCategory = obj.underlyingCategory.toLowerCase().trim();
      if (obj.underlying) obj.underlying = resolveConfigValue("derivCommodities", obj.underlying);
      if (obj.volumeUnit) obj.volumeUnit = resolveConfigValue("derivVolumeUnits", obj.volumeUnit);
      if (obj.currency) obj.currency = resolveConfigValue("derivCurrencies", obj.currency);
      if (obj.instrumentType) {
        const match = (config.derivInstrumentTypes || []).find(t =>
          t.label?.toLowerCase() === obj.instrumentType.toLowerCase() ||
          t.value?.toLowerCase() === obj.instrumentType.toLowerCase()
        );
        obj.instrumentType = match ? match.label : obj.instrumentType;
      }
      if (obj.decimals) {
        const match = (config.derivDecimals || []).find(d => d.value === obj.decimals || d.label === obj.decimals);
        obj.decimals = match ? match.value : "decimal";
      } else { obj.decimals = "decimal"; }

      obj.firstNoticeDay = parseDate(obj.firstNoticeDay);
      obj.lastTradingDate = parseDate(obj.lastTradingDate);
      obj.expiryDate = parseDate(obj.expiryDate);
      if (obj.volumeSizePerLot) obj.volumeSizePerLot = String(obj.volumeSizePerLot).replace(/,/g, ".");
      // Normalize active: défaut true si absent
      if (obj.active !== undefined && obj.active !== "") {
        obj.active = String(obj.active).toLowerCase() !== "false" && obj.active !== "0";
      } else { obj.active = true; }

      const missing = [];
      if (!obj.label) missing.push("label");
      if (!obj.stoxxExchange) missing.push("stoxxExchange");
      if (!obj.instrumentType) missing.push("instrumentType");
      if (!obj.underlyingCategory) missing.push("underlyingCategory");
      if (!obj.underlying) missing.push("underlying");
      if (!obj.underlyingOrigin) missing.push("underlyingOrigin");
      if (!obj.volumeSizePerLot) missing.push("volumeSizePerLot");
      if (!obj.lastTradingDate) missing.push("lastTradingDate");
      if (obj.instrumentType?.toLowerCase() === "option" && !obj.expiryDate) missing.push("expiryDate");

      if (missing.length > 0) {
        errors.push({ row: i + 2, label: obj.label || `Ligne ${i + 2}`, missing });
      } else {
        valid.push(obj);
      }
    });

    setResults({ valid, errors });
    setStep("summary");
    setImporting(false);
  };

  const confirmImport = () => {
    if (results?.valid?.length > 0) onImport(results.valid);
    onClose();
  };

  const allFields = Object.keys(DERIV_PRODUCT_FIELD_MAP);

  return (
    <div style={{ position: "fixed", inset: 0, background: "#00000090", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100, padding: 20 }}>
      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 18, padding: 30, width: "100%", maxWidth: 720, maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, color: COLORS.text }}>Import Excel — Instruments</h2>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: COLORS.textSub }}>Formats acceptés : .xlsx, .xls, .csv</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: COLORS.textMuted, cursor: "pointer", fontSize: 22, lineHeight: 1 }}>×</button>
        </div>

        {step === "guide" && (
          <div>
            <div style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 12, overflow: "hidden", marginBottom: 20 }}>
              <div style={{ padding: "10px 16px", background: COLORS.tableHeader, display: "grid", gridTemplateColumns: "1.5fr 1fr 0.6fr 2fr", gap: 8 }}>
                {["Colonne", "Format", "Requis", "Note"].map(h => (
                  <div key={h} style={{ fontSize: 11, fontWeight: 700, color: COLORS.textMuted, letterSpacing: 1 }}>{h.toUpperCase()}</div>
                ))}
              </div>
              {GUIDE_FIELDS.map((f, i) => (
                <div key={f.field} style={{ padding: "9px 16px", display: "grid", gridTemplateColumns: "1.5fr 1fr 0.6fr 2fr", gap: 8, background: i % 2 === 0 ? "transparent" : `${COLORS.surface}80`, alignItems: "center" }}>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: COLORS.accent }}>{f.field}</div>
                  <div style={{ fontSize: 12, color: COLORS.textSub }}>{f.format}</div>
                  <div>
                    {f.required
                      ? <span style={{ fontSize: 10, fontWeight: 700, color: COLORS.red, background: `${COLORS.red}15`, padding: "2px 7px", borderRadius: 4 }}>OBL.</span>
                      : <span style={{ fontSize: 10, color: COLORS.textMuted, background: COLORS.bg, padding: "2px 7px", borderRadius: 4, border: `1px solid ${COLORS.border}` }}>OPT.</span>
                    }
                  </div>
                  <div style={{ fontSize: 11, color: COLORS.textMuted }}>{f.note}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }} onChange={e => { if (e.target.files[0]) handleFile(e.target.files[0]); }} />
              <Btn onClick={() => fileRef.current.click()}>📂 Choisir un fichier</Btn>
            </div>
            {error && <div style={{ marginTop: 12, fontSize: 13, color: COLORS.red, background: `${COLORS.red}10`, border: `1px solid ${COLORS.red}30`, borderRadius: 8, padding: "10px 14px" }}>⚠ {error}</div>}
          </div>
        )}

        {step === "mapping" && (
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.text, marginBottom: 12 }}>Mapper les colonnes Excel → champs instrument</div>
            <div style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 12, overflow: "hidden", marginBottom: 20 }}>
              <div style={{ padding: "10px 16px", background: COLORS.tableHeader, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {["Colonne Excel", "Champ instrument"].map(h => (
                  <div key={h} style={{ fontSize: 11, fontWeight: 700, color: COLORS.textMuted, letterSpacing: 1 }}>{h.toUpperCase()}</div>
                ))}
              </div>
              {headers.map((h, i) => (
                <div key={i} style={{ padding: "8px 16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, alignItems: "center", background: i % 2 === 0 ? "transparent" : `${COLORS.surface}80` }}>
                  <div style={{ fontSize: 13, color: COLORS.text, fontFamily: "'DM Mono', monospace" }}>{h}</div>
                  <select value={mapping[i] || ""} onChange={e => setMapping(prev => ({ ...prev, [i]: e.target.value || null }))}
                    style={{ background: COLORS.card, border: `1px solid ${mapping[i] ? COLORS.accent + "60" : COLORS.border}`, borderRadius: 8, padding: "6px 10px", color: mapping[i] ? COLORS.text : COLORS.textMuted, fontSize: 12, outline: "none", fontFamily: "inherit" }}>
                    <option value="">— Ignorer —</option>
                    {allFields.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Btn variant="secondary" onClick={() => setStep("guide")}>← Retour</Btn>
              <Btn onClick={doImport} style={{ background: COLORS.green }}>{importing ? "Import..." : `✓ Importer ${rawRows.length} lignes`}</Btn>
            </div>
          </div>
        )}

        {step === "summary" && results && (
          <div>
            <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
              <div style={{ flex: 1, background: `${COLORS.green}12`, border: `1px solid ${COLORS.green}30`, borderRadius: 12, padding: "16px 20px", textAlign: "center" }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: COLORS.green }}>{results.valid.length}</div>
                <div style={{ fontSize: 12, color: COLORS.textSub, marginTop: 4 }}>instrument{results.valid.length !== 1 ? "s" : ""} valide{results.valid.length !== 1 ? "s" : ""}</div>
              </div>
              <div style={{ flex: 1, background: results.errors.length > 0 ? `${COLORS.red}12` : `${COLORS.green}08`, border: `1px solid ${results.errors.length > 0 ? COLORS.red + "30" : COLORS.border}`, borderRadius: 12, padding: "16px 20px", textAlign: "center" }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: results.errors.length > 0 ? COLORS.red : COLORS.textMuted }}>{results.errors.length}</div>
                <div style={{ fontSize: 12, color: COLORS.textSub, marginTop: 4 }}>ligne{results.errors.length !== 1 ? "s" : ""} rejetée{results.errors.length !== 1 ? "s" : ""}</div>
              </div>
            </div>
            {results.errors.length > 0 && (
              <div style={{ background: COLORS.bg, border: `1px solid ${COLORS.red}30`, borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
                <div style={{ padding: "10px 16px", background: `${COLORS.red}10`, fontSize: 12, fontWeight: 700, color: COLORS.red }}>LIGNES REJETÉES — champs obligatoires manquants</div>
                {results.errors.map((e, i) => (
                  <div key={i} style={{ padding: "8px 16px", borderTop: `1px solid ${COLORS.border}`, display: "flex", gap: 12, alignItems: "center" }}>
                    <span style={{ fontSize: 11, color: COLORS.textMuted, fontFamily: "'DM Mono', monospace", flexShrink: 0 }}>Ligne {e.row}</span>
                    <span style={{ fontSize: 13, color: COLORS.text, flex: 1 }}>{e.label}</span>
                    <span style={{ fontSize: 11, color: COLORS.red }}>{e.missing.join(", ")}</span>
                  </div>
                ))}
              </div>
            )}
            {results.valid.length > 0 && (
              <div style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 12, overflow: "hidden", marginBottom: 20 }}>
                <div style={{ padding: "10px 16px", background: COLORS.tableHeader, fontSize: 12, fontWeight: 700, color: COLORS.textSub }}>APERÇU DES INSTRUMENTS VALIDES</div>
                {results.valid.slice(0, 5).map((p, i) => (
                  <div key={i} style={{ padding: "10px 16px", borderTop: `1px solid ${COLORS.border}`, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.text, minWidth: 180 }}>{p.label}</span>
                    <span style={{ fontSize: 11, color: COLORS.blue, background: `${COLORS.blue}15`, padding: "2px 8px", borderRadius: 5 }}>{p.stoxxExchange}</span>
                    <span style={{ fontSize: 11, color: COLORS.green, background: `${COLORS.green}15`, padding: "2px 8px", borderRadius: 5 }}>{p.instrumentType}</span>
                    <span style={{ fontSize: 11, color: COLORS.textSub }}>{p.underlying} · {p.underlyingOrigin}</span>
                    <span style={{ fontSize: 11, color: COLORS.gold, fontFamily: "'DM Mono', monospace" }}>×{p.volumeSizePerLot} {p.volumeUnit}</span>
                  </div>
                ))}
                {results.valid.length > 5 && (
                  <div style={{ padding: "8px 16px", borderTop: `1px solid ${COLORS.border}`, fontSize: 12, color: COLORS.textMuted }}>
                    + {results.valid.length - 5} autre{results.valid.length - 5 > 1 ? "s" : ""} instrument{results.valid.length - 5 > 1 ? "s" : ""}…
                  </div>
                )}
              </div>
            )}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Btn variant="secondary" onClick={() => setStep("mapping")}>← Modifier le mapping</Btn>
              {results.valid.length > 0
                ? <Btn onClick={confirmImport} style={{ background: COLORS.green }}>✓ Confirmer l'import ({results.valid.length})</Btn>
                : <Btn variant="secondary" onClick={onClose}>Fermer</Btn>
              }
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const EMPTY_PROD = { label: "", stoxxExchange: "", instrumentType: "", underlyingCategory: "", underlying: "", underlyingOrigin: "", volumeSizePerLot: "", volumeUnit: "", currency: "EUR", decimals: "decimal", tickSize: "", expiryDate: "", firstNoticeDay: "", lastTradingDate: "", quotationUnit: "" };

const DerivFormField = ({ label, field, type = "text", placeholder, form, setForm }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
    <label style={{ fontSize: 11, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5 }}>{label.toUpperCase()} <span style={{ color: COLORS.red }}>*</span></label>
    <input type={type} value={form[field]} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))} placeholder={placeholder}
      style={{ background: COLORS.card, border: `1px solid ${!String(form[field]).trim() ? COLORS.red + "55" : COLORS.border}`, borderRadius: 8, padding: "9px 12px", color: COLORS.text, fontSize: 13, outline: "none", fontFamily: "inherit" }}
      onFocus={e => e.target.style.borderColor = COLORS.blue}
      onBlur={e => e.target.style.borderColor = !String(form[field]).trim() ? COLORS.red + "55" : COLORS.border} />
  </div>
);

const DerivSelectField = ({ label, field, options, form, setForm }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
    <label style={{ fontSize: 11, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5 }}>{label.toUpperCase()} <span style={{ color: COLORS.red }}>*</span></label>
    <select value={form[field]} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
      style={{ background: COLORS.card, border: `1px solid ${!form[field] ? COLORS.red + "55" : COLORS.border}`, borderRadius: 8, padding: "9px 12px", color: form[field] ? COLORS.text : COLORS.textMuted, fontSize: 13, outline: "none", fontFamily: "inherit" }}>
      <option value="">— Sélectionner —</option>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
);

const DerivProductEditor = ({ config }) => {
  const [products, setProducts] = useState([]);
  const [lotSizes, setLotSizes] = useState([]);
  const [quotationUnits, setQuotationUnits] = useState([]);

useEffect(() => {
  async function loadProducts() {
    const { data } = await supabase.from('deriv_products').select('data');
    if (data?.length) setProducts(data.map(r => r.data));
  }
  loadProducts();
}, []);

useEffect(() => {
  async function loadLotSizes() {
    const { data } = await supabase.from('deriv_lot_sizes').select('data');
    if (data?.length) setLotSizes(data.map(r => r.data));
  }
  loadLotSizes();
}, []);

useEffect(() => {
  async function loadQuotationUnits() {
    const { data } = await supabase.from('deriv_quotation_units').select('data');
    if (data?.length) setQuotationUnits(data.map(r => r.data));
  }
  loadQuotationUnits();
}, []);
  const { config: cfg } = useConfig();
  const [form, setForm] = useState(EMPTY_PROD);
  const [instrumentType, setInstrumentType] = useState("");
  const [editId, setEditId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [prodSearch, setProdSearch] = useState("");
  const [filterUnderlying, setFilterUnderlying] = useState("");
  const [filterYear, setFilterYear] = useState("");

  const isValid = () => form.label.trim() !== "" && form.stoxxExchange !== "" && form.instrumentType !== "" && form.underlyingCategory !== "" && form.underlying !== "" && form.underlyingOrigin !== "" && String(form.volumeSizePerLot).trim() !== "" && form.volumeUnit !== "" && form.currency !== "" && form.lastTradingDate !== "" && (form.instrumentType?.toLowerCase() !== "option" || form.expiryDate !== "");

  const save = async () => {
    if (!isValid()) return;
    // Compute quotationUnit at save time
    const quMatch = (form.underlying && form.stoxxExchange)
      ? quotationUnits.find(q => q.underlying === form.underlying && q.exchange === form.stoxxExchange)
      : null;
    const enriched = { ...form, quotationUnit: quMatch?.quotationUnit || form.quotationUnit || "" };
    const updated = editId ? products.map(p => p.id === editId ? { ...enriched, id: editId } : p) : [...products, { ...enriched, id: Date.now() }];
    setProducts(updated);
    await saveProducts(updated, setProducts, products);
    setForm(EMPTY_PROD); setInstrumentType(""); setEditId(null); setShowForm(false);
  };

  // Migrate existing products when quotationUnits or decimals config are loaded
  useEffect(() => {
    if (!products.length) return;
    const normM = v => (v || '').toLowerCase().trim().replace(/_/g, " ");
    const decRules = (config.derivDecimals || []).filter(d => d.exchange !== undefined || d.underlying !== undefined);
    const needsMigration = products.some(p => {
      const quMatch = quotationUnits.find(q => normM(q.underlying) === normM(p.underlying) && normM(q.exchange) === normM(p.stoxxExchange));
      // Only auto-apply decimals if product has no decimals set or is still at default
      const hasManualDecimals = p.decimals && p.decimals !== "decimal";
      const decMatch = !hasManualDecimals ? decRules.find(d => normM(d.underlying) === normM(p.underlying) && normM(d.exchange) === normM(p.stoxxExchange)) : null;
      return (quMatch && p.quotationUnit !== quMatch.quotationUnit) ||
             (decMatch && (p.decimals !== decMatch.displayFormat || p.tickSize !== (decMatch.tickSize || "")));
    });
    if (!needsMigration) return;
    const updated = products.map(p => {
      const quMatch = quotationUnits.find(q => normM(q.underlying) === normM(p.underlying) && normM(q.exchange) === normM(p.stoxxExchange));
      const hasManualDecimals = p.decimals && p.decimals !== "decimal";
      const decMatch = !hasManualDecimals ? decRules.find(d => normM(d.underlying) === normM(p.underlying) && normM(d.exchange) === normM(p.stoxxExchange)) : null;
      return {
        ...p,
        ...(quMatch ? { quotationUnit: quMatch.quotationUnit } : {}),
        ...(decMatch ? { decimals: decMatch.displayFormat, tickSize: decMatch.tickSize || "" } : {}),
      };
    });
    setProducts(updated);
    saveProducts(updated, setProducts, products);
  }, [quotationUnits, products.length, config.derivDecimals]);

  const remove = async (id) => { const u = products.filter(p => p.id !== id); setProducts(u); await saveProducts(u, setProducts, products); };

  return (
    <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, overflow: "hidden" }}>
      <div onClick={() => setExpanded(!expanded)} style={{ padding: "18px 24px", borderBottom: expanded ? `1px solid ${COLORS.border}` : "none", display: "flex", alignItems: "center", gap: 14, background: `${COLORS.blue}08`, cursor: "pointer", userSelect: "none" }}
        onMouseOver={e => e.currentTarget.style.background = `${COLORS.blue}14`}
        onMouseOut={e => e.currentTarget.style.background = `${COLORS.blue}08`}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: COLORS.hover, border: `1px solid ${COLORS.blue}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🌾</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.text }}>Instruments</div>
          <div style={{ fontSize: 12, color: COLORS.textSub }}>Instruments dérivés disponibles (futures, options…)</div>
        </div>
        <span style={{ fontSize: 11, color: COLORS.textMuted, background: COLORS.bg, padding: "3px 10px", borderRadius: 6, border: `1px solid ${COLORS.border}`, marginRight: 8 }}>
          {products.filter(p => p.active !== false).length} actif{products.filter(p => p.active !== false).length !== 1 ? "s" : ""}
          {products.filter(p => p.active === false).length > 0 && <span style={{ color: COLORS.textMuted }}> · {products.filter(p => p.active === false).length} inactif{products.filter(p => p.active === false).length !== 1 ? "s" : ""}</span>}
        </span>
        <div onClick={e => { e.stopPropagation(); setShowImport(true); if (!expanded) setExpanded(true); }} style={{ cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: "7px 12px", borderRadius: 8, border: `1px solid ${COLORS.border}`, background: "transparent", marginRight: 4 }} title="Importer depuis Excel"><img src="/logoxl.png" style={{ width: 22, height: 22, objectFit: "contain" }} /></div>
        <Btn onClick={e => { e.stopPropagation(); setForm(EMPTY_PROD); setInstrumentType(""); setEditId(null); setShowForm(true); if (!expanded) setExpanded(true); }} style={{ padding: "7px 14px", fontSize: 13 }}>+ Ajouter</Btn>
        <span style={{ color: COLORS.textMuted, fontSize: 14, transition: "transform 0.2s", display: "inline-block", transform: expanded ? "rotate(180deg)" : "rotate(0deg)", marginLeft: 4 }}>▾</span>
      </div>

      {expanded && <div style={{ padding: "20px 24px" }}>
        {showForm && (
          <div style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 18, marginBottom: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <DerivFormField label="Label" field="label" placeholder="ex: Wheat Futures Dec24" form={form} setForm={setForm} />
              <DerivSelectField label="Stoxx Exchange" field="stoxxExchange" options={(config.derivExchanges || []).map(e => ({ value: e.value, label: e.label }))} form={form} setForm={setForm} />
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <label style={{ fontSize: 11, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5 }}>INSTRUMENT TYPE <span style={{ color: COLORS.red }}>*</span></label>
                <select value={instrumentType} onChange={e => { const v = e.target.value; setInstrumentType(v); setForm(f => ({ ...f, instrumentType: v, expiryDate: "" })); }}
                  style={{ background: COLORS.card, border: `1px solid ${!form.instrumentType ? COLORS.red + "55" : COLORS.border}`, borderRadius: 8, padding: "9px 12px", color: form.instrumentType ? COLORS.text : COLORS.textMuted, fontSize: 13, outline: "none", fontFamily: "inherit" }}>
                  <option value="">— Sélectionner —</option>
                  {(config.derivInstrumentTypes || []).map(t => <option key={t.label} value={t.label}>{t.label}</option>)}
                </select>
              </div>
              <DerivSelectField label="Underlying Category" field="underlyingCategory" options={(config.derivUnderlyingCategories || [{ value: "commodity", label: "COMMODITY" }, { value: "fx", label: "FX" }]).map(c => ({ value: c.value, label: c.label }))} form={form} setForm={setForm} />
              <DerivSelectField label="Underlying" field="underlying" options={(config.derivCommodities || []).map(c => ({ value: c.value, label: c.label }))} form={form} setForm={setForm} />
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <label style={{ fontSize: 11, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5 }}>UNDERLYING ORIGIN <span style={{ color: COLORS.red }}>*</span></label>
                <select value={form.underlyingOrigin || ""} onChange={e => setForm(f => ({ ...f, underlyingOrigin: e.target.value }))}
                  style={{ background: COLORS.card, border: `1px solid ${!form.underlyingOrigin ? COLORS.red + "55" : COLORS.border}`, borderRadius: 8, padding: "9px 12px", color: form.underlyingOrigin ? COLORS.text : COLORS.textMuted, fontSize: 13, outline: "none", fontFamily: "inherit" }}>
                  <option value="">— Sélectionner —</option>
                  {(config.derivUnderlyingOrigins || []).map(v => {
                    const country = (config.country || []).find(c => c.value === v);
                    return <option key={v} value={v}>{country ? country.label : v}</option>;
                  })}
                </select>
              </div>
              {/* Volume Size Per Lot — auto depuis Lot Sizes (exchange + underlying) */}
              {(() => {
                const match = (form.stoxxExchange && form.underlying)
                  ? lotSizes.find(l =>
                      l.exchange === form.stoxxExchange &&
                      l.instrument === form.underlying
                    )
                  : null;
                const autoQty = match?.quantity || "";
                const autoUnit = match?.volumeUnit || "";
                if (autoQty && form.volumeSizePerLot !== String(autoQty)) setTimeout(() => setForm(f => ({ ...f, volumeSizePerLot: String(autoQty), volumeUnit: autoUnit })), 0);
                if (!autoQty && (form.volumeSizePerLot || form.volumeUnit)) setTimeout(() => setForm(f => ({ ...f, volumeSizePerLot: "", volumeUnit: "" })), 0);
                const unitLabel = (config.derivVolumeUnits || []).find(u => u.value === autoUnit)?.label || autoUnit;
                return (
                  <>
                    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                      <label style={{ fontSize: 11, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5 }}>VOLUME SIZE PER LOT</label>
                      <input value={autoQty || form.volumeSizePerLot || ""} readOnly
                        style={{ background: autoQty ? `${COLORS.green}10` : COLORS.bg, border: `1px solid ${autoQty ? COLORS.green + "50" : COLORS.border}`, borderRadius: 8, padding: "9px 12px", color: autoQty ? COLORS.green : COLORS.textMuted, fontSize: 13, fontFamily: "'DM Mono', monospace", outline: "none", fontWeight: autoQty ? 700 : 400 }} />
                      {!autoQty && <span style={{ fontSize: 10, color: COLORS.textMuted }}>Définir un Lot Size pour cet exchange</span>}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                      <label style={{ fontSize: 11, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5 }}>VOLUME UNIT</label>
                      <input value={unitLabel || form.volumeUnit || ""} readOnly
                        style={{ background: autoUnit ? `${COLORS.green}10` : COLORS.bg, border: `1px solid ${autoUnit ? COLORS.green + "50" : COLORS.border}`, borderRadius: 8, padding: "9px 12px", color: autoUnit ? COLORS.green : COLORS.textMuted, fontSize: 13, fontFamily: "inherit", outline: "none", fontWeight: autoUnit ? 700 : 400 }} />
                      {!autoUnit && <span style={{ fontSize: 10, color: COLORS.textMuted }}>Définir un Lot Size pour cet exchange</span>}
                    </div>
                  </>
                );
              })()}
              {/* Quotation Unit — auto depuis Quotation Units (underlying + exchange) */}
              {(() => {
                const quMatch = (form.underlying && form.stoxxExchange)
                  ? quotationUnits.find(q => q.underlying === form.underlying && q.exchange === form.stoxxExchange)
                  : null;
                const autoQU = quMatch?.quotationUnit || "";
                if (autoQU && form.quotationUnit !== autoQU) setTimeout(() => setForm(f => ({ ...f, quotationUnit: autoQU })), 0);
                if (!autoQU && form.quotationUnit) setTimeout(() => setForm(f => ({ ...f, quotationUnit: "" })), 0);
                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    <label style={{ fontSize: 11, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5 }}>QUOTATION UNIT</label>
                    <input value={autoQU || form.quotationUnit || ""} readOnly
                      style={{ background: autoQU ? `${COLORS.gold}10` : COLORS.bg, border: `1px solid ${autoQU ? COLORS.gold + "50" : COLORS.border}`, borderRadius: 8, padding: "9px 12px", color: autoQU ? COLORS.gold : COLORS.textMuted, fontSize: 13, fontFamily: "'DM Mono', monospace", outline: "none", fontWeight: autoQU ? 700 : 400 }} />
                    {!autoQU && <span style={{ fontSize: 10, color: COLORS.textMuted }}>Définir une Quotation Unit pour cet underlying/exchange</span>}
                  </div>
                );
              })()}
              <DerivSelectField label="Currency" field="currency" options={(config.derivCurrencies || []).map(c => ({ value: c.value, label: c.label }))} form={form} setForm={setForm} />
              {/* Decimals — auto depuis Decimal Rules (exchange + underlying) */}
              {(() => {
                const normD = v => (v || '').toLowerCase().trim();
                const decRules = (config.derivDecimals || []).filter(d => d.exchange !== undefined || d.underlying !== undefined);
                const autoRule = (form.underlying && form.stoxxExchange)
                  ? decRules.find(d => normD(d.underlying) === normD(form.underlying) && normD(d.exchange) === normD(form.stoxxExchange))
                  : null;
                const autoFormat = autoRule?.displayFormat || "";
                const autoTick = autoRule?.tickSize || "";
                // Auto-update form if rule changed
                if (autoFormat && form.decimals !== autoFormat) setTimeout(() => setForm(f => ({ ...f, decimals: autoFormat, tickSize: autoTick })), 0);
                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    <label style={{ fontSize: 11, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5 }}>DECIMALS</label>
                    <div style={{ display: "flex", gap: 6 }}>
                      <div style={{ flex: 1, background: autoFormat ? `${COLORS.gold}10` : COLORS.card, border: `1px solid ${autoFormat ? COLORS.gold + "50" : COLORS.border}`, borderRadius: 8, padding: "9px 12px", color: autoFormat ? COLORS.gold : COLORS.textMuted, fontSize: 13, fontFamily: "'DM Mono', monospace", fontWeight: autoFormat ? 700 : 400 }}>
                        {autoFormat || form.decimals || "decimal"}
                        {autoFormat && <span style={{ fontSize: 10, color: COLORS.textMuted, marginLeft: 8, fontWeight: 400 }}>auto</span>}
                      </div>
                      {(autoTick || form.tickSize) && (
                        <div style={{ background: `${COLORS.blue}10`, border: `1px solid ${COLORS.blue}40`, borderRadius: 8, padding: "9px 12px", color: COLORS.blue, fontSize: 12, fontFamily: "'DM Mono', monospace", fontWeight: 700, whiteSpace: "nowrap" }}>
                          tick: {autoTick || form.tickSize}
                        </div>
                      )}
                    </div>
                    {!autoFormat && (
                      <select value={form.decimals} onChange={e => setForm(f => ({ ...f, decimals: e.target.value }))}
                        style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "6px 10px", color: COLORS.text, fontSize: 12, outline: "none", fontFamily: "inherit" }}>
                        <option value="decimal">Décimal</option>
                        {(config.derivDecimals || []).filter(d => !d.exchange && !d.underlying).map(d => (
                          <option key={d.value || d.label} value={d.value || d.label}>{d.label}</option>
                        ))}
                      </select>
                    )}
                    {!autoFormat && <span style={{ fontSize: 10, color: COLORS.textMuted }}>Définir une règle Decimals pour cet exchange/underlying</span>}
                  </div>
                );
              })()}
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <label style={{ fontSize: 11, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5 }}>FIRST NOTICE DAY</label>
                <input type="date" value={form.firstNoticeDay} onChange={e => { const v = e.target.value; setForm(f => ({ ...f, firstNoticeDay: v })); }}
                  style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "9px 12px", color: form.firstNoticeDay ? COLORS.text : COLORS.textMuted, fontSize: 13, outline: "none", fontFamily: "inherit", colorScheme: "dark" }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <label style={{ fontSize: 11, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5 }}>LAST TRADING DATE <span style={{ color: COLORS.red }}>*</span></label>
                <input type="date" value={form.lastTradingDate} onChange={e => { const v = e.target.value; setForm(f => ({ ...f, lastTradingDate: v })); }}
                  style={{ background: COLORS.card, border: `1px solid ${!form.lastTradingDate ? COLORS.red + "55" : COLORS.border}`, borderRadius: 8, padding: "9px 12px", color: form.lastTradingDate ? COLORS.text : COLORS.textMuted, fontSize: 13, outline: "none", fontFamily: "inherit", colorScheme: "dark" }} />
              </div>
              {instrumentType.toLowerCase() === "option" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  <label style={{ fontSize: 11, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5 }}>EXPIRY DATE <span style={{ color: COLORS.red }}>*</span></label>
                  <input type="date" value={form.expiryDate} onChange={e => { const v = e.target.value; setForm(f => ({ ...f, expiryDate: v })); }}
                    style={{ background: COLORS.card, border: `1px solid ${!form.expiryDate ? COLORS.red + "55" : COLORS.border}`, borderRadius: 8, padding: "9px 12px", color: form.expiryDate ? COLORS.text : COLORS.textMuted, fontSize: 13, outline: "none", fontFamily: "inherit", colorScheme: "dark" }} />
                </div>
              )}
            </div>
            {instrumentType.toLowerCase() === "option" && (
              <div style={{ marginTop: 12 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 5, background: `${COLORS.purple}08`, border: `1px solid ${COLORS.purple}30`, borderRadius: 10, padding: "12px 14px" }}>
                  <label style={{ fontSize: 11, color: COLORS.purple, fontWeight: 700, letterSpacing: 0.5 }}>⏱ EXPIRY DATE <span style={{ color: COLORS.red }}>*</span></label>
                  <input type="date" value={form.expiryDate} onChange={e => { const v = e.target.value; setForm(f => ({ ...f, expiryDate: v })); }}
                    style={{ background: COLORS.card, border: `1px solid ${!form.expiryDate ? COLORS.red + "55" : COLORS.purple + "60"}`, borderRadius: 8, padding: "9px 12px", color: form.expiryDate ? COLORS.text : COLORS.textMuted, fontSize: 13, outline: "none", fontFamily: "inherit", colorScheme: "dark" }} />
                </div>
              </div>
            )}
            {!isValid() && (
              <div style={{ marginTop: 12, fontSize: 12, color: COLORS.red, background: `${COLORS.red}10`, border: `1px solid ${COLORS.red}30`, borderRadius: 8, padding: "8px 12px" }}>
                ⚠ Tous les champs sont obligatoires.
              </div>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 14, justifyContent: "flex-end" }}>
              <Btn variant="secondary" onClick={() => setShowForm(false)}>Annuler</Btn>
              <Btn onClick={save} disabled={!isValid()}>Enregistrer</Btn>
            </div>
          </div>
        )}

        {products.length === 0 && !showForm && (
          <div style={{ textAlign: "center", color: COLORS.textMuted, padding: 32, fontSize: 13 }}>Aucun instrument — cliquez sur "+ Ajouter" pour commencer</div>
        )}

        {products.length > 0 && (() => {
          // ── Underlyings & years for filters ──
          const validUnderlyings = new Set((config.derivCommodities || []).map(c => c.value));
          const allUnderlyings = [...new Set(products.map(p => p.underlying).filter(u => u && validUnderlyings.has(u)))].sort();
          const allYears = [...new Set(products.map(p => {
            const d = p.lastTradingDate || p.expiryDate || p.firstNoticeDay || "";
            return d ? d.slice(0, 4) : null;
          }).filter(Boolean))].sort().reverse();

          const hasFilters = prodSearch || filterUnderlying || filterYear;

          // ── Apply filters ──
          const applyFilters = (list) => list.filter(p => {
            const q = prodSearch.toLowerCase().trim();
            if (q && !p.label?.toLowerCase().includes(q) && !p.underlying?.toLowerCase().includes(q) && !p.stoxxExchange?.toLowerCase().includes(q)) return false;
            if (filterUnderlying && p.underlying !== filterUnderlying) return false;
            if (filterYear) {
              const yr = (p.lastTradingDate || p.expiryDate || p.firstNoticeDay || "").slice(0, 4);
              if (yr !== filterYear) return false;
            }
            return true;
          });

          const toggleActive = async (prod) => {
            const updated = products.map(p => p.id === prod.id ? { ...p, active: p.active === false ? true : false } : p);
            setProducts(updated);
            await saveProducts(updated, setProducts, products);
          };

          const chkExchanges   = new Set((config.derivExchanges || []).map(e => e.value));
          const chkInstTypes   = new Set((config.derivInstrumentTypes || []).map(t => t.label?.toLowerCase()));
          const chkUndCats     = new Set(["commodity", "fx"]);
          const chkUnderlyings = new Set((config.derivCommodities || []).map(c => c.value));
          const chkOrigins     = new Set((config.derivUnderlyingOrigins || []));
          const chkVolumeUnits = new Set((config.derivVolumeUnits || []).map(u => u.value));
          const chkCurrencies  = new Set((config.derivCurrencies || []).map(c => c.value));

          const isProdValid = (p) =>
            !!(p.label?.trim()) &&
            chkExchanges.has(p.stoxxExchange) &&
            chkInstTypes.has(p.instrumentType?.toLowerCase()) &&
            chkUndCats.has(p.underlyingCategory?.toLowerCase()) &&
            chkUnderlyings.has(p.underlying) &&
            chkOrigins.has(p.underlyingOrigin) &&
            !!(String(p.volumeSizePerLot ?? "").trim()) &&
            chkVolumeUnits.has(p.volumeUnit) &&
            chkCurrencies.has(p.currency) &&
            !!(p.lastTradingDate) &&
            (p.instrumentType?.toLowerCase() !== "option" || !!(p.expiryDate));

          const REQUIRED_FIELDS = [
            { key: "label",              label: "Label",               check: p => !!(p.label?.trim()) },
            { key: "stoxxExchange",      label: "Exchange",            check: p => chkExchanges.has(p.stoxxExchange) },
            { key: "instrumentType",     label: "Instrument Type",     check: p => chkInstTypes.has(p.instrumentType?.toLowerCase()) },
            { key: "underlyingCategory", label: "Underlying Category", check: p => chkUndCats.has(p.underlyingCategory?.toLowerCase()) },
            { key: "underlying",         label: "Underlying",          check: p => chkUnderlyings.has(p.underlying) },
            { key: "underlyingOrigin",   label: "Underlying Origin",   check: p => chkOrigins.has(p.underlyingOrigin) },
            { key: "volumeSizePerLot",   label: "Volume Size / Lot",   check: p => !!(String(p.volumeSizePerLot ?? "").trim()) },
            { key: "volumeUnit",         label: "Volume Unit",         check: p => chkVolumeUnits.has(p.volumeUnit) },
            { key: "currency",           label: "Currency",            check: p => chkCurrencies.has(p.currency) },
            { key: "lastTradingDate",    label: "Last Trading Date",   check: p => !!(p.lastTradingDate) },
          ];

          const renderRow = (p) => {
            const isInactive = p.active === false;
            const valid = isProdValid(p);
            const missingFields = REQUIRED_FIELDS.filter(f => !f.check(p)).map(f => f.label);
            if (p.instrumentType?.toLowerCase() === "option" && !p.expiryDate) missingFields.push("Expiry Date");
            return (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, background: isInactive ? "transparent" : COLORS.bg, border: `1px solid ${valid ? COLORS.border : COLORS.red + "50"}`, borderRadius: 10, padding: "12px 16px", opacity: isInactive ? 0.55 : 1 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: isInactive ? COLORS.surface : `${COLORS.blue}18`, border: `1px solid ${isInactive ? COLORS.border : COLORS.blue + "30"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0 }}>🌾</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: isInactive ? COLORS.textMuted : COLORS.text }}>{p.label}</div>
                  <div style={{ fontSize: 11, color: COLORS.textSub, marginTop: 3, display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ color: COLORS.blue }}>🏛 {p.stoxxExchange}</span>
                    {p.instrumentType && <span style={{ color: COLORS.blue, background: `${COLORS.blue}18`, padding: "1px 7px", borderRadius: 5, fontWeight: 600 }}>{p.instrumentType}</span>}
                    <span style={{ color: p.instrumentType?.toLowerCase().includes("option") ? COLORS.purple : COLORS.orange, background: p.instrumentType?.toLowerCase().includes("option") ? `${COLORS.purple}18` : `${COLORS.orange}18`, padding: "1px 7px", borderRadius: 5, fontWeight: 600 }}>{p.instrumentType?.toLowerCase().includes("option") ? "Options" : "Futures"}</span>
                    <span style={{ color: p.underlyingCategory === "commodity" ? COLORS.green : COLORS.gold, background: p.underlyingCategory === "commodity" ? `${COLORS.green}15` : `${COLORS.gold}15`, padding: "1px 7px", borderRadius: 5, fontWeight: 600 }}>{p.underlyingCategory === "commodity" ? "Commodity" : "FX"}</span>
                    <span>📦 {p.underlying}</span>
                    {p.underlyingOrigin && <span style={{ color: COLORS.textSub }}>🌍 {p.underlyingOrigin}</span>}
                    <span style={{ fontFamily: "'DM Mono', monospace" }}>×{p.volumeSizePerLot}{p.volumeUnit ? ` ${p.volumeUnit}` : ""}</span>
                    <span style={{ color: COLORS.gold }}>💱 {p.currency}</span>
                    {p.quotationUnit && <span style={{ color: COLORS.gold, background: `${COLORS.gold}15`, padding: "1px 7px", borderRadius: 5, fontFamily: "'DM Mono', monospace", fontWeight: 600 }}>📐 {p.quotationUnit}</span>}
                    {p.firstNoticeDay && <span>📅 FND: {p.firstNoticeDay}</span>}
                    {p.lastTradingDate && <span>🔚 LTD: {p.lastTradingDate}</span>}
                    {p.instrumentType?.toLowerCase() === "option" && p.expiryDate && <span style={{ color: COLORS.purple }}>⏱ EXP: {p.expiryDate}</span>}
                  </div>
                  {!valid && missingFields.length > 0 && (
                    <div style={{ marginTop: 5, fontSize: 10, color: COLORS.red, fontWeight: 600 }}>
                      ⚠ Manquant : {missingFields.join(", ")}
                    </div>
                  )}
                </div>
                {/* Validity indicator */}
                <div title={valid ? "Tous les champs obligatoires sont remplis" : `Champs manquants : ${missingFields.join(", ")}`}
                  style={{ width: 10, height: 10, borderRadius: "50%", background: valid ? COLORS.green : COLORS.red, flexShrink: 0, boxShadow: `0 0 6px ${valid ? COLORS.green : COLORS.red}80` }} />
                <div onClick={() => toggleActive(p)} title={isInactive ? "Réactiver" : "Désactiver"}
                  style={{ cursor: "pointer", flexShrink: 0, width: 36, height: 20, borderRadius: 10, background: isInactive ? COLORS.border : COLORS.green, border: `1px solid ${isInactive ? COLORS.textMuted : COLORS.green}`, position: "relative", transition: "background 0.2s" }}>
                  <div style={{ position: "absolute", top: 2, left: isInactive ? 2 : 18, width: 14, height: 14, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px #0004" }} />
                </div>
                <button onClick={() => { setForm({ ...p }); setInstrumentType(p.instrumentType || ""); setEditId(p.id); setShowForm(true); }} style={{ background: "none", border: "none", color: COLORS.accent, cursor: "pointer", fontSize: 14 }}>✏️</button>
                <button onClick={() => remove(p.id)} style={{ background: "none", border: "none", color: COLORS.red, cursor: "pointer", fontSize: 14 }}>🗑</button>
              </div>
            );
          };

          const activeProds = applyFilters(products.filter(p => p.active !== false));
          const inactiveProds = applyFilters(products.filter(p => p.active === false));
          const totalFiltered = activeProds.length + inactiveProds.length;

          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Search + filters */}
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <input value={prodSearch} onChange={e => setProdSearch(e.target.value)} placeholder="🔍 Rechercher un instrument…"
                  style={{ flex: 1, minWidth: 200, background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "8px 12px", color: COLORS.text, fontSize: 13, outline: "none", fontFamily: "inherit" }} />
                <select value={filterUnderlying} onChange={e => setFilterUnderlying(e.target.value)}
                  style={{ background: COLORS.bg, border: `1px solid ${filterUnderlying ? COLORS.accent + "60" : COLORS.border}`, borderRadius: 8, padding: "8px 12px", color: filterUnderlying ? COLORS.text : COLORS.textMuted, fontSize: 13, outline: "none", fontFamily: "inherit", minWidth: 130 }}>
                  <option value="">Underlying</option>
                  {allUnderlyings.map(u => {
                    const label = (config.derivCommodities || []).find(c => c.value === u)?.label || u;
                    return <option key={u} value={u}>{label}</option>;
                  })}
                </select>
                <select value={filterYear} onChange={e => setFilterYear(e.target.value)}
                  style={{ background: COLORS.bg, border: `1px solid ${filterYear ? COLORS.accent + "60" : COLORS.border}`, borderRadius: 8, padding: "8px 12px", color: filterYear ? COLORS.text : COLORS.textMuted, fontSize: 13, outline: "none", fontFamily: "inherit", minWidth: 100 }}>
                  <option value="">Année</option>
                  {allYears.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                {hasFilters && (
                  <button onClick={() => { setProdSearch(""); setFilterUnderlying(""); setFilterYear(""); }}
                    style={{ background: `${COLORS.red}15`, border: `1px solid ${COLORS.red}30`, borderRadius: 8, padding: "8px 12px", color: COLORS.red, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
                    ✕ Reset
                  </button>
                )}
                {hasFilters && <span style={{ fontSize: 12, color: COLORS.textMuted }}>{totalFiltered} résultat{totalFiltered !== 1 ? "s" : ""}</span>}
              </div>

              {/* Active */}
              {activeProds.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {activeProds.map(renderRow)}
                </div>
              )}

              {/* Inactive */}
              {inactiveProds.length > 0 && (
                <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: 12, overflow: "hidden" }}>
                  <div style={{ padding: "8px 14px", background: COLORS.surface, display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: COLORS.textMuted, letterSpacing: 1 }}>INACTIFS</span>
                    <span style={{ fontSize: 11, color: COLORS.textMuted, background: COLORS.bg, padding: "1px 7px", borderRadius: 4, border: `1px solid ${COLORS.border}` }}>{inactiveProds.length}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "10px 10px" }}>
                    {inactiveProds.map(renderRow)}
                  </div>
                </div>
              )}

              {hasFilters && totalFiltered === 0 && (
                <div style={{ textAlign: "center", color: COLORS.textMuted, padding: 20, fontSize: 13 }}>Aucun résultat pour ces filtres</div>
              )}
            </div>
          );
        })()}
      </div>}
      {showImport && (
        <DerivProductImportModal
          config={cfg}
          onClose={() => setShowImport(false)}
          onImport={async (newItems) => {
            const updated = [...products, ...newItems];
            setProducts(updated);
            await saveProducts(updated, setProducts, products);
          }}
        />
      )}
    </div>
  );
};

const UnderlyingOriginEditor = ({ config, updateField, setAdminTab }) => {
  const allCountries = [...(config.country || [])].sort((a, b) => a.label.localeCompare(b.label));
  const selected = config.derivUnderlyingOrigins || [];
  const [localSelected, setLocalSelected] = useState(selected);
  const [dirty, setDirty] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => { setLocalSelected(selected); setDirty(false); }, [config.derivUnderlyingOrigins]);

  const toggle = (value) => {
    const next = localSelected.includes(value) ? localSelected.filter(v => v !== value) : [...localSelected, value];
    setLocalSelected(next);
    setDirty(true);
  };

  const save = (e) => {
    e.stopPropagation();
    updateField("derivUnderlyingOrigins", localSelected);
    setDirty(false);
  };

  return (
    <div style={{ background: COLORS.bg, border: `1px solid ${dirty ? COLORS.accent + "60" : COLORS.border}`, borderRadius: 14, overflow: "hidden", transition: "border-color 0.2s" }}>
      <div onClick={() => setExpanded(e => !e)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", cursor: "pointer", userSelect: "none" }}
        onMouseOver={e => e.currentTarget.style.background = `${COLORS.accent}08`}
        onMouseOut={e => e.currentTarget.style.background = "transparent"}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 18, width: 24, textAlign: "center" }}>🌍</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }}>Underlying Origin</div>
            <div style={{ fontSize: 11, color: COLORS.textMuted }}>Pays disponibles — source : <span style={{ color: COLORS.accent, cursor: "pointer", textDecoration: "underline" }} onClick={e => { e.stopPropagation(); setAdminTab("fields"); }}>Champs CRM → Country</span></div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end", maxWidth: 500 }}>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {localSelected.map(v => {
              const country = allCountries.find(c => c.value === v);
              return country ? (
                <span key={v} style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 5, background: COLORS.card, color: COLORS.text, border: `1px solid ${COLORS.border}` }}>
                  {country.label}
                </span>
              ) : null;
            })}
            {localSelected.length === 0 && <span style={{ fontSize: 11, color: COLORS.textMuted }}>Aucune sélection</span>}
          </div>
          {dirty && <div onClick={save} style={{ background: `${COLORS.green}20`, color: COLORS.green, border: `1px solid ${COLORS.green}40`, padding: "4px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>✓ Sauvegarder</div>}
          <span style={{ color: COLORS.textMuted, fontSize: 14, transition: "transform 0.2s", display: "inline-block", transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
        </div>
      </div>

      {expanded && (
        <div style={{ padding: "14px 18px", borderTop: `1px solid ${COLORS.border}` }}>
          {allCountries.length === 0 && (
            <div style={{ textAlign: "center", color: COLORS.textMuted, fontSize: 13, padding: "16px 0" }}>
              Aucun pays défini — configurez-les dans <span style={{ color: COLORS.accent, cursor: "pointer", textDecoration: "underline" }} onClick={() => setAdminTab("fields")}>Champs CRM → Country</span>
            </div>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {allCountries.map(c => {
              const isOn = localSelected.includes(c.value);
              return (
                <div key={c.value} onClick={() => toggle(c.value)}
                  style={{ padding: "6px 14px", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: isOn ? 700 : 500, transition: "all 0.15s", border: `1.5px solid ${isOn ? COLORS.accent : COLORS.border}`, background: isOn ? `${COLORS.accent}18` : COLORS.card, color: isOn ? COLORS.accent : COLORS.textSub, userSelect: "none" }}>
                  {c.label}
                </div>
              );
            })}
          </div>
          {localSelected.length > 0 && (
            <div style={{ marginTop: 12, fontSize: 11, color: COLORS.textMuted }}>
              <span style={{ color: COLORS.accent, cursor: "pointer" }} onClick={() => { setLocalSelected([]); setDirty(true); }}>✕ Tout désélectionner</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};





// ─── GENERIC DERIV PILLS EDITOR ──────────────────────────────
// Reusable pill-style editor for any config list field
// Pills are white/neutral by default (no color)
const DerivPillsEditor = ({ configKey, label, icon, description, config, updateField, defaultKey, defaultValue, onSetDefault }) => {
  const rawItems = config[configKey];
  const items = Array.isArray(rawItems) ? rawItems : [];
  const [localItems, setLocalItems] = useState(items);
  const [dirty, setDirty] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [newLabel, setNewLabel] = useState("");

  useEffect(() => {
    const raw = config[configKey];
    setLocalItems(Array.isArray(raw) ? raw : []);
    setDirty(false);
  }, [config[configKey]]);

  const mark = (next) => { setLocalItems(next); setDirty(true); };

  const add = () => {
    if (!newLabel.trim()) return;
    mark([...localItems, { value: newLabel.trim().toLowerCase().replace(/\s+/g, "_"), label: newLabel.trim() }]);
    setNewLabel("");
  };

  const save = (e) => {
    e.stopPropagation();
    updateField(configKey, localItems);
    if (defaultKey && onSetDefault) {
      // keep default unchanged
    }
    setDirty(false);
  };

  const currentDefault = defaultKey ? (config[defaultKey] || "") : "";

  return (
    <div style={{ background: COLORS.bg, border: `1px solid ${dirty ? COLORS.accent + "60" : COLORS.border}`, borderRadius: 14, overflow: "hidden", transition: "border-color 0.2s" }}>
      <div onClick={() => setExpanded(e => !e)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", cursor: "pointer", userSelect: "none" }}
        onMouseOver={e => e.currentTarget.style.background = `${COLORS.accent}08`}
        onMouseOut={e => e.currentTarget.style.background = "transparent"}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 18, width: 24, textAlign: "center" }}>{icon}</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }}>{label}</div>
            {description && <div style={{ fontSize: 11, color: COLORS.textMuted }}>{description}</div>}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", justifyContent: "flex-end", maxWidth: 400 }}>
            {localItems.map(s => (
              <span key={s.value} style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 5, background: COLORS.card, color: COLORS.text, border: `1px solid ${COLORS.border}` }}>
                {s.label}{defaultKey && currentDefault === s.value ? " ★" : ""}
              </span>
            ))}
          </div>
          {dirty && <div onClick={save} style={{ background: `${COLORS.green}20`, color: COLORS.green, border: `1px solid ${COLORS.green}40`, padding: "4px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>✓ Sauvegarder</div>}
          <span style={{ color: COLORS.textMuted, fontSize: 14, transition: "transform 0.2s", display: "inline-block", transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
        </div>
      </div>

      {expanded && (
        <div style={{ padding: "14px 18px", borderTop: `1px solid ${COLORS.border}` }}>
          {defaultKey && <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 10 }}>☆ Cliquez sur l'étoile pour définir la valeur par défaut</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
            {localItems.map((s, idx) => {
              const isDefault = defaultKey && currentDefault === s.value;
              return (
                <div key={s.value} style={{ display: "flex", alignItems: "center", gap: 10, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "10px 14px" }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: COLORS.textMuted, flexShrink: 0 }} />
                  <input value={s.label} onChange={e => { const v = e.target.value; mark(localItems.map((x, i) => i === idx ? { ...x, label: v } : x)); }}
                    style={{ flex: 1, background: "transparent", border: "none", color: COLORS.text, fontSize: 13, fontWeight: 600, fontFamily: "inherit", outline: "none" }} />
                  {defaultKey && onSetDefault && (
                    <div onClick={e => { e.stopPropagation(); onSetDefault(isDefault ? "" : s.value); }}
                      title="Définir comme valeur par défaut"
                      style={{ fontSize: 17, color: isDefault ? COLORS.gold : COLORS.textMuted, cursor: "pointer", transition: "color 0.15s" }}
                      onMouseOver={e => e.currentTarget.style.color = COLORS.gold}
                      onMouseOut={e => e.currentTarget.style.color = isDefault ? COLORS.gold : COLORS.textMuted}>
                      {isDefault ? "★" : "☆"}
                    </div>
                  )}
                  <button onClick={() => mark(localItems.filter((_, i) => i !== idx))}
                    style={{ background: "none", border: "none", color: COLORS.textMuted, cursor: "pointer", fontSize: 18, lineHeight: 1 }}
                    onMouseOver={e => e.currentTarget.style.color = COLORS.red}
                    onMouseOut={e => e.currentTarget.style.color = COLORS.textMuted}>×</button>
                </div>
              );
            })}
            {localItems.length === 0 && <div style={{ textAlign: "center", color: COLORS.textMuted, padding: "16px 0", fontSize: 13 }}>Aucune valeur — ajoutez-en ci-dessous</div>}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end", background: `${COLORS.accent}08`, border: `1px dashed ${COLORS.accent}40`, borderRadius: 10, padding: "12px 14px" }}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 10, color: COLORS.textSub, fontWeight: 600 }}>LABEL *</label>
              <input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="Nouvelle valeur…" onKeyDown={e => e.key === "Enter" && add()}
                style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "8px 12px", color: COLORS.text, fontSize: 13, outline: "none", fontFamily: "inherit" }} />
            </div>
            <Btn onClick={add} disabled={!newLabel.trim()} style={{ padding: "8px 14px", fontSize: 13, flexShrink: 0 }}>+ Ajouter</Btn>
          </div>
        </div>
      )}
    </div>
  );
};

const AccountTypePillsEditor = ({ config, updateField, defaultKey, onSetDefault }) => {
  const items = Array.isArray(config.derivAccountTypes) ? config.derivAccountTypes : [];
  const [localItems, setLocalItems] = useState(items);
  const [dirty, setDirty] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState(COLORS.accent);
  const PRESET_COLORS = [COLORS.green, COLORS.orange, COLORS.red, COLORS.blue, COLORS.purple, COLORS.gold, COLORS.accent];

  useEffect(() => { setLocalItems(Array.isArray(config.derivAccountTypes) ? config.derivAccountTypes : []); setDirty(false); }, [config.derivAccountTypes]);

  const mark = (next) => { setLocalItems(next); setDirty(true); };

  const add = () => {
    if (!newLabel.trim()) return;
    mark([...localItems, { value: newLabel.trim().toLowerCase().replace(/\s+/g, "_"), label: newLabel.trim(), color: newColor }]);
    setNewLabel(""); setNewColor(COLORS.accent);
  };

  const save = (e) => {
    e.stopPropagation();
    updateField("derivAccountTypes", localItems);
    setDirty(false);
  };

  return (
    <div style={{ background: COLORS.bg, border: `1px solid ${dirty ? COLORS.accent + "60" : COLORS.border}`, borderRadius: 14, overflow: "hidden", transition: "border-color 0.2s" }}>
      <div onClick={() => setExpanded(e => !e)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", cursor: "pointer", userSelect: "none" }}
        onMouseOver={e => e.currentTarget.style.background = `${COLORS.accent}08`}
        onMouseOut={e => e.currentTarget.style.background = "transparent"}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 18, width: 24, textAlign: "center" }}>🗂</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }}>Account Types</div>
            <div style={{ fontSize: 11, color: COLORS.textMuted }}>Types de compte disponibles pour les opérations sur dérivés</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", gap: 5 }}>
            {localItems.map(s => {
              const isDefault = defaultKey && (config[defaultKey] || "") === s.value;
              return (
                <span key={s.value} style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 5, background: `${s.color || COLORS.accent}20`, color: s.color || COLORS.accent, border: `1px solid ${s.color || COLORS.accent}40` }}>
                  {s.label}{isDefault ? " ★" : ""}
                </span>
              );
            })}
          </div>
          {dirty && <div onClick={save} style={{ background: `${COLORS.green}20`, color: COLORS.green, border: `1px solid ${COLORS.green}40`, padding: "4px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>✓ Sauvegarder</div>}
          <span style={{ color: COLORS.textMuted, fontSize: 14, transition: "transform 0.2s", display: "inline-block", transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
        </div>
      </div>

      {expanded && (
        <div style={{ padding: "14px 18px", borderTop: `1px solid ${COLORS.border}` }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
            {localItems.map((s, idx) => {
              const isDefault = defaultKey && (config[defaultKey] || "") === s.value;
              return (
                <div key={s.value} style={{ display: "flex", alignItems: "center", gap: 10, background: `${s.color || COLORS.accent}10`, border: `1px solid ${isDefault ? (s.color || COLORS.accent) : (s.color || COLORS.accent) + "30"}`, borderRadius: 10, padding: "10px 14px" }}>
                  <div style={{ width: 12, height: 12, borderRadius: "50%", background: s.color || COLORS.accent, flexShrink: 0 }} />
                  <input value={s.label} onChange={e => { const v = e.target.value; mark(localItems.map((x, i) => i === idx ? { ...x, label: v } : x)); }}
                    style={{ flex: 1, background: "transparent", border: "none", color: COLORS.text, fontSize: 13, fontWeight: 700, fontFamily: "inherit", outline: "none" }} />
                  <div style={{ display: "flex", gap: 4 }}>
                    {PRESET_COLORS.map(c => (
                      <div key={c} onClick={() => mark(localItems.map((x, i) => i === idx ? { ...x, color: c } : x))}
                        style={{ width: 14, height: 14, borderRadius: "50%", background: c, cursor: "pointer", border: s.color === c ? `2px solid #fff` : "2px solid transparent", outline: s.color === c ? `2px solid ${c}` : "none" }} />
                    ))}
                  </div>
                  {/* Star: set as default */}
                  <button onClick={() => onSetDefault && onSetDefault(isDefault ? "" : s.value)}
                    title={isDefault ? "Retirer la valeur par défaut" : "Définir comme valeur par défaut"}
                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, lineHeight: 1, color: isDefault ? COLORS.gold : COLORS.textMuted, transition: "color 0.15s" }}
                    onMouseOver={e => e.currentTarget.style.color = COLORS.gold}
                    onMouseOut={e => e.currentTarget.style.color = isDefault ? COLORS.gold : COLORS.textMuted}>★</button>
                  <button onClick={() => mark(localItems.filter((_, i) => i !== idx))}
                    style={{ background: "none", border: "none", color: COLORS.textMuted, cursor: "pointer", fontSize: 18, lineHeight: 1 }}
                    onMouseOver={e => e.currentTarget.style.color = COLORS.red}
                    onMouseOut={e => e.currentTarget.style.color = COLORS.textMuted}>×</button>
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end", background: `${COLORS.accent}08`, border: `1px dashed ${COLORS.accent}40`, borderRadius: 10, padding: "12px 14px" }}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 10, color: COLORS.textSub, fontWeight: 600 }}>LABEL *</label>
              <input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="ex: Arbitrage" onKeyDown={e => e.key === "Enter" && add()}
                style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "8px 12px", color: COLORS.text, fontSize: 13, outline: "none", fontFamily: "inherit" }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 10, color: COLORS.textSub, fontWeight: 600 }}>COULEUR</label>
              <div style={{ display: "flex", gap: 5, padding: "6px 0" }}>
                {PRESET_COLORS.map(c => (
                  <div key={c} onClick={() => setNewColor(c)}
                    style={{ width: 20, height: 20, borderRadius: "50%", background: c, cursor: "pointer", border: newColor === c ? `2px solid #fff` : "2px solid transparent", outline: newColor === c ? `2px solid ${c}` : "none" }} />
                ))}
              </div>
            </div>
            <Btn onClick={add} disabled={!newLabel.trim()} style={{ padding: "8px 14px", fontSize: 13, flexShrink: 0 }}>+ Ajouter</Btn>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── DERIV ACCOUNT IMPORT MODAL ──────────────────────────────
const DERIV_ACCOUNT_FIELD_MAP = {
  "accountNumber": ["account number", "accountnumber", "account", "numéro compte", "numero compte", "num compte"],
  "businessUnit":  ["business unit", "businessunit", "bu", "unité"],
  "currency":      ["currency", "devise", "monnaie"],
  "initialAmount": ["initial amount", "initialamount", "montant initial", "montant", "amount"],
  "accountType":   ["account type", "accounttype", "type compte", "type"],
  "financingBank": ["financing bank", "financingbank", "banque", "bank"],
  "contracts":     ["contracts", "contrats", "contract"],
  "trade":         ["trade", "trade id", "tradeid", "négoce"],
  "isActive":      ["is active", "isactive", "actif", "active", "status", "statut"],
};

const normalizeHeaderDA = (h) => h?.toString().toLowerCase().trim().replace(/[_\-]/g, " ") || "";
const guessFieldDA = (header) => {
  const norm = normalizeHeaderDA(header);
  for (const [field, aliases] of Object.entries(DERIV_ACCOUNT_FIELD_MAP)) {
    if (aliases.some(a => norm === a || norm.includes(a) || a.includes(norm))) return field;
  }
  return null;
};

const DerivAccountImportModal = ({ onClose, onImport, config }) => {
  const [step, setStep]       = useState("guide");
  const [rawRows, setRawRows] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [mapping, setMapping] = useState({});
  const [error, setError]     = useState("");
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState(null);
  const fileRef = useRef();

  const GUIDE_FIELDS = [
    { field: "accountNumber", format: "Texte",        required: true,  note: "ex: ACC-001" },
    { field: "businessUnit",  format: "Texte",        required: true,  note: "Valeur de la liste Business Units (ex: morocco, ukraine)" },
    { field: "currency",      format: "Texte",        required: true,  note: "ex: EUR, USD, MAD" },
    { field: "initialAmount", format: "Nombre",       required: true,  note: "ex: 500000" },
    { field: "accountType",   format: "Texte",        required: false, note: "Valeur de la liste Account Types" },
    { field: "financingBank", format: "Texte",        required: false, note: "Nom exact d'une Financing Bank" },
    { field: "contracts",     format: "Texte",        required: false, note: "ex: CME-001" },
    { field: "trade",         format: "Texte",        required: false, note: "ex: TRD-001" },
    { field: "isActive",      format: "TRUE / FALSE", required: false, note: "Défaut : TRUE" },
  ];

  const handleFile = async (file) => {
    setError("");
    try {
      const XLSX = await import("xlsx");
      const buf  = await file.arrayBuffer();
      const wb   = XLSX.read(buf, { type: "array" });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
      if (!json.length) { setError("Le fichier est vide."); return; }
      const hdrs = json[0].map(h => h?.toString() || "");
      const rows = json.slice(1).filter(r => r.some(c => c !== ""));
      setHeaders(hdrs);
      setRawRows(rows);
      const autoMap = {};
      hdrs.forEach((h, i) => { const g = guessFieldDA(h); if (g && !Object.values(autoMap).includes(g)) autoMap[i] = g; });
      setMapping(autoMap);
      setStep("mapping");
    } catch { setError("Erreur de lecture du fichier."); }
  };

  const doImport = () => {
    setImporting(true);
    const errors = [];
    const valid  = [];

    rawRows.forEach((row, i) => {
      const obj = { id: Date.now() + i };
      Object.entries(mapping).forEach(([ci, f]) => { if (f) obj[f] = row[ci]?.toString().trim() || ""; });

      // Normalize businessUnit against config
      if (obj.businessUnit) {
        const norm = v => v?.toLowerCase().trim().replace(/[\s_-]/g, "");
        const match = (config.businessUnit || []).find(b => norm(b.value) === norm(obj.businessUnit) || norm(b.label) === norm(obj.businessUnit));
        obj.businessUnit = match ? match.value : obj.businessUnit.toLowerCase().replace(/\s+/g, "_");
      }

      // Normalize currency
      if (obj.currency) {
        const match = (config.contractsCurrency || []).find(c => c.value.toLowerCase() === obj.currency.toLowerCase() || c.label.toLowerCase() === obj.currency.toLowerCase());
        obj.currency = match ? match.value : (typeof obj.currency === "string" ? obj.currency.toUpperCase() : obj.currency);
      }

      // Normalize accountType
      if (obj.accountType) {
        const norm = v => v?.toLowerCase().trim();
        const match = (Array.isArray(config.derivAccountTypes) ? config.derivAccountTypes : []).find(t => norm(t.value) === norm(obj.accountType) || norm(t.label) === norm(obj.accountType));
        obj.accountType = match ? match.value : obj.accountType;
      }

      // Normalize initialAmount
      if (obj.initialAmount) obj.initialAmount = String(obj.initialAmount).replace(/,/g, ".");

      // Normalize isActive
      if (obj.isActive !== undefined && obj.isActive !== "") {
        obj.isActive = String(obj.isActive).toLowerCase() !== "false" && obj.isActive !== "0" && obj.isActive !== "non";
      } else {
        obj.isActive = true;
      }

      // Validate required fields
      const missing = [];
      if (!obj.accountNumber) missing.push("accountNumber");
      if (!obj.businessUnit)  missing.push("businessUnit");
      if (!obj.currency)      missing.push("currency");
      if (!String(obj.initialAmount).trim()) missing.push("initialAmount");

      if (missing.length > 0) {
        errors.push({ row: i + 2, label: obj.accountNumber || `Ligne ${i + 2}`, missing });
      } else {
        valid.push(obj);
      }
    });

    setResults({ valid, errors });
    setStep("summary");
    setImporting(false);
  };

  const confirmImport = () => {
    if (results?.valid?.length > 0) onImport(results.valid);
    onClose();
  };

  const allFields = Object.keys(DERIV_ACCOUNT_FIELD_MAP);

  return (
    <div style={{ position: "fixed", inset: 0, background: "#00000090", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100, padding: 20 }}>
      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 18, padding: 30, width: "100%", maxWidth: 680, maxHeight: "90vh", overflowY: "auto" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, color: COLORS.text }}>Import Excel — Accounts</h2>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: COLORS.textSub }}>Formats acceptés : .xlsx, .xls, .csv</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: COLORS.textMuted, cursor: "pointer", fontSize: 22, lineHeight: 1 }}>×</button>
        </div>

        {/* Step: Guide */}
        {step === "guide" && (
          <div>
            <div style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 12, overflow: "hidden", marginBottom: 20 }}>
              <div style={{ padding: "10px 16px", background: COLORS.tableHeader, display: "grid", gridTemplateColumns: "1.5fr 1fr 0.6fr 2fr", gap: 8 }}>
                {["Colonne", "Format", "Requis", "Note"].map(h => (
                  <div key={h} style={{ fontSize: 11, fontWeight: 700, color: COLORS.textMuted, letterSpacing: 1 }}>{h.toUpperCase()}</div>
                ))}
              </div>
              {GUIDE_FIELDS.map((f, i) => (
                <div key={f.field} style={{ padding: "9px 16px", display: "grid", gridTemplateColumns: "1.5fr 1fr 0.6fr 2fr", gap: 8, background: i % 2 === 0 ? "transparent" : `${COLORS.surface}80`, alignItems: "center" }}>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: COLORS.accent }}>{f.field}</div>
                  <div style={{ fontSize: 12, color: COLORS.textSub }}>{f.format}</div>
                  <div>
                    {f.required
                      ? <span style={{ fontSize: 10, fontWeight: 700, color: COLORS.red, background: `${COLORS.red}15`, padding: "2px 7px", borderRadius: 4 }}>OBL.</span>
                      : <span style={{ fontSize: 10, color: COLORS.textMuted, background: COLORS.bg, padding: "2px 7px", borderRadius: 4, border: `1px solid ${COLORS.border}` }}>OPT.</span>
                    }
                  </div>
                  <div style={{ fontSize: 11, color: COLORS.textMuted }}>{f.note}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }} onChange={e => { if (e.target.files[0]) handleFile(e.target.files[0]); }} />
              <Btn onClick={() => fileRef.current.click()}>📂 Choisir un fichier</Btn>
            </div>
            {error && <div style={{ marginTop: 12, fontSize: 13, color: COLORS.red, background: `${COLORS.red}10`, border: `1px solid ${COLORS.red}30`, borderRadius: 8, padding: "10px 14px" }}>⚠ {error}</div>}
          </div>
        )}

        {/* Step: Mapping */}
        {step === "mapping" && (
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.text, marginBottom: 12 }}>Mapper les colonnes Excel → champs compte</div>
            <div style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 12, overflow: "hidden", marginBottom: 20 }}>
              <div style={{ padding: "10px 16px", background: COLORS.tableHeader, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {["Colonne Excel", "Champ compte"].map(h => (
                  <div key={h} style={{ fontSize: 11, fontWeight: 700, color: COLORS.textMuted, letterSpacing: 1 }}>{h.toUpperCase()}</div>
                ))}
              </div>
              {headers.map((h, i) => (
                <div key={i} style={{ padding: "8px 16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, alignItems: "center", background: i % 2 === 0 ? "transparent" : `${COLORS.surface}80` }}>
                  <div style={{ fontSize: 13, color: COLORS.text, fontFamily: "'DM Mono', monospace" }}>{h}</div>
                  <select value={mapping[i] || ""} onChange={e => setMapping(prev => ({ ...prev, [i]: e.target.value || null }))}
                    style={{ background: COLORS.card, border: `1px solid ${mapping[i] ? COLORS.accent + "60" : COLORS.border}`, borderRadius: 8, padding: "6px 10px", color: mapping[i] ? COLORS.text : COLORS.textMuted, fontSize: 12, outline: "none", fontFamily: "inherit" }}>
                    <option value="">— Ignorer —</option>
                    {allFields.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Btn variant="secondary" onClick={() => setStep("guide")}>← Retour</Btn>
              <Btn onClick={doImport} style={{ background: COLORS.green }}>{importing ? "Import..." : `✓ Importer ${rawRows.length} lignes`}</Btn>
            </div>
          </div>
        )}

        {/* Step: Summary */}
        {step === "summary" && results && (
          <div>
            <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
              <div style={{ flex: 1, background: `${COLORS.green}12`, border: `1px solid ${COLORS.green}30`, borderRadius: 12, padding: "16px 20px", textAlign: "center" }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: COLORS.green }}>{results.valid.length}</div>
                <div style={{ fontSize: 12, color: COLORS.textSub, marginTop: 4 }}>compte{results.valid.length !== 1 ? "s" : ""} valide{results.valid.length !== 1 ? "s" : ""}</div>
              </div>
              <div style={{ flex: 1, background: results.errors.length > 0 ? `${COLORS.red}12` : `${COLORS.green}08`, border: `1px solid ${results.errors.length > 0 ? COLORS.red + "30" : COLORS.border}`, borderRadius: 12, padding: "16px 20px", textAlign: "center" }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: results.errors.length > 0 ? COLORS.red : COLORS.textMuted }}>{results.errors.length}</div>
                <div style={{ fontSize: 12, color: COLORS.textSub, marginTop: 4 }}>ligne{results.errors.length !== 1 ? "s" : ""} rejetée{results.errors.length !== 1 ? "s" : ""}</div>
              </div>
            </div>
            {results.errors.length > 0 && (
              <div style={{ background: COLORS.bg, border: `1px solid ${COLORS.red}30`, borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
                <div style={{ padding: "10px 16px", background: `${COLORS.red}10`, fontSize: 12, fontWeight: 700, color: COLORS.red }}>LIGNES REJETÉES — champs obligatoires manquants</div>
                {results.errors.map((e, i) => (
                  <div key={i} style={{ padding: "8px 16px", borderTop: `1px solid ${COLORS.border}`, display: "flex", gap: 12, alignItems: "center" }}>
                    <span style={{ fontSize: 11, color: COLORS.textMuted, fontFamily: "'DM Mono', monospace", flexShrink: 0 }}>Ligne {e.row}</span>
                    <span style={{ fontSize: 13, color: COLORS.text, flex: 1 }}>{e.label}</span>
                    <span style={{ fontSize: 11, color: COLORS.red }}>{e.missing.join(", ")}</span>
                  </div>
                ))}
              </div>
            )}
            {results.valid.length > 0 && (
              <div style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 12, overflow: "hidden", marginBottom: 20 }}>
                <div style={{ padding: "10px 16px", background: COLORS.tableHeader, fontSize: 12, fontWeight: 700, color: COLORS.textSub }}>APERÇU DES COMPTES VALIDES</div>
                {results.valid.slice(0, 5).map((a, i) => (
                  <div key={i} style={{ padding: "10px 16px", borderTop: `1px solid ${COLORS.border}`, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.text, fontFamily: "'DM Mono', monospace", minWidth: 120 }}>{a.accountNumber}</span>
                    <span style={{ fontSize: 11, color: COLORS.blue, background: `${COLORS.blue}15`, padding: "2px 8px", borderRadius: 5 }}>{a.businessUnit}</span>
                    <span style={{ fontSize: 11, color: COLORS.gold }}>{Array.isArray(a.currency) ? a.currency.join(" · ") : a.currency}</span>
                    <span style={{ fontSize: 11, color: COLORS.green, fontFamily: "'DM Mono', monospace" }}>{Number(a.initialAmount).toLocaleString("fr")} {Array.isArray(a.currency) ? a.currency[0] : a.currency}</span>
                    {a.accountType && <span style={{ fontSize: 11, color: COLORS.accent, background: `${COLORS.accent}15`, padding: "2px 8px", borderRadius: 5 }}>{a.accountType}</span>}
                    {a.financingBank && <span style={{ fontSize: 11, color: COLORS.textSub }}>🏦 {a.financingBank}</span>}
                    <span style={{ fontSize: 11, color: a.isActive ? COLORS.green : COLORS.textMuted, fontWeight: 600 }}>{a.isActive ? "● Actif" : "○ Inactif"}</span>
                  </div>
                ))}
                {results.valid.length > 5 && (
                  <div style={{ padding: "8px 16px", borderTop: `1px solid ${COLORS.border}`, fontSize: 12, color: COLORS.textMuted }}>
                    + {results.valid.length - 5} autre{results.valid.length - 5 > 1 ? "s" : ""} compte{results.valid.length - 5 > 1 ? "s" : ""}…
                  </div>
                )}
              </div>
            )}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Btn variant="secondary" onClick={() => setStep("mapping")}>← Modifier le mapping</Btn>
              {results.valid.length > 0
                ? <Btn onClick={confirmImport} style={{ background: COLORS.green }}>✓ Confirmer l'import ({results.valid.length})</Btn>
                : <Btn variant="secondary" onClick={onClose}>Fermer</Btn>
              }
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── FINANCING BANKS EDITOR ──────────────────────────────────
const FinancingBanksEditor = ({ companies = [], config, updateField }) => {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const btnRef = useRef(null);
  const [dropPos, setDropPos] = useState({ top: 0, right: 0 });

  const bankCompanies = companies.filter(c =>
    Array.isArray(c.roles) ? c.roles.includes("Bank") : c.roles === "Bank"
  ).sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  const selected = Array.isArray(config.derivFinancingBanks) ? config.derivFinancingBanks : [];
  const validNames = bankCompanies.map(c => c.name);
  const cleanSelected = selected.filter(name => validNames.includes(name));

  useEffect(() => {
    if (cleanSelected.length !== selected.length) {
      updateField("derivFinancingBanks", cleanSelected);
    }
  }, [bankCompanies.map(c => c.name).join(",")]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target) && !btnRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleOpen = () => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setDropPos({ bottom: window.innerHeight - rect.top + 6, right: window.innerWidth - rect.right });
    }
    setOpen(o => !o);
  };

  const toggle = (name) => {
    const next = cleanSelected.includes(name)
      ? cleanSelected.filter(v => v !== name)
      : [...cleanSelected, name];
    updateField("derivFinancingBanks", next);
  };

  const remove = (name) => updateField("derivFinancingBanks", cleanSelected.filter(v => v !== name));

  const filteredBanks = search.trim()
    ? bankCompanies.filter(c => c.name?.toLowerCase().includes(search.toLowerCase()))
    : bankCompanies;

  return (
    <div style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 14, marginBottom: 0, overflow: "hidden" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", borderBottom: cleanSelected.length > 0 ? `1px solid ${COLORS.border}` : "none" }}>
        <span style={{ fontSize: 18, width: 24, textAlign: "center", flexShrink: 0 }}>🏦</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }}>Financing Banks</div>
          <div style={{ fontSize: 11, color: COLORS.textMuted }}>Banques de financement — sélectionner parmi les companies avec le rôle Bank</div>
        </div>
        <div ref={btnRef} onClick={handleOpen}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 8, cursor: "pointer", border: `1px solid ${open ? COLORS.accent + "80" : COLORS.border}`, background: open ? `${COLORS.accent}10` : COLORS.card, transition: "all 0.15s", flexShrink: 0 }}>
          <span style={{ fontSize: 13, color: COLORS.textSub }}>+ Ajouter une banque</span>
          <span style={{ fontSize: 9, color: COLORS.textMuted }}>▼</span>
        </div>
      </div>

      {/* Fixed-position dropdown rendered via portal-like approach */}
      {open && (
        <div ref={ref} style={{ position: "fixed", bottom: dropPos.bottom, right: dropPos.right, zIndex: 9999, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10, overflow: "hidden", boxShadow: "0 -4px 24px #00000080", minWidth: 280, maxWidth: 360 }}>
          <div style={{ padding: "8px 10px", borderBottom: `1px solid ${COLORS.border}` }}>
            <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher une banque…"
              style={{ width: "100%", background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "6px 10px", color: COLORS.text, fontSize: 13, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
          </div>
          <div style={{ maxHeight: 260, overflowY: "auto" }}>
            {bankCompanies.length === 0 && (
              <div style={{ padding: 16, textAlign: "center", color: COLORS.textMuted, fontSize: 13 }}>
                Aucune company avec le rôle <strong>Bank</strong>
              </div>
            )}
            {filteredBanks.length === 0 && bankCompanies.length > 0 && (
              <div style={{ padding: 16, textAlign: "center", color: COLORS.textMuted, fontSize: 13 }}>Aucun résultat</div>
            )}
            {filteredBanks.map(c => {
              const isSelected = cleanSelected.includes(c.name);
              return (
                <div key={c.id} onClick={() => toggle(c.name)}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", cursor: "pointer", background: isSelected ? `${COLORS.accent}12` : "transparent", borderLeft: `3px solid ${isSelected ? COLORS.accent : "transparent"}`, transition: "background 0.1s" }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = COLORS.hover; }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = isSelected ? `${COLORS.accent}12` : "transparent"; }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", border: `2px solid ${isSelected ? COLORS.accent : COLORS.textMuted}`, background: isSelected ? COLORS.accent : "transparent", flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: isSelected ? COLORS.accent : COLORS.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
                    {c.country && <div style={{ fontSize: 11, color: COLORS.textMuted }}>{c.country}</div>}
                  </div>
                  {isSelected && <span style={{ fontSize: 11, color: COLORS.accent, fontWeight: 700 }}>✓</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Selected banks as removable tags */}
      {cleanSelected.length > 0 && (
        <div style={{ padding: "10px 18px", display: "flex", flexWrap: "wrap", gap: 8 }}>
          {cleanSelected.map(name => (
            <span key={name} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 7, background: `${COLORS.accent}18`, color: COLORS.accent, border: `1px solid ${COLORS.accent}40` }}>
              🏦 {name}
              <span onClick={() => remove(name)} style={{ cursor: "pointer", fontSize: 13, lineHeight: 1, color: COLORS.accent, opacity: 0.7, marginLeft: 2 }}>✕</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── TIMEZONE BLOCK (Admin → Company tab) ─────────────────────
const ALL_TIMEZONES = (() => {
  try { return Intl.supportedValuesOf('timeZone'); } catch {
    return [
      "Africa/Abidjan","Africa/Casablanca","Africa/Johannesburg","Africa/Lagos","Africa/Nairobi",
      "America/Bogota","America/Buenos_Aires","America/Chicago","America/Lima","America/Los_Angeles",
      "America/Mexico_City","America/New_York","America/Santiago","America/Sao_Paulo","America/Toronto",
      "Asia/Bangkok","Asia/Colombo","Asia/Dhaka","Asia/Dubai","Asia/Ho_Chi_Minh","Asia/Hong_Kong",
      "Asia/Jakarta","Asia/Karachi","Asia/Kolkata","Asia/Kuala_Lumpur","Asia/Manila","Asia/Riyadh",
      "Asia/Seoul","Asia/Shanghai","Asia/Singapore","Asia/Taipei","Asia/Tehran","Asia/Tokyo",
      "Atlantic/Reykjavik","Australia/Melbourne","Australia/Perth","Australia/Sydney",
      "Europe/Amsterdam","Europe/Athens","Europe/Berlin","Europe/Brussels","Europe/Bucharest",
      "Europe/Budapest","Europe/Copenhagen","Europe/Dublin","Europe/Helsinki","Europe/Istanbul",
      "Europe/Kiev","Europe/Lisbon","Europe/London","Europe/Luxembourg","Europe/Madrid",
      "Europe/Moscow","Europe/Oslo","Europe/Paris","Europe/Prague","Europe/Rome","Europe/Stockholm",
      "Europe/Vienna","Europe/Warsaw","Europe/Zurich","Pacific/Auckland","Pacific/Honolulu","UTC",
    ];
  }
})();

const getTzMeta = (tz) => {
  try {
    const now = new Date();
    const offset = new Intl.DateTimeFormat('en', { timeZone: tz, timeZoneName: 'shortOffset' })
      .formatToParts(now).find(p => p.type === 'timeZoneName')?.value || '';
    const time = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
    return { offset, time };
  } catch { return { offset: '', time: '--:--' }; }
};

const TimezoneBlock = ({ config, updateField }) => {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const dropRef = useRef(null);
  const currentTz = config.companyTimezone || 'Europe/Paris';
  const meta = getTzMeta(currentTz);

  const filtered = search.trim()
    ? ALL_TIMEZONES.filter(tz => tz.toLowerCase().includes(search.toLowerCase()))
    : ALL_TIMEZONES;

  useEffect(() => {
    const handler = (e) => { if (dropRef.current && !dropRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 14 }}>🕐 TIMEZONE</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>

        {/* Dropdown */}
        <div ref={dropRef} style={{ position: 'relative', flex: '1 1 260px', maxWidth: 360 }}>
          <div
            onClick={() => setOpen(o => !o)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: COLORS.bg, border: `1px solid ${open ? COLORS.accent : COLORS.border}`,
              borderRadius: 8, padding: '10px 14px', cursor: 'pointer', transition: 'border-color 0.2s',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 16 }}>🌍</span>
              <span style={{ fontSize: 14, color: COLORS.text, fontFamily: "'DM Mono', monospace" }}>{currentTz}</span>
            </div>
            <span style={{ color: COLORS.textMuted, fontSize: 12 }}>{open ? '▲' : '▼'}</span>
          </div>

          {open && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 200,
              background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10,
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)', overflow: 'hidden',
            }}>
              {/* Search */}
              <div style={{ padding: '10px 12px', borderBottom: `1px solid ${COLORS.border}` }}>
                <input
                  autoFocus
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Rechercher un timezone…"
                  style={{
                    width: '100%', background: COLORS.bg, border: `1px solid ${COLORS.border}`,
                    borderRadius: 6, padding: '7px 10px', color: COLORS.text, fontSize: 13,
                    outline: 'none', fontFamily: 'inherit',
                  }}
                />
              </div>
              {/* List */}
              <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                {filtered.length === 0 && (
                  <div style={{ padding: '16px', textAlign: 'center', color: COLORS.textMuted, fontSize: 13 }}>Aucun résultat</div>
                )}
                {filtered.map(tz => {
                  const m = getTzMeta(tz);
                  const selected = tz === currentTz;
                  return (
                    <div
                      key={tz}
                      onClick={() => { updateField('companyTimezone', tz); setOpen(false); setSearch(''); }}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '8px 14px', cursor: 'pointer', transition: 'background 0.1s',
                        background: selected ? `${COLORS.accent}18` : 'transparent',
                        borderLeft: selected ? `3px solid ${COLORS.accent}` : '3px solid transparent',
                      }}
                      onMouseEnter={e => { if (!selected) e.currentTarget.style.background = COLORS.hover; }}
                      onMouseLeave={e => { if (!selected) e.currentTarget.style.background = 'transparent'; }}
                    >
                      <span style={{ fontSize: 13, color: selected ? COLORS.accent : COLORS.text }}>{tz}</span>
                      <span style={{ fontSize: 11, color: COLORS.textMuted, fontFamily: "'DM Mono', monospace" }}>{m.offset}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Live clock badge */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: `${COLORS.accent}10`, border: `1px solid ${COLORS.accent}30`,
          borderRadius: 10, padding: '10px 18px', flexShrink: 0,
        }}>
          <span style={{ fontSize: 22, fontFamily: "'DM Mono', monospace", fontWeight: 700, color: COLORS.accent, letterSpacing: 1 }}>
            {meta.time}
          </span>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 11, color: COLORS.textSub, fontWeight: 600 }}>{meta.offset}</span>
            <span style={{ fontSize: 10, color: COLORS.textMuted }}>heure locale</span>
          </div>
        </div>

      </div>
    </div>
  );
};

// ─── SAVED VIEWS BLOCK ───────────────────────────────────────
const SavedViewsBlock = ({ config, updateField }) => {
  const views = config.companyViews || [];
  const [newName, setNewName] = useState("");
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState("");

  const save = (updated) => updateField("companyViews", updated);
  const addView = () => {
    const name = newName.trim();
    if (!name) return;
    save([...views, { id: Date.now(), name, filters: null }]);
    setNewName("");
  };
  const deleteView = (id) => save(views.filter(v => v.id !== id));
  const startEdit = (v) => { setEditId(v.id); setEditName(v.name); };
  const confirmEdit = () => {
    save(views.map(v => v.id === editId ? { ...v, name: editName.trim() || v.name } : v));
    setEditId(null);
  };

  return (
    <div>
      <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 14, lineHeight: 1.6 }}>
        Créez une vue ici, puis dans Companies sélectionnez-la, appliquez vos filtres et cliquez <strong style={{ color: COLORS.text }}>📌 Capturer</strong>.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
        {views.length === 0 && (
          <div style={{ fontSize: 12, color: COLORS.textMuted, padding: "10px 0" }}>Aucune vue — ajoutez-en une ci-dessous.</div>
        )}
        {views.map(v => (
          <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 8, background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "10px 14px" }}>
            {editId === v.id ? (
              <>
                <input autoFocus value={editName} onChange={e => setEditName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") confirmEdit(); if (e.key === "Escape") setEditId(null); }}
                  style={{ flex: 1, background: COLORS.card, border: `1px solid ${COLORS.accent}`, borderRadius: 6, padding: "5px 10px", color: COLORS.text, fontSize: 13, outline: "none", fontFamily: "inherit" }} />
                <button onClick={confirmEdit} style={{ background: COLORS.accent, color: COLORS.textOnAccent, border: "none", borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "inherit" }}>✓</button>
                <button onClick={() => setEditId(null)} style={{ background: "none", border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "5px 10px", cursor: "pointer", fontSize: 12, color: COLORS.textMuted, fontFamily: "inherit" }}>✕</button>
              </>
            ) : (
              <>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: COLORS.text }}>{v.name}</span>
                {v.filters
                  ? <span style={{ fontSize: 10, color: COLORS.green, fontWeight: 600, padding: "2px 7px", background: `${COLORS.green}15`, borderRadius: 5 }}>FILTRES DÉFINIS</span>
                  : <span style={{ fontSize: 10, color: COLORS.textMuted, fontWeight: 600, padding: "2px 7px", background: COLORS.hover, borderRadius: 5 }}>AUCUN FILTRE</span>
                }
                <button onClick={() => startEdit(v)} style={{ background: "none", border: "none", color: COLORS.accent, cursor: "pointer", fontSize: 14 }}>✏️</button>
                <button onClick={() => deleteView(v.id)} style={{ background: "none", border: "none", color: COLORS.red, cursor: "pointer", fontSize: 14 }}>🗑</button>
              </>
            )}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <input value={newName} onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === "Enter" && addView()}
          placeholder="Nom de la nouvelle vue…"
          style={{ flex: 1, background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "9px 14px", color: COLORS.text, fontSize: 13, outline: "none", fontFamily: "inherit" }}
          onFocus={e => e.target.style.borderColor = COLORS.accent}
          onBlur={e => e.target.style.borderColor = COLORS.border} />
        <button onClick={addView} style={{ background: COLORS.accent, color: COLORS.textOnAccent, border: "none", borderRadius: 8, padding: "9px 18px", cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "inherit" }}>+ Ajouter</button>
      </div>
    </div>
  );
};

// ─── EXCHANGE MANAGER BLOCK ───────────────────────────────────
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_LABELS = { Mon: "Lun", Tue: "Mar", Wed: "Mer", Thu: "Jeu", Fri: "Ven", Sat: "Sam", Sun: "Dim" };

const pad2 = n => String(n).padStart(2, "0");

const ExchangeManagerBlock = () => {
  const [exchanges, setExchanges] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Session form state per exchange
  const [sessForm, setSessForm] = useState({});
  const [editSessId, setEditSessId] = useState(null);
  const [showSessForm, setShowSessForm] = useState({});

  // Holiday form state per exchange
  const [holForm, setHolForm] = useState({});
  const [showHolForm, setShowHolForm] = useState({});

  const EMPTY_SESS = () => ({ name: "", open_hour: 9, open_minute: 0, close_hour: 17, close_minute: 30, overnight: false, trading_days: ["Mon","Tue","Wed","Thu","Fri"] });
  const EMPTY_HOL = () => ({ date: "", label: "" });

  useEffect(() => {
    async function load() {
      const [{ data: ex }, { data: se }, { data: ho }] = await Promise.all([
        supabase.from('exchanges').select('*').order('id'),
        supabase.from('exchange_sessions').select('*').order('sort_order'),
        supabase.from('exchange_holidays').select('*').order('date'),
      ]);
      if (ex) setExchanges(ex);
      if (se) setSessions(se);
      if (ho) setHolidays(ho);
      setLoading(false);
    }
    load();
  }, []);

  const toggleExpand = (id) => setExpanded(p => ({ ...p, [id]: !p[id] }));

  // ── Sessions ──
  const saveSession = async (exId, sessId) => {
    setSaving(true);
    const f = sessForm[exId] || EMPTY_SESS();
    const exSessions = sessions.filter(s => s.exchange_id === exId);
    if (sessId) {
      const { error } = await supabase.from('exchange_sessions').update({ name: f.name, open_hour: Number(f.open_hour), open_minute: Number(f.open_minute), close_hour: Number(f.close_hour), close_minute: Number(f.close_minute), overnight: f.overnight, trading_days: f.trading_days || ["Mon","Tue","Wed","Thu","Fri"] }).eq('id', sessId);
      if (!error) setSessions(prev => prev.map(s => s.id === sessId ? { ...s, ...f, open_hour: Number(f.open_hour), open_minute: Number(f.open_minute), close_hour: Number(f.close_hour), close_minute: Number(f.close_minute) } : s));
    } else {
      const newSess = { exchange_id: exId, name: f.name, open_hour: Number(f.open_hour), open_minute: Number(f.open_minute), close_hour: Number(f.close_hour), close_minute: Number(f.close_minute), overnight: f.overnight, trading_days: f.trading_days || ["Mon","Tue","Wed","Thu","Fri"], sort_order: exSessions.length };
      const { data, error } = await supabase.from('exchange_sessions').insert(newSess).select().single();
      if (!error && data) setSessions(prev => [...prev, data]);
    }
    setShowSessForm(p => ({ ...p, [exId]: false }));
    setEditSessId(null);
    setSessForm(p => ({ ...p, [exId]: EMPTY_SESS() }));
    setSaving(false);
  };

  const deleteSession = async (id) => {
    await supabase.from('exchange_sessions').delete().eq('id', id);
    setSessions(prev => prev.filter(s => s.id !== id));
  };

  const openEditSess = (exId, sess) => {
    setSessForm(p => ({ ...p, [exId]: { ...sess, trading_days: sess.trading_days || ["Mon","Tue","Wed","Thu","Fri"] } }));
    setEditSessId(sess.id);
    setShowSessForm(p => ({ ...p, [exId]: true }));
  };

  // ── Holidays ──
  const saveHoliday = async (exId) => {
    setSaving(true);
    const f = holForm[exId] || EMPTY_HOL();
    if (!f.date) { setSaving(false); return; }
    const newHol = { exchange_id: exId, date: f.date, label: f.label };
    const { data, error } = await supabase.from('exchange_holidays').insert(newHol).select().single();
    if (!error && data) setHolidays(prev => [...prev, data].sort((a,b) => a.date.localeCompare(b.date)));
    setShowHolForm(p => ({ ...p, [exId]: false }));
    setHolForm(p => ({ ...p, [exId]: EMPTY_HOL() }));
    setSaving(false);
  };

  const deleteHoliday = async (id) => {
    await supabase.from('exchange_holidays').delete().eq('id', id);
    setHolidays(prev => prev.filter(h => h.id !== id));
  };

  const toggleActive = async (ex) => {
    const newVal = !ex.active;
    await supabase.from('exchanges').update({ active: newVal }).eq('id', ex.id);
    setExchanges(prev => prev.map(e => e.id === ex.id ? { ...e, active: newVal } : e));
  };

  if (loading) return <div style={{ padding: 24, color: COLORS.textMuted, fontSize: 13 }}>Chargement des exchanges…</div>;

  return (
    <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, overflow: "hidden" }}>
      <div style={{ padding: "18px 24px", borderBottom: `1px solid ${COLORS.border}`, background: `${COLORS.blue}08` }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.text }}>🏛 Exchanges — Sessions & Jours fériés</div>
        <div style={{ fontSize: 12, color: COLORS.textSub, marginTop: 4 }}>Configurez les horaires de trading et les jours fériés par exchange</div>
      </div>
      <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
        {exchanges.map(ex => {
          const exSessions = sessions.filter(s => s.exchange_id === ex.id).sort((a,b) => (a.sort_order||0) - (b.sort_order||0));
          const exHolidays = holidays.filter(h => h.exchange_id === ex.id).sort((a,b) => a.date.localeCompare(b.date));
          const isOpen = expanded[ex.id];

          return (
            <div key={ex.id} style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 12, overflow: "hidden" }}>
              {/* Exchange header */}
              <div onClick={() => toggleExpand(ex.id)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", cursor: "pointer", userSelect: "none" }}
                onMouseEnter={e => e.currentTarget.style.background = COLORS.hover}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: `${COLORS.blue}20`, border: `1px solid ${COLORS.blue}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>🏛</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }}>{ex.name}</div>
                  <div style={{ fontSize: 11, color: COLORS.textMuted }}>{ex.city} · {ex.timezone}</div>
                </div>
                <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, background: `${COLORS.blue}15`, color: COLORS.blue, fontWeight: 600 }}>{exSessions.length} session{exSessions.length !== 1 ? "s" : ""}</span>
                <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, background: `${COLORS.orange}15`, color: COLORS.orange, fontWeight: 600 }}>{exHolidays.length} férié{exHolidays.length !== 1 ? "s" : ""}</span>
                <div onClick={e => { e.stopPropagation(); toggleActive(ex); }} style={{ padding: "3px 10px", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 700, background: ex.active ? `${COLORS.green}20` : `${COLORS.red}15`, color: ex.active ? COLORS.green : COLORS.red, border: `1px solid ${ex.active ? COLORS.green : COLORS.red}40` }}>
                  {ex.active ? "ACTIF" : "INACTIF"}
                </div>
                <span style={{ color: COLORS.textMuted, fontSize: 14, transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>▾</span>
              </div>

              {isOpen && (
                <div style={{ padding: "16px", borderTop: `1px solid ${COLORS.border}` }}>

                  {/* Sessions */}
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.text, textTransform: "uppercase", letterSpacing: 0.5 }}>⏰ Sessions de trading</div>
                      <Btn onClick={() => { setSessForm(p => ({ ...p, [ex.id]: EMPTY_SESS() })); setEditSessId(null); setShowSessForm(p => ({ ...p, [ex.id]: true })); }} style={{ padding: "5px 12px", fontSize: 12 }}>+ Ajouter</Btn>
                    </div>
                    {showSessForm[ex.id] && (() => {
                      const exId = ex.id;
                      const f = sessForm[exId] || EMPTY_SESS();
                      const setF = (patch) => setSessForm(p => ({ ...p, [exId]: { ...(p[exId] || EMPTY_SESS()), ...patch } }));
                      const toggleDay = (day) => { const days = f.trading_days || ["Mon","Tue","Wed","Thu","Fri"]; setF({ trading_days: days.includes(day) ? days.filter(d => d !== day) : [...days, day] }); };
                      const currentSessId = editSessId;
                      return (
                        <div style={{ background: COLORS.bg, border: `1px solid ${COLORS.accent}40`, borderRadius: 10, padding: 14, marginBottom: 10 }}>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                            <div style={{ gridColumn: "1/-1" }}>
                              <label style={{ fontSize: 11, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5 }}>NOM DE LA SESSION</label>
                              <input value={f.name} onChange={e => setF({ name: e.target.value })} placeholder="Ex: Regular, Pre-Opening…"
                                style={{ width: "100%", marginTop: 4, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 7, padding: "8px 12px", color: COLORS.text, fontSize: 13, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
                            </div>
                            {[["OUVERTURE", "open_hour", "open_minute"], ["FERMETURE", "close_hour", "close_minute"]].map(([lbl, hk, mk]) => (
                              <div key={hk}>
                                <label style={{ fontSize: 11, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5 }}>{lbl}</label>
                                <div style={{ display: "flex", gap: 6, marginTop: 4, alignItems: "center" }}>
                                  <input type="number" min={0} max={23} value={f[hk]} onChange={e => setF({ [hk]: Number(e.target.value) })}
                                    style={{ width: 60, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 7, padding: "8px 10px", color: COLORS.text, fontSize: 13, outline: "none", fontFamily: "'DM Mono', monospace", textAlign: "center" }} />
                                  <span style={{ color: COLORS.textMuted, fontWeight: 700 }}>:</span>
                                  <input type="number" min={0} max={59} value={f[mk]} onChange={e => setF({ [mk]: Number(e.target.value) })}
                                    style={{ width: 60, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 7, padding: "8px 10px", color: COLORS.text, fontSize: 13, outline: "none", fontFamily: "'DM Mono', monospace", textAlign: "center" }} />
                                </div>
                              </div>
                            ))}
                          </div>
                          <div style={{ marginBottom: 10 }}>
                            <label style={{ fontSize: 11, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5 }}>JOURS DE TRADING</label>
                            <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                              {DAYS.map(day => { const isActive = (f.trading_days || ["Mon","Tue","Wed","Thu","Fri"]).includes(day); return (
                                <button key={day} onClick={() => toggleDay(day)} style={{ padding: "4px 10px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "inherit", background: isActive ? `${COLORS.accent}25` : COLORS.hover, color: isActive ? COLORS.accent : COLORS.textMuted, border: `1px solid ${isActive ? COLORS.accent : COLORS.border}`, transition: "all 0.15s" }}>{DAY_LABELS[day]}</button>
                              ); })}
                            </div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                            <label style={{ fontSize: 12, color: COLORS.textSub, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                              <input type="checkbox" checked={f.overnight} onChange={e => setF({ overnight: e.target.checked })} />
                              Session overnight (chevauche minuit)
                            </label>
                          </div>
                          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                            <Btn variant="secondary" onClick={() => { setShowSessForm(p => ({ ...p, [exId]: false })); setEditSessId(null); setSessForm(p => ({ ...p, [exId]: EMPTY_SESS() })); }}>Annuler</Btn>
                            <Btn onClick={() => saveSession(exId, currentSessId)} disabled={saving || !f.name}>{saving ? "…" : currentSessId ? "Mettre à jour" : "Ajouter"}</Btn>
                          </div>
                        </div>
                      );
                    })()}
                    {exSessions.length === 0 && !showSessForm[ex.id] && (
                      <div style={{ color: COLORS.textMuted, fontSize: 12, padding: "8px 0" }}>Aucune session — cliquez sur "+ Ajouter"</div>
                    )}
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {exSessions.map(s => (
                        <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "8px 14px" }}>
                          <div style={{ flex: 1 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.text, marginRight: 10 }}>{s.name}</span>
                            <span style={{ fontSize: 12, fontFamily: "'DM Mono', monospace", color: COLORS.accent }}>{pad2(s.open_hour)}:{pad2(s.open_minute)} – {pad2(s.close_hour)}:{pad2(s.close_minute)}</span>
                            {s.overnight && <span style={{ marginLeft: 8, fontSize: 10, color: COLORS.purple, fontWeight: 700 }}>OVERNIGHT</span>}
                          </div>
                          <div style={{ display: "flex", gap: 4 }}>
                            {(s.trading_days || ["Mon","Tue","Wed","Thu","Fri"]).map(d => (
                              <span key={d} style={{ fontSize: 10, padding: "2px 5px", borderRadius: 4, background: `${COLORS.blue}15`, color: COLORS.blue, fontWeight: 600 }}>{DAY_LABELS[d]}</span>
                            ))}
                          </div>
                          <button onClick={() => openEditSess(ex.id, s)} style={{ background: "none", border: "none", color: COLORS.accent, cursor: "pointer", fontSize: 14 }}>✏️</button>
                          <button onClick={() => deleteSession(s.id)} style={{ background: "none", border: "none", color: COLORS.red, cursor: "pointer", fontSize: 14 }}>🗑</button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Holidays */}
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.text, textTransform: "uppercase", letterSpacing: 0.5 }}>🎌 Jours fériés</div>
                      <Btn onClick={() => { setHolForm(p => ({ ...p, [ex.id]: EMPTY_HOL() })); setShowHolForm(p => ({ ...p, [ex.id]: true })); }} style={{ padding: "5px 12px", fontSize: 12 }}>+ Ajouter</Btn>
                    </div>
                    {showHolForm[ex.id] && (
                      <div style={{ background: COLORS.bg, border: `1px solid ${COLORS.accent}40`, borderRadius: 10, padding: 14, marginBottom: 10 }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                          <div>
                            <label style={{ fontSize: 11, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5 }}>DATE</label>
                            <input type="date" value={holForm[ex.id]?.date || ""} onChange={e => setHolForm(p => ({ ...p, [ex.id]: { ...(p[ex.id] || EMPTY_HOL()), date: e.target.value } }))}
                              style={{ width: "100%", marginTop: 4, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 7, padding: "8px 12px", color: COLORS.text, fontSize: 13, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
                          </div>
                          <div>
                            <label style={{ fontSize: 11, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5 }}>LIBELLÉ</label>
                            <input value={holForm[ex.id]?.label || ""} onChange={e => setHolForm(p => ({ ...p, [ex.id]: { ...(p[ex.id] || EMPTY_HOL()), label: e.target.value } }))} placeholder="Ex: Christmas, Thanksgiving…"
                              style={{ width: "100%", marginTop: 4, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 7, padding: "8px 12px", color: COLORS.text, fontSize: 13, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                          <Btn variant="secondary" onClick={() => setShowHolForm(p => ({ ...p, [ex.id]: false }))}>Annuler</Btn>
                          <Btn onClick={() => saveHoliday(ex.id)} disabled={saving || !holForm[ex.id]?.date}>{saving ? "…" : "Ajouter"}</Btn>
                        </div>
                      </div>
                    )}
                    {exHolidays.length === 0 && !showHolForm[ex.id] && (
                      <div style={{ color: COLORS.textMuted, fontSize: 12, padding: "8px 0" }}>Aucun jour férié configuré</div>
                    )}
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {exHolidays.map(h => (
                        <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 10, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "8px 14px" }}>
                          <span style={{ fontSize: 12, fontFamily: "'DM Mono', monospace", color: COLORS.textSub, flexShrink: 0 }}>{h.date}</span>
                          <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: COLORS.text }}>{h.label}</span>
                          <button onClick={() => deleteHoliday(h.id)} style={{ background: "none", border: "none", color: COLORS.red, cursor: "pointer", fontSize: 14 }}>🗑</button>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const BatchEuronextFees = () => {
  const [batchState, setBatchState] = useState("idle"); // idle | confirm | running | done | error
  const [batchReport, setBatchReport] = useState(null);
  const [batchProgress, setBatchProgress] = useState({ phase: "", done: 0, total: 0 });

  const runBatch = async () => {
    setBatchState("running");
    setBatchReport(null);
    setBatchProgress({ phase: "Chargement des opérations…", done: 0, total: 0 });
    try {
      // 1. Load all operations fresh
      const PAGE = 1000;
      let allOps = [];
      let from = 0;
      while (true) {
        const { data, error } = await supabase.from("derivatives").select("data").range(from, from + PAGE - 1);
        if (error || !data || data.length === 0) break;
        allOps = [...allOps, ...data.map(r => r.data ?? r)];
        if (data.length < PAGE) break;
        from += PAGE;
      }

      setBatchProgress({ phase: "Chargement des tarifs…", done: 0, total: allOps.length });
      // 2. Load all tarifs (including inactive)
      const { data: tarifData } = await supabase.from("deriv_exchange_tarifs").select("data");
      const allTarifs = tarifData ? tarifData.map(r => r.data) : [];

      // 3. Load all products
      const { data: prodData } = await supabase.from("deriv_products").select("data");
      const allProducts = prodData ? prodData.map(r => r.data) : [];

      const norm = v => (v || "").toString().toLowerCase().trim();

      const computeFeesForOp = (op, tarifs, prods) => {
        const opBroker = norm(op.broker);
        const resolvedExchange = prods.find(p => norm(p.label) === norm(op.instrument))?.stoxxExchange || op.exchange || "";
        const opExchange = norm(resolvedExchange);
        const opTrans = norm(op.orderTransmissionType);
        const opOpType = norm(op.opType);
        const tradeDate = op.tradeDate || "";

        const matching = tarifs.filter(t => {
          const brokers = Array.isArray(t.financialBroker) ? t.financialBroker : [t.financialBroker];
          const transmissions = Array.isArray(t.orderTransmissionType) ? t.orderTransmissionType : [t.orderTransmissionType];
          const opTypes = Array.isArray(t.opType) ? t.opType : (t.opType ? [t.opType] : []);
          const brokerMatch = brokers.some(b => norm(b) === opBroker || norm(b).includes(opBroker) || opBroker.includes(norm(b)));
          const exchangeMatch = norm(t.exchange) === opExchange || norm(t.exchange).includes(opExchange) || opExchange.includes(norm(t.exchange));
          const transMatch = opTrans === "" || transmissions.some(tr => norm(tr) === opTrans);
          const opTypeMatch = opTypes.length === 0 || opOpType === "" || opTypes.some(ot => norm(ot) === opOpType);
          const dateFrom = t.validFrom || "";
          const dateTo = t.validTo || "";
          const dateMatch = (!dateFrom || tradeDate >= dateFrom) && (!dateTo || tradeDate <= dateTo);
          return brokerMatch && exchangeMatch && transMatch && opTypeMatch && dateMatch;
        });

        if (matching.length === 0) return { fees: null, matched: [], ambiguous: false };

        // Detect ambiguity: multiple tarifs of same tarifType matching same op
        const byType = {};
        matching.forEach(t => {
          const k = t.tarifType || "__none__";
          if (!byType[k]) byType[k] = [];
          byType[k].push(t);
        });
        const ambiguous = Object.values(byType).some(arr => arr.length > 1);
        if (ambiguous) return { fees: null, matched: matching, ambiguous: true };

        const total = matching.reduce((sum, t) => sum + (parseFloat(t.tarif) || 0), 0);
        const lots = parseFloat(op.quantity) || 1;
        return { fees: Math.round(total * lots), matched: matching, ambiguous: false };
      };

      // 4. Filter Euronext ops
      const euronextOps = allOps.filter(op => {
        const resolvedEx = allProducts.find(p => norm(p.label) === norm(op.instrument))?.stoxxExchange || op.exchange || "";
        return norm(resolvedEx).includes("euronext");
      });

      if (euronextOps.length === 0) {
        setBatchReport({ updated: 0, errors: [], total: 0, message: "Aucune opération Euronext trouvée." });
        setBatchState("done");
        return;
      }

      const updatedList = [];
      const errors = [];

      for (const op of euronextOps) {
        const { fees, matched, ambiguous } = computeFeesForOp(op, allTarifs, allProducts);

        if (ambiguous) {
          errors.push({
            ref: op.ref || op.id,
            tradeDate: op.tradeDate || "—",
            reason: `Ambiguïté — plusieurs tarifs du même type matchent cette trade date. Tarifs en conflit : ${matched.map(t => `${t.tarifType || "—"} [${t.validFrom || "∞"} → ${t.validTo || "∞"}] (${t.isActive ? "actif" : "inactif"})`).join(" | ")}`,
          });
          continue;
        }

        if (fees === null) {
          errors.push({
            ref: op.ref || op.id,
            tradeDate: op.tradeDate || "—",
            reason: `Aucun tarif trouvé — broker: "${op.broker || "—"}", exchange: "${op.exchange || "—"}", opType: "${op.opType || "—"}", transmission: "${op.orderTransmissionType || "—"}", tradeDate: "${op.tradeDate || "—"}"`,
          });
          continue;
        }

        const wasManual = op.fees !== undefined && op.fees !== "";
        const newOp = { ...op, fees: "" }; // clear override → auto
        updatedList.push({ op: newOp, oldFees: op.fees, newFees: fees, wasManual });
      }

      // 5. Persist safely:
      // Step A — deduplicate entire derivatives table first (in case of previous botched run)
      setBatchProgress({ phase: "Déduplication en base…", done: 0, total: updatedList.length });
      const { data: allRows } = await supabase.from("derivatives").select("id, data");
      if (allRows) {
        // Group rows by op id
        const byOpId = {};
        for (const row of allRows) {
          const opId = String(row.data?.id ?? row.id);
          if (!byOpId[opId]) byOpId[opId] = [];
          byOpId[opId].push(row);
        }
        const rowsToDelete = [];
        for (const [opId, rows] of Object.entries(byOpId)) {
          if (rows.length <= 1) continue;
          // Sort: prefer row with fees="" (batch result) — keep it, delete others
          // rows with fees="" or fees undefined = batch-processed (no override)
          // rows with fees set = original imported value
          rows.sort((a, b) => {
            const aClean = a.data?.fees === "" || a.data?.fees === undefined || a.data?.fees === null;
            const bClean = b.data?.fees === "" || b.data?.fees === undefined || b.data?.fees === null;
            if (aClean && !bClean) return -1; // keep a (clean), delete b
            if (!aClean && bClean) return 1;  // keep b (clean), delete a
            // Both same type: keep the one with highest Supabase id (most recent insert)
            return b.id - a.id;
          });
          // Keep first (best candidate), delete the rest
          rowsToDelete.push(...rows.slice(1).map(r => r.id));
        }
        if (rowsToDelete.length > 0) {
          const DDCHUNK = 100;
          for (let i = 0; i < rowsToDelete.length; i += DDCHUNK) {
            await supabase.from("derivatives").delete().in("id", rowsToDelete.slice(i, i + DDCHUNK));
          }
        }
      }

      // Step B — for each op to update: delete all rows with that op id, then insert once
      const CHUNK = 20;
      let savedCount = 0;
      setBatchProgress({ phase: "Sauvegarde…", done: 0, total: updatedList.length });
      for (let i = 0; i < updatedList.length; i += CHUNK) {
        const chunk = updatedList.slice(i, i + CHUNK);
        await Promise.all(chunk.map(async ({ op }) => {
          // delete ALL rows with this op id (catches any remaining duplicates)
          await supabase.from("derivatives").delete().eq("data->>id", String(op.id));
          await supabase.from("derivatives").insert({ data: op });
        }));
        savedCount += chunk.length;
        setBatchProgress({ phase: "Sauvegarde…", done: savedCount, total: updatedList.length });
      }

      setBatchReport({ total: euronextOps.length, updated: updatedList.length, errors, updatedList });
      setBatchState("done");
    } catch (err) {
      setBatchReport({ fatalError: String(err) });
      setBatchState("error");
    }
  };

  return (
    <div style={{ background: COLORS.card, border: `2px dashed ${COLORS.red}60`, borderRadius: 16, overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "16px 24px", background: `${COLORS.red}08`, borderBottom: batchState !== "idle" && batchState !== "confirm" ? `1px solid ${COLORS.border}` : "none", display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: `${COLORS.red}20`, border: `1px solid ${COLORS.red}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>🔁</div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.text }}>Batch — Recalcul fees Euronext</div>
            <span style={{ fontSize: 10, fontWeight: 700, background: `${COLORS.red}25`, color: COLORS.red, border: `1px solid ${COLORS.red}40`, borderRadius: 4, padding: "2px 8px", letterSpacing: 0.5 }}>⚠ USAGE UNIQUE</span>
          </div>
          <div style={{ fontSize: 12, color: COLORS.textSub, marginTop: 3 }}>
            Supprime les fees manuelles des ops Euronext et les recalcule (tarifs actifs + inactifs) en respectant les plages de validité (validFrom / validTo vs tradeDate).
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          {batchState === "idle" && (
            <div style={{ display: "flex", gap: 8 }}>
              <Btn variant="secondary" onClick={async () => {
                setBatchState("running");
                setBatchProgress({ phase: "Déduplication en base…", done: 0, total: 0 });
                try {
                  const { data: allRows } = await supabase.from("derivatives").select("id, data");
                  if (allRows) {
                    const byOpId = {};
                    for (const row of allRows) {
                      const opId = String(row.data?.id ?? row.id);
                      if (!byOpId[opId]) byOpId[opId] = [];
                      byOpId[opId].push(row);
                    }
                    const rowsToDelete = [];
                    for (const [opId, rows] of Object.entries(byOpId)) {
                      if (rows.length <= 1) continue;
                      rows.sort((a, b) => {
                        const aClean = a.data?.fees === "" || a.data?.fees === undefined || a.data?.fees === null;
                        const bClean = b.data?.fees === "" || b.data?.fees === undefined || b.data?.fees === null;
                        if (aClean && !bClean) return -1;
                        if (!aClean && bClean) return 1;
                        return b.id - a.id;
                      });
                      rowsToDelete.push(...rows.slice(1).map(r => r.id));
                    }
                    if (rowsToDelete.length > 0) {
                      const DDCHUNK = 100;
                      for (let i = 0; i < rowsToDelete.length; i += DDCHUNK) {
                        await supabase.from("derivatives").delete().in("id", rowsToDelete.slice(i, i + DDCHUNK));
                      }
                      setBatchReport({ dedupeOnly: true, removed: rowsToDelete.length, total: allRows.length });
                    } else {
                      setBatchReport({ dedupeOnly: true, removed: 0, total: allRows.length });
                    }
                  }
                  setBatchState("done");
                } catch (err) {
                  setBatchReport({ fatalError: String(err) }); setBatchState("error");
                }
              }}>🧹 Dédupliquer</Btn>
              <Btn variant="danger" onClick={() => setBatchState("confirm")}>Lancer le batch</Btn>
            </div>
          )}
          {batchState === "confirm" && <>
            <Btn variant="secondary" onClick={() => setBatchState("idle")}>Annuler</Btn>
            <Btn variant="danger" onClick={runBatch}>✓ Confirmer</Btn>
          </>}
          {batchState === "running" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: "4px 0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, color: COLORS.textMuted }}>⟳ {batchProgress.phase}</span>
                {batchProgress.total > 0 && (
                  <span style={{ fontSize: 12, fontFamily: "'DM Mono', monospace", color: COLORS.accent, fontWeight: 700 }}>
                    {batchProgress.done} / {batchProgress.total}
                  </span>
                )}
              </div>
              {batchProgress.total > 0 && (
                <div style={{ width: 180, height: 5, background: COLORS.border, borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.round((batchProgress.done / batchProgress.total) * 100)}%`, background: COLORS.accent, borderRadius: 3, transition: "width 0.3s ease" }} />
                </div>
              )}
            </div>
          )}
          {(batchState === "done" || batchState === "error") && <Btn variant="secondary" onClick={() => { setBatchState("idle"); setBatchReport(null); }}>Fermer</Btn>}
        </div>
      </div>

      {/* Confirm warning */}
      {batchState === "confirm" && (
        <div style={{ padding: "12px 24px", background: `${COLORS.red}08`, borderTop: `1px solid ${COLORS.red}30` }}>
          <div style={{ fontSize: 13, color: COLORS.red, fontWeight: 600 }}>
            ⚠ Cette action va effacer toutes les fees manuelles des opérations Euronext et les remplacer par le calcul automatique (avec dates de validité). Confirmez-vous ?
          </div>
        </div>
      )}

      {/* Results */}
      {batchState === "done" && batchReport && !batchReport.fatalError && batchReport.dedupeOnly && (
            <div style={{ padding: "16px 24px" }}>
              <div style={{ background: batchReport.removed > 0 ? `${COLORS.green}10` : COLORS.bg, border: `1px solid ${batchReport.removed > 0 ? COLORS.green + "40" : COLORS.border}`, borderRadius: 10, padding: "12px 16px" }}>
                {batchReport.removed > 0
                  ? <span style={{ fontSize: 13, color: COLORS.green, fontWeight: 700 }}>✓ {batchReport.removed} doublon{batchReport.removed > 1 ? "s" : ""} supprimé{batchReport.removed > 1 ? "s" : ""} sur {batchReport.total} lignes — la row avec fees vides (résultat du batch) a été conservée pour chaque op.</span>
                  : <span style={{ fontSize: 13, color: COLORS.textMuted }}>✓ Aucun doublon trouvé ({batchReport.total} lignes).</span>
                }
              </div>
            </div>
      )}
      {batchState === "done" && batchReport && !batchReport.fatalError && !batchReport.dedupeOnly && (
        <div style={{ padding: "16px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {[
              { label: "ops mises à jour", value: batchReport.updated, color: COLORS.green },
              { label: "erreurs", value: batchReport.errors.length, color: batchReport.errors.length > 0 ? COLORS.red : COLORS.textMuted },
              { label: "ops Euronext total", value: batchReport.total, color: COLORS.textSub },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "10px 16px", flex: 1, minWidth: 90 }}>
                <div style={{ fontSize: 22, fontWeight: 800, color, fontFamily: "'DM Mono', monospace" }}>{value}</div>
                <div style={{ fontSize: 11, color: COLORS.textSub, marginTop: 3 }}>{label}</div>
              </div>
            ))}
          </div>
          {batchReport.message && <div style={{ fontSize: 13, color: COLORS.textMuted, fontStyle: "italic" }}>{batchReport.message}</div>}

          {batchReport.updatedList?.length > 0 && (
            <div style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 10, overflow: "hidden" }}>
              <div style={{ padding: "8px 14px", background: `${COLORS.green}10`, fontSize: 11, fontWeight: 700, color: COLORS.green, letterSpacing: 0.5 }}>OPÉRATIONS MISES À JOUR</div>
              <div style={{ maxHeight: 220, overflowY: "auto" }}>
                {batchReport.updatedList.map(({ op, oldFees, newFees, wasManual }, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 14px", borderTop: i > 0 ? `1px solid ${COLORS.border}` : "none", fontSize: 12 }}>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontWeight: 700, color: COLORS.accent, minWidth: 100 }}>{op.ref || op.id}</span>
                    <span style={{ color: COLORS.textMuted, minWidth: 80 }}>{op.tradeDate || "—"}</span>
                    {wasManual && <span style={{ fontSize: 10, background: `${COLORS.orange}20`, color: COLORS.orange, borderRadius: 4, padding: "1px 6px", fontWeight: 700 }}>manuel: {oldFees}</span>}
                    <span style={{ marginLeft: "auto", fontFamily: "'DM Mono', monospace", color: COLORS.green, fontWeight: 700 }}>→ {newFees}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {batchReport.errors.length > 0 && (
            <div style={{ background: COLORS.bg, border: `1px solid ${COLORS.red}40`, borderRadius: 10, overflow: "hidden" }}>
              <div style={{ padding: "8px 14px", background: `${COLORS.red}10`, fontSize: 11, fontWeight: 700, color: COLORS.red, letterSpacing: 0.5 }}>ERREURS — fees non recalculées</div>
              <div style={{ maxHeight: 220, overflowY: "auto" }}>
                {batchReport.errors.map((e, i) => (
                  <div key={i} style={{ padding: "9px 14px", borderTop: i > 0 ? `1px solid ${COLORS.border}` : "none" }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 3 }}>
                      <span style={{ fontFamily: "'DM Mono', monospace", fontWeight: 700, color: COLORS.red, fontSize: 12 }}>{e.ref}</span>
                      <span style={{ fontSize: 11, color: COLORS.textMuted }}>{e.tradeDate}</span>
                    </div>
                    <div style={{ fontSize: 11, color: COLORS.textSub, lineHeight: 1.6 }}>{e.reason}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
          )}

      {batchState === "error" && batchReport?.fatalError && (
        <div style={{ padding: "14px 24px", color: COLORS.red, fontSize: 13 }}>❌ Erreur fatale : {batchReport.fatalError}</div>
      )}
    </div>
  );
};

const AdminPanel = ({ companies = [] }) => {
  const { config, updateField } = useConfig();
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [adminTab, setAdminTab] = useState("fields");
  const [employees, setEmployees] = useState([]);

useEffect(() => {
  async function loadEmployees() {
    const { data } = await supabase.from('employees').select('data');
    if (data?.length) setEmployees(data.map(r => r.data));
  }
  loadEmployees();
}, []);
  const [empForm, setEmpForm] = useState({ firstName: "", name: "", phone: "", email: "", status: "active", role: "user", password: "" });
  const [editEmpId, setEditEmpId] = useState(null);
  const [showEmpForm, setShowEmpForm] = useState(false);

  // ── Deriv Accounts state ──
  const EMPTY_ACC = () => ({ accountNumber: "", businessUnit: "", currency: [], initialAmount: "", isActive: true, accountType: config.derivDefaultAccountType || "", financingBank: "", contracts: "", trade: "" });
  const [derivAccounts, setDerivAccounts] = useState([]);

useEffect(() => {
  async function loadAccounts() {
    const { data } = await supabase.from('deriv_accounts').select('*');
    if (data?.length) setDerivAccounts(data.map(r => {
      const acc = r.data ?? r;
      if (typeof acc.isActive === "string") {
        acc.isActive = acc.isActive.trim().toLowerCase() !== "false" && acc.isActive.trim() !== "0";
      }
      return acc;
    }));
  }
  loadAccounts();
}, []);
  const [accForm, setAccForm] = useState(EMPTY_ACC());
  const [editAccId, setEditAccId] = useState(null);
  const [showAccForm, setShowAccForm] = useState(false);
  const [showAccImport, setShowAccImport] = useState(false);
  const [expandedAccounts, setExpandedAccounts] = useState(false);
  const [accSearch, setAccSearch] = useState("");
  const [expandedOrderTransmission, setExpandedOrderTransmission] = useState(false);
  const [expandedFinancialBrokers, setExpandedFinancialBrokers] = useState(false);
  const [expandedLotSizes, setExpandedLotSizes] = useState(false);

  // ── Lot Sizes state ──
  const EMPTY_LS = { exchange: "", instrument: "", quantity: "", volumeUnit: "" };
  const [lotSizes, setLotSizes] = useState([]);
  const [lsForm, setLsForm] = useState(EMPTY_LS);
  const [editLsId, setEditLsId] = useState(null);
  const [showLsForm, setShowLsForm] = useState(false);

  useEffect(() => {
    async function loadLotSizes() {
      const { data } = await supabase.from('deriv_lot_sizes').select('data');
      if (data?.length) setLotSizes(data.map(r => r.data));
    }
    loadLotSizes();
  }, []);

  const isLsFormValid = () =>
    lsForm.exchange.trim() !== "" &&
    lsForm.instrument.trim() !== "" &&
    String(lsForm.quantity).trim() !== "" &&
    lsForm.volumeUnit !== "";

  const saveLotSize = async () => {
    if (!isLsFormValid()) return;
    const updated = editLsId
      ? lotSizes.map(l => l.id === editLsId ? { ...lsForm, id: editLsId } : l)
      : [...lotSizes, { ...lsForm, id: Date.now() }];
    setLotSizes(updated);
    await safeSave('deriv_lot_sizes', updated, setLotSizes, lotSizes);
    setLsForm(EMPTY_LS);
    setEditLsId(null);
    setShowLsForm(false);
  };

  const deleteLotSize = async (id) => {
    const updated = lotSizes.filter(l => l.id !== id);
    setLotSizes(updated);
    await safeSave('deriv_lot_sizes', updated, setLotSizes, lotSizes);
  };

  // ── Exchange Tarifs state ──
  const EMPTY_ET = { financialBroker: [], exchange: "", tarifType: "", opType: [], orderTransmissionType: [], tarif: "", currency: "", validFrom: "", validTo: "", isActive: true };
  const [exchangeTarifs, setExchangeTarifs] = useState([]);
  const [etForm, setEtForm] = useState(EMPTY_ET);
  const [editEtId, setEditEtId] = useState(null);
  const [showEtForm, setShowEtForm] = useState(false);
  const [expandedExchangeTarifs, setExpandedExchangeTarifs] = useState(false);
  const [etFilters, setEtFilters] = useState({ exchange: [], tarifType: [], opType: [], transmission: [], broker: [], isActive: "all" });

  // ── Price Units state ──
  const EMPTY_PU = { exchange: "", underlying: "", unit: "" };
  const [priceUnits, setPriceUnits] = useState([]);
  const [puForm, setPuForm] = useState(EMPTY_PU);
  const [editPuId, setEditPuId] = useState(null);
  const [showPuForm, setShowPuForm] = useState(false);
  const [expandedPriceUnits, setExpandedPriceUnits] = useState(false);

  useEffect(() => {
    async function loadPriceUnits() {
      const { data } = await supabase.from('deriv_price_units').select('data');
      if (data?.length) setPriceUnits(data.map(r => r.data));
    }
    loadPriceUnits();
  }, []);

  const isPuFormValid = () => puForm.exchange !== "" && String(puForm.unit).trim() !== "" && !isNaN(parseFloat(puForm.unit));

  const savePriceUnit = async () => {
    if (!isPuFormValid()) return;
    const clean = { ...puForm, unit: parseFloat(puForm.unit) };
    const updated = editPuId
      ? priceUnits.map(p => p.id === editPuId ? { ...clean, id: editPuId } : p)
      : [...priceUnits, { ...clean, id: Date.now() }];
    setPriceUnits(updated);
    await safeSave('deriv_price_units', updated, setPriceUnits, priceUnits);
    setPuForm(EMPTY_PU); setEditPuId(null); setShowPuForm(false);
  };

  const deletePriceUnit = async (id) => {
    const updated = priceUnits.filter(p => p.id !== id);
    setPriceUnits(updated);
    await safeSave('deriv_price_units', updated, setPriceUnits, priceUnits);
  };

  // ── Quotation Units state ──
  const EMPTY_QU = { underlying: "", exchange: "", quotationUnit: "" };
  const [quotationUnits, setQuotationUnits] = useState([]);
  const [quForm, setQuForm] = useState(EMPTY_QU);
  const [editQuId, setEditQuId] = useState(null);
  const [showQuForm, setShowQuForm] = useState(false);
  const [expandedQuotationUnits, setExpandedQuotationUnits] = useState(false);

  useEffect(() => {
    async function loadQuotationUnits() {
      const { data } = await supabase.from('deriv_quotation_units').select('data');
      if (data?.length) setQuotationUnits(data.map(r => r.data));
    }
    loadQuotationUnits();
  }, []);

  const isQuFormValid = () => quForm.underlying !== "" && quForm.exchange !== "" && quForm.quotationUnit.trim() !== "";

  const saveQuotationUnit = async () => {
    if (!isQuFormValid()) return;
    const updated = editQuId
      ? quotationUnits.map(q => q.id === editQuId ? { ...quForm, id: editQuId } : q)
      : [...quotationUnits, { ...quForm, id: Date.now() }];
    setQuotationUnits(updated);
    await safeSave('deriv_quotation_units', updated, setQuotationUnits, quotationUnits);
    setQuForm(EMPTY_QU); setEditQuId(null); setShowQuForm(false);
  };

  const deleteQuotationUnit = async (id) => {
    const updated = quotationUnits.filter(q => q.id !== id);
    setQuotationUnits(updated);
    await safeSave('deriv_quotation_units', updated, setQuotationUnits, quotationUnits);
  };

  useEffect(() => {
    async function loadExchangeTarifs() {
      const { data } = await supabase.from('deriv_exchange_tarifs').select('data');
      if (data?.length) setExchangeTarifs(data.map(r => r.data));
    }
    loadExchangeTarifs();
  }, []);

  const isEtFormValid = () =>
    (etForm.financialBroker || []).length > 0 &&
    etForm.exchange !== "" &&
    etForm.tarifType !== "" &&
    (etForm.orderTransmissionType || []).length > 0 &&
    etForm.tarif.trim() !== "" &&
    etForm.currency !== "";

  const saveExchangeTarif = async () => {
    if (!isEtFormValid()) return;
    const updated = editEtId
      ? exchangeTarifs.map(e => e.id === editEtId ? { ...etForm, id: editEtId } : e)
      : [...exchangeTarifs, { ...etForm, id: Date.now() }];
    setExchangeTarifs(updated);
    await safeSave('deriv_exchange_tarifs', updated, setExchangeTarifs, exchangeTarifs);
    setEtForm(EMPTY_ET);
    setEditEtId(null);
    setShowEtForm(false);
  };

  const deleteExchangeTarif = async (id) => {
    const updated = exchangeTarifs.filter(e => e.id !== id);
    setExchangeTarifs(updated);
    await safeSave('deriv_exchange_tarifs', updated, setExchangeTarifs, exchangeTarifs);
  };

  const isAccFormValid = () =>
    accForm.accountNumber.trim() !== "" &&
    accForm.businessUnit !== "" &&
    Array.isArray(accForm.currency) && accForm.currency.length > 0 &&
    String(accForm.initialAmount).trim() !== "";

  const saveAccount = async () => {
    if (!isAccFormValid()) return;
    const cleanCurrency = [...new Set((Array.isArray(accForm.currency) ? accForm.currency : [accForm.currency]).map(v => v?.toUpperCase()).filter(Boolean))];
    const cleanForm = { ...accForm, currency: cleanCurrency };
    const updated = editAccId
      ? derivAccounts.map(a => a.id === editAccId ? { ...cleanForm, id: editAccId } : a)
      : [...derivAccounts, { ...cleanForm, id: Date.now() }];
    setDerivAccounts(updated);
    await safeSave('deriv_accounts', updated, setDerivAccounts, derivAccounts);
    setAccForm(EMPTY_ACC());
    setEditAccId(null);
    setShowAccForm(false);
  };

  const deleteAccount = async (id) => {
    const updated = derivAccounts.filter(a => a.id !== id);
    setDerivAccounts(updated);
    await safeSave('deriv_accounts', updated, setDerivAccounts, derivAccounts);
  };

  const saveEmployee = async () => {
    const updated = editEmpId ? employees.map(e => e.id === editEmpId ? { ...empForm, id: editEmpId } : e) : [...employees, { ...empForm, id: Date.now() }];
    setEmployees(updated);
    await supabase.from('employees').delete().neq('id', 0);
for (const e of updated) await supabase.from('employees').insert({ data: e });
    setEmpForm({ firstName: "", name: "", phone: "", email: "", status: "active", role: "user", password: "" });
    setEditEmpId(null);
    setShowEmpForm(false);
  };

  const deleteEmployee = async (id) => {
    const updated = employees.filter(e => e.id !== id);
    setEmployees(updated);
    await supabase.from('employees').delete().neq('id', 0);
for (const e of updated) await supabase.from('employees').insert({ data: e });
  };

  const resetToDefaults = () => {
    FIELD_DEFINITIONS.forEach(f => updateField(f.key, DEFAULT_CONFIG[f.key]));
    setShowResetConfirm(false);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: `${COLORS.gold}20`, border: `1px solid ${COLORS.gold}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>⚙</div>
            <h1 style={{ margin: 0, fontSize: 28, color: COLORS.text, fontFamily: "'Inter', sans-serif" }}>Admin Panel</h1>
          </div>
          <p style={{ margin: 0, color: COLORS.textSub, fontSize: 14 }}>Gérez les valeurs prédéfinies de vos champs CRM sans toucher au code</p>
        </div>
        <Btn variant="danger" style={{ padding: "8px 14px", fontSize: 12 }} onClick={() => setShowResetConfirm(true)}>↺ Réinitialiser les défauts</Btn>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        {[["fields", "📋 Champs CRM"], ["derivatives", "◬ Derivatives"], ["company", "🏢 Company"]].map(([t, l]) => (
          <span key={t} onClick={() => setAdminTab(t)} style={{ cursor: "pointer", fontSize: 13, fontWeight: 700, padding: "6px 18px", borderRadius: 10, background: adminTab === t ? (t === "derivatives" ? COLORS.blue : COLORS.accent) : COLORS.bg, color: adminTab === t ? "#fff" : COLORS.textMuted, border: `1px solid ${adminTab === t ? (t === "derivatives" ? COLORS.blue : COLORS.accent) : COLORS.border}` }}>{l}</span>
        ))}
      </div>

      {adminTab === "derivatives" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Accounts CRUD */}
          <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, overflow: "hidden" }}>
            <div onClick={() => setExpandedAccounts(!expandedAccounts)} style={{ padding: "18px 24px", borderBottom: expandedAccounts ? `1px solid ${COLORS.border}` : "none", display: "flex", alignItems: "center", gap: 14, background: `${COLORS.blue}08`, cursor: "pointer", userSelect: "none" }}
              onMouseOver={e => e.currentTarget.style.background = `${COLORS.blue}14`}
              onMouseOut={e => e.currentTarget.style.background = `${COLORS.blue}08`}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: COLORS.hover, border: `1px solid ${COLORS.blue}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>💼</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.text }}>Accounts</div>
                <div style={{ fontSize: 12, color: COLORS.textSub }}>Comptes de trading pour les opérations sur dérivés</div>
              </div>
              <span style={{ fontSize: 11, color: COLORS.textMuted, background: COLORS.bg, padding: "3px 10px", borderRadius: 6, border: `1px solid ${COLORS.border}`, marginRight: 8 }}>{derivAccounts.length} compte{derivAccounts.length !== 1 ? "s" : ""}</span>
              <div onClick={e => { e.stopPropagation(); setShowAccImport(true); if (!expandedAccounts) setExpandedAccounts(true); }} style={{ cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: "7px 12px", borderRadius: 8, border: `1px solid ${COLORS.border}`, background: "transparent", marginRight: 4 }} title="Importer depuis Excel"><img src="/logoxl.png" style={{ width: 22, height: 22, objectFit: "contain" }} /></div>
              <Btn onClick={e => { e.stopPropagation(); setAccForm(EMPTY_ACC()); setEditAccId(null); setShowAccForm(true); if (!expandedAccounts) setExpandedAccounts(true); }} style={{ padding: "7px 14px", fontSize: 13 }}>+ Ajouter</Btn>
              <span style={{ color: COLORS.textMuted, fontSize: 14, transition: "transform 0.2s", display: "inline-block", transform: expandedAccounts ? "rotate(180deg)" : "rotate(0deg)", marginLeft: 4 }}>▾</span>
            </div>
            {showAccImport && (
              <DerivAccountImportModal
                config={config}
                onClose={() => setShowAccImport(false)}
                onImport={async (newItems) => {
                  const updated = [...derivAccounts, ...newItems];
                  setDerivAccounts(updated);
                  await safeSave('deriv_accounts', updated, setDerivAccounts, derivAccounts);
                }}
              />
            )}
            {expandedAccounts && <div style={{ padding: "20px 24px" }}>

              {showAccForm && (
                <div style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 18, marginBottom: 16 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <label style={{ fontSize: 12, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5 }}>ACCOUNT NUMBER <span style={{ color: COLORS.red }}>*</span></label>
                      <input value={accForm.accountNumber} onChange={e => { const v = e.target.value; setAccForm(p => ({ ...p, accountNumber: v })); }} placeholder="ex: ACC-001"
                        style={{ background: COLORS.card, border: `1px solid ${!accForm.accountNumber.trim() ? COLORS.red + "60" : COLORS.border}`, borderRadius: 8, padding: "10px 14px", color: COLORS.text, fontSize: 14, outline: "none", fontFamily: "inherit" }}
                        onFocus={e => e.target.style.borderColor = COLORS.accent} onBlur={e => e.target.style.borderColor = !accForm.accountNumber.trim() ? COLORS.red + "60" : COLORS.border} />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <label style={{ fontSize: 12, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5 }}>BUSINESS UNIT <span style={{ color: COLORS.red }}>*</span></label>
                      <select value={accForm.businessUnit} onChange={e => { const v = e.target.value; setAccForm(p => ({ ...p, businessUnit: v })); }}
                        style={{ background: COLORS.card, border: `1px solid ${!accForm.businessUnit ? COLORS.red + "60" : COLORS.border}`, borderRadius: 8, padding: "10px 14px", color: accForm.businessUnit ? COLORS.text : COLORS.textMuted, fontSize: 14, outline: "none", fontFamily: "inherit" }}>
                        <option value="">— Sélectionner —</option>
                        {config.businessUnit.filter(b => (config.derivBusinessUnits || []).includes(b.value)).map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
                      </select>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <label style={{ fontSize: 12, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5 }}>ACCOUNT CURRENCY <span style={{ color: COLORS.red }}>*</span></label>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {(config.contractsCurrency || []).map(c => {
                          const selected = Array.isArray(accForm.currency) && accForm.currency.some(v => (v || "").toUpperCase() === (c.value || "").toUpperCase());
                          const col = c.color || COLORS.accent;
                          return (
                            <div key={c.value} onClick={() => {
                              const cur = Array.isArray(accForm.currency) ? accForm.currency : [];
                              const next = selected ? cur.filter(v => v !== c.value) : [...cur, c.value];
                              setAccForm(f => ({ ...f, currency: next }));
                            }}
                              style={{ padding: "7px 14px", borderRadius: 8, cursor: "pointer", fontWeight: selected ? 700 : 500, fontSize: 12, transition: "all 0.15s", border: `1.5px solid ${selected ? col : COLORS.border}`, background: selected ? `${col}18` : COLORS.bg, color: selected ? col : COLORS.textSub, userSelect: "none" }}>
                              {c.label}
                            </div>
                          );
                        })}
                      </div>
                      {(!Array.isArray(accForm.currency) || accForm.currency.length === 0) && (
                        <span style={{ fontSize: 11, color: COLORS.red + "99" }}>⚠ Sélectionnez au moins une devise</span>
                      )}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <label style={{ fontSize: 12, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5 }}>INITIAL AMOUNT <span style={{ color: COLORS.red }}>*</span></label>
                      <input type="number" value={accForm.initialAmount} onChange={e => { const v = e.target.value; setAccForm(p => ({ ...p, initialAmount: v })); }} placeholder="ex: 500000"
                        style={{ background: COLORS.card, border: `1px solid ${String(accForm.initialAmount).trim() === "" ? COLORS.red + "60" : COLORS.border}`, borderRadius: 8, padding: "10px 14px", color: COLORS.text, fontSize: 14, outline: "none", fontFamily: "inherit" }}
                        onFocus={e => e.target.style.borderColor = COLORS.accent} onBlur={e => e.target.style.borderColor = String(accForm.initialAmount).trim() === "" ? COLORS.red + "60" : COLORS.border} />
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 14 }}>
                    {/* Account Type */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <label style={{ fontSize: 12, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5 }}>ACCOUNT TYPE</label>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {(Array.isArray(config.derivAccountTypes) ? config.derivAccountTypes : []).map(opt => {
                          const active = accForm.accountType === opt.value;
                          const col = opt.color || COLORS.accent;
                          return (
                            <div key={opt.value} onClick={() => setAccForm(f => ({ ...f, accountType: active ? "" : opt.value }))}
                              style={{ flex: 1, minWidth: 80, textAlign: "center", padding: "9px 4px", borderRadius: 8, cursor: "pointer", fontWeight: active ? 700 : 500, fontSize: 11, transition: "all 0.15s", border: `1.5px solid ${active ? col : COLORS.border}`, background: active ? `${col}18` : COLORS.bg, color: active ? col : COLORS.textSub, userSelect: "none" }}>
                              {opt.label}
                            </div>
                          );
                        })}
                        {(Array.isArray(config.derivAccountTypes) ? config.derivAccountTypes : []).length === 0 && <span style={{ fontSize: 11, color: COLORS.orange }}>💡 Aucun type — ajoutez-en dans le bloc Account Types</span>}
                      </div>
                    </div>
                    {/* Financing Bank */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <label style={{ fontSize: 12, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5 }}>FINANCING BANK</label>
                      <select value={accForm.financingBank} onChange={e => setAccForm(f => ({ ...f, financingBank: e.target.value }))}
                        style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "10px 14px", color: accForm.financingBank ? COLORS.text : COLORS.textMuted, fontSize: 13, fontFamily: "inherit", outline: "none" }}>
                        <option value="">— Aucune —</option>
                        {(Array.isArray(config.derivFinancingBanks) ? config.derivFinancingBanks : []).map(name => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                      </select>
                      {(Array.isArray(config.derivFinancingBanks) ? config.derivFinancingBanks : []).length === 0 && (
                        <span style={{ fontSize: 11, color: COLORS.orange }}>💡 Aucune banque — ajoutez-en dans le bloc Financing Banks</span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 14, marginTop: 14 }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <label style={{ fontSize: 12, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5 }}>TRADE</label>
                      <input value={accForm.trade || ""} onChange={e => setAccForm(f => ({ ...f, trade: e.target.value }))} placeholder="ex: TRD-001"
                        style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "10px 14px", color: COLORS.text, fontSize: 14, outline: "none", fontFamily: "inherit" }} />
                    </div>
                  </div>

                  <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 12 }}>
                    <label style={{ fontSize: 12, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5 }}>IS ACTIVE</label>
                    <div onClick={() => setAccForm({ ...accForm, isActive: !accForm.isActive })}
                      style={{ width: 44, height: 24, borderRadius: 12, background: accForm.isActive ? COLORS.green : COLORS.border, cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
                      <div style={{ position: "absolute", top: 3, left: accForm.isActive ? 23 : 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 4px #0005" }} />
                    </div>
                    <span style={{ fontSize: 13, color: accForm.isActive ? COLORS.green : COLORS.textMuted, fontWeight: 600 }}>{accForm.isActive ? "Active" : "Inactive"}</span>
                  </div>
                  {!isAccFormValid() && (
                    <div style={{ marginTop: 12, fontSize: 12, color: COLORS.red, background: `${COLORS.red}10`, border: `1px solid ${COLORS.red}30`, borderRadius: 8, padding: "8px 12px" }}>
                      ⚠ Tous les champs marqués <strong>*</strong> sont obligatoires.
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
                    <Btn variant="secondary" onClick={() => setShowAccForm(false)}>Annuler</Btn>
                    <Btn onClick={saveAccount} disabled={!isAccFormValid()}>Enregistrer</Btn>
                  </div>
                </div>
              )}

              {derivAccounts.length === 0 && !showAccForm && (
                <div style={{ textAlign: "center", color: COLORS.textMuted, padding: 32, fontSize: 13 }}>Aucun compte — cliquez sur "+ Ajouter" pour commencer</div>
              )}

              {derivAccounts.length > 0 && (
                <>
                  {/* Search bar */}
                  <div style={{ marginBottom: 12 }}>
                    <input
                      value={accSearch}
                      onChange={e => setAccSearch(e.target.value)}
                      placeholder="🔍 Rechercher un compte…"
                      style={{ width: "100%", background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "8px 14px", color: COLORS.text, fontSize: 13, outline: "none", fontFamily: "inherit" }}
                    />
                  </div>

                  {(() => {
                    const q = accSearch.trim().toLowerCase();
                    const filtered = derivAccounts.filter(a =>
                      !q ||
                      a.accountNumber?.toLowerCase().includes(q) ||
                      a.businessUnit?.toLowerCase().includes(q) ||
                      a.financingBank?.toLowerCase().includes(q) ||
                      a.contracts?.toLowerCase().includes(q)
                    );
                    const active = filtered.filter(a => a.isActive !== false && String(a.isActive).toLowerCase() !== "false");
                    const inactive = filtered.filter(a => a.isActive === false || String(a.isActive).toLowerCase() === "false");

                    const renderRow = (a) => {
                      const bu = config.businessUnit.find(b => b.value === a.businessUnit);
                      return (
                        <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 14, background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "12px 16px" }}>
                          <div style={{ width: 36, height: 36, borderRadius: 10, background: `${COLORS.blue}18`, border: `1px solid ${COLORS.blue}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>💼</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text, fontFamily: "'DM Mono', monospace" }}>{a.accountNumber}</div>
                            <div style={{ fontSize: 11, color: COLORS.textSub, marginTop: 2, display: "flex", gap: 10, flexWrap: "wrap" }}>
                              {bu && <span style={{ color: bu.color || COLORS.textSub }}>◈ {bu.label}</span>}
                              <span>💱 {[...new Set((Array.isArray(a.currency) ? a.currency : (a.currency ? [a.currency] : [])).map(v => v?.toUpperCase()).filter(Boolean))].map(v => (config.contractsCurrency || []).find(c => c.value.toUpperCase() === v)?.label || v).join(" · ") || "—"}</span>
                              {a.initialAmount && <span style={{ color: COLORS.green, fontFamily: "'DM Mono', monospace" }}>{Number(a.initialAmount).toLocaleString("fr")}</span>}
                              {a.accountType && (() => { const opt = (Array.isArray(config.derivAccountTypes) ? config.derivAccountTypes : []).find(o => o.value === a.accountType); return opt ? <span style={{ color: opt.color || COLORS.accent, fontWeight: 700 }}>● {opt.label}</span> : <span style={{ color: COLORS.textMuted }}>● {a.accountType}</span>; })()}
                              {a.financingBank && <span style={{ color: COLORS.accent }}>🏦 {a.financingBank}</span>}
                              {a.contracts && <span style={{ color: COLORS.textSub }}>📄 {a.contracts}</span>}
                              {a.trade && <span style={{ color: COLORS.textSub }}>🔀 {a.trade}</span>}
                            </div>
                          </div>
                          <div onClick={() => { const updated = derivAccounts.map(x => x.id === a.id ? { ...x, isActive: !x.isActive } : x); setDerivAccounts(updated); safeSave('deriv_accounts', updated, setDerivAccounts, derivAccounts); }}
                            style={{ width: 40, height: 22, borderRadius: 11, background: a.isActive ? COLORS.green : COLORS.border, cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
                            <div style={{ position: "absolute", top: 3, left: a.isActive ? 21 : 3, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px #0005" }} />
                          </div>
                          <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, fontWeight: 600, minWidth: 58, textAlign: "center", background: a.isActive ? `${COLORS.green}22` : `${COLORS.red}22`, color: a.isActive ? COLORS.green : COLORS.red }}>{a.isActive ? "Active" : "Inactive"}</span>
                          <button onClick={() => { const acc = { ...a, currency: Array.isArray(a.currency) ? a.currency.map(v => (v||"").toUpperCase()) : (a.currency ? [a.currency.toUpperCase()] : []) }; setAccForm(acc); setEditAccId(a.id); setShowAccForm(true); }} style={{ background: "none", border: "none", color: COLORS.accent, cursor: "pointer", fontSize: 14 }}>✏️</button>
                          <button onClick={() => deleteAccount(a.id)} style={{ background: "none", border: "none", color: COLORS.red, cursor: "pointer", fontSize: 14 }}>🗑</button>
                        </div>
                      );
                    };

                    return (
                      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        {/* Actifs */}
                        {active.length > 0 && (
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {active.map(renderRow)}
                          </div>
                        )}
                        {/* Inactifs */}
                        {inactive.length > 0 && (
                          <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: 12, overflow: "hidden" }}>
                            <div style={{ padding: "8px 14px", background: COLORS.surface, display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: COLORS.textMuted, letterSpacing: 1 }}>INACTIFS</span>
                              <span style={{ fontSize: 11, color: COLORS.textMuted, background: COLORS.bg, padding: "1px 7px", borderRadius: 4, border: `1px solid ${COLORS.border}` }}>{inactive.length}</span>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "10px 10px", opacity: 0.6 }}>
                              {inactive.map(renderRow)}
                            </div>
                          </div>
                        )}
                        {filtered.length === 0 && <div style={{ textAlign: "center", color: COLORS.textMuted, padding: 20, fontSize: 13 }}>Aucun résultat pour « {accSearch} »</div>}
                      </div>
                    );
                  })()}
                </>
              )}
            </div>}
          </div>

          {/* ── Account Financing Bank ── */}
          <div style={{ position: "relative", zIndex: 50 }}>
            <FinancingBanksEditor companies={companies} config={config} updateField={updateField} />
          </div>

          {/* ── Account Type ── */}
          <AccountTypePillsEditor config={config} updateField={updateField} defaultKey="derivDefaultAccountType" onSetDefault={v => updateField("derivDefaultAccountType", v)} />

          <DerivOpStatusEditor config={config} updateField={updateField} />

          <DerivPillsEditor configKey="derivInstrumentTypes" label="Instrument Types" icon="📐" description="Types d'instruments disponibles dans la modale (Future, Option…)" config={config} updateField={updateField} defaultKey="derivInstrumentTypeDefault" onSetDefault={v => updateField("derivInstrumentTypeDefault", v)} />

          <DerivPillsEditor configKey="derivOpTypes" label="Operation Types" icon="🔁" description="Types d'opérations disponibles dans la modale (Hedging, Rolling…)" config={config} updateField={updateField} defaultKey="derivOpTypeDefault" onSetDefault={v => updateField("derivOpTypeDefault", v)} />

          <DerivPillsEditor configKey="derivExchanges" label="Exchanges" icon="🏛" description="Bourses disponibles pour les opérations (CME, Euronext…)" config={config} updateField={updateField} defaultKey="derivDefaultExchange" onSetDefault={v => updateField("derivDefaultExchange", v)} />

          <DerivProductEditor config={config} />

          <DerivPillsEditor configKey="derivVolumeUnits" label="Volume Units" icon="📦" description="Unités de volume utilisées dans les opérations sur dérivés" config={config} updateField={updateField} />

          <DerivPillsEditor configKey="derivCurrencies" label="Currencies" icon="💱" description="Devises disponibles dans le module Derivatives" config={config} updateField={updateField} />

          <DerivDecimalsEditor config={config} updateField={updateField} />

          <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: "20px 24px" }}>
            <DerivBUEditor config={config} updateField={updateField} />
          </div>

          <UnderlyingCategoryEditor config={config} updateField={updateField} />

          <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: "20px 24px" }}>
            <UnderlyingEditor config={config} updateField={updateField} />
          </div>

          <UnderlyingOriginEditor config={config} updateField={updateField} setAdminTab={setAdminTab} />

          <DerivPillsEditor configKey="derivTarifTypes" label="Tarif Types" icon="🏷" description="Types de tarifs de référence pour les opérations sur dérivés" config={config} updateField={updateField} />

          {/* Lot Sizes */}
          <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, overflow: "hidden" }}>
            <div onClick={() => setExpandedLotSizes(v => !v)}
              style={{ padding: "18px 24px", borderBottom: expandedLotSizes ? `1px solid ${COLORS.border}` : "none", background: `${COLORS.green}08`, display: "flex", alignItems: "center", gap: 14, cursor: "pointer", userSelect: "none" }}
              onMouseOver={e => e.currentTarget.style.background = `${COLORS.green}14`}
              onMouseOut={e => e.currentTarget.style.background = `${COLORS.green}08`}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: COLORS.hover, border: `1px solid ${COLORS.green}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>📦</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.text }}>Lot Sizes</div>
                <div style={{ fontSize: 12, color: COLORS.textSub, marginTop: 2 }}>Taille de lot par exchange et instrument</div>
              </div>
              <span style={{ fontSize: 11, color: COLORS.textMuted, background: COLORS.bg, padding: "3px 10px", borderRadius: 6, border: `1px solid ${COLORS.border}`, marginRight: 4 }}>
                {lotSizes.length} entrée{lotSizes.length !== 1 ? "s" : ""}
              </span>
              <span style={{ color: COLORS.textMuted, fontSize: 14, transition: "transform 0.2s", display: "inline-block", transform: expandedLotSizes ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
            </div>
            {expandedLotSizes && (
              <div style={{ padding: "16px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
                {!showLsForm && (
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <Btn onClick={() => { setLsForm(EMPTY_LS); setEditLsId(null); setShowLsForm(true); }}>+ Ajouter</Btn>
                  </div>
                )}
                {showLsForm && (
                  <div style={{ background: `${COLORS.accent}08`, border: `1px dashed ${COLORS.accent}40`, borderRadius: 12, padding: "16px" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <label style={{ fontSize: 11, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5 }}>EXCHANGE <span style={{ color: COLORS.red }}>*</span></label>
                        <select value={lsForm.exchange} onChange={e => setLsForm(f => ({ ...f, exchange: e.target.value }))}
                          style={{ background: COLORS.bg, border: `1px solid ${lsForm.exchange ? COLORS.border : COLORS.red + "60"}`, borderRadius: 8, padding: "9px 14px", color: lsForm.exchange ? COLORS.text : COLORS.textMuted, fontSize: 13, fontFamily: "inherit", outline: "none" }}>
                          <option value="">— Sélectionner —</option>
                          {(config.derivExchanges || []).map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
                        </select>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <label style={{ fontSize: 11, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5 }}>UNDERLYING <span style={{ color: COLORS.red }}>*</span></label>
                        <select value={lsForm.instrument} onChange={e => setLsForm(f => ({ ...f, instrument: e.target.value }))}
                          style={{ background: COLORS.bg, border: `1px solid ${lsForm.instrument ? COLORS.border : COLORS.red + "60"}`, borderRadius: 8, padding: "9px 14px", color: lsForm.instrument ? COLORS.text : COLORS.textMuted, fontSize: 13, fontFamily: "inherit", outline: "none" }}>
                          <option value="">— Sélectionner —</option>
                          {(config.derivCommodities || []).map(u => (
                            <option key={u.value || u} value={u.value || u}>{u.label || u}</option>
                          ))}
                        </select>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <label style={{ fontSize: 11, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5 }}>QUANTITY <span style={{ color: COLORS.red }}>*</span></label>
                        <input type="number" value={lsForm.quantity} onChange={e => setLsForm(f => ({ ...f, quantity: e.target.value }))} placeholder="ex: 50"
                          style={{ background: COLORS.bg, border: `1px solid ${String(lsForm.quantity).trim() ? COLORS.border : COLORS.red + "60"}`, borderRadius: 8, padding: "9px 14px", color: COLORS.text, fontSize: 13, fontFamily: "inherit", outline: "none" }} />
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <label style={{ fontSize: 11, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5 }}>VOLUME UNIT <span style={{ color: COLORS.red }}>*</span></label>
                        <select value={lsForm.volumeUnit} onChange={e => setLsForm(f => ({ ...f, volumeUnit: e.target.value }))}
                          style={{ background: COLORS.bg, border: `1px solid ${lsForm.volumeUnit ? COLORS.border : COLORS.red + "60"}`, borderRadius: 8, padding: "9px 14px", color: lsForm.volumeUnit ? COLORS.text : COLORS.textMuted, fontSize: 13, fontFamily: "inherit", outline: "none" }}>
                          <option value="">— Sélectionner —</option>
                          {(config.derivVolumeUnits || []).map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                        </select>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                      <Btn variant="secondary" onClick={() => { setShowLsForm(false); setLsForm(EMPTY_LS); setEditLsId(null); }}>Annuler</Btn>
                      <Btn onClick={saveLotSize} disabled={!isLsFormValid()}>Enregistrer</Btn>
                    </div>
                  </div>
                )}
                {lotSizes.length === 0 && !showLsForm ? (
                  <div style={{ textAlign: "center", color: COLORS.textMuted, padding: "24px 0", fontSize: 13 }}>Aucun lot size — cliquez sur "+ Ajouter" pour commencer</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {lotSizes.length > 0 && (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 80px 80px 60px", gap: 8, padding: "4px 12px" }}>
                        {["EXCHANGE", "UNDERLYING", "QTY", "UNIT", ""].map(h => (
                          <span key={h} style={{ fontSize: 10, fontWeight: 700, color: COLORS.textMuted, letterSpacing: 0.5 }}>{h}</span>
                        ))}
                      </div>
                    )}
                    {lotSizes.map(l => {
                      const exchCfg = (config.derivExchanges || []).find(e => e.value === l.exchange);
                      const unitCfg = (config.derivVolumeUnits || []).find(u => u.value === l.volumeUnit);
                      const commodityCfg = (config.derivCommodities || []).find(c => c.value === l.instrument);
                      return (
                        <div key={l.id} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 80px 80px 60px", gap: 8, alignItems: "center", background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "10px 12px" }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.blue }}>{exchCfg?.label || l.exchange}</span>
                          <span style={{ fontSize: 13, color: COLORS.text }}>{commodityCfg?.label || l.instrument}</span>
                          <span style={{ fontSize: 13, fontFamily: "'DM Mono', monospace", color: COLORS.green }}>{l.quantity}</span>
                          <span style={{ fontSize: 12, color: COLORS.accent, fontWeight: 600 }}>{unitCfg?.label || l.volumeUnit}</span>
                          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                            <button onClick={() => { setLsForm({ ...l }); setEditLsId(l.id); setShowLsForm(true); }} style={{ background: "none", border: "none", color: COLORS.accent, cursor: "pointer", fontSize: 14 }}>✏️</button>
                            <button onClick={() => deleteLotSize(l.id)} style={{ background: "none", border: "none", color: COLORS.red, cursor: "pointer", fontSize: 14 }}>🗑</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Exchange Tarifs */}
          <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, overflow: "hidden" }}>
            <div onClick={() => setExpandedExchangeTarifs(v => !v)}
              style={{ padding: "18px 24px", borderBottom: expandedExchangeTarifs ? `1px solid ${COLORS.border}` : "none", background: `${COLORS.purple}08`, display: "flex", alignItems: "center", gap: 14, cursor: "pointer", userSelect: "none" }}
              onMouseOver={e => e.currentTarget.style.background = `${COLORS.purple}14`}
              onMouseOut={e => e.currentTarget.style.background = `${COLORS.purple}08`}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: COLORS.hover, border: `1px solid ${COLORS.purple}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>💱</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.text }}>Exchange Tarifs</div>
                <div style={{ fontSize: 12, color: COLORS.textSub, marginTop: 2 }}>Tarifs par broker, exchange et type de transmission</div>
              </div>
              <span style={{ fontSize: 11, color: COLORS.textMuted, background: COLORS.bg, padding: "3px 10px", borderRadius: 6, border: `1px solid ${COLORS.border}`, marginRight: 4 }}>
                {exchangeTarifs.length} tarif{exchangeTarifs.length !== 1 ? "s" : ""}
              </span>
              <span style={{ color: COLORS.textMuted, fontSize: 14, transition: "transform 0.2s", display: "inline-block", transform: expandedExchangeTarifs ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
            </div>

            {expandedExchangeTarifs && (
              <div style={{ padding: "16px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
                {!showEtForm && (
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <Btn onClick={() => { setEtForm(EMPTY_ET); setEditEtId(null); setShowEtForm(true); }}>+ Ajouter</Btn>
                  </div>
                )}

                {showEtForm && (
                  <div style={{ background: `${COLORS.accent}08`, border: `1px dashed ${COLORS.accent}40`, borderRadius: 12, padding: "16px" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>

                      {/* Financial Broker */}
                      {(() => {
                        const brokers = companies.filter(c => (c.roles || []).some(r => r.toLowerCase().includes("financial") && r.toLowerCase().includes("broker")));
                        const selectedBrokers = etForm.financialBroker || [];
                        return (
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <label style={{ fontSize: 11, color: selectedBrokers.length === 0 ? COLORS.red : COLORS.textSub, fontWeight: 600, letterSpacing: 0.5 }}>
                                FINANCIAL BROKER <span style={{ color: COLORS.red }}>*</span>
                              </label>
                              {selectedBrokers.length > 1 && (
                                <span style={{ fontSize: 10, color: COLORS.blue, fontWeight: 700, background: `${COLORS.blue}15`, borderRadius: 4, padding: "1px 6px" }}>OR</span>
                              )}
                              {selectedBrokers.length > 0 && (
                                <span style={{ fontSize: 10, color: COLORS.textMuted }}>{selectedBrokers.length} sélectionné{selectedBrokers.length > 1 ? "s" : ""}</span>
                              )}
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "8px", background: COLORS.bg, border: `1px solid ${selectedBrokers.length === 0 ? COLORS.red + "60" : COLORS.border}`, borderRadius: 8, minHeight: 42 }}>
                              {brokers.length === 0 && (
                                <span style={{ fontSize: 12, color: COLORS.textMuted, padding: "2px 4px" }}>💡 Aucun Financial Broker dans Companies</span>
                              )}
                              {brokers.map(c => {
                                const active = selectedBrokers.includes(c.name);
                                return (
                                  <div key={c.id} onClick={() => {
                                    const next = active
                                      ? selectedBrokers.filter(v => v !== c.name)
                                      : [...selectedBrokers, c.name];
                                    setEtForm(f => ({ ...f, financialBroker: next }));
                                  }} style={{ padding: "4px 10px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: active ? 700 : 400, transition: "all 0.15s", border: `1.5px solid ${active ? COLORS.orange : COLORS.border}`, background: active ? `${COLORS.orange}18` : "transparent", color: active ? COLORS.orange : COLORS.textSub, userSelect: "none" }}>
                                    {active && <span style={{ marginRight: 4 }}>✓</span>}
                                    {c.name}
                                  </div>
                                );
                              })}
                            </div>
                            {selectedBrokers.length === 0 && (
                              <span style={{ fontSize: 11, color: COLORS.red }}>⚠ Sélectionnez au moins un broker</span>
                            )}
                          </div>
                        );
                      })()}

                      {/* Exchange */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <label style={{ fontSize: 11, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5 }}>EXCHANGE <span style={{ color: COLORS.red }}>*</span></label>
                        <select value={etForm.exchange} onChange={e => setEtForm(f => ({ ...f, exchange: e.target.value }))}
                          style={{ background: COLORS.bg, border: `1px solid ${etForm.exchange ? COLORS.border : COLORS.red + "60"}`, borderRadius: 8, padding: "9px 14px", color: etForm.exchange ? COLORS.text : COLORS.textMuted, fontSize: 13, fontFamily: "inherit", outline: "none" }}>
                          <option value="">— Sélectionner —</option>
                          {(config.derivExchanges || []).map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
                        </select>
                      </div>

                      {/* Tarif Type */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <label style={{ fontSize: 11, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5 }}>TARIF TYPE <span style={{ color: COLORS.red }}>*</span></label>
                        <select value={etForm.tarifType} onChange={e => setEtForm(f => ({ ...f, tarifType: e.target.value }))}
                          style={{ background: COLORS.bg, border: `1px solid ${etForm.tarifType ? COLORS.border : COLORS.red + "60"}`, borderRadius: 8, padding: "9px 14px", color: etForm.tarifType ? COLORS.text : COLORS.textMuted, fontSize: 13, fontFamily: "inherit", outline: "none" }}>
                          <option value="">— Sélectionner —</option>
                          {(config.derivTarifTypes || []).map(t => <option key={t.value || t.label} value={t.value || t.label}>{t.label}</option>)}
                        </select>
                      </div>

                      {/* Operation Type — multi-select pills (OR logic) */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <label style={{ fontSize: 11, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5 }}>OPERATION TYPE</label>
                          {(etForm.opType || []).length > 1 && (
                            <span style={{ fontSize: 10, color: COLORS.blue, fontWeight: 700, background: `${COLORS.blue}15`, borderRadius: 4, padding: "1px 6px" }}>OR</span>
                          )}
                          {(etForm.opType || []).length > 0 && (
                            <span style={{ fontSize: 10, color: COLORS.textMuted }}>{(etForm.opType || []).length} sélectionné{(etForm.opType || []).length > 1 ? "s" : ""}</span>
                          )}
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "8px", background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, minHeight: 42 }}>
                          {(config.derivOpTypes || []).length === 0 && (
                            <span style={{ fontSize: 12, color: COLORS.textMuted, padding: "2px 4px" }}>💡 Aucun type défini dans l'admin</span>
                          )}
                          {(config.derivOpTypes || []).map(t => {
                            const val = t.label || t.value;
                            const active = (etForm.opType || []).includes(val);
                            return (
                              <div key={t.value || t.label} onClick={() => {
                                const current = etForm.opType || [];
                                const next = active ? current.filter(v => v !== val) : [...current, val];
                                setEtForm(f => ({ ...f, opType: next }));
                              }} style={{ padding: "4px 10px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: active ? 700 : 400, transition: "all 0.15s", border: `1.5px solid ${active ? COLORS.accent : COLORS.border}`, background: active ? `${COLORS.accent}18` : "transparent", color: active ? COLORS.accent : COLORS.textSub, userSelect: "none" }}>
                                {active && <span style={{ marginRight: 4 }}>✓</span>}
                                {val}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Order Transmission Type — multi-select toggle (OR logic) */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <label style={{ fontSize: 11, color: (etForm.orderTransmissionType || []).length === 0 ? COLORS.red : COLORS.textSub, fontWeight: 600, letterSpacing: 0.5 }}>
                          ORDER TRANSMISSION TYPE <span style={{ color: COLORS.red }}>*</span>
                          {(etForm.orderTransmissionType || []).length > 1 && (
                            <span style={{ marginLeft: 8, fontSize: 10, color: COLORS.blue, fontWeight: 400 }}>OR</span>
                          )}
                        </label>
                        <div style={{ display: "flex", gap: 6 }}>
                          {(config.derivOrderTransmissionTypes || []).map(t => {
                            const selected = (etForm.orderTransmissionType || []).includes(t.value);
                            return (
                              <div key={t.value} onClick={() => {
                                const current = etForm.orderTransmissionType || [];
                                const next = selected
                                  ? current.filter(v => v !== t.value)
                                  : [...current, t.value];
                                setEtForm(f => ({ ...f, orderTransmissionType: next }));
                              }} style={{ flex: 1, textAlign: "center", padding: "9px 6px", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 12, transition: "all 0.15s", border: `1.5px solid ${selected ? COLORS.blue : (etForm.orderTransmissionType || []).length === 0 ? COLORS.red + "60" : COLORS.border}`, background: selected ? `${COLORS.blue}18` : COLORS.bg, color: selected ? COLORS.blue : COLORS.textSub, userSelect: "none" }}>
                                {t.label}
                              </div>
                            );
                          })}
                        </div>
                        {(etForm.orderTransmissionType || []).length === 0 && (
                          <span style={{ fontSize: 11, color: COLORS.red }}>⚠ Sélectionnez au moins un type</span>
                        )}
                      </div>

                      {/* Tarif (saisie libre) */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <label style={{ fontSize: 11, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5 }}>TARIF <span style={{ color: COLORS.red }}>*</span></label>
                        <input value={etForm.tarif} onChange={e => setEtForm(f => ({ ...f, tarif: e.target.value }))} placeholder="ex: 2.50"
                          style={{ background: COLORS.bg, border: `1px solid ${etForm.tarif.trim() ? COLORS.border : COLORS.red + "60"}`, borderRadius: 8, padding: "9px 14px", color: COLORS.text, fontSize: 13, fontFamily: "inherit", outline: "none" }} />
                      </div>

                      {/* Currency */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <label style={{ fontSize: 11, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5 }}>CURRENCY <span style={{ color: COLORS.red }}>*</span></label>
                        <select value={etForm.currency} onChange={e => setEtForm(f => ({ ...f, currency: e.target.value }))}
                          style={{ background: COLORS.bg, border: `1px solid ${etForm.currency ? COLORS.border : COLORS.red + "60"}`, borderRadius: 8, padding: "9px 14px", color: etForm.currency ? COLORS.text : COLORS.textMuted, fontSize: 13, fontFamily: "inherit", outline: "none" }}>
                          <option value="">— Sélectionner —</option>
                          {(config.derivCurrencies || []).map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                        </select>
                      </div>

                      {/* Valid From */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <label style={{ fontSize: 11, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5 }}>VALID FROM <span style={{ fontSize: 10, fontWeight: 400, color: COLORS.textMuted }}>(optionnel)</span></label>
                        <input type="date" value={etForm.validFrom || ""} onChange={e => setEtForm(f => ({ ...f, validFrom: e.target.value }))}
                          style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "9px 14px", color: etForm.validFrom ? COLORS.text : COLORS.textMuted, fontSize: 13, fontFamily: "inherit", outline: "none" }} />
                      </div>

                      {/* Valid To */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <label style={{ fontSize: 11, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5 }}>VALID TO <span style={{ fontSize: 10, fontWeight: 400, color: COLORS.textMuted }}>(optionnel)</span></label>
                        <input type="date" value={etForm.validTo || ""} onChange={e => setEtForm(f => ({ ...f, validTo: e.target.value }))}
                          min={etForm.validFrom || undefined}
                          style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "9px 14px", color: etForm.validTo ? COLORS.text : COLORS.textMuted, fontSize: 13, fontFamily: "inherit", outline: "none" }} />
                      </div>

                      {/* Active toggle */}
                      <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 14, padding: "10px 14px", background: etForm.isActive ? `${COLORS.green}10` : COLORS.bg, border: `1px solid ${etForm.isActive ? COLORS.green + "50" : COLORS.border}`, borderRadius: 10, cursor: "pointer", transition: "all 0.15s", userSelect: "none" }}
                        onClick={() => setEtForm(f => ({ ...f, isActive: !f.isActive }))}>
                        <div style={{ width: 38, height: 22, borderRadius: 11, background: etForm.isActive ? COLORS.green : COLORS.border, position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
                          <div style={{ position: "absolute", top: 3, left: etForm.isActive ? 18 : 3, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }} />
                        </div>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: etForm.isActive ? COLORS.green : COLORS.textSub, letterSpacing: 0.5 }}>ACTIF</div>
                          <div style={{ fontSize: 11, color: COLORS.textMuted }}>{etForm.isActive ? "Tarif actif — visible dans le formulaire" : "Tarif inactif — masqué dans le formulaire"}</div>
                        </div>
                      </div>

                    </div>
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                      <Btn variant="secondary" onClick={() => { setShowEtForm(false); setEtForm(EMPTY_ET); setEditEtId(null); }}>Annuler</Btn>
                      <Btn onClick={saveExchangeTarif} disabled={!isEtFormValid()}>Enregistrer</Btn>
                    </div>
                  </div>
                )}

                {/* Filtres */}
                {exchangeTarifs.length > 0 && (() => {
                  const allBrokers = [...new Set(exchangeTarifs.flatMap(et => Array.isArray(et.financialBroker) ? et.financialBroker : (et.financialBroker ? [et.financialBroker] : [])))].sort();
                  const allExchanges = [...new Set(exchangeTarifs.map(et => et.exchange).filter(Boolean))].sort();
                  const allTarifTypes = [...new Set(exchangeTarifs.map(et => et.tarifType).filter(Boolean))].sort();
                  const allOpTypes = [...new Set(exchangeTarifs.flatMap(et => Array.isArray(et.opType) ? et.opType : (et.opType ? [et.opType] : [])))].sort();
                  const allTransmissions = [...new Set(exchangeTarifs.flatMap(et => Array.isArray(et.orderTransmissionType) ? et.orderTransmissionType : (et.orderTransmissionType ? [et.orderTransmissionType] : [])))].sort();
                  const hasFilters = etFilters.exchange.length > 0 || etFilters.tarifType.length > 0 || etFilters.opType.length > 0 || etFilters.transmission.length > 0 || etFilters.broker.length > 0 || etFilters.isActive !== "all";
                  const toggle = (key, val) => setEtFilters(f => ({ ...f, [key]: f[key].includes(val) ? f[key].filter(v => v !== val) : [...f[key], val] }));
                  const pillStyle = (active, color) => ({ cursor: "pointer", fontSize: 11, fontWeight: active ? 700 : 500, padding: "3px 10px", borderRadius: 8, border: `1px solid ${active ? color : COLORS.border}`, background: active ? `${color}22` : COLORS.bg, color: active ? color : COLORS.textMuted, transition: "all 0.12s", userSelect: "none" });
                  return (
                    <div style={{ background: COLORS.bg, border: `1px solid ${hasFilters ? COLORS.purple + "50" : COLORS.border}`, borderRadius: 10, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10, transition: "border-color 0.2s" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: COLORS.textSub, letterSpacing: 0.5 }}>FILTRES</span>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {hasFilters && <span style={{ fontSize: 11, color: COLORS.purple, fontWeight: 700, fontFamily: "'DM Mono', monospace" }}>{(() => { const n = exchangeTarifs.filter(et => { if (etFilters.broker.length > 0) { const brokers = Array.isArray(et.financialBroker) ? et.financialBroker : (et.financialBroker ? [et.financialBroker] : []); if (!etFilters.broker.some(b => brokers.includes(b))) return false; } if (etFilters.exchange.length > 0 && !etFilters.exchange.includes(et.exchange)) return false; if (etFilters.tarifType.length > 0 && !etFilters.tarifType.includes(et.tarifType)) return false; if (etFilters.opType.length > 0) { const ops = Array.isArray(et.opType) ? et.opType : (et.opType ? [et.opType] : []); if (!etFilters.opType.some(o => ops.includes(o))) return false; } if (etFilters.transmission.length > 0) { const trans = Array.isArray(et.orderTransmissionType) ? et.orderTransmissionType : (et.orderTransmissionType ? [et.orderTransmissionType] : []); if (!etFilters.transmission.some(t => trans.includes(t))) return false; } if (etFilters.isActive !== "all") { const active = et.isActive !== false && String(et.isActive) !== "false"; if (etFilters.isActive === "active" && !active) return false; if (etFilters.isActive === "inactive" && active) return false; } return true; }).length; return `${n} résultat${n !== 1 ? "s" : ""}`; })()}</span>}
                          {hasFilters && <span onClick={() => setEtFilters({ exchange: [], tarifType: [], opType: [], transmission: [], broker: [], isActive: "all" })} style={{ cursor: "pointer", fontSize: 11, color: COLORS.red, fontWeight: 600 }}>✕ Reset</span>}
                        </div>
                      </div>
                      {/* Broker */}
                      {allBrokers.length > 0 && (
                        <div>
                          <div style={{ fontSize: 10, color: COLORS.textMuted, fontWeight: 700, letterSpacing: 0.5, marginBottom: 5 }}>BROKER</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                            {allBrokers.map(v => <span key={v} onClick={() => toggle("broker", v)} style={pillStyle(etFilters.broker.includes(v), COLORS.orange)}>{v}</span>)}
                          </div>
                        </div>
                      )}
                      {/* Exchange */}
                      {allExchanges.length > 0 && (
                        <div>
                          <div style={{ fontSize: 10, color: COLORS.textMuted, fontWeight: 700, letterSpacing: 0.5, marginBottom: 5 }}>EXCHANGE</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                            {allExchanges.map(v => { const label = (config.derivExchanges || []).find(e => e.value === v)?.label || v; return <span key={v} onClick={() => toggle("exchange", v)} style={pillStyle(etFilters.exchange.includes(v), COLORS.blue)}>{label}</span>; })}
                          </div>
                        </div>
                      )}
                      {/* Tarif Type */}
                      {allTarifTypes.length > 0 && (
                        <div>
                          <div style={{ fontSize: 10, color: COLORS.textMuted, fontWeight: 700, letterSpacing: 0.5, marginBottom: 5 }}>TARIF TYPE</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                            {allTarifTypes.map(v => <span key={v} onClick={() => toggle("tarifType", v)} style={pillStyle(etFilters.tarifType.includes(v), COLORS.accent)}>{v}</span>)}
                          </div>
                        </div>
                      )}
                      {/* Operation Type */}
                      {allOpTypes.length > 0 && (
                        <div>
                          <div style={{ fontSize: 10, color: COLORS.textMuted, fontWeight: 700, letterSpacing: 0.5, marginBottom: 5 }}>OPERATION TYPE</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                            {allOpTypes.map(v => <span key={v} onClick={() => toggle("opType", v)} style={pillStyle(etFilters.opType.includes(v), COLORS.green)}>{v}</span>)}
                          </div>
                        </div>
                      )}
                      {/* Transmission */}
                      {allTransmissions.length > 0 && (
                        <div>
                          <div style={{ fontSize: 10, color: COLORS.textMuted, fontWeight: 700, letterSpacing: 0.5, marginBottom: 5 }}>TRANSMISSION</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                            {allTransmissions.map(v => { const label = (config.derivOrderTransmissionTypes || []).find(t => t.value === v)?.label || v; return <span key={v} onClick={() => toggle("transmission", v)} style={pillStyle(etFilters.transmission.includes(v), COLORS.purple)}>{label}</span>; })}
                          </div>
                        </div>
                      )}
                      {/* Is Active */}
                      <div>
                        <div style={{ fontSize: 10, color: COLORS.textMuted, fontWeight: 700, letterSpacing: 0.5, marginBottom: 5 }}>STATUT</div>
                        <div style={{ display: "flex", gap: 5 }}>
                          {[["all", "Tous"], ["active", "Actif"], ["inactive", "Inactif"]].map(([val, label]) => (
                            <span key={val} onClick={() => setEtFilters(f => ({ ...f, isActive: val }))} style={pillStyle(etFilters.isActive === val, val === "active" ? COLORS.green : val === "inactive" ? COLORS.red : COLORS.textSub)}>{label}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Liste */}
                {exchangeTarifs.length === 0 && !showEtForm ? (
                  <div style={{ textAlign: "center", color: COLORS.textMuted, padding: "24px 0", fontSize: 13 }}>Aucun tarif — cliquez sur "+ Ajouter" pour commencer</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {exchangeTarifs.length > 0 && (
                      <div style={{ display: "grid", gridTemplateColumns: "minmax(100px,2fr) minmax(80px,1fr) minmax(80px,1fr) minmax(80px,1.5fr) minmax(100px,1.5fr) 70px 50px 80px 50px 80px", gap: 8, padding: "4px 12px" }}>
                        {["BROKER", "EXCHANGE", "TARIF TYPE", "OP TYPE", "TRANSMISSION", "TARIF", "CUR.", "VALIDITÉ", "STATUT", ""].map(h => (
                          <span key={h} style={{ fontSize: 10, fontWeight: 700, color: COLORS.textMuted, letterSpacing: 0.5 }}>{h}</span>
                        ))}
                      </div>
                    )}
                    {[...exchangeTarifs].filter(et => {
                      if (etFilters.broker.length > 0) {
                        const brokers = Array.isArray(et.financialBroker) ? et.financialBroker : (et.financialBroker ? [et.financialBroker] : []);
                        if (!etFilters.broker.some(b => brokers.includes(b))) return false;
                      }
                      if (etFilters.exchange.length > 0 && !etFilters.exchange.includes(et.exchange)) return false;
                      if (etFilters.tarifType.length > 0 && !etFilters.tarifType.includes(et.tarifType)) return false;
                      if (etFilters.opType.length > 0) {
                        const ops = Array.isArray(et.opType) ? et.opType : (et.opType ? [et.opType] : []);
                        if (!etFilters.opType.some(o => ops.includes(o))) return false;
                      }
                      if (etFilters.transmission.length > 0) {
                        const trans = Array.isArray(et.orderTransmissionType) ? et.orderTransmissionType : (et.orderTransmissionType ? [et.orderTransmissionType] : []);
                        if (!etFilters.transmission.some(t => trans.includes(t))) return false;
                      }
                      if (etFilters.isActive !== "all") {
                        const active = et.isActive !== false && String(et.isActive) !== "false";
                        if (etFilters.isActive === "active" && !active) return false;
                        if (etFilters.isActive === "inactive" && active) return false;
                      }
                      return true;
                    }).sort((a, b) => {
                        const ta = (a.tarifType || "").toLowerCase();
                        const tb = (b.tarifType || "").toLowerCase();
                        if (ta !== tb) return ta < tb ? -1 : 1;
                        const ea = (a.exchange || "").toLowerCase();
                        const eb = (b.exchange || "").toLowerCase();
                        if (ea !== eb) return ea < eb ? -1 : 1;
                        const fa = (Array.isArray(a.financialBroker) ? a.financialBroker.join(" ") : (a.financialBroker || "")).toLowerCase();
                        const fb = (Array.isArray(b.financialBroker) ? b.financialBroker.join(" ") : (b.financialBroker || "")).toLowerCase();
                        return fa < fb ? -1 : fa > fb ? 1 : 0;
                      }).map(et => {
                      const exchCfg = (config.derivExchanges || []).find(e => e.value === et.exchange);
                      const transCfg = (config.derivOrderTransmissionTypes || []).find(t => t.value === et.orderTransmissionType);
                      const tarifTypeCfg = (config.derivTarifTypes || []).find(t => (t.value || t.label) === et.tarifType);
                      const today = new Date().toISOString().slice(0, 10);
                      const expired = et.validTo && et.validTo < today;
                      const notYet = et.validFrom && et.validFrom > today;
                      return (
                        <div key={et.id} style={{ display: "grid", gridTemplateColumns: "minmax(100px,2fr) minmax(80px,1fr) minmax(80px,1fr) minmax(80px,1.5fr) minmax(100px,1.5fr) 70px 50px 80px 50px 80px", gap: 8, alignItems: "center", background: !et.isActive ? `${COLORS.border}30` : COLORS.bg, border: `1px solid ${expired || !et.isActive ? COLORS.border : COLORS.border}`, borderRadius: 10, padding: "10px 12px", opacity: !et.isActive ? 0.6 : 1 }}>
                          <span title={Array.isArray(et.financialBroker) ? et.financialBroker.join(" OR ") : (et.financialBroker || "—")} style={{ fontSize: 12, fontWeight: 700, color: COLORS.orange, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "block" }}>
                            {Array.isArray(et.financialBroker) ? et.financialBroker.join(" / ") : (et.financialBroker || "—")}
                          </span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.blue }}>{exchCfg?.label || et.exchange}</span>
                          <span style={{ fontSize: 12, color: COLORS.text }}>{tarifTypeCfg?.label || et.tarifType}</span>
                          <span title={Array.isArray(et.opType) ? et.opType.join(" OR ") : (et.opType || "—")} style={{ fontSize: 11, color: COLORS.accent, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>
                            {Array.isArray(et.opType) && et.opType.length > 0 ? et.opType.join(" / ") : (et.opType || "—")}
                          </span>
                          <span style={{ fontSize: 11, color: COLORS.textSub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={Array.isArray(et.orderTransmissionType) ? et.orderTransmissionType.map(v => (config.derivOrderTransmissionTypes || []).find(t => t.value === v)?.label || v).join(" OR ") : (transCfg?.label || et.orderTransmissionType || "—")}>
                            {Array.isArray(et.orderTransmissionType)
                              ? et.orderTransmissionType.map(v => (config.derivOrderTransmissionTypes || []).find(t => t.value === v)?.label || v).join(" / ")
                              : (transCfg?.label || et.orderTransmissionType || "—")}
                          </span>
                          <span style={{ fontSize: 13, fontFamily: "'DM Mono', monospace", color: COLORS.green, fontWeight: 700 }}>{et.tarif}</span>
                          <span style={{ fontSize: 12, color: COLORS.accent, fontWeight: 600 }}>{et.currency}</span>
                          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                            {et.validFrom && <span style={{ fontSize: 10, color: COLORS.textMuted, fontFamily: "'DM Mono', monospace" }}>↦ {et.validFrom}</span>}
                            {et.validTo && <span style={{ fontSize: 10, color: expired ? COLORS.red : COLORS.textMuted, fontFamily: "'DM Mono', monospace" }}>↤ {et.validTo}</span>}
                            {!et.validFrom && !et.validTo && <span style={{ fontSize: 10, color: COLORS.textMuted }}>—</span>}
                          </div>
                          <div onClick={async () => {
                            const updated = exchangeTarifs.map(x => x.id === et.id ? { ...x, isActive: !x.isActive } : x);
                            setExchangeTarifs(updated);
                            await safeSave('deriv_exchange_tarifs', updated, setExchangeTarifs, exchangeTarifs);
                          }} style={{ width: 38, height: 22, borderRadius: 11, background: et.isActive ? COLORS.green : COLORS.border, cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
                            <div style={{ position: "absolute", top: 3, left: et.isActive ? 18 : 3, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px #0005" }} />
                          </div>
                          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                            <button onClick={() => { const ott = et.orderTransmissionType; const fb = et.financialBroker; const ot = et.opType; setEtForm({ ...et, financialBroker: Array.isArray(fb) ? fb : (fb ? [fb] : []), opType: Array.isArray(ot) ? ot : (ot ? [ot] : []), orderTransmissionType: Array.isArray(ott) ? ott : (ott ? [ott] : []) }); setEditEtId(et.id); setShowEtForm(true); }} title="Modifier" style={{ background: `${COLORS.accent}15`, border: `1px solid ${COLORS.accent}30`, color: COLORS.accent, borderRadius: 7, padding: "5px 10px", cursor: "pointer", fontSize: 18, lineHeight: 1 }}>✏️</button>
                            <button onClick={() => deleteExchangeTarif(et.id)} title="Supprimer" style={{ background: `${COLORS.red}15`, border: `1px solid ${COLORS.red}30`, color: COLORS.red, borderRadius: 7, padding: "5px 10px", cursor: "pointer", fontSize: 18, lineHeight: 1 }}>🗑</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Order Transmission Types */}
          <DerivPillsEditor configKey="derivOrderTransmissionTypes" label="Order Transmission Types" icon="📡" description="Modes de transmission des ordres (Electronic, Manual…)" config={config} updateField={updateField} defaultKey="derivOrderTransmissionDefault" onSetDefault={v => updateField("derivOrderTransmissionDefault", v)} />

          {/* Price Units */}
          <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, overflow: "hidden" }}>
            <div onClick={() => setExpandedPriceUnits(v => !v)}
              style={{ padding: "18px 24px", borderBottom: expandedPriceUnits ? `1px solid ${COLORS.border}` : "none", background: `${COLORS.blue}08`, display: "flex", alignItems: "center", gap: 14, cursor: "pointer", userSelect: "none" }}
              onMouseOver={e => e.currentTarget.style.background = `${COLORS.blue}14`}
              onMouseOut={e => e.currentTarget.style.background = `${COLORS.blue}08`}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: COLORS.hover, border: `1px solid ${COLORS.blue}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>💲</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.text }}>Price Units</div>
                <div style={{ fontSize: 12, color: COLORS.textSub, marginTop: 2 }}>Unité de prix par exchange (valeur décimale)</div>
              </div>
              <div style={{ fontSize: 12, color: COLORS.textMuted, fontFamily: "'DM Mono', monospace", marginRight: 8 }}>{priceUnits.length} entrée{priceUnits.length !== 1 ? "s" : ""}</div>
              <Btn onClick={e => { e.stopPropagation(); setPuForm(EMPTY_PU); setEditPuId(null); setShowPuForm(true); if (!expandedPriceUnits) setExpandedPriceUnits(true); }} style={{ padding: "7px 14px", fontSize: 13 }}>+ Ajouter</Btn>
              <span style={{ color: COLORS.textMuted, fontSize: 14, transition: "transform 0.2s", display: "inline-block", transform: expandedPriceUnits ? "rotate(180deg)" : "rotate(0deg)", marginLeft: 4 }}>▾</span>
            </div>

            {expandedPriceUnits && (
              <div style={{ padding: "20px 24px" }}>
                {/* Form */}
                {showPuForm && (
                  <div style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 18, marginBottom: 16 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <label style={{ fontSize: 12, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5 }}>EXCHANGE <span style={{ color: COLORS.red }}>*</span></label>
                        <select value={puForm.exchange} onChange={e => setPuForm(f => ({ ...f, exchange: e.target.value }))}
                          style={{ background: COLORS.card, border: `1px solid ${!puForm.exchange ? COLORS.red + "60" : COLORS.border}`, borderRadius: 8, padding: "10px 14px", color: puForm.exchange ? COLORS.text : COLORS.textMuted, fontSize: 14, fontFamily: "inherit", outline: "none" }}>
                          <option value="">— Sélectionner —</option>
                          {(config.derivExchanges || []).map(ex => <option key={ex.value} value={ex.value}>{ex.label}</option>)}
                        </select>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <label style={{ fontSize: 12, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5 }}>UNDERLYING <span style={{ color: COLORS.textMuted, fontWeight: 400 }}>(optionnel)</span></label>
                        <select value={puForm.underlying || ""} onChange={e => setPuForm(f => ({ ...f, underlying: e.target.value }))}
                          style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "10px 14px", color: puForm.underlying ? COLORS.text : COLORS.textMuted, fontSize: 14, fontFamily: "inherit", outline: "none" }}>
                          <option value="">— Tous —</option>
                          {(config.derivCommodities || []).map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                        </select>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <label style={{ fontSize: 12, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5 }}>UNIT <span style={{ color: COLORS.red }}>*</span></label>
                        <input type="number" step="any" value={puForm.unit} onChange={e => setPuForm(f => ({ ...f, unit: e.target.value }))}
                          placeholder="ex: 0.25"
                          style={{ background: COLORS.card, border: `1px solid ${String(puForm.unit).trim() === "" ? COLORS.red + "60" : COLORS.border}`, borderRadius: 8, padding: "10px 14px", color: COLORS.text, fontSize: 14, outline: "none", fontFamily: "'DM Mono', monospace" }}
                          onFocus={e => e.target.style.borderColor = COLORS.accent}
                          onBlur={e => e.target.style.borderColor = String(puForm.unit).trim() === "" ? COLORS.red + "60" : COLORS.border} />
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 14, justifyContent: "flex-end" }}>
                      <Btn variant="secondary" onClick={() => { setShowPuForm(false); setPuForm(EMPTY_PU); setEditPuId(null); }}>Annuler</Btn>
                      <Btn onClick={savePriceUnit} disabled={!isPuFormValid()}>Enregistrer</Btn>
                    </div>
                  </div>
                )}

                {/* List */}
                {priceUnits.length === 0 && !showPuForm && (
                  <div style={{ textAlign: "center", color: COLORS.textMuted, padding: 32, fontSize: 13 }}>Aucune entrée — cliquez sur "+ Ajouter" pour commencer</div>
                )}
                {priceUnits.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {[...priceUnits].sort((a, b) => (a.exchange || "").localeCompare(b.exchange || "") || (a.underlying || "").localeCompare(b.underlying || "")).map(pu => {
                      const exLabel = (config.derivExchanges || []).find(e => e.value === pu.exchange)?.label || pu.exchange;
                      const undLabel = pu.underlying ? ((config.derivCommodities || []).find(c => c.value === pu.underlying)?.label || pu.underlying) : null;
                      return (
                        <div key={pu.id} style={{ display: "flex", alignItems: "center", gap: 14, background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "12px 16px" }}>
                          <div style={{ width: 36, height: 36, borderRadius: 10, background: `${COLORS.blue}18`, border: `1px solid ${COLORS.blue}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>💲</div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text }}>
                              {exLabel}
                              {undLabel && <span style={{ marginLeft: 8, fontSize: 11, color: COLORS.green, background: `${COLORS.green}15`, padding: "1px 7px", borderRadius: 5, fontWeight: 600 }}>📦 {undLabel}</span>}
                              {!undLabel && <span style={{ marginLeft: 8, fontSize: 11, color: COLORS.textMuted }}>tous underlyings</span>}
                            </div>
                            <div style={{ fontSize: 11, color: COLORS.textSub, marginTop: 2, fontFamily: "'DM Mono', monospace" }}>Unit : <span style={{ color: COLORS.accent }}>{pu.unit}</span></div>
                          </div>
                          <button onClick={() => { setPuForm({ exchange: pu.exchange, underlying: pu.underlying || "", unit: pu.unit }); setEditPuId(pu.id); setShowPuForm(true); }} style={{ background: "none", border: "none", color: COLORS.accent, cursor: "pointer", fontSize: 14 }}>✏️</button>
                          <button onClick={() => deletePriceUnit(pu.id)} style={{ background: "none", border: "none", color: COLORS.red, cursor: "pointer", fontSize: 14 }}>🗑</button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Quotation Units */}
          <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, overflow: "hidden" }}>
            <div onClick={() => setExpandedQuotationUnits(v => !v)}
              style={{ padding: "18px 24px", borderBottom: expandedQuotationUnits ? `1px solid ${COLORS.border}` : "none", background: `${COLORS.blue}08`, display: "flex", alignItems: "center", gap: 14, cursor: "pointer", userSelect: "none" }}
              onMouseOver={e => e.currentTarget.style.background = `${COLORS.blue}14`}
              onMouseOut={e => e.currentTarget.style.background = `${COLORS.blue}08`}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: COLORS.hover, border: `1px solid ${COLORS.blue}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>📐</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.text }}>Quotation Units</div>
                <div style={{ fontSize: 12, color: COLORS.textSub, marginTop: 2 }}>Unité de cotation par underlying et exchange</div>
              </div>
              <div style={{ fontSize: 12, color: COLORS.textMuted, fontFamily: "'DM Mono', monospace", marginRight: 8 }}>{quotationUnits.length} entrée{quotationUnits.length !== 1 ? "s" : ""}</div>
              <Btn onClick={e => { e.stopPropagation(); setQuForm(EMPTY_QU); setEditQuId(null); setShowQuForm(true); if (!expandedQuotationUnits) setExpandedQuotationUnits(true); }} style={{ padding: "7px 14px", fontSize: 13 }}>+ Ajouter</Btn>
              <span style={{ color: COLORS.textMuted, fontSize: 14, transition: "transform 0.2s", display: "inline-block", transform: expandedQuotationUnits ? "rotate(180deg)" : "rotate(0deg)", marginLeft: 4 }}>▾</span>
            </div>

            {expandedQuotationUnits && (
              <div style={{ padding: "20px 24px" }}>
                {/* Form */}
                {showQuForm && (
                  <div style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 18, marginBottom: 16 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <label style={{ fontSize: 12, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5 }}>UNDERLYING <span style={{ color: COLORS.red }}>*</span></label>
                        <select value={quForm.underlying} onChange={e => setQuForm(f => ({ ...f, underlying: e.target.value }))}
                          style={{ background: COLORS.card, border: `1px solid ${!quForm.underlying ? COLORS.red + "60" : COLORS.border}`, borderRadius: 8, padding: "10px 14px", color: quForm.underlying ? COLORS.text : COLORS.textMuted, fontSize: 14, fontFamily: "inherit", outline: "none" }}>
                          <option value="">— Sélectionner —</option>
                          {(config.derivCommodities || []).map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                        </select>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <label style={{ fontSize: 12, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5 }}>EXCHANGE <span style={{ color: COLORS.red }}>*</span></label>
                        <select value={quForm.exchange} onChange={e => setQuForm(f => ({ ...f, exchange: e.target.value }))}
                          style={{ background: COLORS.card, border: `1px solid ${!quForm.exchange ? COLORS.red + "60" : COLORS.border}`, borderRadius: 8, padding: "10px 14px", color: quForm.exchange ? COLORS.text : COLORS.textMuted, fontSize: 14, fontFamily: "inherit", outline: "none" }}>
                          <option value="">— Sélectionner —</option>
                          {(config.derivExchanges || []).map(ex => <option key={ex.value} value={ex.value}>{ex.label}</option>)}
                        </select>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <label style={{ fontSize: 12, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5 }}>QUOTATION UNIT <span style={{ color: COLORS.red }}>*</span></label>
                        <input value={quForm.quotationUnit} onChange={e => setQuForm(f => ({ ...f, quotationUnit: e.target.value }))}
                          placeholder="ex: USD/MT, ¢/bu…"
                          style={{ background: COLORS.card, border: `1px solid ${!quForm.quotationUnit.trim() ? COLORS.red + "60" : COLORS.border}`, borderRadius: 8, padding: "10px 14px", color: COLORS.text, fontSize: 14, outline: "none", fontFamily: "'DM Mono', monospace" }}
                          onFocus={e => e.target.style.borderColor = COLORS.accent}
                          onBlur={e => e.target.style.borderColor = !quForm.quotationUnit.trim() ? COLORS.red + "60" : COLORS.border} />
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 14, justifyContent: "flex-end" }}>
                      <Btn variant="secondary" onClick={() => { setShowQuForm(false); setQuForm(EMPTY_QU); setEditQuId(null); }}>Annuler</Btn>
                      <Btn onClick={saveQuotationUnit} disabled={!isQuFormValid()}>Enregistrer</Btn>
                    </div>
                  </div>
                )}

                {/* List */}
                {quotationUnits.length === 0 && !showQuForm && (
                  <div style={{ textAlign: "center", color: COLORS.textMuted, padding: 32, fontSize: 13 }}>Aucune entrée — cliquez sur "+ Ajouter" pour commencer</div>
                )}
                {quotationUnits.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {[...quotationUnits].sort((a, b) => (a.underlying || "").localeCompare(b.underlying || "")).map(qu => {
                      const underlyingLabel = (config.derivCommodities || []).find(c => c.value === qu.underlying)?.label || qu.underlying;
                      const exchangeLabel = (config.derivExchanges || []).find(e => e.value === qu.exchange)?.label || qu.exchange;
                      return (
                        <div key={qu.id} style={{ display: "flex", alignItems: "center", gap: 14, background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "12px 16px" }}>
                          <div style={{ width: 36, height: 36, borderRadius: 10, background: `${COLORS.blue}18`, border: `1px solid ${COLORS.blue}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>📐</div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text }}>{underlyingLabel} · {exchangeLabel}</div>
                            <div style={{ fontSize: 11, color: COLORS.textSub, marginTop: 2, fontFamily: "'DM Mono', monospace" }}>Unit : <span style={{ color: COLORS.accent }}>{qu.quotationUnit}</span></div>
                          </div>
                          <button onClick={() => { setQuForm({ underlying: qu.underlying, exchange: qu.exchange, quotationUnit: qu.quotationUnit }); setEditQuId(qu.id); setShowQuForm(true); if (!expandedQuotationUnits) setExpandedQuotationUnits(true); }} style={{ background: "none", border: "none", color: COLORS.accent, cursor: "pointer", fontSize: 14 }}>✏️</button>
                          <button onClick={() => deleteQuotationUnit(qu.id)} style={{ background: "none", border: "none", color: COLORS.red, cursor: "pointer", fontSize: 14 }}>🗑</button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Financial Brokers — lecture seule, alimenté par Companies */}
          {(() => {
            const financialBrokers = companies.filter(c =>
              (c.roles || []).some(r => r.toLowerCase().includes("financial") && r.toLowerCase().includes("broker"))
            );
            const currentDefault = config.derivDefaultBroker || "";
            const defaultStillValid = financialBrokers.some(c => c.name === currentDefault);
            return (
              <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, overflow: "hidden" }}>
                <div onClick={() => setExpandedFinancialBrokers(v => !v)}
                  style={{ padding: "18px 24px", borderBottom: expandedFinancialBrokers ? `1px solid ${COLORS.border}` : "none", background: `${COLORS.orange}08`, display: "flex", alignItems: "center", gap: 14, cursor: "pointer", userSelect: "none" }}
                  onMouseOver={e => e.currentTarget.style.background = `${COLORS.orange}14`}
                  onMouseOut={e => e.currentTarget.style.background = `${COLORS.orange}08`}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: COLORS.hover, border: `1px solid ${COLORS.orange}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🏦</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.text }}>Financial Brokers</div>
                    <div style={{ fontSize: 12, color: COLORS.textSub, marginTop: 2 }}>
                      Sociétés ayant le rôle <span style={{ color: COLORS.orange, fontWeight: 700 }}>Financial Broker</span> — gérez-les dans la section <span style={{ color: COLORS.accent, fontWeight: 600 }}>Companies</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap", justifyContent: "flex-end", maxWidth: 400, marginRight: 8 }}>
                    {financialBrokers.map(c => (
                      <span key={c.id} style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 5, background: COLORS.bg, color: COLORS.text, border: `1px solid ${COLORS.border}` }}>
                        {c.name}
                      </span>
                    ))}
                    {financialBrokers.length === 0 && <span style={{ fontSize: 11, color: COLORS.textMuted }}>Aucun broker</span>}
                  </div>
                  <span style={{ color: COLORS.textMuted, fontSize: 14, transition: "transform 0.2s", display: "inline-block", transform: expandedFinancialBrokers ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
                </div>
                {expandedFinancialBrokers && (
                  <div style={{ padding: "16px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
                    {financialBrokers.length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <div style={{ fontSize: 11, color: COLORS.textMuted }}>☆ Cliquez sur l'étoile pour définir le broker par défaut</div>
                        {financialBrokers.map(c => {
                          const isDefault = c.name === currentDefault;
                          return (
                            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "10px 14px" }}>
                              <div style={{ width: 12, height: 12, borderRadius: "50%", background: COLORS.orange, flexShrink: 0 }} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</div>
                                {c.country && <div style={{ fontSize: 11, color: COLORS.textSub }}>{c.country}</div>}
                              </div>
                              {(Array.isArray(c.businessUnit) ? c.businessUnit : (c.businessUnit ? [c.businessUnit] : [])).map(bu => {
                                const buCfg = (config.businessUnit || []).find(b => b.value === bu);
                                return buCfg ? <span key={bu} style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: `${buCfg.color}22`, color: buCfg.color, border: `1px solid ${buCfg.color}40` }}>{buCfg.label.toUpperCase()}</span> : null;
                              })}
                              <div onClick={() => updateField("derivDefaultBroker", isDefault ? "" : c.name)}
                                title="Définir comme broker par défaut"
                                style={{ fontSize: 18, color: isDefault ? COLORS.gold : COLORS.textMuted, cursor: "pointer", transition: "color 0.15s" }}
                                onMouseOver={e => e.currentTarget.style.color = COLORS.gold}
                                onMouseOut={e => e.currentTarget.style.color = isDefault ? COLORS.gold : COLORS.textMuted}>
                                {isDefault ? "★" : "☆"}
                              </div>
                            </div>
                          );
                        })}
                        {currentDefault && !defaultStillValid && <span style={{ fontSize: 11, color: COLORS.red }}>⚠ Cette société n'existe plus — veuillez resélectionner</span>}
                      </div>
                    )}
                    {financialBrokers.length === 0 && (
                      <div style={{ textAlign: "center", color: COLORS.textMuted, padding: "24px 0", fontSize: 13 }}>
                        Aucune société avec le rôle "Financial Broker" — assignez ce rôle dans <strong>Companies</strong>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          {/* ── EXCHANGE MANAGER ── */}
          <ExchangeManagerBlock />

          {/* ── BATCH EURONEXT FEES RECALC ── */}
          <BatchEuronextFees />

        </div>
      )}

      {adminTab === "company" && (
        <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, overflow: "hidden" }}>
          <div style={{ padding: "18px 24px", borderBottom: `1px solid ${COLORS.border}`, background: `${COLORS.accent}06` }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.text }}>🏢 Company</div>
            <div style={{ fontSize: 12, color: COLORS.textSub, marginTop: 4 }}>Paramètres spécifiques aux sociétés</div>
          </div>
          <div style={{ padding: "20px 24px" }}>

            {/* ── TIMEZONE BLOCK ── */}
            <TimezoneBlock config={config} updateField={updateField} />

            <div style={{ height: 1, background: COLORS.border, margin: "20px 0" }} />

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text, textTransform: "uppercase", letterSpacing: 0.5 }}>👥 EMPLOYEES</div>
              <Btn onClick={() => { setEmpForm({ firstName: "", name: "", phone: "", email: "", status: "active", role: "user", password: "" }); setEditEmpId(null); setShowEmpForm(true); }}>+ Ajouter</Btn>
            </div>

            {showEmpForm && (
              <div style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <Input label="First Name" value={empForm.firstName} onChange={v => setEmpForm({ ...empForm, firstName: v })} placeholder="John" />
                  <Input label="Name" value={empForm.name} onChange={v => setEmpForm({ ...empForm, name: v })} placeholder="Doe" />
                  <Input label="Phone Number" value={empForm.phone} onChange={v => setEmpForm({ ...empForm, phone: v })} placeholder="+33 6 12 34 56 78" />
                  <Input label="Email" value={empForm.email} onChange={v => setEmpForm({ ...empForm, email: v })} placeholder="john.doe@example.com" />
                  <SelectField label="Status" value={empForm.status} onChange={v => setEmpForm({ ...empForm, status: v })} options={[{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]} />
                  <SelectField label="Role" value={empForm.role} onChange={v => setEmpForm({ ...empForm, role: v })} options={[{ value: "admin", label: "Admin" }, { value: "user", label: "User" }]} />
                  <Input label="Mot de passe" value={empForm.password} onChange={v => setEmpForm({ ...empForm, password: v })} placeholder="Mot de passe" />
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 12, justifyContent: "flex-end" }}>
                  <Btn variant="secondary" onClick={() => setShowEmpForm(false)}>Annuler</Btn>
                  <Btn onClick={saveEmployee}>Enregistrer</Btn>
                </div>
              </div>
            )}

            {employees.length === 0 && !showEmpForm && (
              <div style={{ textAlign: "center", color: COLORS.textMuted, padding: 32, fontSize: 13 }}>Aucun employé — cliquez sur "+ Ajouter" pour commencer</div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {employees.map(e => (
                <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 12, background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "10px 16px" }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: COLORS.hover, border: `1px solid ${COLORS.accent}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: COLORS.accent, flexShrink: 0 }}>
                    {(e.firstName?.[0] || "") + (e.name?.[0] || "")}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text }}>{e.firstName} {e.name}</div>
                    <div style={{ fontSize: 11, color: COLORS.textSub }}>{e.email}{e.phone ? ` · ${e.phone}` : ""}</div>
                  </div>
                  <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, fontWeight: 600, background: e.status === "active" ? `${COLORS.green}22` : `${COLORS.red}22`, color: e.status === "active" ? COLORS.green : COLORS.red }}>{e.status === "active" ? "Active" : "Inactive"}</span>
                  <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, fontWeight: 700, background: e.role === "admin" ? `${COLORS.gold}22` : `${COLORS.border}`, color: e.role === "admin" ? COLORS.gold : COLORS.textMuted, border: `1px solid ${e.role === "admin" ? COLORS.gold + "50" : COLORS.border}` }}>{e.role === "admin" ? "⚙ Admin" : "User"}</span>
                  <button onClick={() => { setEmpForm({ ...e }); setEditEmpId(e.id); setShowEmpForm(true); }} style={{ background: "none", border: "none", color: COLORS.accent, cursor: "pointer", fontSize: 14 }}>✏️</button>
                  <button onClick={() => deleteEmployee(e.id)} style={{ background: "none", border: "none", color: COLORS.red, cursor: "pointer", fontSize: 14 }}>🗑</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {adminTab === "fields" && (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Bloc CRM */}
        <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, overflow: "hidden" }}>
          <div style={{ padding: "18px 24px", borderBottom: `1px solid ${COLORS.border}`, display: "flex", alignItems: "center", gap: 14, background: `${COLORS.accent}06` }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: COLORS.hover, border: `1px solid ${COLORS.accent}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>📋</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.text }}>Bloc CRM</div>
              <div style={{ fontSize: 12, color: COLORS.textSub }}>Valeurs prédéfinies pour les formulaires Companies &amp; Contacts</div>
            </div>
            <div style={{ fontSize: 11, color: COLORS.textMuted, background: COLORS.bg, padding: "4px 10px", borderRadius: 6, border: `1px solid ${COLORS.border}` }}>
              {FIELD_DEFINITIONS.length} champs configurables
            </div>
          </div>
          <div style={{ padding: "20px 24px" }}>
            <div style={{ padding: "10px 14px", background: `${COLORS.gold}10`, border: `1px solid ${COLORS.gold}30`, borderRadius: 10, marginBottom: 20, fontSize: 12, color: COLORS.gold, lineHeight: 1.7 }}>
              💡 Cliquez sur un champ pour le déplier et modifier ses valeurs. N'oubliez pas de cliquer sur <strong>✓ Sauvegarder</strong> après chaque modification.
            </div>
            {FIELD_DEFINITIONS.map(fieldDef => (
              <FieldEditor key={fieldDef.key} fieldDef={fieldDef} values={config[fieldDef.key] || []} onUpdate={updateField} />
            ))}
          </div>
        </div>

        {/* ── SAVED VIEWS ── */}
        <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, overflow: "hidden" }}>
          <div style={{ padding: "18px 24px", borderBottom: `1px solid ${COLORS.border}`, background: `${COLORS.accent}06` }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.text }}>📋 Vues sauvegardées</div>
            <div style={{ fontSize: 12, color: COLORS.textSub, marginTop: 4 }}>Sous-tableaux filtrés dans le menu Companies</div>
          </div>
          <div style={{ padding: "20px 24px" }}>
            <SavedViewsBlock config={config} updateField={updateField} />
          </div>
        </div>

      </div>
      )}

      {showResetConfirm && (
        <Modal title="Réinitialiser les valeurs" onClose={() => setShowResetConfirm(false)}>
          <p style={{ color: COLORS.textSub, fontSize: 14, lineHeight: 1.7 }}>
            Êtes-vous sûr de vouloir remettre toutes les valeurs par défaut ?<br />
            <strong style={{ color: COLORS.red }}>Cette action est irréversible.</strong>
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
            <Btn variant="secondary" onClick={() => setShowResetConfirm(false)}>Annuler</Btn>
            <Btn variant="danger" onClick={resetToDefaults}>Réinitialiser</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
};

// ─── DASHBOARD ────────────────────────────────────────────────
const Dashboard = ({ contacts, companies, tasks }) => {
  const { config } = useConfig();
  const totalRevenue = companies.reduce((s, c) => s + (c.revenue || 0), 0);
  const clientStatus = config.activityStatus.find(s => s.value === "client");
  const stats = [
    { label: "Sociétés", value: companies.length, color: COLORS.purple, icon: "◆" },
    { label: "Contacts", value: contacts.length, color: COLORS.blue, icon: "◉" },
    { label: "Clients actifs", value: contacts.filter(c => clientStatus ? c.status === clientStatus.value : false).length, color: COLORS.green, icon: "◈" },
    { label: "Tâches en cours", value: tasks.filter(t => !t.done).length, color: COLORS.gold, icon: "◎" },
    { label: "Revenus totaux", value: `${totalRevenue.toLocaleString("fr")} €`, color: COLORS.accent, icon: "◇" },
  ];
  const urgentTasks = tasks.filter(t => !t.done && t.priority === "haute").slice(0, 3);
  const recentContacts = [...contacts].sort((a, b) => new Date(b.lastContact) - new Date(a.lastContact)).slice(0, 4);
  const getStatusCfg = (v) => config.activityStatus.find(s => s.value === v) || { label: v || "—", color: COLORS.textSub };

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ margin: 0, fontSize: 28, color: COLORS.text, fontFamily: "'Inter', sans-serif" }}>Vue d'ensemble</h1>
        <p style={{ margin: "6px 0 0", color: COLORS.textSub, fontSize: 14 }}>Bienvenue dans votre espace CRM</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 16, marginBottom: 32 }}>
        {stats.map(s => (
          <div key={s.label} style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: "20px", borderLeft: `3px solid ${s.color}` }}>
            <div style={{ fontSize: 22, marginBottom: 10 }}>{s.icon}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: s.color, fontFamily: "'DM Mono', monospace", lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: 12, color: COLORS.textSub, marginTop: 6 }}>{s.label}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 22 }}>
          <h3 style={{ margin: "0 0 18px", fontSize: 15, color: COLORS.text }}>🔥 Tâches urgentes</h3>
          {urgentTasks.length === 0 && <p style={{ color: COLORS.textMuted, fontSize: 13 }}>Aucune tâche urgente</p>}
          {urgentTasks.map(t => {
            const contact = contacts.find(c => c.id === t.contactId);
            return (
              <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: `1px solid ${COLORS.border}` }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: COLORS.red, flexShrink: 0 }} />
                <div style={{ flex: 1 }}><div style={{ fontSize: 14, color: COLORS.text }}>{t.title}</div><div style={{ fontSize: 12, color: COLORS.textSub }}>{contact?.name}</div></div>
                <div style={{ fontSize: 11, color: COLORS.textMuted }}>{t.due}</div>
              </div>
            );
          })}
        </div>
        <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 22 }}>
          <h3 style={{ margin: "0 0 18px", fontSize: 15, color: COLORS.text }}>🕐 Derniers contacts</h3>
          {recentContacts.map(c => {
            const company = companies.find(co => co.id === c.companyId);
            const sc = getStatusCfg(c.status);
            return (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: `1px solid ${COLORS.border}` }}>
                <Avatar initials={c.avatar} size={34} color={sc.color} />
                <div style={{ flex: 1 }}><div style={{ fontSize: 14, color: COLORS.text }}>{c.name}</div><div style={{ fontSize: 12, color: COLORS.blue }}>{company?.name || "—"}</div></div>
                <Badge label={sc.label} color={sc.color} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ─── EXCEL IMPORT ─────────────────────────────────────────────
const COMPANY_FIELD_MAP = {
  "ref": ["ref", "reference", "référence", "company ref", "orb ref"],
  "name": ["name", "company name", "société", "societe", "company"],
  "website": ["website", "site", "url", "site web"],
  "city": ["city", "ville"],
  "country": ["country", "pays"],
  "group": ["group", "groupe"],
  "taxInfo": ["tax info", "taxinfo", "tax", "tva", "siret", "tax number", "numéro fiscal"],
  "address": ["address", "adresse"],
  "broker": ["broker", "courtier"],
  "roles": ["role", "roles", "rôle", "rôles"],
  "businessUnit": ["business unit", "businessunit", "bu", "business units"],
  "companyType": ["company type", "type société", "type de société", "type", "companytype"],
  "legalName": ["legal name", "raison sociale", "denomination", "nom légal", "legalname"],
  "companySize": ["company size", "taille société", "taille", "size", "companysize"],
  "status": ["activity status", "statut activité", "status", "statut"],
  "complianceStatus": ["compliance status", "statut compliance", "compliancestatus"],
  "finalAuthStatus": ["authorisation status", "final auth status", "final authorization status", "statut autorisation", "finalauthstatus"],
  "watchList": ["watch list", "watchlist", "watch"],
  "complianceAdditionalInfos": ["compliance additional infos", "compliance additional info", "compliance infos", "compliance notes", "additional infos compliance", "complianceadditionalinfos"],
  "complianceCreationDate": ["creation date", "compliance creation date", "date création", "date creation", "compliancecreationdate"],
  "complianceLastUpdateDate": ["last update date", "compliance last update", "date mise à jour", "date maj", "compliancelastupdatedate", "compliance last update date", "date mise a jour", "last update", "update date", "maj date", "date de mise a jour", "date de mise jour"],
  "complianceRequestDate": ["request date", "compliance request date", "date demande", "compliancerequestdate"],
  "complianceLastReceptionDate": ["last reception date", "compliance last reception", "date dernière réception", "date reception", "compliancelastreceptiondate"],
  "complianceFinalConfirmationDate": ["final confirmation date", "compliance final confirmation", "date confirmation finale", "compliancefinalconfirmationdate"],
  "incorporationDate": ["incorporation date", "date incorporation", "date création société", "date immatriculation", "incorporationdate"],
  "equity": ["equity", "capitaux propres", "fonds propres"],
  "turnover": ["turnover", "chiffre affaires", "ca", "chiffre d'affaires"],
  "netIncome": ["net income", "résultat net", "resultat net", "bénéfice net", "netincome"],
  "totalFixedAssets": ["total fixed assets", "actifs immobilisés", "immobilisations", "totalfixedassets"],
  "totalAssets": ["total assets", "total bilan", "bilan", "actif total", "totalassets"],
  "contractsCurrency": ["contracts currency", "currency", "devise", "monnaie", "contractscurrency"],
  "numberOfContracts": ["number of contracts", "nombre contrats", "nb contrats", "contracts", "numberofcontracts"],
"foodFeed": ["food feed", "foodfeed", "food/feed", "food", "feed"],
    "tags": ["tags", "tag"],
  "gtRole": ["gt role", "gt_role", "gtrole", "gt role(s)", "gt roles"],
};

const CONTACT_FIELD_MAP = {
  "name": ["name", "nom", "full name", "contact"],
  "email": ["email", "mail", "e-mail"],
  "phone": ["phone", "tel", "telephone"],
  "role": ["role", "rôle", "poste", "title", "job title"],
  "notes": ["notes", "note", "comments"],
  "revenue": ["revenue", "revenus", "ca"],
};

const DERIV_FIELD_MAP = {
  "ref":          ["ref", "reference", "référence", "trade ref", "op ref"],
  "type":         ["type", "instrument type", "inst type"],
  "opType":       ["op type", "optype", "operation type", "type opération"],
  "side":         ["side", "sens", "buy/sell", "achat/vente"],
  "instrument":   ["instrument", "instrument", "product", "produit", "contrat"],
  "quantity":     ["lots", "quantity", "qty", "nb lots", "number of lots", "quantité"],
  "price":        ["price", "prix"],
  "strike":       ["strike", "strike price", "prix exercice"],
  "optionType":   ["option type", "call/put", "optiontype"],
  "tradeDate":    ["trade date", "date trade", "date opération", "tradedate"],
  "expiryDate":   ["expiry date", "expiry", "date expiration", "expirydate"],
  "broker":       ["broker", "courtier"],
  "exchange":     ["exchange", "bourse", "marché"],
  "account":      ["account", "compte"],
  "businessUnit": ["business unit", "bu", "businessunit"],
  "contract":     ["contract", "contrat", "contract number"],
  "trade":        ["trade", "trade number", "trade id"],
  "status":       ["status", "statut", "op status", "operation status"],
  "internalDeal": ["internal deal", "internal", "internaldeal"],
  "notes":        ["notes", "note", "comments", "commentaires"],
  "fees":         ["fees", "fee", "frais", "commission", "brokerage", "courtage"],
};


const normalizeHeader = (h) => h?.toString().toLowerCase().trim()
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/[\u00A0\u2000-\u200B\u202F\u205F\u3000]/g, " ")
  .replace(/\s+/g, " ")
  .replace(/[^a-z0-9 ]/g, "");

const guessField = (header, fieldMap) => {
  const norm = normalizeHeader(header);
  console.log("HEADER:", JSON.stringify(header), "NORM:", JSON.stringify(norm), "LEN:", norm.length);
  for (const [field, aliases] of Object.entries(fieldMap)) {
if (aliases.some(a => { console.log("COMPARE:", JSON.stringify(norm), JSON.stringify(a), norm.length, a.length); if (norm === a) console.log("MATCH:", field, a); return norm === a; })) {
      return field;
    }
  }
  
  return null;
};

// ─── DERIV EXPORT MODAL ──────────────────────────────────────
const DerivExportModal = ({ ops, filtered, onClose, products = [], config = {} }) => {
  const [scope, setScope] = useState("filtered");
  const [exporting, setExporting] = useState(false);
  const COLUMNS = [
    { key: "ref",                   label: "Ref" },
    { key: "tradeDate",             label: "Trade Date" },
    { key: "type",                  label: "Type" },
    { key: "opType",                label: "Op Type" },
    { key: "side",                  label: "Side" },
    { key: "instrument",            label: "Instrument" },
    { key: "exchange",              label: "Exchange" },
    { key: "underlying",            label: "Underlying" },
    { key: "quantity",              label: "Quantity" },
    { key: "price",                 label: "Price" },
    { key: "strike",                label: "Strike" },
    { key: "optionType",            label: "Option Type" },
    { key: "expiryDate",            label: "Expiry Date" },
    { key: "account",               label: "Account" },
    { key: "broker",                label: "Broker" },
    { key: "businessUnit",          label: "Business Unit" },
    { key: "contract",              label: "Contract" },
    { key: "trade",                 label: "Trade" },
    { key: "lotSize",               label: "Lot Size" },
    { key: "orderTransmissionType", label: "Order Transmission" },
    { key: "fees",                  label: "Fees" },
    { key: "status",                label: "Status" },
    { key: "internalDeal",          label: "Internal Deal" },
    { key: "notes",                 label: "Notes" },
  ];
  const doExport = async () => {
    setExporting(true);
    try {
      const XLSX = await import("xlsx");
      const data = scope === "all" ? ops : filtered;
      const norm = v => (v || "").toLowerCase().trim();
      const commodities = config.derivCommodities || [];
      const rows = data.map(op => {
        const product = products.find(p => norm(p.label) === norm(op.instrument));
        const underlyingValue = product?.underlying || op.underlying || "";
        const underlyingLabel = commodities.find(c => norm(c.value) === norm(underlyingValue))?.label || underlyingValue;
        return Object.fromEntries(COLUMNS.map(c => {
          if (c.key === "underlying") return [c.label, underlyingLabel];
          return [c.label, op[c.key] ?? ""];
        }));
      });
      const ws = XLSX.utils.json_to_sheet(rows, { header: COLUMNS.map(c => c.label) });
      ws["!cols"] = COLUMNS.map(c => ({ wch: Math.max(c.label.length + 2, 14) }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Operations");
      const date = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `derivatives_export_${date}.xlsx`);
    } catch (e) { console.error("[export] error:", e); }
    setExporting(false);
    onClose();
  };
  return (
    <Modal title="Exporter les opérations" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ fontSize: 13, color: COLORS.textSub }}>Choisissez les opérations à exporter :</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            { value: "filtered", label: "Opérations filtrées", sub: `${filtered.length} opération${filtered.length !== 1 ? "s" : ""} visibles à l'écran` },
            { value: "all",      label: "Toutes les opérations", sub: `${ops.length} opération${ops.length !== 1 ? "s" : ""} au total` },
          ].map(opt => (
            <div key={opt.value} onClick={() => setScope(opt.value)}
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 10, border: `1px solid ${scope === opt.value ? COLORS.accent : COLORS.border}`, background: scope === opt.value ? `${COLORS.accent}10` : COLORS.card, cursor: "pointer", transition: "all 0.15s" }}>
              <div style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${scope === opt.value ? COLORS.accent : COLORS.border}`, background: scope === opt.value ? COLORS.accent : "transparent", flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>{opt.label}</div>
                <div style={{ fontSize: 11, color: COLORS.textMuted }}>{opt.sub}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11, color: COLORS.textMuted, background: COLORS.card, borderRadius: 8, padding: "10px 14px", border: `1px solid ${COLORS.border}` }}>
          📋 {COLUMNS.length} colonnes : {COLUMNS.map(c => c.label).join(", ")}
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
          <Btn variant="secondary" onClick={onClose}>Annuler</Btn>
          <Btn onClick={doExport} disabled={exporting}>{exporting ? "Export en cours…" : "⬇ Exporter Excel"}</Btn>
        </div>
      </div>
    </Modal>
  );
};

const ExcelImportModal = ({ onClose, onImport, type, derivAccounts = [], derivProducts = [], derivCompanies = [] }) => {
  const { config, updateField } = useConfig();
  const [step, setStep] = useState("guide");
  const [guideTab, setGuideTab] = useState(type === "companies" ? "companies" : type === "derivatives" ? "derivatives" : "contacts");
  const [rawRows, setRawRows] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [mapping, setMapping] = useState({});
  const [preview, setPreview] = useState([]);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef();
  const fieldMap = type === "companies" ? COMPANY_FIELD_MAP : type === "derivatives" ? DERIV_FIELD_MAP : CONTACT_FIELD_MAP;

  const [unknownQueue, setUnknownQueue] = useState([]);
  const [currentQueueIdx, setCurrentQueueIdx] = useState(0);
  const [decisions, setDecisions] = useState({});
  const [parsedItems, setParsedItems] = useState([]);
  const [rejectedValues, setRejectedValues] = useState([]);

  const GUIDE_CONFIG_MAP = {
  status: "activityStatus",
  companyType: "companyType",
  country: "country",
  city: "city",
  companySize: "companySize",
  foodFeed: "foodFeed",
  roles: "roles",
  businessUnit: "businessUnit",
  complianceStatus: "complianceStatus",
  finalAuthStatus: "finalAuthStatus",
  contractsCurrency: "contractsCurrency",
};

  const IMPORT_GUIDE = {
  companies: [
    { field: "ref", format: "Texte", note: "Laisser vide pour générer automatiquement" },
    { field: "name", format: "Texte", note: "" },
    { field: "legalName", format: "Texte", note: "" },
    { field: "companyType", format: "Texte", note: "" },
    { field: "group", format: "Texte", note: "" },
    { field: "taxInfo", format: "Texte", note: "" },
    { field: "website", format: "Texte", note: "" },
    { field: "address", format: "Texte", note: "" },
    { field: "city", format: "Texte", note: "" },
    { field: "country", format: "Texte", note: "" },
    { field: "status", format: "Texte", note: "" },
    { field: "companySize", format: "Texte", note: "" },
    { field: "broker", format: "Texte", note: "" },
    { field: "roles", format: "Texte", note: "Choix multiple — Séparateurs : , / ; |" },
    { field: "gtRole", format: "Texte", note: "" },
    { field: "businessUnit", format: "Texte", note: "Choix multiple — Séparateurs : , / ; |" },
    { field: "complianceStatus", format: "Texte", note: "" },
    { field: "finalAuthStatus", format: "Texte", note: "" },
    { field: "complianceCreationDate", format: "JJ/MM/AAAA", note: "" },
    { field: "complianceLastUpdateDate", format: "JJ/MM/AAAA", note: "" },
    { field: "complianceRequestDate", format: "JJ/MM/AAAA", note: "" },
    { field: "complianceLastReceptionDate", format: "JJ/MM/AAAA", note: "" },
    { field: "complianceFinalConfirmationDate", format: "JJ/MM/AAAA", note: "" },
    { field: "complianceAdditionalInfos", format: "Texte", note: "" },
    { field: "incorporationDate", format: "JJ/MM/AAAA", note: "" },
    { field: "equity", format: "Nombre", note: "" },
    { field: "turnover", format: "Nombre", note: "" },
    { field: "netIncome", format: "Nombre", note: "" },
    { field: "totalFixedAssets", format: "Nombre", note: "" },
    { field: "totalAssets", format: "Nombre", note: "" },
    { field: "contractsCurrency", format: "Texte", note: "Choix multiple — Séparateurs : , / ; |" },
    { field: "numberOfContracts", format: "Nombre", note: "" },
    { field: "foodFeed", format: "Texte", note: "" },
   { field: "tags", format: "Texte", note: "Choix multiple — Séparateurs : ," },
    { field: "watchList", format: "TRUE / FALSE", note: "" },
      ],
  contacts: [
    { field: "name", format: "Texte", note: "" },
    { field: "email", format: "Texte", note: "" },
    { field: "phone", format: "Texte", note: "" },
    { field: "position", format: "Texte", note: "" },
    { field: "company", format: "Texte", note: "" },
  ],
  derivatives: [
    { field: "ref",          format: "Texte",        note: "Référence unique de l'opération" },
    { field: "type",         format: "Texte",        note: "ex: Future, Option" },
    { field: "opType",       format: "Texte",        note: "ex: Trade, Hedging, Rolling" },
    { field: "side",         format: "BUY / SELL",   note: "" },
    { field: "instrument",   format: "Texte",        note: "Nom de l'instrument", label: "instrument" },
    { field: "quantity",     format: "Nombre",       note: "Nombre de lots" },
    { field: "price",        format: "Nombre",       note: "" },
    { field: "strike",       format: "Nombre",       note: "Options uniquement" },
    { field: "optionType",   format: "Call / Put",   note: "Options uniquement" },
    { field: "tradeDate",    format: "JJ/MM/AAAA",   note: "" },
    { field: "expiryDate",   format: "JJ/MM/AAAA",   note: "Options uniquement" },
    { field: "broker",       format: "Texte",        note: "" },
    { field: "exchange",     format: "Texte",        note: "" },
    { field: "account",      format: "Texte",        note: "" },
    { field: "businessUnit", format: "Texte",        note: "" },
    { field: "contract",     format: "Texte",        note: "" },
    { field: "trade",        format: "Texte",        note: "" },
    { field: "status",       format: "Texte",        note: "ex: traded, pending" },
    { field: "internalDeal", format: "TRUE / FALSE", note: "" },
    { field: "notes",        format: "Texte",        note: "" },
    { field: "fees",         format: "Nombre",       note: "Frais de courtage (override du calcul automatique)" },
  ],
  };
  const handleFile = async (file) => {
    setError("");
    try {
      const XLSX = await import("xlsx");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
      if (!json.length) { setError("Le fichier est vide."); return; }
      const hdrs = json[0].map(h => h?.toString() || "");
      const rows = json.slice(1).filter(r => r.some(c => c !== ""));
      setHeaders(hdrs); setRawRows(rows);
      const autoMap = {};
      hdrs.forEach((h, i) => { 
  const norm = normalizeHeader(h);

const g = guessField(h, fieldMap);  if (g && !Object.values(autoMap).includes(g)) autoMap[i] = g; 
});
      setMapping(autoMap); setStep("mapping");
    } catch { setError("Erreur de lecture du fichier."); }
  };

  const buildPreview = () => {
    setPreview(rawRows.slice(0, 5).map(row => { const obj = {}; Object.entries(mapping).forEach(([ci, f]) => { if (f) obj[f] = row[ci]?.toString() || ""; }); return obj; }));
    setStep("preview");
  };

  const FIELD_CONFIG_MAP = {
    status: { configKey: "activityStatus", label: "Activity Status" },
    companyType: { configKey: "companyType", label: "Company Type" },
    country: { configKey: "country", label: "Country" },
    city: { configKey: "city", label: "City" },
    companySize: { configKey: "companySize", label: "Company Size" },
    foodFeed: { configKey: "foodFeed", label: "Food / Feed" },
  };

  // For derivatives: fields that reference config lists or admin-managed tables
  const DERIV_FIELD_CONFIG_MAP = {
    type:         { configKey: "derivInstrumentTypes", label: "Instrument Type",  getValue: (v, cfg) => cfg.derivInstrumentTypes?.find(t => t.label?.toLowerCase() === v?.toLowerCase() || t.value?.toLowerCase() === v?.toLowerCase())?.label },
    opType:       { configKey: "derivOpTypes",         label: "Operation Type",   getValue: (v, cfg) => cfg.derivOpTypes?.find(t => t.label?.toLowerCase() === v?.toLowerCase() || t.value?.toLowerCase() === v?.toLowerCase())?.label },
    exchange:     { configKey: "derivExchanges",       label: "Exchange",         getValue: (v, cfg) => cfg.derivExchanges?.find(t => t.label?.toLowerCase() === v?.toLowerCase() || t.value?.toLowerCase() === v?.toLowerCase())?.value },
    businessUnit: { configKey: "businessUnit",         label: "Business Unit",    getValue: (v, cfg) => cfg.businessUnit?.find(t => t.label?.toLowerCase() === v?.toLowerCase() || t.value?.toLowerCase() === v?.toLowerCase())?.value },
  };

  const mapToConfigValue = (configKey, val) => {
    if (!val) return null;
    const normalize = s => s.toLowerCase().replace(/_/g, " ").trim();
    const normalizedVal = normalize(val);
    const match = config[configKey]?.find(s => normalize(s.value) === normalizedVal || normalize(s.label) === normalizedVal);
    return match ? match.value : null;
  };

  // Match against config values/labels only — no hardcoded guessing
  // Normalizes spaces, dashes (- and –) and case for flexible matching
  const mapAuth = (val, cfgList) => {
    if (!val) return null;
    const norm = s => s.toString().toLowerCase().replace(/[–—]/g, "-").replace(/\s+/g, " ").trim();
    const normalizedVal = norm(val);
    const match = cfgList.find(s =>
      norm(s.value) === normalizedVal || norm(s.label) === normalizedVal
    );
    return match ? match.value : null; // null = unknown, will be flagged
  };

  const doImport = () => {
    setImporting(true);
    const unknowns = {};
    const items = rawRows.map((row, i) => {
      const obj = { id: Date.now() + i };
      Object.entries(mapping).forEach(([ci, f]) => { if (f) obj[f] = row[ci]?.toString() || ""; });
      if (type === "companies") {
        obj.avatar = (obj.name || "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
        obj.tags = []; obj.revenue = Number(obj.revenue) || 0;
        // Keep imported ref if provided, otherwise generate one
        if (!obj.ref || obj.ref.trim() === "") {
          const existingRefs = [...companies.map(c => c.ref), ...rawRows.slice(0, i).map((_, j) => { const o = {}; Object.entries(mapping).forEach(([ci, f]) => { if (f) o[f] = rawRows[j][ci]?.toString() || ""; }); return o.ref; }).filter(Boolean)];
          let num = companies.length + i + 1;
          let generatedRef;
          do { generatedRef = "ORB-" + String(num).padStart(6, "0"); num++; } while (existingRefs.includes(generatedRef));
          obj.ref = generatedRef;
        }
        Object.entries(FIELD_CONFIG_MAP).forEach(([fieldKey, { configKey, label }]) => {
          const val = obj[fieldKey];
          if (val && !mapToConfigValue(configKey, val)) {
            const key = `${configKey}:${val}`;
            if (!unknowns[key]) unknowns[key] = { fieldKey, configKey, fieldLabel: label, value: val };
          }
        });
        obj.size = obj.size || "1-10";
        if (obj.complianceStatus) {
  const mapped = mapAuth(obj.complianceStatus, config.complianceStatus);
  if (mapped === null) {
    const key = `complianceStatus:${obj.complianceStatus}`;
    if (!unknowns[key]) unknowns[key] = { fieldKey: "complianceStatus", configKey: "complianceStatus", fieldLabel: "Compliance Status", value: obj.complianceStatus };
    obj.complianceStatus = "";
  } else {
    obj.complianceStatus = mapped;
  }
}
if (obj.finalAuthStatus) {
  const mapped = mapAuth(obj.finalAuthStatus, config.finalAuthStatus);
  if (mapped === null) {
    const key = `finalAuthStatus:${obj.finalAuthStatus}`;
    if (!unknowns[key]) unknowns[key] = { fieldKey: "finalAuthStatus", configKey: "finalAuthStatus", fieldLabel: "Final Authorization Status", value: obj.finalAuthStatus };
    obj.finalAuthStatus = "";
  } else {
    obj.finalAuthStatus = mapped;
  }
}
        if (obj.businessUnit && typeof obj.businessUnit === "string") {
          const buValues = obj.businessUnit.split(/[,;]/).map(v => v.trim()).filter(Boolean);
          buValues.forEach(v => {
            if (!mapToConfigValue("businessUnit", v)) {
              const key = `businessUnit:${v}`;
              if (!unknowns[key]) unknowns[key] = { fieldKey: "businessUnit", configKey: "businessUnit", fieldLabel: "Business Unit", value: v };
            }
          });
          obj.businessUnit = buValues;
        } else { obj.businessUnit = []; }
        if (obj.roles && typeof obj.roles === "string") {
  const roleValues = obj.roles.split(/[,;\/]/).map(r => r.trim()).filter(Boolean);
  const normRole = s => s.toLowerCase().replace(/_/g, " ");
  roleValues.forEach(r => {
    const matched = config.roles?.find(cr => normRole(cr.value) === normRole(r) || normRole(cr.label) === normRole(r));
    if (!matched) {
      const key = `roles:${r}`;
      if (!unknowns[key]) unknowns[key] = { fieldKey: "roles", configKey: "roles", fieldLabel: "Roles", value: r };
    }
  });
  obj.roles = roleValues.map(r => {
    const matched = config.roles?.find(cr => normRole(cr.value) === normRole(r) || normRole(cr.label) === normRole(r));
    return matched ? matched.value : r;
  });
} else { obj.roles = []; }
if (obj.contractsCurrency && typeof obj.contractsCurrency === "string") {
  const curValues = obj.contractsCurrency.split(/[,;]/).map(v => v.trim()).filter(Boolean);
  curValues.forEach(v => {
    const matched = config.contractsCurrency?.find(c => c.value.toLowerCase() === v.toLowerCase() || c.label.toLowerCase() === v.toLowerCase());
    if (!matched) {
      const key = `contractsCurrency:${v}`;
      if (!unknowns[key]) unknowns[key] = { fieldKey: "contractsCurrency", configKey: "contractsCurrency", fieldLabel: "Contracts Currency", value: v };
    }
  });
  obj.contractsCurrency = curValues.map(v => {
    const matched = config.contractsCurrency?.find(c => c.value.toLowerCase() === v.toLowerCase() || c.label.toLowerCase() === v.toLowerCase());
    return matched ? matched.value : v;
  });
} else { obj.contractsCurrency = []; }

        // Parse compliance dates (handles Excel serial, DD/MM/YYYY, ISO)
        const parseCompanyDate = (val) => {
          if (!val && val !== 0) return "";
          const s = val.toString().trim();
          if (/^\d{4,5}$/.test(s)) {
            const d = new Date(Math.round((parseInt(s) - 25569) * 86400 * 1000));
            return d.toISOString().split("T")[0];
          }
          const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
          if (m) return `${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`;
          if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
          return s;
        };
        if (obj.complianceCreationDate)       obj.complianceCreationDate       = parseCompanyDate(obj.complianceCreationDate);
        if (obj.complianceLastUpdateDate)     obj.complianceLastUpdateDate     = parseCompanyDate(obj.complianceLastUpdateDate);
        if (obj.complianceRequestDate)        obj.complianceRequestDate        = parseCompanyDate(obj.complianceRequestDate);
        if (obj.complianceLastReceptionDate)  obj.complianceLastReceptionDate  = parseCompanyDate(obj.complianceLastReceptionDate);
        if (obj.complianceFinalConfirmationDate) obj.complianceFinalConfirmationDate = parseCompanyDate(obj.complianceFinalConfirmationDate);
        obj.avatar = (obj.name || "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
        obj.tags = []; obj.revenue = Number(obj.revenue) || 0;
        const val = obj.status;
        if (val && !mapToConfigValue("activityStatus", val)) {
          const key = `activityStatus:${val}`;
          if (!unknowns[key]) unknowns[key] = { fieldKey: "status", configKey: "activityStatus", fieldLabel: "Activity Status", value: val };
        }
        obj.priority = obj.priority || "moyenne";
        obj.lastContact = new Date().toISOString().split("T")[0];
      } else if (type === "derivatives") {
        // Parse dates (handles Excel serial, DD/MM/YYYY, ISO)
        const parseExcelDate = (val) => {
          if (!val && val !== 0) return "";
          const s = val.toString().trim();
          // Excel serial number
          if (/^\d{4,5}$/.test(s)) {
            const d = new Date(Math.round((parseInt(s) - 25569) * 86400 * 1000));
            return d.toISOString().split("T")[0];
          }
          // DD/MM/YYYY or DD-MM-YYYY
          const m1 = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
          if (m1) return `${m1[3]}-${m1[2].padStart(2,"0")}-${m1[1].padStart(2,"0")}`;
          // Already ISO YYYY-MM-DD
          if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
          return s;
        };
        if (obj.tradeDate)  obj.tradeDate  = parseExcelDate(obj.tradeDate);
        if (obj.expiryDate) obj.expiryDate = parseExcelDate(obj.expiryDate);
        // Normalize numeric fields
        if (obj.quantity) obj.quantity = String(obj.quantity).replace(/,/g, ".");
        if (obj.price)    obj.price    = String(obj.price).replace(/,/g, ".");
        if (obj.strike)   obj.strike   = String(obj.strike).replace(/,/g, ".");
        // Normalize fees: keep as string if present, else empty (manual override of auto-compute)
        if (obj.fees !== undefined && obj.fees !== "") {
          const feesNum = parseFloat(String(obj.fees).replace(/,/g, "."));
          obj.fees = isNaN(feesNum) ? "" : String(feesNum);
        } else {
          obj.fees = "";
        }
        // Normalize side to uppercase
        if (obj.side) {
          obj.side = obj.side.toString().toUpperCase().trim();
          if (obj.side === "LONG") obj.side = "BUY";
          if (obj.side === "SHORT") obj.side = "SELL";
        }
        // Normalize internalDeal
        obj.internalDeal = String(obj.internalDeal || "").toLowerCase() === "true";
        // Normalize status
        if (obj.status) obj.status = obj.status.toString().toUpperCase().trim();
        // Validate config-linked fields
        Object.entries(DERIV_FIELD_CONFIG_MAP).forEach(([fieldKey, { configKey, label, getValue }]) => {
          const val = obj[fieldKey];
          if (!val) return;
          const found = getValue(val, config);
          if (!found) {
            const key = `${configKey}:${val}`;
            if (!unknowns[key]) unknowns[key] = { fieldKey, configKey, fieldLabel: label, value: val };
          }
        });
        // Validate required fields — same as REQUIRED_FIELDS in the form
        const DERIV_REQUIRED = [
          { key: "businessUnit", label: "Business Unit" },
          { key: "type",         label: "Instrument Type" },
          { key: "opType",       label: "Operation Type" },
          { key: "quantity",     label: "Number of Lots" },
          { key: "price",        label: "Price" },
          { key: "tradeDate",    label: "Trade Date" },
          { key: "instrument",   label: "Instrument" },
          { key: "account",      label: "Account" },
          { key: "side",         label: "Side" },
          { key: "broker",       label: "Broker" },
        ];
        DERIV_REQUIRED.forEach(({ key, label }) => {
          const val = obj[key];
          const isEmpty = !val || String(val).trim() === "";
          if (isEmpty) {
            const uKey = `missing_${key}`;
            if (!unknowns[uKey]) unknowns[uKey] = {
              fieldKey: key, configKey: `missing_${key}`,
              fieldLabel: label, value: "(vide)", missingRequired: true
            };
          }
        });
        // Validate account against derivAccounts table (only if account is present)
        if (obj.account && obj.account.toString().trim()) {
          const norm = v => v?.toString().toLowerCase().trim() || "";
          const accountExists = derivAccounts.some(a => norm(a.accountNumber) === norm(obj.account));
          if (!accountExists) {
            const key = `derivAccount:${obj.account}`;
            if (!unknowns[key]) unknowns[key] = { fieldKey: "account", configKey: "derivAccount", fieldLabel: "Account Number", value: obj.account, unknownAccount: true };
          }
        }
        // Validate instrument against deriv_products table (case-insensitive, trimmed)
        if (obj.instrument) {
          const norm = v => v?.toString().toLowerCase().trim() || "";
          const found = derivProducts.find(p => norm(p.label) === norm(obj.instrument) || norm(p.value) === norm(obj.instrument));
          if (!found) {
            const key = `derivProducts:${obj.instrument}`;
            if (!unknowns[key]) unknowns[key] = { fieldKey: "instrument", configKey: "derivProducts", fieldLabel: "Instrument", value: obj.instrument };
          } else if (!obj.exchange && found.stoxxExchange) {
            // Auto-fill exchange from product if not provided
            obj.exchange = found.stoxxExchange;
          }
        }
        // Validate broker against companies list
        if (obj.broker) {
          const norm = v => v?.toString().toLowerCase().trim() || "";
          const brokerExists = derivCompanies.some(c => norm(c.name) === norm(obj.broker));
          if (!brokerExists) {
            const key = `derivBroker:${obj.broker}`;
            if (!unknowns[key]) unknowns[key] = { fieldKey: "broker", configKey: "derivBroker", fieldLabel: "Broker", value: obj.broker, infoOnly: true };
          }
        }
      }
      return obj;
    }).filter(o => {
      if (type === "derivatives") {
        const hasRequired = !!(o.businessUnit && o.type && o.opType && o.quantity && o.price && o.tradeDate && o.instrument && o.account && o.side && o.broker);
        return !!(o.ref || o.side || o.instrument || o.price || o.quantity) && hasRequired;
      }
      return !!o.name;
    });

    setParsedItems(items);
    const allUnknowns = Object.values(unknowns);
    // infoOnly = broker — accepté automatiquement sans demande à l'utilisateur
    // unknownAccount = compte inconnu — doit passer dans la queue de validation
    const autoDecisions = {};
    allUnknowns.filter(u => u.infoOnly).forEach(u => {
      autoDecisions[`${u.configKey}:${u.value}`] = "add";
    });
    const queue = allUnknowns.filter(u => !u.infoOnly);
    if (queue.length > 0) {
      setUnknownQueue(queue); setCurrentQueueIdx(0); setDecisions(autoDecisions); setStep("validate");
    } else {
      const resolved = resolveItems(items, autoDecisions);
      onImport(resolved, Object.values(mapping).filter(Boolean)); setImporting(false); onClose();
    }
    setImporting(false);
  };

  const resolveItems = (items, finalDecisions) => {
    return items.map(obj => {
      const resolved = { ...obj };
      if (type === "companies") {
        Object.entries(FIELD_CONFIG_MAP).forEach(([fieldKey, { configKey }]) => {
          const val = resolved[fieldKey];
          if (!val) return;
          const mapped = mapToConfigValue(configKey, val);
          if (mapped) { resolved[fieldKey] = mapped; }
          else {
            const key = `${configKey}:${val}`;
            const decision = finalDecisions[key];
            resolved[fieldKey] = decision === "add" ? (mapToConfigValue(configKey, val) || val) : "";
          }
        });
        if (Array.isArray(resolved.businessUnit)) {
          resolved.businessUnit = resolved.businessUnit.map(v => {
            const mapped = mapToConfigValue("businessUnit", v);
            if (mapped) return mapped;
            const key = `businessUnit:${v}`;
            return finalDecisions[key] === "add" ? (mapToConfigValue("businessUnit", v) || v) : null;
          }).filter(Boolean);
        }
        if (Array.isArray(resolved.roles)) {
  const normRole = s => s.toLowerCase().replace(/_/g, " ");
  resolved.roles = resolved.roles.map(r => {
    const matched = config.roles?.find(cr => normRole(cr.value) === normRole(r) || normRole(cr.label) === normRole(r));
    if (matched) return matched.value;
    const key = `roles:${r}`;
    return finalDecisions[key] === "add" ? r : null;
  }).filter(Boolean);
}
if (Array.isArray(resolved.contractsCurrency)) {
  resolved.contractsCurrency = resolved.contractsCurrency.map(v => {
    const matched = config.contractsCurrency?.find(c => c.value.toLowerCase() === v.toLowerCase() || c.label.toLowerCase() === v.toLowerCase());
    if (matched) return matched.value;
    const key = `contractsCurrency:${v}`;
    return finalDecisions[key] === "add" ? v : null;
  }).filter(Boolean);
}
      } else if (type === "contacts") {
        const val = resolved.status;
        if (val) {
          const mapped = mapToConfigValue("activityStatus", val);
          if (mapped) { resolved.status = mapped; }
          else {
            const key = `activityStatus:${val}`;
            resolved.status = finalDecisions[key] === "add"
              ? (mapToConfigValue("activityStatus", val) || config.activityStatus[0]?.value || "")
              : (config.activityStatus[0]?.value || "");
          }
        }
      } else if (type === "derivatives") {
        // Apply decisions for config-linked fields
        Object.entries(DERIV_FIELD_CONFIG_MAP).forEach(([fieldKey, { configKey, getValue }]) => {
          const val = resolved[fieldKey];
          if (!val) return;
          const found = getValue(val, config);
          if (found) {
            resolved[fieldKey] = found;
          } else {
            const key = `${configKey}:${val}`;
            const decision = finalDecisions[key];
            resolved[fieldKey] = decision === "add" ? val : "";
          }
        });
        // instrument
        if (resolved.instrument) {
          const norm = v => v?.toString().toLowerCase().trim() || "";
          const found = derivProducts.find(p => norm(p.label) === norm(resolved.instrument) || norm(p.value) === norm(resolved.instrument));
          if (found) {
            resolved.instrument = found.label || found.value;
          } else {
            const key = `derivProducts:${resolved.instrument}`;
            const decision = finalDecisions[key];
            resolved.instrument = decision === "add" ? resolved.instrument : "";
          }
        }
      }
      return resolved;
    });
  };

  const handleDecision = (decision) => {
    const current = unknownQueue[currentQueueIdx];
    const key = `${current.configKey}:${current.value}`;
    const newDecisions = { ...decisions, [key]: decision };
    setDecisions(newDecisions);
    if (decision === "add") {
      if (current.configKey === "derivProducts") {
        // Instrument inconnu — on ne peut pas l'ajouter ici (trop de champs requis)
        // L'utilisateur doit créer l'instrument dans Admin Panel > Instruments
      } else {
        const fieldDef = FIELD_DEFINITIONS.find(f => f.key === current.configKey);
        const useLabel = fieldDef && !fieldDef.hasValue;
        const isCountry = current.configKey === "country";
        const newItem = { value: useLabel ? current.value.toUpperCase() : isCountry ? current.value.toUpperCase() : current.value.toLowerCase().replace(/\s+/g, "_"), label: isCountry ? current.value.toUpperCase() : current.value };
        const hasColor = config[current.configKey]?.[0]?.color !== undefined;
        if (hasColor) newItem.color = COLORS.textSub;
        updateField(current.configKey, [...(config[current.configKey] || []), newItem]);
      }
    }
    if (currentQueueIdx < unknownQueue.length - 1) {
      setCurrentQueueIdx(currentQueueIdx + 1);
    } else {
      const skipped = unknownQueue.filter(u => newDecisions[`${u.configKey}:${u.value}`] === "skip").map(u => ({ field: u.fieldLabel, value: u.value }));
      setRejectedValues(skipped);
      const resolved = resolveItems(parsedItems, newDecisions);
      onImport(resolved, Object.values(mapping).filter(Boolean)); setStep("summary");
    }
  };

  const allFields = Object.keys(fieldMap);
  const currentItem = unknownQueue[currentQueueIdx];

  return (
    <div style={{ position: "fixed", inset: 0, background: "#00000090", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 18, padding: 30, width: "100%", maxWidth: 700, maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, color: COLORS.text, fontFamily: "'Inter', sans-serif" }}>Import Excel — {type === "companies" ? "Companies" : type === "derivatives" ? "Derivatives" : "Contacts"}</h2>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: COLORS.textSub }}>Formats acceptés : .xlsx, .xls, .csv</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: COLORS.textSub, cursor: "pointer", fontSize: 22 }}>×</button>
        </div>

        {step !== "validate" && step !== "summary" && (
          <div style={{ display: "flex", gap: 6, marginBottom: 28 }}>
            {[["guide", "0. Guide"], ["upload", "1. Fichier"], ["mapping", "2. Colonnes"], ["preview", "3. Aperçu"]].map(([s, l]) => (
              <div key={s} style={{ padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: step === s ? COLORS.accent : COLORS.bg, color: step === s ? "#fff" : COLORS.textMuted, border: `1px solid ${step === s ? COLORS.accent : COLORS.border}` }}>{l}</div>
            ))}
          </div>
        )}

        {step === "guide" && (
  <div>
    <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
      {(type === "derivatives" ? ["derivatives"] : ["companies", "contacts"]).map(t => (
        <span key={t} onClick={() => setGuideTab(t)} style={{ cursor: "pointer", fontSize: 12, fontWeight: 700, padding: "4px 14px", borderRadius: 8, background: guideTab === t ? COLORS.accent : COLORS.bg, color: guideTab === t ? "#fff" : COLORS.textMuted, border: `1px solid ${guideTab === t ? COLORS.accent : COLORS.border}` }}>
          {t === "companies" ? "Companies" : t === "contacts" ? "Contacts" : "Derivatives"}
        </span>
      ))}
    </div>
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ background: COLORS.bg }}>
            <th style={{ padding: "8px 12px", textAlign: "left", color: COLORS.textSub, fontWeight: 700, borderBottom: `1px solid ${COLORS.border}`, letterSpacing: 0.5 }}>CHAMP</th>
            <th style={{ padding: "8px 12px", textAlign: "left", color: COLORS.textSub, fontWeight: 700, borderBottom: `1px solid ${COLORS.border}`, letterSpacing: 0.5 }}>FORMAT</th>
            <th style={{ padding: "8px 12px", textAlign: "left", color: COLORS.textSub, fontWeight: 700, borderBottom: `1px solid ${COLORS.border}`, letterSpacing: 0.5 }}>NOTE</th>
            <th style={{ padding: "8px 12px", textAlign: "left", color: COLORS.textSub, fontWeight: 700, borderBottom: `1px solid ${COLORS.border}`, letterSpacing: 0.5 }}>VALEURS</th>
          </tr>
        </thead>
        <tbody>
          {IMPORT_GUIDE[guideTab].map((row, i) => (
            <tr key={row.field} style={{ background: i % 2 === 0 ? COLORS.card : COLORS.bg }}>
              <td style={{ padding: "7px 12px", color: COLORS.accent, fontFamily: "'DM Mono', monospace", borderBottom: `1px solid ${COLORS.border}` }}>{row.field}</td>
              <td style={{ padding: "7px 12px", color: COLORS.text, borderBottom: `1px solid ${COLORS.border}` }}>{row.format}</td>
              <td style={{ padding: "7px 12px", color: COLORS.textSub, borderBottom: `1px solid ${COLORS.border}` }}>{row.note}</td>
              <td style={{ padding: "7px 12px", borderBottom: `1px solid ${COLORS.border}` }}>
                {GUIDE_CONFIG_MAP[row.field] && config[GUIDE_CONFIG_MAP[row.field]]?.length > 0 ? (
                  <details>
                    <summary style={{ cursor: "pointer", fontSize: 11, color: COLORS.accent, fontWeight: 600 }}>{config[GUIDE_CONFIG_MAP[row.field]].length} valeurs</summary>
                    <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {config[GUIDE_CONFIG_MAP[row.field]].map(v => (
                        <span key={v.value} style={{ fontSize: 10, padding: "2px 7px", borderRadius: 6, background: v.color ? `${v.color}22` : COLORS.bg, color: v.color || COLORS.text, border: `1px solid ${v.color ? v.color + "55" : COLORS.border}`, fontWeight: 600 }}>{v.label}</span>
                      ))}
                    </div>
                  </details>
                ) : <span style={{ color: COLORS.textMuted, fontSize: 11 }}>—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
      <Btn onClick={() => setStep("upload")}>Suivant →</Btn>
    </div>
  </div>
)}

        {step === "upload" && (
          <div>
            <div onClick={() => fileRef.current.click()} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); }}
              style={{ border: `2px dashed ${COLORS.border}`, borderRadius: 14, padding: "48px 24px", textAlign: "center", cursor: "pointer" }}
              onMouseOver={e => e.currentTarget.style.borderColor = COLORS.accent} onMouseOut={e => e.currentTarget.style.borderColor = COLORS.border}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>📂</div>
              <div style={{ color: COLORS.text, fontSize: 15, fontWeight: 600 }}>Glissez votre fichier ici</div>
              <div style={{ color: COLORS.textSub, fontSize: 13, marginTop: 6 }}>ou cliquez pour parcourir</div>
            </div>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }} onChange={e => { if (e.target.files[0]) handleFile(e.target.files[0]); }} />
            {error && <div style={{ marginTop: 14, padding: "10px 14px", background: `${COLORS.red}15`, borderRadius: 8, color: COLORS.red, fontSize: 13 }}>{error}</div>}
          </div>
        )}

        {step === "mapping" && (() => {
          const CONTACT_ONLY_FIELDS = ["president", "ceo", "cfo", "ubo"];
          const normalizeH = h => h?.toString().toLowerCase().replace(/[^a-z0-9]/g, "");
          const isContactOnly = (h) => CONTACT_ONLY_FIELDS.includes(normalizeH(h));
          const mappedCount = Object.values(mapping).filter(Boolean).length;
          const reallyIgnored = headers.filter((h, i) => !mapping[i] && !isContactOnly(h)).length;
          const allOk = reallyIgnored === 0;
          return (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, padding: "10px 16px", borderRadius: 10, background: allOk ? `${COLORS.green}12` : `${COLORS.red}12`, border: `1px solid ${allOk ? COLORS.green : COLORS.red}30` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 12, height: 12, borderRadius: "50%", background: allOk ? COLORS.green : COLORS.red, boxShadow: `0 0 6px ${allOk ? COLORS.green : COLORS.red}` }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: allOk ? COLORS.green : COLORS.red }}>
                  {allOk ? "Toutes les colonnes sont mappées" : `${reallyIgnored} colonne${reallyIgnored > 1 ? "s" : ""} ignorée${reallyIgnored > 1 ? "s" : ""}`}
                </span>
              </div>
              <span style={{ fontSize: 12, color: COLORS.textSub }}>{mappedCount} / {headers.length} mappées</span>
            </div>
            <p style={{ color: COLORS.textSub, fontSize: 13, margin: "0 0 16px" }}>{rawRows.length} lignes détectées.</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, maxHeight: 380, overflowY: "auto" }}>
              {headers.map((h, i) => {
                const isMapped = !!mapping[i];
                const isException = !isMapped && isContactOnly(h);
                const dotColor = isMapped ? COLORS.green : isException ? COLORS.textMuted : COLORS.red;
                const borderColor = isMapped ? COLORS.green + "50" : isException ? COLORS.border : COLORS.red + "50";
                return (
                <div key={i} style={{ background: COLORS.bg, borderRadius: 10, padding: "10px 14px", border: `1px solid ${borderColor}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: dotColor, boxShadow: isMapped || isException ? `0 0 4px ${dotColor}` : `0 0 4px ${COLORS.red}` }} />
                    <div style={{ fontSize: 12, color: COLORS.accent, fontWeight: 600 }}>{h || `Colonne ${i + 1}`}</div>
                    {isException && <span style={{ fontSize: 10, color: COLORS.textMuted, marginLeft: "auto", fontStyle: "italic" }}>saisie manuelle</span>}
                  </div>
                  <select value={mapping[i] || ""} onChange={e => { const m = { ...mapping }; if (e.target.value) { Object.keys(m).forEach(k => { if (m[k] === e.target.value) delete m[k]; }); m[i] = e.target.value; } else delete m[i]; setMapping(m); }}
                    style={{ width: "100%", background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "6px 10px", color: COLORS.text, fontSize: 13, fontFamily: "inherit", outline: "none" }}>
                    <option value="">— Ignorer —</option>
                    {allFields.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                  <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 4 }}>Ex: {rawRows[0]?.[i]?.toString().slice(0, 30) || "—"}</div>
                </div>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 22, justifyContent: "flex-end" }}>
              <Btn variant="secondary" onClick={() => setStep("upload")}>← Retour</Btn>
              <Btn onClick={buildPreview}>Aperçu →</Btn>
            </div>
          </div>
          );
        })()}

        {step === "preview" && (
          <div>
            <p style={{ color: COLORS.textSub, fontSize: 13, margin: "0 0 16px" }}>Aperçu des 5 premières lignes sur {rawRows.length}.</p>
            <div style={{ overflowX: "auto", borderRadius: 10, border: `1px solid ${COLORS.border}` }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead><tr style={{ background: COLORS.bg }}>{Object.values(mapping).filter(Boolean).map(f => <th key={f} style={{ padding: "10px 14px", color: COLORS.textSub, fontWeight: 700, textAlign: "left", borderBottom: `1px solid ${COLORS.border}` }}>{f.toUpperCase()}</th>)}</tr></thead>
                <tbody>{preview.map((row, i) => <tr key={i} style={{ borderBottom: `1px solid ${COLORS.border}` }}>{Object.values(mapping).filter(Boolean).map(f => <td key={f} style={{ padding: "9px 14px", color: COLORS.text, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row[f] || <span style={{ color: COLORS.textMuted }}>—</span>}</td>)}</tr>)}</tbody>
              </table>
            </div>
            <div style={{ marginTop: 16, padding: "10px 14px", background: `${COLORS.green}12`, border: `1px solid ${COLORS.green}30`, borderRadius: 8, fontSize: 13, color: COLORS.green }}>
              ✓ {rawRows.length} lignes prêtes à l'import
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 22, justifyContent: "flex-end" }}>
              <Btn variant="secondary" onClick={() => setStep("mapping")}>← Modifier</Btn>
              <Btn onClick={doImport} style={{ background: COLORS.green }}>{importing ? "Import..." : `✓ Importer ${rawRows.length} lignes`}</Btn>
            </div>
          </div>
        )}

        {step === "validate" && currentItem && (
          <div>
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.text }}>Validation des valeurs inconnues</span>
                <span style={{ fontSize: 12, color: COLORS.textSub }}>{currentQueueIdx + 1} / {unknownQueue.length}</span>
              </div>
              <div style={{ height: 6, background: COLORS.border, borderRadius: 4 }}>
                <div style={{ height: 6, background: COLORS.accent, borderRadius: 4, width: `${((currentQueueIdx + 1) / unknownQueue.length) * 100}%`, transition: "width 0.3s" }} />
              </div>
            </div>
            <div style={{ background: COLORS.bg, border: `1px solid ${COLORS.gold}40`, borderRadius: 16, padding: 28, textAlign: "center" }}>
              <div style={{ fontSize: 13, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5, marginBottom: 10 }}>CHAMP : {currentItem.fieldLabel.toUpperCase()}</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: COLORS.gold, marginBottom: 10, fontFamily: "'Inter', sans-serif" }}>"{currentItem.value}"</div>
              {currentItem.unknownAccount ? (
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 13, color: COLORS.textSub, marginBottom: 20, lineHeight: 1.8 }}>
                    <span style={{ color: COLORS.red, fontWeight: 600 }}>⚠ Ce numéro de compte n'existe pas dans l'Admin Panel.</span><br />
                    <span style={{ color: COLORS.orange, fontWeight: 600 }}>⚠ L'import ne peut pas continuer.</span><br />
                    Créez d'abord ce compte dans<br />
                    <strong style={{ color: COLORS.text }}>Admin Panel → Derivatives → Accounts</strong><br />
                    <span style={{ color: COLORS.textMuted, fontSize: 12 }}>puis relancez l'import.</span>
                  </div>
                  <button onClick={onClose} style={{ padding: "12px 32px", borderRadius: 10, background: `${COLORS.red}15`, border: `1.5px solid ${COLORS.red}40`, color: COLORS.red, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                    ✗ Annuler l'import
                  </button>
                </div>
              ) : currentItem.infoOnly ? (
                <>
                  <div style={{ fontSize: 13, color: COLORS.textSub, marginBottom: 28 }}>
                    Cette valeur (<strong style={{ color: COLORS.text }}>{currentItem.fieldLabel}</strong>) sera importée telle quelle.<br />
                    <span style={{ color: COLORS.orange }}>⚠ Vérifiez qu'elle correspond à une entrée existante dans l'Admin Panel.</span>
                  </div>
                  <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                    <button onClick={() => handleDecision("skip")} style={{ padding: "12px 28px", borderRadius: 10, background: `${COLORS.red}15`, border: `1.5px solid ${COLORS.red}40`, color: COLORS.red, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                      ✗ Ignorer ce champ
                    </button>
                    <button onClick={() => handleDecision("add")} style={{ padding: "12px 28px", borderRadius: 10, background: `${COLORS.green}20`, border: `1.5px solid ${COLORS.green}60`, color: COLORS.green, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                      ✓ Importer tel quel
                    </button>
                  </div>
                </>
              ) : currentItem.configKey?.startsWith("missing_") ? (
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 13, color: COLORS.textSub, marginBottom: 20, lineHeight: 1.8 }}>
                    <span style={{ color: COLORS.red, fontWeight: 600 }}>⚠ Certaines opérations n'ont pas de valeur pour le champ obligatoire <strong style={{ color: COLORS.text }}>{currentItem.fieldLabel}</strong>.</span><br />
                    <span style={{ color: COLORS.textMuted, fontSize: 12 }}>Ces lignes seront ignorées à l'import.</span>
                  </div>
                  <button onClick={() => handleDecision("skip")} style={{ padding: "12px 32px", borderRadius: 10, background: `${COLORS.orange}15`, border: `1.5px solid ${COLORS.orange}40`, color: COLORS.orange, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                    OK — Continuer sans ces lignes
                  </button>
                </div>
              ) : (
                <>
                  {currentItem.configKey !== "derivProducts" && (
                    <div style={{ fontSize: 13, color: COLORS.textSub, marginBottom: 28 }}>
                      Cette valeur n&#39;existe pas dans l&#39;Admin Panel.<br />
                      Voulez-vous l'intégrer dans la liste <strong style={{ color: COLORS.text }}>{currentItem.fieldLabel}</strong> ?
                    </div>
                  )}
                  {currentItem.configKey === "derivProducts" ? (
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 13, color: COLORS.textSub, marginBottom: 20, lineHeight: 1.8 }}>
                        Cet instrument n'existe pas dans l'Admin Panel.<br />
                        <span style={{ color: COLORS.orange, fontWeight: 600 }}>⚠ L'import ne peut pas continuer.</span><br />
                        Créez d'abord cet instrument dans<br />
                        <strong style={{ color: COLORS.text }}>Admin Panel → Derivatives → Instruments</strong><br />
                        <span style={{ color: COLORS.textMuted, fontSize: 12 }}>puis relancez l'import.</span>
                      </div>
                      <button onClick={onClose} style={{ padding: "12px 32px", borderRadius: 10, background: `${COLORS.red}15`, border: `1.5px solid ${COLORS.red}40`, color: COLORS.red, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                        ✗ Annuler l'import
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                      <button onClick={() => handleDecision("skip")} style={{ padding: "12px 28px", borderRadius: 10, background: `${COLORS.red}15`, border: `1.5px solid ${COLORS.red}40`, color: COLORS.red, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                        ✗ Ne pas intégrer
                      </button>
                      <button onClick={() => handleDecision("add")} style={{ padding: "12px 28px", borderRadius: 10, background: `${COLORS.green}20`, border: `1.5px solid ${COLORS.green}60`, color: COLORS.green, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                        ✓ Intégrer dans l&#39;Admin Panel
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {step === "summary" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, padding: "14px 18px", background: `${COLORS.green}12`, border: `1px solid ${COLORS.green}40`, borderRadius: 12 }}>
              <span style={{ fontSize: 24 }}>✅</span>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.green }}>Import terminé</div>
                <div style={{ fontSize: 13, color: COLORS.textSub, marginTop: 3 }}>{parsedItems.length} entrées importées avec succès.</div>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
              <Btn onClick={onClose}>Fermer</Btn>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── COLORED STATUS DROPDOWN ─────────────────────────────────
const ColoredStatusDropdown = ({ label, value, options, getCfg, onChange }) => {
  const current = getCfg(value);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);
  return (
    <div>
      <div style={{ fontSize: 10, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5, marginBottom: 6 }}>{label}</div>
      <div ref={ref} style={{ position: "relative" }}>
        <div onClick={() => setOpen(o => !o)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: `${current.color}18`, border: `1px solid ${current.color}60`, borderRadius: 8, padding: "7px 10px", cursor: "pointer", transition: "all 0.15s" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: current.color, lineHeight: 1.3 }}>{current.label}</span>
          <span style={{ fontSize: 9, color: current.color, marginLeft: 6, flexShrink: 0 }}>▼</span>
        </div>
        {open && (
          <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 300, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10, overflow: "hidden", boxShadow: "0 8px 24px #00000060" }}>
            {options.map(s => (
              <div key={s.value} onClick={() => { onChange(s.value); setOpen(false); }}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", cursor: "pointer", background: value === s.value ? `${s.color}18` : "transparent", borderLeft: `3px solid ${value === s.value ? s.color : "transparent"}`, transition: "background 0.1s" }}
                onMouseEnter={e => { if (value !== s.value) e.currentTarget.style.background = COLORS.hover; }}
                onMouseLeave={e => { if (value !== s.value) e.currentTarget.style.background = "transparent"; }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: s.color, flexShrink: 0 }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: s.color, lineHeight: 1.3 }}>{s.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── COMPANY DETAIL PANEL ────────────────────────────────────
const CompanyDetailPanel = ({ sel, selContacts, onEdit, onDelete, getStatusCfg, getComplianceCfg, getFinalAuthCfg, getBUCfg, getRoleCfg, getTypeCfg, onPatchCompany }) => {
  const { config } = useConfig();
  const [activeTab, setActiveTab] = useState("info");
  const TABS = [
    { id: "info", label: "INFO", icon: "ℹ" },
    { id: "contacts", label: "CONTACTS", icon: "◉" },
    { id: "compliance", label: "COMPLIANCE", icon: "🛡" },
    { id: "finance", label: "FINANCE", icon: "💰" },
    { id: "activity", label: "ACTIVITY", icon: "📊" },
    { id: "risk", label: "RISK", icon: "⚠" },
    { id: "documents", label: "DOCUMENTS", icon: "📄" },
  ];

  return (
    <div style={{ width: 480, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, display: "flex", flexDirection: "column", flexShrink: 0, overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "20px 20px 0", borderBottom: `1px solid ${COLORS.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <CountryFlag country={sel.country} size={44} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.text, fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sel.name}</div>
            <div style={{ fontSize: 12, color: COLORS.textSub, marginTop: 2 }}>{sel.website || "—"}</div>
          </div>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            <button onClick={onEdit} title="Modifier" style={{ background: COLORS.hover, border: `1px solid ${COLORS.accent}40`, color: COLORS.accent, borderRadius: 7, padding: "5px 10px", cursor: "pointer", fontSize: 13 }}>✏️</button>
            <button onClick={onDelete} title="Supprimer" style={{ background: `${COLORS.red}15`, border: `1px solid ${COLORS.red}30`, color: COLORS.red, borderRadius: 7, padding: "5px 10px", cursor: "pointer", fontSize: 13 }}>🗑</button>
          </div>
        </div>
        <div style={{ display: "flex", gap: 0 }}>
          {TABS.map(t => (
            <div key={t.id} onClick={() => setActiveTab(t.id)} style={{
              flex: 1, textAlign: "center", padding: "8px 4px", cursor: "pointer", fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
              color: activeTab === t.id ? COLORS.accent : COLORS.textMuted,
              borderBottom: `2px solid ${activeTab === t.id ? COLORS.accent : "transparent"}`,
              transition: "all 0.15s",
            }}
              onMouseOver={e => { if (activeTab !== t.id) e.currentTarget.style.color = COLORS.textSub; }}
              onMouseOut={e => { if (activeTab !== t.id) e.currentTarget.style.color = COLORS.textMuted; }}
            >
              <div style={{ fontSize: 14, marginBottom: 3 }}>{t.icon}</div>
              {t.label}
            </div>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>

        {/* ── INFO ── */}
        {activeTab === "info" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: `${COLORS.accent}10`, border: `1px solid ${COLORS.accent}25`, borderRadius: 8, padding: "7px 12px", marginBottom: 14 }}>
  <span style={{ fontSize: 11, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5 }}>ID</span>
  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 700, color: COLORS.accent, letterSpacing: 1 }}>{sel.ref || "—"}</span>
</div>
{sel.legalName && <div style={{ borderBottom: `1px solid ${COLORS.border}`, padding: "9px 0", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
  <span style={{ fontSize: 12, color: COLORS.textSub, flexShrink: 0 }}>Legal Name</span>
  <span style={{ fontSize: 12, color: COLORS.text, textAlign: "right" }}>{sel.legalName}</span>
</div>}
            <div style={{ borderBottom: `1px solid ${COLORS.border}`, padding: "9px 0", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, color: COLORS.textSub, flexShrink: 0 }}>Company Type</span>
              {sel.companyType ? <Badge label={getTypeCfg(sel.companyType).label} color={getTypeCfg(sel.companyType).color} /> : <span style={{ fontSize: 12, color: COLORS.textMuted }}>—</span>}
            </div>
            {[
              { label: "Group", value: sel.group },
              { label: "Tax Info", value: sel.taxInfo },
              { label: "Website", value: sel.website },
              { label: "Address", value: sel.address },
              { label: "City", value: sel.city },
              { label: "Country", value: getCountryLabel(sel.country, config.country) },
            ].map(row => (
              <div key={row.label} style={{ borderBottom: `1px solid ${COLORS.border}`, padding: "9px 0", display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontSize: 12, color: COLORS.textSub, flexShrink: 0 }}>{row.label}</span>
                <span style={{ fontSize: 12, color: row.value ? COLORS.text : COLORS.textMuted, textAlign: "right" }}>{row.value || "—"}</span>
              </div>
            ))}
            <div style={{ borderBottom: `1px solid ${COLORS.border}`, padding: "9px 0", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, color: COLORS.textSub, flexShrink: 0 }}>Activity Status</span>
              <ColoredStatusDropdown
                value={sel.status}
                options={config.activityStatus}
                getCfg={getStatusCfg}
                onChange={v => onPatchCompany({ status: v })}
              />
            </div>
            <div style={{ borderBottom: `1px solid ${COLORS.border}`, padding: "9px 0", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, color: COLORS.textSub, flexShrink: 0 }}>Company Size</span>
              {sel.companySize ? <Badge label={sel.companySize} color={{ Big: COLORS.purple, Medium: COLORS.blue, Small: COLORS.green }[sel.companySize] || COLORS.textSub} /> : <span style={{ fontSize: 12, color: COLORS.textMuted }}>—</span>}
            </div>
            <div style={{ borderBottom: `1px solid ${COLORS.border}`, padding: "9px 0", display: "flex", justifyContent: "space-between", gap: 8 }}>
              <span style={{ fontSize: 12, color: COLORS.textSub, flexShrink: 0 }}>Broker</span>
              <span style={{ fontSize: 12, color: sel.broker ? COLORS.text : COLORS.textMuted, textAlign: "right" }}>{sel.broker || "—"}</span>
            </div>
            <div style={{ borderBottom: `1px solid ${COLORS.border}`, padding: "9px 0", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, color: COLORS.textSub, flexShrink: 0 }}>Business Unit</span>
              {(sel.businessUnit && (Array.isArray(sel.businessUnit) ? sel.businessUnit.length > 0 : sel.businessUnit))
                ? <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    {(Array.isArray(sel.businessUnit) ? sel.businessUnit : [sel.businessUnit]).map(v => (
                      <Badge key={v} label={getBUCfg(v).label.toUpperCase()} color={getBUCfg(v).color} />
                    ))}
                  </div>
                : <span style={{ fontSize: 12, color: COLORS.textMuted }}>—</span>}
            </div>
            {/* ── ROLES — dernière position dans INFO ── */}
            <div style={{ borderBottom: `1px solid ${COLORS.border}`, padding: "9px 0", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, color: COLORS.textSub, flexShrink: 0 }}>Roles</span>
              {(sel.roles && sel.roles.length > 0)
                ? <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    {sel.roles.map(r => <Badge key={r} label={getRoleCfg(r).label || r} color={getRoleCfg(r).color} />)}
                  </div>
                : <span style={{ fontSize: 12, color: COLORS.textMuted }}>—</span>}
            </div>
            <div style={{ borderBottom: `1px solid ${COLORS.border}`, padding: "9px 0", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, color: COLORS.textSub, flexShrink: 0 }}>GT Role</span>
              <span style={{ fontSize: 12, color: sel.gtRole ? COLORS.text : COLORS.textMuted, fontWeight: sel.gtRole ? 600 : 400 }}>{sel.gtRole || "—"}</span>
            </div>
            <div style={{ borderBottom: `1px solid ${COLORS.border}`, padding: "9px 0", display: "flex", justifyContent: "space-between", gap: 8 }}>
  <span style={{ fontSize: 12, color: COLORS.textSub, flexShrink: 0 }}>Tags</span>
  {(sel.tags && sel.tags.length > 0)
    ? <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "flex-end" }}>{sel.tags.map(t => <Tag key={t} label={t} />)}</div>
    : <span style={{ fontSize: 12, color: COLORS.textMuted }}>—</span>}
</div>
            <div style={{ marginTop: 14 }}>
  <div style={{ fontSize: 11, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5, marginBottom: 6 }}>
    ADDITIONAL INFOS (COMPLIANCE)
  </div>
  <div style={{ padding: 12, background: COLORS.bg, borderRadius: 8, fontSize: 13, color: COLORS.textSub, lineHeight: 1.6, minHeight: 40 }}>
    {sel.complianceAdditionalInfos || <span style={{ color: COLORS.textMuted }}>—</span>}
  </div>
</div>
            
          </div>
        )}

        {/* ── FINANCE ── */}
        {activeTab === "finance" && (
          <div style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <span style={{ fontSize: 15 }}>💰</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.text, letterSpacing: 0.5 }}>FINANCE</span>
            </div>
            {[
              { label: "Incorporation Date", value: sel.incorporationDate },
              { label: "Equity", value: sel.equity },
              { label: "Turnover", value: sel.turnover },
              { label: "Net Income", value: sel.netIncome },
              { label: "Total Fixed Assets", value: sel.totalFixedAssets },
              { label: "Total Assets", value: sel.totalAssets },
            ].map(row => (
              <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${COLORS.border}`, padding: "10px 0" }}>
                <span style={{ fontSize: 11, color: COLORS.textSub, fontWeight: 600 }}>{row.label.toUpperCase()}</span>
                <span style={{ fontSize: 13, color: row.value ? COLORS.text : COLORS.textMuted }}>{row.value || "—"}</span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${COLORS.border}`, padding: "10px 0" }}>
              <span style={{ fontSize: 11, color: COLORS.textSub, fontWeight: 600 }}>COMPANY SIZE</span>
              {sel.companySize
                ? <Badge label={sel.companySize} color={{ Big: COLORS.purple, Medium: COLORS.blue, Small: COLORS.green }[sel.companySize] || COLORS.textSub} />
                : <span style={{ fontSize: 13, color: COLORS.textMuted }}>—</span>}
            </div>
          </div>
        )}

        {/* ── ACTIVITY ── */}
        {activeTab === "activity" && (
          <div style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <span style={{ fontSize: 15 }}>📊</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.text, letterSpacing: 0.5 }}>ACTIVITY</span>
            </div>
            {/* ── ROLES — première position dans ACTIVITY ── */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${COLORS.border}`, padding: "10px 0" }}>
              <span style={{ fontSize: 11, color: COLORS.textSub, fontWeight: 600 }}>ROLES</span>
              {(sel.roles && sel.roles.length > 0)
                ? <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    {sel.roles.map(r => <Badge key={r} label={getRoleCfg(r).label || r} color={getRoleCfg(r).color} />)}
                  </div>
                : <span style={{ fontSize: 13, color: COLORS.textMuted }}>—</span>}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${COLORS.border}`, padding: "10px 0" }}>
              <span style={{ fontSize: 11, color: COLORS.textSub, fontWeight: 600 }}>GT ROLE</span>
              <span style={{ fontSize: 13, color: sel.gtRole ? COLORS.text : COLORS.textMuted, fontWeight: sel.gtRole ? 600 : 400 }}>{sel.gtRole || "—"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${COLORS.border}`, padding: "10px 0" }}>
              <span style={{ fontSize: 11, color: COLORS.textSub, fontWeight: 600 }}>BROKER</span>
              <span style={{ fontSize: 13, color: sel.broker ? COLORS.text : COLORS.textMuted }}>{sel.broker || "—"}</span>
            </div>
            <div style={{ borderBottom: `1px solid ${COLORS.border}`, padding: "10px 0" }}>
              <div style={{ fontSize: 11, color: COLORS.textSub, fontWeight: 600, marginBottom: 8 }}>CONTRACTS CURRENCY</div>
              {(sel.contractsCurrency || []).length > 0
                ? <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {sel.contractsCurrency.map(c => <Badge key={c} label={c} color={COLORS.accent} />)}
                  </div>
                : <span style={{ fontSize: 13, color: COLORS.textMuted }}>—</span>
              }
            </div>
            {[
              { label: "Number of Contracts", value: sel.numberOfContracts },
              { label: "Food/Feed", value: sel.foodFeed },
            ].map(row => (
              <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${COLORS.border}`, padding: "10px 0" }}>
                <span style={{ fontSize: 11, color: COLORS.textSub, fontWeight: 600 }}>{row.label.toUpperCase()}</span>
                <span style={{ fontSize: 13, color: row.value ? COLORS.text : COLORS.textMuted }}>{row.value || "—"}</span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${COLORS.border}`, padding: "10px 0" }}>
              <span style={{ fontSize: 11, color: COLORS.textSub, fontWeight: 600 }}>BUSINESS UNIT</span>
              {(sel.businessUnit && (Array.isArray(sel.businessUnit) ? sel.businessUnit.length > 0 : sel.businessUnit))
                ? <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    {(Array.isArray(sel.businessUnit) ? sel.businessUnit : [sel.businessUnit]).map(v => (
                      <Badge key={v} label={getBUCfg(v).label.toUpperCase()} color={getBUCfg(v).color} />
                    ))}
                  </div>
                : <span style={{ fontSize: 13, color: COLORS.textMuted }}>—</span>}
            </div>
          </div>
        )}

        {/* ── RISK ── */}
        {activeTab === "risk" && (
          <div style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <span style={{ fontSize: 15 }}>⚠️</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.text, letterSpacing: 0.5 }}>RISK</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${COLORS.border}`, padding: "10px 0" }}>
              <span style={{ fontSize: 11, color: COLORS.textSub, fontWeight: 600 }}>WATCH LIST</span>
              {sel.watchList ? <Badge label="⚠ Yes" color={COLORS.red} /> : <Badge label="No" color={COLORS.textSub} />}
            </div>
          </div>
        )}

        {/* ── COMPLIANCE ── */}
        {activeTab === "compliance" && (
          <div>
            <div style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <span style={{ fontSize: 16 }}>🛡</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.text, letterSpacing: 0.5 }}>COMPLIANCE</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                {[
                  { label: "COMPLIANCE STATUS", field: "complianceStatus", options: config.complianceStatus, getCfg: getComplianceCfg },
                  { label: "FINAL AUTHORIZATION STATUS", field: "finalAuthStatus", options: config.finalAuthStatus, getCfg: getFinalAuthCfg },
                ].map(({ label, field, options, getCfg }) => (
                  <ColoredStatusDropdown
                    key={field}
                    label={label}
                    value={sel[field]}
                    options={options}
                    getCfg={getCfg}
                    onChange={v => onPatchCompany({ [field]: v })}
                  />
                ))}
              </div>
              {[
                { label: "Legal Name", value: sel.legalName },
{ label: "Creation Date", value: formatComplianceDate(sel.complianceCreationDate, config.companyTimezone || 'Europe/Paris') },
                { label: "Last Update Date", value: formatComplianceDate(sel.complianceLastUpdateDate, config.companyTimezone || 'Europe/Paris') },
                { label: "Request Date", value: formatComplianceDate(sel.complianceRequestDate, config.companyTimezone || 'Europe/Paris') },
                { label: "Last Reception Date", value: formatComplianceDate(sel.complianceLastReceptionDate, config.companyTimezone || 'Europe/Paris') },
                { label: "Final Confirmation Date", value: formatComplianceDate(sel.complianceFinalConfirmationDate, config.companyTimezone || 'Europe/Paris') },
              ].map(row => (
                <div key={row.label} style={{ display: "flex", justifyContent: "space-between", borderBottom: `1px solid ${COLORS.border}`, paddingBottom: 7, paddingTop: 7 }}>
                  <span style={{ fontSize: 11, color: COLORS.textSub }}>{row.label}</span>
                  <span style={{ fontSize: 11, color: row.value ? COLORS.text : COLORS.textMuted, fontFamily: "'DM Mono', monospace" }}>{row.value || "—"}</span>
                </div>
              ))}
              <div style={{ marginTop: 14 }}>
  <div style={{ fontSize: 10, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5, marginBottom: 6 }}>
    ADDITIONAL INFOS (COMPLIANCE)
  </div>
  <div style={{ padding: 10, background: COLORS.bg, borderRadius: 8, fontSize: 12, color: COLORS.textSub, lineHeight: 1.6, minHeight: 40 }}>
    {sel.complianceAdditionalInfos || <span style={{ color: COLORS.textMuted }}>—</span>}
  </div>
</div>
            </div>

            <div style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <span style={{ fontSize: 15 }}>👤</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.text, letterSpacing: 0.5 }}>KEY PEOPLE</span>
              </div>
              {[
                { label: "UBO", ids: sel.ubo || [] },
                { label: "Shareholders", ids: sel.shareholders || [] },
                { label: "President", ids: sel.president ? [sel.president] : [] },
                { label: "CEO", ids: sel.ceo ? [sel.ceo] : [] },
                { label: "CFO", ids: sel.cfo ? [sel.cfo] : [] },
              ].map(row => {
                const people = row.ids.map(id => selContacts.find(c => c.id === id || c.id === Number(id))).filter(Boolean);
                return (
                  <div key={row.label} style={{ borderBottom: `1px solid ${COLORS.border}`, padding: "10px 0" }}>
                    <div style={{ fontSize: 10, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5, marginBottom: people.length > 0 ? 8 : 0 }}>{row.label.toUpperCase()}</div>
                    {people.length > 0
                      ? <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                          {people.map(p => (
                            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "6px 10px" }}>
                              <Avatar initials={p.avatar || p.name?.slice(0,2).toUpperCase()} size={26} color={COLORS.blue} />
                              <div>
                                <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.text }}>{p.name}</div>
                                {p.role && <div style={{ fontSize: 10, color: COLORS.textSub }}>{p.role}</div>}
                              </div>
                            </div>
                          ))}
                        </div>
                      : <span style={{ fontSize: 12, color: COLORS.textMuted }}>—</span>
                    }
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── DOCUMENTS ── */}
        {activeTab === "documents" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 200, gap: 12 }}>
            <div style={{ fontSize: 40 }}>📄</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.text }}>Bloc DOCUMENTS</div>
            <div style={{ fontSize: 13, color: COLORS.textMuted, textAlign: "center", lineHeight: 1.6 }}>Les documents liés à cette société<br />seront disponibles prochainement.</div>
          </div>
        )}

        {/* ── CONTACTS ── */}
        {activeTab === "contacts" && (
          <div>
            <div style={{ fontSize: 11, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5, marginBottom: 14 }}>
              {selContacts.length} CONTACT{selContacts.length > 1 ? "S" : ""} LIÉ{selContacts.length > 1 ? "S" : ""}
            </div>
            {selContacts.length === 0 && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "20px 0", color: COLORS.textMuted, fontSize: 13 }}>
                <span style={{ fontSize: 32 }}>◉</span>
                Aucun contact associé à cette société
              </div>
            )}
            {selContacts.map(c => (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: `1px solid ${COLORS.border}` }}>
                <Avatar initials={c.avatar} size={34} color={getStatusCfg(c.status).color} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: COLORS.text, fontWeight: 600 }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: COLORS.textSub }}>{c.role || "—"}</div>
                </div>
                <Badge label={getStatusCfg(c.status).label} color={getStatusCfg(c.status).color} />
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
};

// ─── COMPANIES ────────────────────────────────────────────────
// ─── AUTO LOGOUT ──────────────────────────────────────────────
const INACTIVITY_MS  = 2 * 60 * 60 * 1000; // 2 heures
const WARNING_MS     = 1 * 60 * 1000;       // avertissement 1 min avant

const useAutoLogout = (currentUser, onLogout) => {
  const [showWarning, setShowWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(60);
  const timerRef    = useRef(null);
  const warningRef  = useRef(null);
  const countRef    = useRef(null);

  const clearAll = () => {
    clearTimeout(timerRef.current);
    clearTimeout(warningRef.current);
    clearInterval(countRef.current);
  };

  const logout = useCallback(() => {
    clearAll();
    setShowWarning(false);
    onLogout();
  }, [onLogout]);

  const resetTimer = useCallback(() => {
    if (!currentUser) return;
    clearAll();
    setShowWarning(false);
    setSecondsLeft(60);

    // Show warning 1 min before logout
    warningRef.current = setTimeout(() => {
      setShowWarning(true);
      setSecondsLeft(60);
      countRef.current = setInterval(() => {
        setSecondsLeft(s => {
          if (s <= 1) { clearInterval(countRef.current); return 0; }
          return s - 1;
        });
      }, 1000);
    }, INACTIVITY_MS - WARNING_MS);

    // Actual logout
    timerRef.current = setTimeout(logout, INACTIVITY_MS);
  }, [currentUser, logout]);

  useEffect(() => {
    if (!currentUser) { clearAll(); setShowWarning(false); return; }
    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"];
    const handler = () => resetTimer();
    events.forEach(e => window.addEventListener(e, handler, { passive: true }));
    resetTimer();
    return () => {
      events.forEach(e => window.removeEventListener(e, handler));
      clearAll();
    };
  }, [currentUser, resetTimer]);

  return { showWarning, secondsLeft, resetTimer };
};

const AutoLogoutWarning = ({ secondsLeft, onStay, onLogout }) => (
  <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center" }}>
    <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: "32px 40px", maxWidth: 420, width: "90%", textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,0.6)" }}>
      <div style={{ fontSize: 40, marginBottom: 16 }}>⏱</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.text, marginBottom: 10 }}>Session inactive</div>
      <div style={{ fontSize: 14, color: COLORS.textSub, marginBottom: 24, lineHeight: 1.6 }}>
        Vous allez être déconnecté automatiquement dans
        <div style={{ fontSize: 40, fontWeight: 800, color: COLORS.accent, fontFamily: "'DM Mono', monospace", margin: "12px 0" }}>
          {String(secondsLeft).padStart(2, "0")}s
        </div>
        en raison d'inactivité.
      </div>
      <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
        <button onClick={onLogout} style={{ background: `${COLORS.red}15`, color: COLORS.red, border: `1px solid ${COLORS.red}40`, borderRadius: 8, padding: "10px 20px", cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "inherit" }}>
          Se déconnecter
        </button>
        <button onClick={onStay} style={{ background: COLORS.accent, color: COLORS.textOnAccent, border: "none", borderRadius: 8, padding: "10px 24px", cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "inherit" }}>
          Rester connecté
        </button>
      </div>
    </div>
  </div>
);

const LoginPage = ({ onLogin }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async () => {
    const { data, error } = await supabase.from('employees').select('data');
    
    const employees = data ? data.map(r => r.data) : [];
    
    const emp = employees.find(e => e.email === email && e.password === password && e.status === "active");
    
    if (emp) {
      // Always use the freshest data from Supabase so role changes take effect immediately
      onLogin(emp);
    }
    else { setError("Email ou mot de passe incorrect."); }
  };

  return (
    <div style={{ minHeight: "100vh", width: "100vw", display: "flex", alignItems: "center", justifyContent: "center", background: COLORS.bg, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, backgroundImage: "url('./login-bg.png')", backgroundSize: "75%", backgroundPosition: "center top", filter: "brightness(0.35)", zIndex: 0 }} />
      <div style={{ position: "absolute", bottom: 40, right: 40, zIndex: 1, background: COLORS.card, border: `1px solid ${COLORS.accent}40`, borderRadius: 18, padding: "36px 32px", width: "100%", maxWidth: 360, boxShadow: `0 0 40px ${COLORS.accent}15` }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 8 }}>
            <img src="/xagrilogo.png" style={{ width: 44, height: 44, objectFit: "contain" }} />
            <span style={{ fontSize: 26, fontWeight: 800, color: COLORS.accent, fontFamily: "'Inter', sans-serif" }}>X-AGRI</span>
          </div>
          <div style={{ fontSize: 13, color: COLORS.textMuted, letterSpacing: 0.5 }}>Connectez-vous pour continuer</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 11, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5 }}>EMAIL</label>
            <input value={email} onChange={e => setEmail(e.target.value)} placeholder="john.doe@example.com"
              style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "10px 14px", color: COLORS.text, fontSize: 14, outline: "none", fontFamily: "inherit" }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 11, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5 }}>MOT DE PASSE</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••"
              style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "10px 14px", color: COLORS.text, fontSize: 14, outline: "none", fontFamily: "inherit" }}
              onKeyDown={e => e.key === "Enter" && handleLogin()} />
          </div>
          {error && <div style={{ fontSize: 12, color: COLORS.red, textAlign: "center" }}>{error}</div>}
          <Btn onClick={handleLogin} style={{ width: "100%", justifyContent: "center", marginTop: 8 }}>Se connecter</Btn>
        </div>
      </div>
    </div>
  );
};

const VirtualList = ({ items, itemHeight, containerHeight, renderItem, emptyMessage }) => {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef(null);
  const gap = 6;
  const rowHeight = itemHeight + gap;
  const totalHeight = items.length * rowHeight;
  const visibleCount = Math.ceil(containerHeight / rowHeight) + 4;
  const startIdx = Math.max(0, Math.floor(scrollTop / rowHeight) - 2);
  const endIdx = Math.min(items.length, startIdx + visibleCount);
  const visibleItems = items.slice(startIdx, endIdx);
  const offsetY = startIdx * rowHeight;

  return (
    <div ref={containerRef} onScroll={e => setScrollTop(e.currentTarget.scrollTop)}
      style={{ overflowY: "auto", flex: 1, position: "relative" }}>
      {items.length === 0
        ? <div style={{ textAlign: "center", color: COLORS.textMuted, padding: 48 }}>{emptyMessage}</div>
        : <div style={{ height: totalHeight, position: "relative" }}>
            <div style={{ position: "absolute", top: offsetY, left: 0, right: 0, display: "flex", flexDirection: "column", gap }}>
              {visibleItems.map(item => renderItem(item))}
            </div>
          </div>
      }
    </div>
  );
};

const CompanyRow = ({ c, isSelected, onSelect, getComplianceCfg, getFinalAuthCfg, getRoleCfg, getBUCfg, config }) => (
  <div onClick={onSelect} style={{
    background: isSelected ? `${COLORS.purple}12` : COLORS.card,
    border: `1px solid ${isSelected ? COLORS.purple : COLORS.border}`,
    borderRadius: 12, padding: "12px 18px", cursor: "pointer",
    display: "grid", gridTemplateColumns: "2fr 1.2fr 1.2fr 1.5fr 1.5fr 1.2fr 1fr", gap: 10, alignItems: "center", transition: "all 0.15s",
  }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, overflow: "hidden" }}>
      <CountryFlag country={c.country} size={36} />
      <div style={{ minWidth: 0, flex: 1, overflow: "hidden" }}>
        <div style={{ fontWeight: 700, color: COLORS.text, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</div>
        <div style={{ color: COLORS.textSub, fontSize: 11, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {[c.city, c.country ? getCountryLabel(c.country, config.country).toUpperCase() : null].filter(Boolean).join(", ") || "—"}
        </div>
        {c.ref && <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: COLORS.textMuted, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.ref}</div>}
      </div>
    </div>
    <div style={{ fontSize: 12, color: c.broker ? COLORS.text : COLORS.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.broker || "—"}</div>
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
      {(c.roles || []).slice(0, 2).map(r => <Badge key={r} label={getRoleCfg(r).label || r} color={getRoleCfg(r).color} />)}
      {(c.roles || []).length > 2 && <span style={{ fontSize: 11, color: COLORS.textMuted }}>+{c.roles.length - 2}</span>}
      {(c.roles || []).length === 0 && <span style={{ fontSize: 12, color: COLORS.textMuted }}>—</span>}
    </div>
    <div>
      {c.complianceStatus ? (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 5 }}>
          <span style={{ fontSize: 11, fontWeight: 600, lineHeight: 1.3 }}>
            {(getComplianceCfg(c.complianceStatus).displayLabel
              ? getComplianceCfg(c.complianceStatus).displayLabel.replace(/\\n/g, "\n").split("\n")
              : getComplianceCfg(c.complianceStatus).label.split(/\s*[–-]\s*/)
            ).map((part, i) => <span key={i} style={{ display: "block", color: getComplianceCfg(c.complianceStatus).color }}>{part.trim()}</span>)}
          </span>
        </div>
      ) : <span style={{ fontSize: 12, color: COLORS.textMuted }}>—</span>}
    </div>
    <div>
      {c.finalAuthStatus ? (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 5 }}>
          <span style={{ fontSize: 11, fontWeight: 600, lineHeight: 1.3 }}>
            {(getFinalAuthCfg(c.finalAuthStatus).displayLabel
              ? getFinalAuthCfg(c.finalAuthStatus).displayLabel.replace(/\\n/g, "\n").split("\n")
              : getFinalAuthCfg(c.finalAuthStatus).label.split(/\s*[–-]\s*/)
            ).map((part, i) => <span key={i} style={{ display: "block", color: getFinalAuthCfg(c.finalAuthStatus).color }}>{part.trim()}</span>)}
          </span>
        </div>
      ) : <span style={{ fontSize: 12, color: COLORS.textMuted }}>—</span>}
    </div>
    <div style={{ fontSize: 12, color: COLORS.blue, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.website || "—"}</div>
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
      {(Array.isArray(c.businessUnit) ? c.businessUnit : (c.businessUnit ? [c.businessUnit] : [])).length > 0
        ? (Array.isArray(c.businessUnit) ? c.businessUnit : [c.businessUnit]).map(v => <Badge key={v} label={getBUCfg(v).label.toUpperCase()} color={getBUCfg(v).color} />)
        : <span style={{ fontSize: 12, color: COLORS.textMuted }}>—</span>}
    </div>
  </div>
);

// ─── COMPANY EXPORT MODAL ────────────────────────────────────
const COMPANY_EXPORT_HEADERS = [
  "ref", "name", "legalName", "companyType", "group", "taxInfo",
  "website", "phone", "address", "city", "country", "status", "companySize",
  "broker", "roles", "gtRole", "businessUnit",
  "complianceStatus", "finalAuthStatus",
  "complianceCreationDate", "complianceLastUpdateDate",
  "complianceRequestDate", "complianceLastReceptionDate", "complianceFinalConfirmationDate",
  "complianceAdditionalInfos",
  "incorporationDate", "equity", "turnover", "netIncome", "totalFixedAssets", "totalAssets",
  "contractsCurrency", "numberOfContracts", "foodFeed", "tags", "watchList",
];

const CompanyExportModal = ({ all, filtered, onClose }) => {
  const [scope, setScope] = useState("filtered");
  const [exporting, setExporting] = useState(false);

  const doExport = async () => {
    setExporting(true);
    try {
      const XLSX = await import("xlsx");
      const data = scope === "all" ? all : filtered;
      const rows = data.map(c => COMPANY_EXPORT_HEADERS.map(h => {
        const v = c[h];
        if (Array.isArray(v)) return v.join(", ");
        if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
        return v ?? "";
      }));
      const ws = XLSX.utils.aoa_to_sheet([COMPANY_EXPORT_HEADERS, ...rows]);
      ws["!cols"] = COMPANY_EXPORT_HEADERS.map(h => ({ wch: Math.max(h.length + 2, 14) }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Companies");
      XLSX.writeFile(wb, `companies_export_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (e) { console.error("[export] error:", e); }
    setExporting(false);
    onClose();
  };

  return (
    <Modal title="Exporter les sociétés" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ fontSize: 13, color: COLORS.textSub }}>Choisissez les sociétés à exporter :</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            { value: "filtered", label: "Sociétés filtrées", sub: `${filtered.length} société${filtered.length !== 1 ? "s" : ""} visibles à l'écran` },
            { value: "all",      label: "Toutes les sociétés", sub: `${all.length} société${all.length !== 1 ? "s" : ""} au total` },
          ].map(opt => (
            <div key={opt.value} onClick={() => setScope(opt.value)}
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 10, border: `1px solid ${scope === opt.value ? COLORS.accent : COLORS.border}`, background: scope === opt.value ? `${COLORS.accent}10` : COLORS.card, cursor: "pointer", transition: "all 0.15s" }}>
              <div style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${scope === opt.value ? COLORS.accent : COLORS.border}`, background: scope === opt.value ? COLORS.accent : "transparent", flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>{opt.label}</div>
                <div style={{ fontSize: 11, color: COLORS.textMuted }}>{opt.sub}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11, color: COLORS.textMuted, background: COLORS.card, borderRadius: 8, padding: "10px 14px", border: `1px solid ${COLORS.border}` }}>
          📋 {COMPANY_EXPORT_HEADERS.length} colonnes : {COMPANY_EXPORT_HEADERS.join(", ")}
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
          <Btn variant="secondary" onClick={onClose}>Annuler</Btn>
          <Btn onClick={doExport} disabled={exporting}>{exporting ? "Export en cours…" : "⬇ Exporter Excel"}</Btn>
        </div>
      </div>
    </Modal>
  );
};

const Companies = ({ companies, setCompanies, contacts }) => {
  const { config, updateField } = useConfig();
  const [search, setSearch] = useState("");
  const [activeViewId, setActiveViewId] = useState(null);
  const [showExport, setShowExport] = useState(false);
const [showFilters, setShowFilters] = useState(false);
const [filterMode, setFilterMode] = useState("AND");
const [activeFilters, setActiveFilters] = useState({
  city:[],companyType: [], status: [], country: [], businessUnit: [], roles: [],
  foodFeed: [], companySize: [], complianceStatus: [], finalAuthStatus: [], contractsCurrency: [], watchList: []
});

const [excludeFilters, setExcludeFilters] = useState({
  city:[], companyType: [], status: [], country: [], businessUnit: [], roles: [],
  foodFeed: [], companySize: [], complianceStatus: [], finalAuthStatus: [], contractsCurrency: [], watchList: []
});
const [onlyFilters, setOnlyFilters] = useState({
  city:[], companyType: [], status: [], country: [], businessUnit: [], roles: [],
  foodFeed: [], companySize: [], complianceStatus: [], finalAuthStatus: [], contractsCurrency: [], watchList: []
});
const [customFilters, setCustomFilters] = useState([]);
const [filterSearch, setFilterSearch] = useState("");
const [filterSuggestions, setFilterSuggestions] = useState([]);

const CUSTOM_FILTER_FIELDS = [
  { key: "name", label: "Company Name", type: "text" },
  { key: "legalName", label: "Legal Name", type: "text" },
  { key: "broker", label: "Broker", type: "text" },
  { key: "group", label: "Group", type: "text" },
  { key: "taxInfo", label: "Tax Info", type: "text" },
  { key: "address", label: "Address", type: "text" },
  { key: "website", label: "Website", type: "text" },
  { key: "equity", label: "Equity", type: "number" },
  { key: "turnover", label: "Turnover", type: "number" },
  { key: "netIncome", label: "Net Income", type: "number" },
  { key: "totalFixedAssets", label: "Total Fixed Assets", type: "number" },
  { key: "totalAssets", label: "Total Assets", type: "number" },
  { key: "numberOfContracts", label: "Number of Contracts", type: "number" },
  { key: "complianceCreationDate", label: "Creation Date", type: "date" },
  { key: "complianceLastUpdateDate", label: "Last Update Date", type: "date" },
  { key: "complianceRequestDate", label: "Request Date", type: "date" },
  { key: "complianceLastReceptionDate", label: "Last Reception Date", type: "date" },
  { key: "complianceFinalConfirmationDate", label: "Final Confirmation Date", type: "date" },
  { key: "incorporationDate", label: "Incorporation Date", type: "date" },
  { key: "president", label: "President", type: "contact" },
  { key: "ceo", label: "CEO", type: "contact" },
  { key: "cfo", label: "CFO", type: "contact" },
  { key: "ubo", label: "UBO", type: "contact" },
  { key: "shareholders", label: "Shareholders", type: "contact" },
];
useEffect(() => { setSelected(null); }, [activeFilters, excludeFilters, search]);
useEffect(() => {
  const handleEsc = (e) => { if (e.key === "Escape") setShowFilters(false); };
  document.addEventListener("keydown", handleEsc);
  return () => document.removeEventListener("keydown", handleEsc);
}, []);

  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editCompany, setEditCompany] = useState(null);
  const [isReloading, setIsReloading] = useState(false);

  const reloadCompanies = async () => {
    setIsReloading(true);
    const PAGE = 1000;
    let all = [];
    let from = 0;
    while (true) {
      const { data, error } = await supabase.from('companies').select('data').order('id', { ascending: true }).range(from, from + PAGE - 1);
      if (error || !data || data.length === 0) break;
      all = [...all, ...data.map(r => r.data ?? r)];
      if (data.length < PAGE) break;
      from += PAGE;
    }
    if (all.length) setCompanies(all);
    setIsReloading(false);
  };

  useEffect(() => {
    const handleKey = (e) => { if (e.key === "Escape" && selected && !showForm && !showImport) setSelected(null); };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [selected, showForm, showImport]);

  const makeEmptyForm = () => ({
    name: "", size: "11-50", status: config.activityStatus[0]?.value || "",
    website: "", phone: "", address: "", country: "", city: "", revenue: 0,
    tags: "", group: "",
    companyType: config.companyType[0]?.value || "",
    roles: [],
    complianceStatus: config.complianceStatus[0]?.value || "",
    finalAuthStatus: config.finalAuthStatus[0]?.value || "",
    businessUnit: [], broker: "",
    taxInfo: "", legalName: "",  complianceAdditionalInfos: "",
    complianceRequestDate: "", complianceLastReceptionDate: "", complianceFinalConfirmationDate: "",
    complianceCreationDate: "", complianceLastUpdateDate: "",
    shareholders: [], ubo: [], president: "", ceo: "", cfo: "",
    companySize: "", watchList: false,
    incorporationDate: "", equity: "", turnover: "", netIncome: "", totalFixedAssets: "", totalAssets: "",
    contractsCurrency: [], numberOfContracts: "", foodFeed: "",
    gtRole: "",
  });
  const [form, setForm] = useState(makeEmptyForm());

  const filtered = useMemo(() => companies.filter(c => {
    const ms = c.name?.toLowerCase().includes(search.toLowerCase()) || c.website?.toLowerCase().includes(search.toLowerCase());
const filterKeys = activeFilters ? Object.keys(activeFilters) : [];
const passFilters = filterMode === "AND"
  ? filterKeys.every(key => {
      const val = c[key];
      const valArr = Array.isArray(val) ? val : (val !== undefined && val !== null && val !== "" ? [val] : []);
      if (activeFilters[key].length > 0) {
        // Always OR within the same filter key
        const inc = activeFilters[key].some(f => valArr.includes(f));
        if (!inc) return false;
        const onlyVals = (onlyFilters[key] || []).filter(v => activeFilters[key].includes(v));
        if (onlyVals.length > 0) {
          const exactMatch = onlyVals.some(v => valArr.length === 1 && valArr[0] === v);
          if (!exactMatch) return false;
        }
      }
      if (excludeFilters[key]?.length > 0) {
        const exc = excludeFilters[key].some(f => valArr.includes(f));
        if (exc) return false;
      }
      return true;
    })
  : filterKeys.some(key => {
      const val = c[key];
      const valArr = Array.isArray(val) ? val : (val !== undefined && val !== null && val !== "" ? [val] : []);
      if (activeFilters[key].length > 0) {
        const inc = activeFilters[key].some(f => valArr.includes(f));
        if (inc) return true;
      }
      return false;
    }) || filterKeys.length === 0;
 const passCustom = customFilters.every(cf => {
  const val = c[cf.key];
  const isEmpty = val === null || val === undefined || val === "" || (Array.isArray(val) && val.length === 0);
  if (cf.op === "empty") return isEmpty;
  if (cf.op === "notempty") return !isEmpty;
  if (!cf.value) return true;
  if (cf.type === "contact") {
    const ids = Array.isArray(val) ? val : (val ? [val] : []);
    return ids.some(id => {
      const contact = contacts.find(ct => ct.id === id);
      return contact?.name?.toLowerCase().includes(cf.value.toLowerCase());
    });
  }
  if (cf.type === "text" && cf.op === "contains") return (val || "").toLowerCase().includes(cf.value.toLowerCase());
  if (cf.type === "text") return (val || "").toLowerCase() === cf.value.toLowerCase();
  if (cf.type === "number") {
    const num = Number(val); const fnum = Number(cf.value);
    if (cf.op === "eq") return num === fnum;
    if (cf.op === "gt") return num > fnum;
    if (cf.op === "lt") return num < fnum;
  }
  if (cf.type === "date") {
    // normalize val to ISO date prefix for comparison
    const normDate = (v) => {
      if (!v) return "";
      const s = v.toString().trim();
      if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
      const m = s.match(/^(\d{1,2})[\/\.](\d{1,2})[\/\.](\d{4})/);
      if (m) return m[3] + "-" + m[2].padStart(2,"0") + "-" + m[1].padStart(2,"0");
      const n = parseFloat(s);
      if (!isNaN(n) && n > 40000 && n < 60000) {
        const d = new Date(Math.round((n - 25569) * 86400 * 1000));
        return d.toISOString().slice(0, 10);
      }
      return s.slice(0, 10);
    };
    const nVal = normDate(val);
    if (cf.op === "eq") return nVal === cf.value;
    if (cf.op === "gt") return nVal > cf.value;
    if (cf.op === "lt") return nVal < cf.value;
    if (cf.op === "between") {
      const from = cf.value || "";
      const to = cf.value2 || "";
      if (!from && !to) return true;
      if (from && !to) return nVal >= from;
      if (!from && to) return nVal <= to;
      return nVal >= from && nVal <= to;
    }
  }
  return true;
  });
  return ms && passFilters && passCustom;
}).sort((a, b) => {
  const toNum = v => { if (!v) return 0; const n = parseFloat(v.toString()); return isNaN(n) ? 0 : n; };
  return toNum(b.complianceCreationDate) - toNum(a.complianceCreationDate);
}), [companies, search, activeFilters, excludeFilters, onlyFilters, customFilters, filterMode]);

const sel = useMemo(() => selected ? filtered.find(c => c.id === selected) : null, [selected, filtered]);
  const normDateTimeLocal = (val) => {
    if (!val) return "";
    const s = val.toString().trim();
    // Excel serial number (with or without decimal for time)
    if (/^\d{4,5}(\.\d+)?$/.test(s)) {
      const n = parseFloat(s);
      if (n > 40000 && n < 60000) {
        const d = new Date(Math.round((n - 25569) * 86400 * 1000));
        const pad = x => String(x).padStart(2, '0');
        return `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
      }
    }
    // Already datetime-local "yyyy-MM-ddTHH:mm..."
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) return s.slice(0, 16);
    // ISO date only "yyyy-MM-dd"
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s + "T00:00";
    // "dd/mm/yyyy HH:mm" or "dd.mm.yyyy HH:mm"
    const mDT = s.match(/^(\d{1,2})[\/\.](\d{1,2})[\/\.](\d{4})[\s,]+(\d{2}):(\d{2})/);
    if (mDT) return `${mDT[3]}-${mDT[2].padStart(2,'0')}-${mDT[1].padStart(2,'0')}T${mDT[4]}:${mDT[5]}`;
    // "dd/mm/yyyy" or "dd.mm.yyyy"
    const mD = s.match(/^(\d{1,2})[\/\.](\d{1,2})[\/\.](\d{4})$/);
    if (mD) return `${mD[3]}-${mD[2].padStart(2,'0')}-${mD[1].padStart(2,'0')}T00:00`;
    // Fallback: try native Date parse
    try {
      const d = new Date(s);
      if (!isNaN(d.getTime())) {
        const pad = n => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      }
    } catch {}
    return "";
  };
  const openEdit = (c) => {
    setForm({
      ...c,
      tags: (c.tags || []).join(", "),
      roles: c.roles || [],
      complianceCreationDate: normDateTimeLocal(c.complianceCreationDate),
      complianceLastUpdateDate: normDateTimeLocal(c.complianceLastUpdateDate),
      complianceRequestDate: normDateTimeLocal(c.complianceRequestDate),
      complianceLastReceptionDate: normDateTimeLocal(c.complianceLastReceptionDate),
      complianceFinalConfirmationDate: normDateTimeLocal(c.complianceFinalConfirmationDate),
    });
    setEditCompany(c);
    setShowForm(true);
  };
  const openNew = () => { setForm(makeEmptyForm()); setEditCompany(null); setShowForm(true); };
  const toggleRole = (role) => { const cur = form.roles || []; setForm({ ...form, roles: cur.includes(role) ? cur.filter(r => r !== role) : [...cur, role] }); };

  const generateCompanyRef = () => {
    const existing = companies.map(c => c.ref).filter(Boolean);
    let num = companies.length + 1;
    let ref;
    do { ref = "ORB-" + String(num).padStart(6, "0"); num++; } while (existing.includes(ref));
    return ref;
  };

  const save = () => {
    const tz = config.companyTimezone || 'Europe/Paris';
    const now = nowInTz(tz); // "yyyy-MM-ddTHH:mm" in company timezone
    const isNew = !editCompany;
    const data = {
      ...form,
      tags: form.tags.split(",").map(t => t.trim()).filter(Boolean),
      avatar: form.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase(),
      revenue: Number(form.revenue) || 0,
      roles: form.roles || [],
      // Auto-stamp: creation date only for new companies, last update always
      complianceCreationDate: isNew ? now : (form.complianceCreationDate || now),
      complianceLastUpdateDate: now,
    };
    const updated = isNew ? [...companies, { ...data, id: Date.now(), ref: generateCompanyRef() }] : companies.map(c => c.id === editCompany.id ? { ...c, ...data } : c);
    setCompanies(updated);
    saveLargeTable('companies', updated);
    setShowForm(false); setSelected(null);
  };

  const del = (id) => {
    const updated = companies.filter(c => c.id !== id);
    setCompanies(updated);
    saveLargeTable('companies', updated);
    setSelected(null);
  };

  const selContacts = sel ? contacts.filter(c => c.companyId === sel.id) : [];

  const getStatusCfg = (v) => config.activityStatus.find(s => s.value === v) || { label: v || "—", color: COLORS.textSub };
  const COMPLIANCE_LEGACY_MAP = {
    "not_authorised_-_requested": "not_auth_requested",
    "not_authorised_-_inactive": "not_auth_awaiting",
    "not_authorised_-_under_review": "not_auth_awaiting",
    "not_authorised": "not_auth_awaiting",
    "not_authorized_-_requested": "not_auth_requested",
    "not_authorized_-_inactive": "not_auth_awaiting",
    "not_authorized_-_under_review": "not_auth_awaiting",
    "not_authorized": "not_auth_awaiting",
    "authorised": "authorized",
    "authorised_upon_request": "authorized_upon_request",
    "authorized_upon_request": "authorized_upon_request",
    "blacklisted": "blacklisted",
  };
  const getComplianceCfg = (v) => {
    if (!v) return { label: "—", color: COLORS.textSub };
    const norm = s => s?.toLowerCase().replace(/[\s_\-]+/g, "");
    const mapped = COMPLIANCE_LEGACY_MAP[v] || COMPLIANCE_LEGACY_MAP[v?.toLowerCase()];
    return config.complianceStatus.find(s => s.value === v)
      || config.complianceStatus.find(s => norm(s.value) === norm(v))
      || config.complianceStatus.find(s => norm(s.label) === norm(v))
      || (mapped && config.complianceStatus.find(s => s.value === mapped))
      || { label: v, color: COLORS.textSub };
  };
  const getFinalAuthCfg = (v) => {
    if (!v) return { label: "—", color: COLORS.textSub };
    const norm = s => s?.toLowerCase().replace(/[\s_\-]+/g, "");
    const mapped = COMPLIANCE_LEGACY_MAP[v] || COMPLIANCE_LEGACY_MAP[v?.toLowerCase()];
    return config.finalAuthStatus.find(s => s.value === v)
      || config.finalAuthStatus.find(s => norm(s.value) === norm(v))
      || config.finalAuthStatus.find(s => norm(s.label) === norm(v))
      || (mapped && config.finalAuthStatus.find(s => s.value === mapped))
      || { label: v, color: COLORS.textSub };
  };
  const getBUCfg = (v) => config.businessUnit.find(s => s.value === v) || { label: v || "—", color: COLORS.accent };
  const getRoleCfg = (v) => config.roles.find(r => r.value === v) || { color: COLORS.accent };
  const getTypeCfg = (v) => config.companyType.find(s => s.value === v) || { label: v || "—", color: COLORS.blue };

  return (
<div style={{ display: "flex", gap: 0, height: "calc(100vh - 60px)", overflow: "hidden" }}>
<div style={{ flex: sel ? 1 : "1 1 100%", display: "flex", flexDirection: "column", minWidth: 0 }}>

        <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
          <input placeholder="Search a company..." value={search} onChange={e => setSearch(e.target.value)}
            style={{ flex: 1, minWidth: 160, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "10px 16px", color: COLORS.text, fontSize: 14, outline: "none", fontFamily: "inherit" }} />
          
          <div style={{ position: "relative" }}>
            <Btn variant="secondary" onClick={() => setShowFilters(v => !v)}>
              ▼ FILTER {(Object.values(activeFilters).flat().length + customFilters.filter(cf => cf.value || cf.value2 || cf.op === "empty" || cf.op === "notempty").length) > 0 && <span style={{ background: COLORS.accent, color: "#fff", borderRadius: 10, fontSize: 11, padding: "1px 7px", marginLeft: 6 }}>{Object.values(activeFilters).flat().length + customFilters.filter(cf => cf.value || cf.value2 || cf.op === "empty" || cf.op === "notempty").length}</span>}
            </Btn>
            {showFilters && (
              <div style={{ position: "absolute", top: "110%", left: 0, zIndex: 100, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 16, minWidth: 320, maxWidth: 400, boxShadow: "0 8px 32px #0006", maxHeight: "70vh", overflowY: "auto" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.text }}>Filtres</span>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <span style={{ fontSize: 11, color: COLORS.textSub }}>Mode :</span>
                    {["AND", "OR"].map(m => (
                      <span key={m} onClick={() => setFilterMode(m)} style={{ cursor: "pointer", fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 8, background: filterMode === m ? COLORS.accent : COLORS.bg, color: filterMode === m ? "#fff" : COLORS.textSub, border: `1px solid ${filterMode === m ? COLORS.accent : COLORS.border}` }}>{m}</span>
                    ))}
<span onClick={() => { setActiveFilters({ companyType: [], status: [], city: [], country: [], businessUnit: [], roles: [], foodFeed: [], companySize: [], complianceStatus: [], finalAuthStatus: [], contractsCurrency: [], watchList: [] }); setExcludeFilters({ companyType: [], status: [], city: [], country: [], businessUnit: [], roles: [], foodFeed: [], companySize: [], complianceStatus: [], finalAuthStatus: [], contractsCurrency: [], watchList: [] }); setOnlyFilters({ companyType: [], status: [], city: [], country: [], businessUnit: [], roles: [], foodFeed: [], companySize: [], complianceStatus: [], finalAuthStatus: [], contractsCurrency: [], watchList: [] }); setExcludeFilters({ companyType: [], status: [], country: [], businessUnit: [], roles: [], foodFeed: [], companySize: [], complianceStatus: [], finalAuthStatus: [], contractsCurrency: [] }); }} style={{ cursor: "pointer", fontSize: 11, color: COLORS.textMuted, marginLeft: 6 }}>
✕ Reset</span>
                  </div>
                </div>
                {[
{ key: "status", label: "Activity Status", cfg: config.activityStatus },
{ key: "city", label: "City", cfg: config.city },
{ key: "companyType", label: "Company Type", cfg: config.companyType },
                  { key: "country", label: "Country", cfg: config.country },
                  { key: "businessUnit", label: "Business Unit", cfg: config.businessUnit },
                  { key: "roles", label: "Roles", cfg: config.roles },
                  { key: "foodFeed", label: "Food / Feed", cfg: config.foodFeed },
                  { key: "companySize", label: "Company Size", cfg: config.companySize },
                  { key: "complianceStatus", label: "Compliance Status", cfg: config.complianceStatus },
                  { key: "finalAuthStatus", label: "Final Auth Status", cfg: config.finalAuthStatus },
                  { key: "contractsCurrency", label: "Contracts Currency", cfg: config.contractsCurrency },
                { key: "watchList", label: "Watch List", cfg: [{ value: true, label: "⚠️ Watch List", color: COLORS.red }] },
                ].map(({ key, label, cfg }) => (
                  <div key={key} style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.textSub, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {(cfg || []).map(item => {
                        const selected = activeFilters[key].includes(item.value);
                       const excluded = excludeFilters[key]?.includes(item.value);
return (
  <span key={item.value} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
    <span
      onClick={() => {
        if (excluded) { setExcludeFilters(f => ({ ...f, [key]: f[key].filter(v => v !== item.value) })); return; }
        setActiveFilters(f => ({ ...f, [key]: selected ? f[key].filter(v => v !== item.value) : [...f[key], item.value] }));
        if (selected) setOnlyFilters(f => ({ ...f, [key]: (f[key] || []).filter(v => v !== item.value) }));
      }}
      onDoubleClick={() => {
        setActiveFilters(f => ({ ...f, [key]: f[key].filter(v => v !== item.value) }));
        setExcludeFilters(f => ({ ...f, [key]: excluded ? f[key].filter(v => v !== item.value) : [...f[key], item.value] }));
      }}
      style={{ cursor: "pointer", fontSize: 11, padding: "3px 10px", borderRadius: 8, fontWeight: 600,
        background: excluded ? `${COLORS.red}22` : selected ? item.color : `${item.color}22`,
        color: excluded ? COLORS.red : selected ? "#fff" : item.color,
        border: `1px solid ${excluded ? COLORS.red : item.color}55`,
        textDecoration: excluded ? "line-through" : "none",
        transition: "all 0.15s" }}>
      {item.label}
    </span>
    {selected && !excluded && (
      <span
        onClick={() => setOnlyFilters(f => ({ ...f, [key]: (f[key] || []).includes(item.value) ? f[key].filter(v => v !== item.value) : [...(f[key] || []), item.value] }))}
        title="Only: retourne uniquement les entrées où ce champ contient exclusivement cette valeur"
        style={{ cursor: "pointer", fontSize: 10, padding: "2px 6px", borderRadius: 6, fontWeight: 700,
          background: (onlyFilters[key] || []).includes(item.value) ? `${COLORS.gold}33` : COLORS.bg,
          color: (onlyFilters[key] || []).includes(item.value) ? COLORS.gold : COLORS.textMuted,
          border: `1px solid ${(onlyFilters[key] || []).includes(item.value) ? COLORS.gold : COLORS.border}`,
          transition: "all 0.15s" }}>
        only
      </span>
    )}
  </span>
                        );
                      })}
                    </div>
                  </div>
                ))}
              <div style={{ marginTop: 12, borderTop: `1px solid ${COLORS.border}`, paddingTop: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.textSub, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>📅 Last Update Date</div>
                {(() => {
                  const dateRangeFilter = customFilters.find(cf => cf.key === "complianceLastUpdateDate");
                  const dateRangeIdx = customFilters.findIndex(cf => cf.key === "complianceLastUpdateDate");
                  const setFrom = (v) => {
                    if (dateRangeIdx >= 0) {
                      setCustomFilters(fs => fs.map((f, j) => j === dateRangeIdx ? { ...f, op: "between", value: v } : f));
                    } else {
                      setCustomFilters(fs => [...fs, { key: "complianceLastUpdateDate", label: "Last Update Date", type: "date", op: "between", value: v, value2: "" }]);
                    }
                  };
                  const setTo = (v) => {
                    if (dateRangeIdx >= 0) {
                      setCustomFilters(fs => fs.map((f, j) => j === dateRangeIdx ? { ...f, op: "between", value2: v } : f));
                    } else {
                      setCustomFilters(fs => [...fs, { key: "complianceLastUpdateDate", label: "Last Update Date", type: "date", op: "between", value: "", value2: v }]);
                    }
                  };
                  const clearRange = () => setCustomFilters(fs => fs.filter(f => f.key !== "complianceLastUpdateDate"));
                  const fromVal = dateRangeFilter?.value || "";
                  const toVal = dateRangeFilter?.value2 || "";
                  const hasRange = fromVal || toVal;
                  return (
                    <div style={{ background: hasRange ? `${COLORS.accent}08` : COLORS.bg, border: `1px solid ${hasRange ? COLORS.accent + "40" : COLORS.border}`, borderRadius: 8, padding: "10px 12px", transition: "all 0.2s" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <span style={{ fontSize: 10, color: COLORS.textMuted, fontWeight: 600, minWidth: 28 }}>DE</span>
                        <input type="date" value={fromVal} onChange={e => setFrom(e.target.value)}
                          style={{ flex: 1, background: COLORS.card, border: `1px solid ${fromVal ? COLORS.accent + "80" : COLORS.border}`, borderRadius: 6, padding: "5px 8px", color: fromVal ? COLORS.text : COLORS.textMuted, fontSize: 12, outline: "none", colorScheme: "dark", fontFamily: "inherit" }} />
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 10, color: COLORS.textMuted, fontWeight: 600, minWidth: 28 }}>À</span>
                        <input type="date" value={toVal} onChange={e => setTo(e.target.value)}
                          style={{ flex: 1, background: COLORS.card, border: `1px solid ${toVal ? COLORS.accent + "80" : COLORS.border}`, borderRadius: 6, padding: "5px 8px", color: toVal ? COLORS.text : COLORS.textMuted, fontSize: 12, outline: "none", colorScheme: "dark", fontFamily: "inherit" }} />
                      </div>
                      {hasRange && (
                        <div style={{ marginTop: 8, display: "flex", justifyContent: "flex-end" }}>
                          <span onClick={clearRange} style={{ cursor: "pointer", fontSize: 11, color: COLORS.red, fontWeight: 600 }}>✕ Effacer</span>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
              <div style={{ marginTop: 12, borderTop: `1px solid ${COLORS.border}`, paddingTop: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.textSub, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Filtres personnalisés</div>
                <div style={{ position: "relative" }}>
                  <input value={filterSearch} onChange={e => { setFilterSearch(e.target.value); setFilterSuggestions(e.target.value.trim() ? CUSTOM_FILTER_FIELDS.filter(f => f.label.toLowerCase().includes(e.target.value.toLowerCase()) && !customFilters.find(cf => cf.key === f.key)) : []); }}
                    placeholder="Ajouter un filtre..." style={{ width: "100%", background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "7px 12px", color: COLORS.text, fontSize: 12, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
                  {filterSuggestions.length > 0 && (
                    <div style={{ position: "absolute", top: "110%", left: 0, right: 0, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 8, zIndex: 200, overflow: "hidden" }}>
                      {filterSuggestions.map(f => (
                        <div key={f.key} onClick={() => { setCustomFilters(cf => [...cf, { key: f.key, label: f.label, type: f.type, op: f.type === "date" ? "between" : f.type === "text" || f.type === "contact" ? "notempty" : "eq", value: "", value2: "" }]); setFilterSearch(""); setFilterSuggestions([]); }}
                          style={{ padding: "8px 12px", cursor: "pointer", fontSize: 12, color: COLORS.text, borderBottom: `1px solid ${COLORS.border}` }}
                          onMouseOver={e => e.currentTarget.style.background = COLORS.bg}
                          onMouseOut={e => e.currentTarget.style.background = "transparent"}>
                          {f.label} <span style={{ fontSize: 10, color: COLORS.textMuted, marginLeft: 4 }}>{f.type}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {customFilters.map((cf, i) => (
                  <div key={cf.key} style={{ marginTop: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 11, color: COLORS.textSub, minWidth: 100 }}>{cf.label}</span>
                      <select value={cf.op} onChange={e => setCustomFilters(fs => fs.map((f, j) => j === i ? { ...f, op: e.target.value, value: "", value2: "" } : f))}
                        style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "4px 6px", color: COLORS.text, fontSize: 11, outline: "none" }}>
                        {cf.type !== "text" && cf.type !== "contact" && <option value="eq">=</option>}
                        {cf.type !== "text" && cf.type !== "contact" && <option value="gt">&gt;</option>}
                        {cf.type !== "text" && cf.type !== "contact" && <option value="lt">&lt;</option>}
                        {cf.type === "date" && <option value="between">Entre</option>}
                        {cf.type === "contact" && <option value="contains">Contient</option>}
                        <option value="empty">Est vide</option>
                        <option value="notempty">N'est pas vide</option>
                      </select>
                      {cf.op !== "empty" && cf.op !== "notempty" && cf.op !== "between" && (
                        <input value={cf.value} type={cf.type === "date" ? "date" : cf.type === "number" ? "number" : "text"} placeholder={cf.type === "contact" ? "Nom du contact..." : ""}
                          onChange={e => setCustomFilters(fs => fs.map((f, j) => j === i ? { ...f, value: e.target.value } : f))}
                          style={{ flex: 1, minWidth: 0, maxWidth: 120, background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "4px 8px", color: COLORS.text, fontSize: 11, outline: "none" }} />
                      )}
                      <span onClick={() => setCustomFilters(fs => fs.filter((_, j) => j !== i))} style={{ cursor: "pointer", color: COLORS.textMuted, fontSize: 14 }}>✕</span>
                    </div>
                    {cf.op === "between" && cf.type === "date" && (
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, paddingLeft: 106 }}>
                        <input type="date" value={cf.value || ""} onChange={e => setCustomFilters(fs => fs.map((f, j) => j === i ? { ...f, value: e.target.value } : f))}
                          style={{ flex: 1, background: COLORS.bg, border: `1px solid ${cf.value ? COLORS.accent + "80" : COLORS.border}`, borderRadius: 6, padding: "4px 8px", color: COLORS.text, fontSize: 11, outline: "none", colorScheme: "dark" }} />
                        <span style={{ fontSize: 10, color: COLORS.textMuted, flexShrink: 0 }}>→</span>
                        <input type="date" value={cf.value2 || ""} onChange={e => setCustomFilters(fs => fs.map((f, j) => j === i ? { ...f, value2: e.target.value } : f))}
                          style={{ flex: 1, background: COLORS.bg, border: `1px solid ${cf.value2 ? COLORS.accent + "80" : COLORS.border}`, borderRadius: 6, padding: "4px 8px", color: COLORS.text, fontSize: 11, outline: "none", colorScheme: "dark" }} />
                        {(cf.value || cf.value2) && (
                          <span onClick={() => setCustomFilters(fs => fs.map((f, j) => j === i ? { ...f, value: "", value2: "" } : f))} style={{ cursor: "pointer", color: COLORS.textMuted, fontSize: 11 }}>✕</span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
</div>
              </div>
            )}
          </div>
          {(() => {
            const [xlOpen, setXlOpen] = useState(false);
            const ref = useRef(null);
            useEffect(() => {
              if (!xlOpen) return;
              const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setXlOpen(false); };
              document.addEventListener("mousedown", handler);
              return () => document.removeEventListener("mousedown", handler);
            }, [xlOpen]);
            return (
              <div ref={ref} style={{ position: "relative" }}>
                <div onClick={() => setXlOpen(o => !o)}
                  style={{ cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: "10px 14px", borderRadius: 8, border: `1px solid ${xlOpen ? COLORS.accent + "80" : COLORS.border}`, background: xlOpen ? `${COLORS.accent}10` : "transparent", transition: "all 0.15s" }}>
                  <img src="/logoxl.png" style={{ width: 28, height: 28, objectFit: "contain" }} />
                </div>
                {xlOpen && (
                  <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 200, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10, overflow: "hidden", boxShadow: "0 8px 24px #00000060", minWidth: 150 }}>
                    <div onClick={() => { setXlOpen(false); setShowImport(true); }}
                      style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 16px", cursor: "pointer", color: COLORS.text, fontSize: 13, fontWeight: 600 }}
                      onMouseOver={e => e.currentTarget.style.background = COLORS.hover}
                      onMouseOut={e => e.currentTarget.style.background = "transparent"}>
                      <span style={{ fontSize: 16 }}>⬆</span> IMPORT
                    </div>
                    <div style={{ height: 1, background: COLORS.border }} />
                    <div onClick={() => { setXlOpen(false); setShowExport(true); }}
                      style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 16px", cursor: "pointer", color: COLORS.text, fontSize: 13, fontWeight: 600 }}
                      onMouseOver={e => e.currentTarget.style.background = COLORS.hover}
                      onMouseOut={e => e.currentTarget.style.background = "transparent"}>
                      <span style={{ fontSize: 16 }}>⬇</span> EXPORT
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
          {companies.length > 0 && (
            <button onClick={async () => {
              if (window.confirm(`⚠️ Supprimer les ${companies.length} companies ? Cette action est irréversible.`)) {
                await supabase.from('companies').delete().neq('id', 0);
                setCompanies([]);
              }
            }} style={{ background: `${COLORS.red}15`, color: COLORS.red, border: `1px solid ${COLORS.red}40`, borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "inherit", padding: "10px 14px", letterSpacing: 0.3, height: "46px" }}>
              🗑 Effacer tout ({companies.length})
            </button>
          )}
          <button onClick={reloadCompanies} disabled={isReloading} title="Recharger depuis Supabase"
            style={{ background: "transparent", border: `1px solid ${COLORS.border}`, borderRadius: 8, cursor: isReloading ? "wait" : "pointer", fontSize: 18, padding: "10px 14px", color: isReloading ? COLORS.textMuted : COLORS.textSub, transition: "color 0.2s", height: "46px" }}>
            {isReloading ? "⟳" : "↺"}
          </button>
          {activeViewId && (
            <button onClick={() => {
              const updated = (config.companyViews || []).map(v => v.id === activeViewId
                ? { ...v, filters: { activeFilters, excludeFilters, onlyFilters, customFilters, filterMode, search } }
                : v);
              updateField("companyViews", updated);
            }} title="Sauvegarder les filtres actuels dans cette vue"
              style={{ background: `${COLORS.blue}15`, color: COLORS.blue, border: `1px solid ${COLORS.blue}40`, borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "inherit", padding: "10px 14px", height: "46px", whiteSpace: "nowrap" }}>
              📌 Capturer
            </button>
          )}
          <button onClick={openNew} style={{ background: COLORS.accent, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit", padding: "6px 14px", lineHeight: "1", height: "46px", marginTop: 3 }}>+ NEW COMPANY</button>
        </div>

        {(config.companyViews || []).length > 0 && (
          <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
            {(config.companyViews || []).map(view => {
              const isActive = activeViewId === view.id;
              const EMPTY = { city:[], companyType:[], status:[], country:[], businessUnit:[], roles:[], foodFeed:[], companySize:[], complianceStatus:[], finalAuthStatus:[], contractsCurrency:[], watchList:[] };
              return (
                <button key={view.id} onClick={() => {
                  if (isActive) {
                    setActiveViewId(null);
                    setActiveFilters({...EMPTY}); setExcludeFilters({...EMPTY}); setOnlyFilters({...EMPTY});
                    setCustomFilters([]); setFilterMode("AND"); setSearch("");
                  } else {
                    setActiveViewId(view.id);
                    setActiveFilters(view.filters?.activeFilters || {...EMPTY});
                    setExcludeFilters(view.filters?.excludeFilters || {...EMPTY});
                    setOnlyFilters(view.filters?.onlyFilters || {...EMPTY});
                    setCustomFilters(view.filters?.customFilters || []);
                    setFilterMode(view.filters?.filterMode || "AND");
                    setSearch(view.filters?.search || "");
                  }
                }}
                  style={{ padding: "7px 18px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "inherit", letterSpacing: 0.3, transition: "all 0.15s", background: isActive ? COLORS.accent : COLORS.card, color: isActive ? COLORS.textOnAccent : COLORS.textSub, border: `1.5px solid ${isActive ? COLORS.accent : COLORS.border}` }}
                  onMouseEnter={e => { if (!isActive) { e.currentTarget.style.borderColor = COLORS.accent + "80"; e.currentTarget.style.color = COLORS.text; }}}
                  onMouseLeave={e => { if (!isActive) { e.currentTarget.style.borderColor = COLORS.border; e.currentTarget.style.color = COLORS.textSub; }}}>
                  {view.name}{isActive && <span style={{ marginLeft: 8, fontSize: 11, opacity: 0.7 }}>✕</span>}
                </button>
              );
            })}
          </div>
        )}

       {(Object.values(activeFilters).flat().length > 0 || customFilters.filter(cf => cf.value || cf.value2 || cf.op === "empty" || cf.op === "notempty").length > 0) && (
  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
    <span style={{ fontSize: 11, color: COLORS.textSub, fontWeight: 600, alignSelf: "center" }}>Filtres actifs :</span>
    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, background: `${COLORS.accent}15`, color: COLORS.accent, fontWeight: 700, alignSelf: "center", fontFamily: "'DM Mono', monospace" }}>{filtered.length} société{filtered.length !== 1 ? "s" : ""}</span>
    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, background: filterMode === "AND" ? `${COLORS.accent}22` : `${COLORS.purple}22`, color: filterMode === "AND" ? COLORS.accent : COLORS.purple, fontWeight: 700, alignSelf: "center" }}>{filterMode}</span>
    {customFilters.filter(cf => cf.value || cf.value2).map((cf, i) => (
      <span key={`custom:${cf.key}`} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, padding: "2px 8px", borderRadius: 6, background: `${COLORS.accent}22`, color: COLORS.accent, border: `1px solid ${COLORS.accent}55`, fontWeight: 600 }}>
        {cf.label} {cf.op === "between" ? `${cf.value || "…"} → ${cf.value2 || "…"}` : cf.type !== "text" ? cf.op === "eq" ? "=" : cf.op === "gt" ? ">" : "<" : "="} {cf.op !== "between" ? cf.value : ""}
        <span onClick={() => setCustomFilters(fs => fs.filter((_, j) => j !== i))} style={{ cursor: "pointer", marginLeft: 2, fontSize: 12, lineHeight: 1 }}>✕</span>
      </span>
    ))}
   {[
  ...Object.entries(activeFilters).flatMap(([key, values]) => values.map(val => ({ key, val, exclude: false }))),
  ...Object.entries(excludeFilters).flatMap(([key, values]) => values.map(val => ({ key, val, exclude: true }))),
].map(({ key, val, exclude }) => {
        const fieldDefs = [
          { key: "status", cfg: config.activityStatus },
          { key: "companyType", cfg: config.companyType },
          { key: "country", cfg: config.country },
          { key: "businessUnit", cfg: config.businessUnit },
          { key: "roles", cfg: config.roles },
          { key: "foodFeed", cfg: config.foodFeed },
          { key: "companySize", cfg: config.companySize },
          { key: "complianceStatus", cfg: config.complianceStatus },
          { key: "finalAuthStatus", cfg: config.finalAuthStatus },
          { key: "contractsCurrency", cfg: config.contractsCurrency },
          { key: "watchList", cfg: [{ value: true, label: "⚠️ Watch List", color: COLORS.red }] },
        ];
       const cfg = fieldDefs.find(f => f.key === key)?.cfg || [];
        const item = cfg.find(i => i.value === val);
        const color = exclude ? COLORS.red : (item?.color || COLORS.accent);
        const label = item?.label || val;
        return (
          <span key={`${exclude ? "exc" : "inc"}:${key}:${val}`} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, padding: "2px 8px", borderRadius: 6, background: `${color}22`, color, border: `1px solid ${color}55`, fontWeight: 600, textDecoration: exclude ? "line-through" : "none" }}>
            {exclude && <span style={{ fontSize: 10, marginRight: 2 }}>≠</span>}{label}
            <span onClick={() => exclude ? setExcludeFilters(f => ({ ...f, [key]: f[key].filter(v => v !== val) })) : setActiveFilters(f => ({ ...f, [key]: f[key].filter(v => v !== val) }))} style={{ cursor: "pointer", marginLeft: 2, fontSize: 12, lineHeight: 1 }}>✕</span>
          </span>
        );
      })}
  </div>
)}

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 1.2fr 1.5fr 1.5fr 1.2fr 1fr", gap: 10, padding: "8px 18px", marginBottom: 2 }}>
          {["Company", "Broker", "Role"].map(h => (
            <div key={h} style={{ fontSize: 14, color: "#D4AF37", fontWeight: 600, letterSpacing: 0.5 }}>{h.toUpperCase()}</div>
          ))}
          {["Compliance\nStatus", "Final Auth.\nStatus"].map(h => (
            <div key={h} style={{ fontSize: 14, color: "#D4AF37", fontWeight: 600, letterSpacing: 0.5, whiteSpace: "pre-line", lineHeight: 1.3 }}>{h.toUpperCase()}</div>
          ))}
          {["Website", "Business Unit"].map(h => (
            <div key={h} style={{ fontSize: 14, color: "#D4AF37", fontWeight: 600, letterSpacing: 0.5 }}>{h.toUpperCase()}</div>
          ))}
        </div>

        <VirtualList items={filtered} itemHeight={70} containerHeight={600} renderItem={(c) => (
          <CompanyRow key={c.id} c={c} isSelected={selected === c.id} onSelect={() => setSelected(c.id === selected ? null : c.id)}
            getComplianceCfg={getComplianceCfg} getFinalAuthCfg={getFinalAuthCfg} getRoleCfg={getRoleCfg} getBUCfg={getBUCfg} config={config} />
        )} emptyMessage="Aucune société trouvée" />
      </div>

      {sel && <div style={{ marginLeft: 20 }}><CompanyDetailPanel sel={sel} selContacts={selContacts} onEdit={() => openEdit(sel)} onDelete={() => del(sel.id)}
        getStatusCfg={getStatusCfg} getComplianceCfg={getComplianceCfg} getFinalAuthCfg={getFinalAuthCfg}
        getBUCfg={getBUCfg} getRoleCfg={getRoleCfg} getTypeCfg={getTypeCfg}
        onPatchCompany={(patch) => {
          const tz = config.companyTimezone || 'Europe/Paris';
          const updated = companies.map(c => c.id === sel.id ? { ...c, ...patch, complianceLastUpdateDate: nowInTz(tz) } : c);
          setCompanies(updated);
          saveLargeTable('companies', updated);
        }} /></div>}


      {showForm && (
        <Modal title={editCompany ? "Modifier la société" : "Nouvelle société"} onClose={() => setShowForm(false)} wide>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div style={{ gridColumn: "1 / -1" }}><Input label="Company Name" value={form.name} onChange={v => setForm({ ...form, name: v })} placeholder="ACME Corp" /></div>
            <div style={{ gridColumn: "1 / -1" }}><Input label="Legal Name" value={form.legalName || ""} onChange={v => setForm({ ...form, legalName: v })} placeholder="Raison sociale officielle" /></div>
            <SelectField label="Company Type" value={form.companyType} onChange={v => setForm({ ...form, companyType: v })} options={config.companyType.map(s => ({ value: s.value, label: s.label }))} />
            <Input label="Group" value={form.group} onChange={v => setForm({ ...form, group: v })} placeholder="Ex: ACME Holding" />
            <div style={{ gridColumn: "1 / -1" }}><Input label="Tax Info" value={form.taxInfo || ""} onChange={v => setForm({ ...form, taxInfo: v })} placeholder="N° TVA, SIRET…" /></div>
            <div style={{ gridColumn: "1 / -1" }}><Input label="Website" value={form.website || ""} onChange={v => setForm({ ...form, website: v })} placeholder="Ex: www.acme.com" /></div>
            <div style={{ gridColumn: "1 / -1" }}><Input label="Address" value={form.address || ""} onChange={v => setForm({ ...form, address: v })} placeholder="Ex: 12 rue de la Paix" /></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 12, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5 }}>CITY</label>
              <select value={form.city} onChange={e => setForm({ ...form, city: e.target.value })}
                style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "10px 14px", color: COLORS.text, fontSize: 14, outline: "none", fontFamily: "inherit" }}>
                <option value="">— Sélectionner —</option>
                {config.city.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 12, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5 }}>COUNTRY</label>
              {(() => {
                const isUnknown = form.country && !config.country.find(c => c.value === form.country);
                const allOpts = [{ value: "", label: "— Sélectionner —" }, ...(isUnknown ? [{ value: form.country, label: "⚠ " + form.country + " (valeur inconnue)" }] : []), ...config.country.map(c => ({ value: c.value, label: c.label }))];
                return <>
                  <select key={form.country} defaultValue={form.country || ""} onChange={e => setForm({ ...form, country: e.target.value })}
                    style={{ background: COLORS.bg, border: "1px solid " + (isUnknown ? COLORS.red : COLORS.border), borderRadius: 8, padding: "10px 14px", color: isUnknown ? COLORS.red : COLORS.text, fontSize: 14, outline: "none", fontFamily: "inherit" }}>
                    {allOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  {isUnknown && <div style={{ fontSize: 11, color: COLORS.red }}>⚠ Valeur inconnue</div>}
                </>;
              })()}
            </div>
            <SelectField label="Activity Status" value={form.status} onChange={v => setForm({ ...form, status: v })} options={config.activityStatus.map(s => ({ value: s.value, label: s.label }))} />
            <SelectField label="Company Size" value={form.companySize || ""} onChange={v => setForm({ ...form, companySize: v })} options={[{ value: "", label: "— Select —" }, { value: "Big", label: "Big" }, { value: "Medium", label: "Medium" }, { value: "Small", label: "Small" }]} />
            <Input label="Broker" value={form.broker} onChange={v => setForm({ ...form, broker: v })} placeholder="Ex: BNP Paribas" />
            <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 8 }}>
              <label style={{ fontSize: 12, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5 }}>BUSINESS UNIT — sélection multiple</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {config.businessUnit.map(bu => {
                  const isSelected = (form.businessUnit || []).includes(bu.value);
                  return <div key={bu.value} onClick={() => { const cur = form.businessUnit || []; setForm({ ...form, businessUnit: isSelected ? cur.filter(v => v !== bu.value) : [...cur, bu.value] }); }}
                    style={{ padding: "6px 14px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, background: isSelected ? `${bu.color}25` : COLORS.bg, border: `1.5px solid ${isSelected ? bu.color : COLORS.border}`, color: isSelected ? bu.color : COLORS.textSub, transition: "all 0.15s", userSelect: "none" }}>
                    {isSelected && <span style={{ marginRight: 5, fontSize: 11 }}>✓</span>}{bu.label}
                  </div>;
                })}
              </div>
            </div>
            <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 10, margin: "4px 0" }}>
              <div style={{ fontSize: 11, color: COLORS.orange, fontWeight: 700, letterSpacing: 0.5, whiteSpace: "nowrap" }}>🛡 COMPLIANCE</div>
              <div style={{ flex: 1, height: 1, background: COLORS.border }} />
            </div>
            <SelectField label="Compliance Status" value={form.complianceStatus} onChange={v => setForm({ ...form, complianceStatus: v })} options={config.complianceStatus.map(s => ({ value: s.value, label: s.label }))} />
            <SelectField label="Final Authorization Status" value={form.finalAuthStatus} onChange={v => setForm({ ...form, finalAuthStatus: v })} options={config.finalAuthStatus.map(s => ({ value: s.value, label: s.label }))} />
            <Input label="Creation Date" type="datetime-local" value={form.complianceCreationDate || ""} onChange={v => setForm({ ...form, complianceCreationDate: v })} />
            <Input label="Last Update Date" type="datetime-local" value={form.complianceLastUpdateDate || ""} onChange={v => setForm({ ...form, complianceLastUpdateDate: v })} />
            <Input label="Request Date" type="datetime-local" value={form.complianceRequestDate || ""} onChange={v => setForm({ ...form, complianceRequestDate: v })} />
            <Input label="Last Reception Date" type="datetime-local" value={form.complianceLastReceptionDate || ""} onChange={v => setForm({ ...form, complianceLastReceptionDate: v })} />
            <Input label="Final Confirmation Date" type="date" value={form.complianceFinalConfirmationDate || ""} onChange={v => setForm({ ...form, complianceFinalConfirmationDate: v })} />
            <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 12, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5 }}>ADDITIONAL INFOS (COMPLIANCE)</label>
              <textarea value={form.complianceAdditionalInfos || ""} onChange={e => setForm({ ...form, complianceAdditionalInfos: e.target.value })} rows={2}
                style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "10px 14px", color: COLORS.text, fontSize: 14, resize: "vertical", fontFamily: "inherit", outline: "none", width: "100%", boxSizing: "border-box" }} />
            </div>
            <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 10, margin: "4px 0" }}>
              <div style={{ fontSize: 11, color: COLORS.red, fontWeight: 700, letterSpacing: 0.5, whiteSpace: "nowrap" }}>⚠️ RISK</div>
              <div style={{ flex: 1, height: 1, background: COLORS.border }} />
            </div>
            <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", justifyContent: "space-between", background: COLORS.bg, border: `1px solid ${form.watchList ? COLORS.red + "60" : COLORS.border}`, borderRadius: 10, padding: "12px 16px" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>Watch List</div>
                <div style={{ fontSize: 11, color: COLORS.textSub, marginTop: 2 }}>Flag this company as being on the watch list</div>
              </div>
              <div onClick={() => setForm({ ...form, watchList: !form.watchList })} style={{ width: 44, height: 24, borderRadius: 12, background: form.watchList ? COLORS.red : COLORS.border, cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
                <div style={{ position: "absolute", top: 3, left: form.watchList ? 23 : 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px #0004" }} />
              </div>
            </div>
            <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 10, margin: "4px 0" }}>
              <div style={{ fontSize: 11, color: COLORS.blue, fontWeight: 700, letterSpacing: 0.5, whiteSpace: "nowrap" }}>👤 KEY PEOPLE</div>
              <div style={{ flex: 1, height: 1, background: COLORS.border }} />
            </div>
            {["ubo", "shareholders"].map((key) => {
              const label = key === "ubo" ? "UBO" : "Shareholders";
              return (
                <div key={key} style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 8 }}>
                  <label style={{ fontSize: 12, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5 }}>{label} — sélection multiple</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {(editCompany ? contacts.filter(c => c.companyId === editCompany.id) : []).length === 0
                      ? <span style={{ fontSize: 12, color: COLORS.textMuted }}>No contacts linked to this company yet.</span>
                      : (editCompany ? contacts.filter(c => c.companyId === editCompany.id) : []).map(c => {
                          const isSelected = (form[key] || []).includes(c.id);
                          return <div key={c.id} onClick={() => { const cur = form[key] || []; setForm({ ...form, [key]: isSelected ? cur.filter(id => id !== c.id) : [...cur, c.id] }); }}
                            style={{ padding: "6px 14px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, background: isSelected ? `${COLORS.blue}25` : COLORS.bg, border: `1.5px solid ${isSelected ? COLORS.blue : COLORS.border}`, color: isSelected ? COLORS.blue : COLORS.textSub, userSelect: "none" }}>
                            {isSelected && <span style={{ marginRight: 5, fontSize: 11 }}>✓</span>}{c.name}
                          </div>;
                        })
                    }
                  </div>
                </div>
              );
            })}
            {[{ label: "President", key: "president" }, { label: "CEO", key: "ceo" }, { label: "CFO", key: "cfo" }].map(({ label, key }) => (
              <div key={key} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 12, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5 }}>{label}</label>
                <select value={form[key] || ""} onChange={e => setForm({ ...form, [key]: e.target.value })}
                  style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "10px 14px", color: COLORS.text, fontSize: 14, outline: "none", fontFamily: "inherit" }}>
                  <option value="">— None —</option>
                  {(editCompany ? contacts.filter(c => c.companyId === editCompany.id) : []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            ))}
            <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 8 }}>
              <label style={{ fontSize: 12, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5 }}>RÔLE(S) — sélection multiple</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {config.roles.map(r => {
                  const isSelected = (form.roles || []).includes(r.value);
                  return <div key={r.value} onClick={() => toggleRole(r.value)}
                    style={{ padding: "6px 14px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, background: isSelected ? `${r.color}25` : COLORS.bg, border: `1.5px solid ${isSelected ? r.color : COLORS.border}`, color: isSelected ? r.color : COLORS.textSub, transition: "all 0.15s", userSelect: "none" }}>
                    {isSelected && <span style={{ marginRight: 5, fontSize: 11 }}>✓</span>}{r.label}
                  </div>;
                })}
              </div>
            </div>
            <div style={{ gridColumn: "1 / -1" }}><Input label="GT Role" value={form.gtRole || ""} onChange={v => setForm({ ...form, gtRole: v })} placeholder="Ex: VESSEL MANAGER" /></div>
            <div style={{ gridColumn: "1 / -1" }}><Input label="Tags (séparés par virgule)" value={form.tags} onChange={v => setForm({ ...form, tags: v })} placeholder="B2B, Export" /></div>
            <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 10, margin: "4px 0" }}>
              <div style={{ fontSize: 11, color: COLORS.green, fontWeight: 700, letterSpacing: 0.5, whiteSpace: "nowrap" }}>💰 FINANCE</div>
              <div style={{ flex: 1, height: 1, background: COLORS.border }} />
            </div>
            <Input label="Incorporation Date" type="date" value={form.incorporationDate || ""} onChange={v => setForm({ ...form, incorporationDate: v })} />
            <Input label="Equity" value={form.equity || ""} onChange={v => setForm({ ...form, equity: v })} placeholder="Ex: 500 000 €" />
            <Input label="Turnover" value={form.turnover || ""} onChange={v => setForm({ ...form, turnover: v })} placeholder="Ex: 2 000 000 €" />
            <Input label="Net Income" value={form.netIncome || ""} onChange={v => setForm({ ...form, netIncome: v })} placeholder="Ex: 150 000 €" />
            <Input label="Total Fixed Assets" value={form.totalFixedAssets || ""} onChange={v => setForm({ ...form, totalFixedAssets: v })} placeholder="Ex: 800 000 €" />
            <Input label="Total Assets" value={form.totalAssets || ""} onChange={v => setForm({ ...form, totalAssets: v })} placeholder="Ex: 3 000 000 €" />
            <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 10, margin: "4px 0" }}>
              <div style={{ fontSize: 11, color: COLORS.purple, fontWeight: 700, letterSpacing: 0.5, whiteSpace: "nowrap" }}>📊 ACTIVITY</div>
              <div style={{ flex: 1, height: 1, background: COLORS.border }} />
            </div>
            <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 8 }}>
              <label style={{ fontSize: 12, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5 }}>CONTRACTS CURRENCY — sélection multiple</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {config.contractsCurrency.map(cur => {
                  const isSelected = (form.contractsCurrency || []).includes(cur.value);
                  return <div key={cur.value} onClick={() => { const curr = form.contractsCurrency || []; setForm({ ...form, contractsCurrency: isSelected ? curr.filter(c => c !== cur.value) : [...curr, cur.value] }); }}
                    style={{ padding: "6px 14px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, background: isSelected ? `${cur.color}25` : COLORS.bg, border: `1.5px solid ${isSelected ? cur.color : COLORS.border}`, color: isSelected ? cur.color : COLORS.textSub, transition: "all 0.15s", userSelect: "none" }}>
                    {isSelected && <span style={{ marginRight: 5, fontSize: 11 }}>✓</span>}{cur.label}
                  </div>;
                })}
              </div>
            </div>
            <Input label="Number of Contracts" type="number" value={form.numberOfContracts || ""} onChange={v => setForm({ ...form, numberOfContracts: v })} placeholder="Ex: 12" />
            <SelectField label="Food/Feed" value={form.foodFeed || ""} onChange={v => setForm({ ...form, foodFeed: v })} options={[{ value: "", label: "— Select —" }, { value: "FOOD", label: "FOOD" }, { value: "FEED", label: "FEED" }, { value: "FOOD + FEED", label: "FOOD + FEED" }]} />
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 22, justifyContent: "flex-end" }}>
            <Btn variant="secondary" onClick={() => setShowForm(false)}>Annuler</Btn>
            <Btn onClick={save}>Enregistrer</Btn>
          </div>
        </Modal>
      )}
      {showImport && <ExcelImportModal type="companies" onClose={() => setShowImport(false)} onImport={(items, mappedFields = []) => {
  setCompanies(prev => {
    const byRef = {};
    prev.forEach(c => { if (c.ref) byRef[c.ref] = c; });
    const updated = [...prev];
    const updatedIds = new Set();

    items.forEach(incoming => {
      const existingIdx = incoming.ref ? prev.findIndex(c => c.ref === incoming.ref) : -1;
      if (existingIdx !== -1) {
        // Merge: only overwrite fields that were actually in the Excel and have a non-empty value
        const merged = { ...prev[existingIdx] };
        mappedFields.forEach(field => {
          const val = incoming[field];
          const isEmpty = val === undefined || val === null || val === "" || (Array.isArray(val) && val.length === 0);
          if (!isEmpty) merged[field] = val;
        });
        // Always update lastUpdateDate on merge
        merged.complianceLastUpdateDate = nowInTz(config.companyTimezone || 'Europe/Paris');
        updated[existingIdx] = merged;
        updatedIds.add(existingIdx);
      } else {
        // New company — add it
        updated.push(incoming);
      }
    });

    saveLargeTable('companies', updated);
    return updated;
  });
}} />}
      {showExport && <CompanyExportModal all={companies} filtered={filtered} onClose={() => setShowExport(false)} />}
    </div>
  );
};

// ─── CONTACTS ─────────────────────────────────────────────────

const PHONE_DIALCODES = [
  { code: "AF", dial: "+93", name: "Afghanistan" },
  { code: "AL", dial: "+355", name: "Albania" },
  { code: "DZ", dial: "+213", name: "Algeria" },
  { code: "AR", dial: "+54", name: "Argentina" },
  { code: "AM", dial: "+374", name: "Armenia" },
  { code: "AU", dial: "+61", name: "Australia" },
  { code: "AT", dial: "+43", name: "Austria" },
  { code: "AZ", dial: "+994", name: "Azerbaijan" },
  { code: "BH", dial: "+973", name: "Bahrain" },
  { code: "BD", dial: "+880", name: "Bangladesh" },
  { code: "BE", dial: "+32", name: "Belgium" },
  { code: "BO", dial: "+591", name: "Bolivia" },
  { code: "BA", dial: "+387", name: "Bosnia" },
  { code: "BR", dial: "+55", name: "Brazil" },
  { code: "BG", dial: "+359", name: "Bulgaria" },
  { code: "CM", dial: "+237", name: "Cameroon" },
  { code: "CA", dial: "+1", name: "Canada" },
  { code: "CL", dial: "+56", name: "Chile" },
  { code: "CN", dial: "+86", name: "China" },
  { code: "CO", dial: "+57", name: "Colombia" },
  { code: "HR", dial: "+385", name: "Croatia" },
  { code: "CY", dial: "+357", name: "Cyprus" },
  { code: "CZ", dial: "+420", name: "Czechia" },
  { code: "CD", dial: "+243", name: "DR Congo" },
  { code: "DK", dial: "+45", name: "Denmark" },
  { code: "DO", dial: "+1", name: "Dominican Republic" },
  { code: "EG", dial: "+20", name: "Egypt" },
  { code: "EE", dial: "+372", name: "Estonia" },
  { code: "ET", dial: "+251", name: "Ethiopia" },
  { code: "FI", dial: "+358", name: "Finland" },
  { code: "FR", dial: "+33", name: "France" },
  { code: "GE", dial: "+995", name: "Georgia" },
  { code: "DE", dial: "+49", name: "Germany" },
  { code: "GH", dial: "+233", name: "Ghana" },
  { code: "GR", dial: "+30", name: "Greece" },
  { code: "HU", dial: "+36", name: "Hungary" },
  { code: "IN", dial: "+91", name: "India" },
  { code: "ID", dial: "+62", name: "Indonesia" },
  { code: "IR", dial: "+98", name: "Iran" },
  { code: "IQ", dial: "+964", name: "Iraq" },
  { code: "IE", dial: "+353", name: "Ireland" },
  { code: "IL", dial: "+972", name: "Israel" },
  { code: "IT", dial: "+39", name: "Italy" },
  { code: "CI", dial: "+225", name: "Ivory Coast" },
  { code: "JP", dial: "+81", name: "Japan" },
  { code: "JO", dial: "+962", name: "Jordan" },
  { code: "KZ", dial: "+7", name: "Kazakhstan" },
  { code: "KE", dial: "+254", name: "Kenya" },
  { code: "KW", dial: "+965", name: "Kuwait" },
  { code: "LV", dial: "+371", name: "Latvia" },
  { code: "LB", dial: "+961", name: "Lebanon" },
  { code: "LY", dial: "+218", name: "Libya" },
  { code: "LT", dial: "+370", name: "Lithuania" },
  { code: "LU", dial: "+352", name: "Luxembourg" },
  { code: "MY", dial: "+60", name: "Malaysia" },
  { code: "ML", dial: "+223", name: "Mali" },
  { code: "MT", dial: "+356", name: "Malta" },
  { code: "MX", dial: "+52", name: "Mexico" },
  { code: "MD", dial: "+373", name: "Moldova" },
  { code: "MA", dial: "+212", name: "Morocco" },
  { code: "MZ", dial: "+258", name: "Mozambique" },
  { code: "NP", dial: "+977", name: "Nepal" },
  { code: "NL", dial: "+31", name: "Netherlands" },
  { code: "NZ", dial: "+64", name: "New Zealand" },
  { code: "NG", dial: "+234", name: "Nigeria" },
  { code: "NO", dial: "+47", name: "Norway" },
  { code: "OM", dial: "+968", name: "Oman" },
  { code: "PK", dial: "+92", name: "Pakistan" },
  { code: "PE", dial: "+51", name: "Peru" },
  { code: "PH", dial: "+63", name: "Philippines" },
  { code: "PL", dial: "+48", name: "Poland" },
  { code: "PT", dial: "+351", name: "Portugal" },
  { code: "QA", dial: "+974", name: "Qatar" },
  { code: "RO", dial: "+40", name: "Romania" },
  { code: "RU", dial: "+7", name: "Russia" },
  { code: "RW", dial: "+250", name: "Rwanda" },
  { code: "SA", dial: "+966", name: "Saudi Arabia" },
  { code: "SN", dial: "+221", name: "Senegal" },
  { code: "RS", dial: "+381", name: "Serbia" },
  { code: "SG", dial: "+65", name: "Singapore" },
  { code: "SK", dial: "+421", name: "Slovakia" },
  { code: "SI", dial: "+386", name: "Slovenia" },
  { code: "ZA", dial: "+27", name: "South Africa" },
  { code: "KR", dial: "+82", name: "South Korea" },
  { code: "ES", dial: "+34", name: "Spain" },
  { code: "LK", dial: "+94", name: "Sri Lanka" },
  { code: "SD", dial: "+249", name: "Sudan" },
  { code: "SE", dial: "+46", name: "Sweden" },
  { code: "CH", dial: "+41", name: "Switzerland" },
  { code: "TW", dial: "+886", name: "Taiwan" },
  { code: "TZ", dial: "+255", name: "Tanzania" },
  { code: "TH", dial: "+66", name: "Thailand" },
  { code: "TN", dial: "+216", name: "Tunisia" },
  { code: "TR", dial: "+90", name: "Turkey" },
  { code: "UG", dial: "+256", name: "Uganda" },
  { code: "UA", dial: "+380", name: "Ukraine" },
  { code: "AE", dial: "+971", name: "UAE" },
  { code: "GB", dial: "+44", name: "United Kingdom" },
  { code: "US", dial: "+1", name: "United States" },
  { code: "UY", dial: "+598", name: "Uruguay" },
  { code: "UZ", dial: "+998", name: "Uzbekistan" },
  { code: "VN", dial: "+84", name: "Vietnam" },
  { code: "YE", dial: "+967", name: "Yemen" },
  { code: "ZM", dial: "+260", name: "Zambia" },
  { code: "ZW", dial: "+263", name: "Zimbabwe" },
];

const PhoneField = ({ label, dialCode, onDialChange, phone, onPhoneChange }) => {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const selectedEntry = PHONE_DIALCODES.find(c => c.dial === dialCode);

  const suggestions = (() => {
    const q = search.toLowerCase().trim();
    if (!q) return PHONE_DIALCODES.slice(0, 8);
    return PHONE_DIALCODES.filter(c =>
      c.name.toLowerCase().includes(q) || c.dial.includes(q) || c.code.toLowerCase().includes(q)
    ).slice(0, 8);
  })();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 12, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5 }}>{label.toUpperCase()}</label>
      <div style={{ display: "flex", gap: 6 }}>
        {/* Indicatif autocomplete */}
        <div style={{ position: "relative", flexShrink: 0, width: 120 }}>
          <input
            value={open ? search : (selectedEntry ? `${selectedEntry.dial} ${selectedEntry.code}` : "")}
            onChange={e => { setSearch(e.target.value); if (!open) setOpen(true); }}
            onFocus={() => { setSearch(""); setOpen(true); }}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder="🌐 +00"
            style={{ width: "100%", background: COLORS.bg, border: `1px solid ${dialCode ? COLORS.accent + "80" : COLORS.border}`, borderRadius: 8, padding: "10px 8px", color: COLORS.text, fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
          />
          {open && (
            <div style={{ position: "absolute", top: "110%", left: 0, zIndex: 500, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 8, boxShadow: "0 8px 24px #00000070", minWidth: 220, overflow: "hidden" }}>
              {suggestions.map(c => (
                <div key={c.code} onMouseDown={() => { onDialChange(c.dial); setSearch(""); setOpen(false); }}
                  style={{ padding: "8px 12px", cursor: "pointer", fontSize: 13, color: COLORS.text, display: "flex", alignItems: "center", gap: 10, borderBottom: `1px solid ${COLORS.border}` }}
                  onMouseOver={e => e.currentTarget.style.background = COLORS.hover}
                  onMouseOut={e => e.currentTarget.style.background = "transparent"}>
                  <img src={`https://flagcdn.com/20x15/${c.code.toLowerCase()}.png`} style={{ width: 20, height: 15, objectFit: "cover", borderRadius: 2, flexShrink: 0 }} />
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
                  <span style={{ color: COLORS.accent, fontWeight: 600, fontFamily: "'DM Mono', monospace", fontSize: 12, flexShrink: 0 }}>{c.dial}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        {/* Numéro */}
        <input value={phone} onChange={e => onPhoneChange(e.target.value)} placeholder="6 12 34 56 78"
          style={{ flex: 1, background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "10px 14px", color: COLORS.text, fontSize: 14, outline: "none", fontFamily: "inherit" }} />
      </div>
    </div>
  );
};

const Contacts = ({ contacts, setContacts, companies }) => {
  const { config } = useConfig();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editContact, setEditContact] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({ companyId: "", position: "", email: "", isMainContact: false, isAuthorizedSignatory: false, isVerified: false });
  const [filterCompanySearch, setFilterCompanySearch] = useState("");
  const [filterCompanyOpen, setFilterCompanyOpen] = useState(false);

  const makeEmptyForm = () => ({
    firstName: "", lastName: "", companyId: "", email: "", phone: "", phoneDialCode: "", phoneAlt: "", phoneAltDialCode: "",
    position: "", status: config.activityStatus[0]?.value || "", priority: "moyenne",
    isMainContact: false, isAuthorizedSignatory: false, isVerified: false,
    tags: "", notes: "", revenue: 0,
  });
  const [form, setForm] = useState(makeEmptyForm());

  const getFullName = (c) => [c.firstName, c.lastName].filter(Boolean).join(" ") || c.name || "—";
  const getAvatar = (c) => ((c.firstName?.[0] || "") + (c.lastName?.[0] || "")).toUpperCase() || c.avatar || "?";
  const getPositionLabel = (v) => (config.contactPositions || []).find(p => p.value === v)?.label || v || "—";

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") {
        if (selected) setSelected(null);
        else setShowFilters(false);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [selected]);

  const activeFiltersCount = [
    filters.companyId, filters.position, filters.email,
    filters.isMainContact, filters.isAuthorizedSignatory, filters.isVerified
  ].filter(Boolean).length;

  const filtered = contacts.filter(c => {
    const company = companies.find(co => co.id === c.companyId);
    const fullName = getFullName(c);
    const ms = fullName.toLowerCase().includes(search.toLowerCase()) ||
      company?.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase());
    if (!ms) return false;
    if (filters.companyId && c.companyId !== Number(filters.companyId)) return false;
    if (filters.position && c.position !== filters.position) return false;
    if (filters.email && !c.email?.toLowerCase().includes(filters.email.toLowerCase())) return false;
    if (filters.isMainContact && !c.isMainContact) return false;
    if (filters.isAuthorizedSignatory && !c.isAuthorizedSignatory) return false;
    if (filters.isVerified && !c.isVerified) return false;
    return true;
  });

  const openEdit = (c) => { setForm({ ...makeEmptyForm(), ...c, tags: (c.tags || []).join(", ") }); setEditContact(c); setShowForm(true); };
  const openNew = () => { setForm(makeEmptyForm()); setEditContact(null); setShowForm(true); };

  const save = () => {
    const fullName = [form.firstName, form.lastName].filter(Boolean).join(" ");
    const data = {
      ...form,
      name: fullName,
      companyId: form.companyId ? Number(form.companyId) : null,
      tags: typeof form.tags === "string" ? form.tags.split(",").map(t => t.trim()).filter(Boolean) : form.tags || [],
      avatar: getAvatar(form),
      revenue: Number(form.revenue) || 0,
      lastContact: editContact?.lastContact || new Date().toISOString().split("T")[0],
    };
    const updated = editContact ? contacts.map(c => c.id === editContact.id ? { ...c, ...data } : c) : [...contacts, { ...data, id: Date.now() }];
    setContacts(updated);
    saveLargeTable('contacts', updated);
    setShowForm(false); setSelected(null);
  };

  const del = (id) => {
    const updated = contacts.filter(c => c.id !== id);
    setContacts(updated);
    saveLargeTable('contacts', updated);
    setSelected(null);
  };
  const sel = selected ? contacts.find(c => c.id === selected) : null;
  const selCompany = sel ? companies.find(co => co.id === sel.companyId) : null;
  const getStatusCfg = (v) => config.activityStatus.find(s => s.value === v) || { label: v || "—", color: COLORS.textSub };

  const ToggleBtn = ({ label, value, onChange, color }) => (
    <div onClick={() => onChange(!value)} style={{
      display: "flex", alignItems: "center", gap: 7, padding: "8px 14px", borderRadius: 8, cursor: "pointer",
      fontSize: 12, fontWeight: 600, userSelect: "none", transition: "all 0.15s",
      background: value ? `${color}22` : COLORS.bg,
      border: `1.5px solid ${value ? color : COLORS.border}`,
      color: value ? color : COLORS.textSub,
    }}>
      <div style={{ width: 8, height: 8, borderRadius: "50%", background: value ? color : COLORS.border, transition: "background 0.15s", flexShrink: 0 }} />
      {label}
    </div>
  );

  return (
    <div style={{ display: "flex", gap: 20, height: "calc(100vh - 200px)", width: "100%", overflow: "hidden" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div style={{ display: "flex", gap: 10, marginBottom: showFilters ? 0 : 18 }}>
          <input placeholder="SEARCH A CONTACT..." value={search} onChange={e => setSearch(e.target.value)}
            style={{ flex: 1, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "10px 16px", color: COLORS.text, fontSize: 14, outline: "none", fontFamily: "inherit" }} />
          <Btn variant="secondary" onClick={() => setShowFilters(f => !f)}>
            ▼ FILTER {activeFiltersCount > 0 && <span style={{ background: COLORS.accent, color: "#fff", borderRadius: 10, fontSize: 11, padding: "1px 7px", marginLeft: 6 }}>{activeFiltersCount}</span>}
          </Btn>
          <div onClick={() => setShowImport(true)} style={{ cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: "10px 14px", borderRadius: 8, border: `1px solid ${COLORS.border}`, background: "transparent" }}>
            <img src="/logoxl.png" style={{ width: 32, height: 32, objectFit: "contain" }} />
          </div>
          {contacts.length > 0 && (
            <button onClick={async () => {
              if (window.confirm(`⚠️ Supprimer les ${contacts.length} contacts ? Cette action est irréversible.`)) {
                await supabase.from('contacts').delete().neq('id', 0);
                setContacts([]);
              }
            }} style={{ background: `${COLORS.red}15`, color: COLORS.red, border: `1px solid ${COLORS.red}40`, borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "inherit", padding: "10px 14px", letterSpacing: 0.3, height: "46px" }}>
              🗑 Effacer tout ({contacts.length})
            </button>
          )}
          <button onClick={openNew} style={{ background: COLORS.accent, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit", padding: "6px 14px", lineHeight: "1", height: "46px", marginTop: 3 }}>NEW CONTACT</button>
        </div>

        {/* Panneau filtres déroulant */}
        {showFilters && (
          <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 16, marginBottom: 18, display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>

              {/* Company autocomplete */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6, position: "relative" }}>
                <label style={{ fontSize: 11, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5 }}>COMPANY</label>
                <div style={{ position: "relative" }}>
                  <input value={filterCompanySearch} onChange={e => { setFilterCompanySearch(e.target.value); setFilters(f => ({ ...f, companyId: "" })); }}
                    onFocus={() => setFilterCompanyOpen(true)} onBlur={() => setTimeout(() => setFilterCompanyOpen(false), 150)}
                    placeholder="Search company..." style={{ width: "100%", background: COLORS.bg, border: `1px solid ${filters.companyId ? COLORS.green + "80" : COLORS.border}`, borderRadius: 8, padding: "8px 12px", color: COLORS.text, fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
                  {filters.companyId && <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: COLORS.green, fontSize: 13 }}>✓</span>}
                </div>
                {filterCompanyOpen && (() => {
                  const q = filterCompanySearch.toLowerCase();
                  const sugg = companies.filter(co => co.name.toLowerCase().includes(q)).slice(0, 6);
                  if (!sugg.length) return null;
                  return (
                    <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 300, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 8, boxShadow: "0 8px 24px #00000060", overflow: "hidden", marginTop: 2 }}>
                      {sugg.map(co => (
                        <div key={co.id} onMouseDown={() => { setFilterCompanySearch(co.name); setFilters(f => ({ ...f, companyId: co.id })); setFilterCompanyOpen(false); }}
                          style={{ padding: "8px 12px", cursor: "pointer", fontSize: 13, color: COLORS.text, display: "flex", alignItems: "center", gap: 8, borderBottom: `1px solid ${COLORS.border}` }}
                          onMouseOver={e => e.currentTarget.style.background = COLORS.hover} onMouseOut={e => e.currentTarget.style.background = "transparent"}>
                          <Avatar initials={co.avatar} size={20} color={COLORS.accent} square />
                          {co.name}
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* Position */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 11, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5 }}>POSITION</label>
                <select value={filters.position} onChange={e => setFilters(f => ({ ...f, position: e.target.value }))}
                  style={{ background: COLORS.bg, border: `1px solid ${filters.position ? COLORS.accent + "80" : COLORS.border}`, borderRadius: 8, padding: "8px 12px", color: COLORS.text, fontSize: 13, fontFamily: "inherit", outline: "none" }}>
                  <option value="">— All positions —</option>
                  {(config.contactPositions || []).map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>

              {/* Email */}
              <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 11, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5 }}>EMAIL</label>
                <input value={filters.email} onChange={e => setFilters(f => ({ ...f, email: e.target.value }))}
                  placeholder="Filter by email..." style={{ background: COLORS.bg, border: `1px solid ${filters.email ? COLORS.accent + "80" : COLORS.border}`, borderRadius: 8, padding: "8px 12px", color: COLORS.text, fontSize: 13, fontFamily: "inherit", outline: "none" }} />
              </div>
            </div>

            {/* Toggles booléens */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: 11, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5, marginRight: 4 }}>STATUS :</span>
              {[
                { key: "isMainContact", label: "MAIN CONTACT", color: COLORS.green },
                { key: "isAuthorizedSignatory", label: "AUTHORIZED SIGNATORY", color: COLORS.gold },
                { key: "isVerified", label: "IS VERIFIED", color: COLORS.blue },
              ].map(({ key, label, color }) => (
                <div key={key} onClick={() => setFilters(f => ({ ...f, [key]: !f[key] }))}
                  style={{ padding: "6px 14px", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 600, userSelect: "none", transition: "all 0.15s",
                    background: filters[key] ? `${color}22` : COLORS.bg,
                    border: `1.5px solid ${filters[key] ? color : COLORS.border}`,
                    color: filters[key] ? color : COLORS.textSub }}>
                  {filters[key] && "✓ "}{label}
                </div>
              ))}
            </div>

            {/* Reset */}
            {activeFiltersCount > 0 && (
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button onClick={() => { setFilters({ companyId: "", position: "", email: "", isMainContact: false, isAuthorizedSignatory: false, isVerified: false }); setFilterCompanySearch(""); }}
                  style={{ background: "none", border: "none", color: COLORS.red, cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit" }}>
                  ✕ Réinitialiser les filtres
                </button>
              </div>
            )}
          </div>
        )}

        <div style={{ overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map(c => {
            const company = companies.find(co => co.id === c.companyId);
            const sc = getStatusCfg(c.status);
            const fullName = getFullName(c);
            const posLabel = getPositionLabel(c.position);
            return (
              <div key={c.id} onClick={() => setSelected(c.id === selected ? null : c.id)}
                style={{ background: selected === c.id ? COLORS.rowSelected : COLORS.card, border: `1px solid ${selected === c.id ? COLORS.accent : COLORS.border}`, borderRadius: 12, padding: "14px 18px", cursor: "pointer", display: "flex", alignItems: "center", gap: 14, transition: "all 0.15s" }}>
                <Avatar initials={getAvatar(c)} size={40} color={COLORS.accent} />
                <div style={{ flex: 1, minWidth: 0, display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr 1fr", gap: "0 16px", alignItems: "center" }}>
                  {/* Nom + position */}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, color: COLORS.text, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fullName}</div>
                    <div style={{ fontSize: 12, color: COLORS.textSub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{posLabel || "—"}</div>
                  </div>
                  {/* Company */}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 10, color: COLORS.textMuted, fontWeight: 600, letterSpacing: 0.4 }}>COMPANY</div>
                    <div style={{ fontSize: 12, color: company ? COLORS.blue : COLORS.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{company?.name || "—"}</div>
                  </div>
                  {/* Email */}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 10, color: COLORS.textMuted, fontWeight: 600, letterSpacing: 0.4 }}>EMAIL</div>
                    <div style={{ fontSize: 12, color: c.email ? COLORS.text : COLORS.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.email || "—"}</div>
                  </div>
                  {/* Phone */}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 10, color: COLORS.textMuted, fontWeight: 600, letterSpacing: 0.4 }}>PHONE</div>
                    <div style={{ fontSize: 12, color: c.phone ? COLORS.text : COLORS.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{[c.phoneDialCode, c.phone].filter(Boolean).join(" ") || "—"}</div>
                  </div>
                  {/* Badges */}
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    {c.isMainContact && <Badge label="MAIN CONTACT" color={COLORS.green} />}
                    {c.isAuthorizedSignatory && <Badge label="AUTH. SIGNATORY" color={COLORS.gold} />}
                    {c.isVerified && <Badge label="✓ VERIFIED" color={COLORS.blue} />}
                  </div>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && <div style={{ textAlign: "center", color: COLORS.textMuted, padding: 48 }}>Aucun contact trouvé</div>}
        </div>
      </div>

      {sel && (
        <div style={{ width: 320, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 24, overflowY: "auto", flexShrink: 0 }}>
          {/* En-tête */}
          <div style={{ textAlign: "center", marginBottom: 16 }}>
            <Avatar initials={getAvatar(sel)} size={64} color={COLORS.accent} />
            <h2 style={{ margin: "12px 0 2px", color: COLORS.text, fontSize: 18, fontFamily: "'Inter', sans-serif" }}>{getFullName(sel)}</h2>
            <p style={{ margin: 0, color: COLORS.textSub, fontSize: 13 }}>{getPositionLabel(sel.position) || "—"}</p>
          </div>

          {/* Badges status */}
          <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 16, flexWrap: "wrap" }}>
            <Badge label={sel.isMainContact ? "MAIN CONTACT" : "MAIN CONTACT"} color={sel.isMainContact ? COLORS.green : COLORS.border} />
            <Badge label={sel.isAuthorizedSignatory ? "AUTHORIZED SIGNATORY" : "AUTHORIZED SIGNATORY"} color={sel.isAuthorizedSignatory ? COLORS.gold : COLORS.border} />
            <Badge label={sel.isVerified ? "✓ IS VERIFIED" : "IS VERIFIED"} color={sel.isVerified ? COLORS.blue : COLORS.border} />
          </div>

          {/* Société */}
          <div style={{ borderBottom: `1px solid ${COLORS.border}`, padding: "9px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: COLORS.textSub, fontWeight: 600 }}>COMPANY</span>
            {selCompany ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Avatar initials={selCompany.avatar} size={20} color={COLORS.accent} square />
                <span style={{ fontSize: 13, color: COLORS.blue, fontWeight: 600 }}>{selCompany.name}</span>
              </div>
            ) : <span style={{ fontSize: 13, color: COLORS.textMuted }}>—</span>}
          </div>

          {/* Tous les champs — toujours visibles */}
          {[
            { label: "FIRST NAME", value: sel.firstName },
            { label: "LAST NAME", value: sel.lastName },
            { label: "POSITION", value: getPositionLabel(sel.position) },
            { label: "EMAIL", value: sel.email },
            { label: "PHONE NUMBER", value: [sel.phoneDialCode, sel.phone].filter(Boolean).join(" ") },
            { label: "ADDITIONAL PHONE", value: [sel.phoneAltDialCode, sel.phoneAlt].filter(Boolean).join(" ") },
          ].map(row => (
            <div key={row.label} style={{ borderBottom: `1px solid ${COLORS.border}`, padding: "9px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 11, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.4 }}>{row.label}</span>
              <span style={{ fontSize: 13, color: row.value ? COLORS.text : COLORS.textMuted }}>{row.value || "—"}</span>
            </div>
          ))}

          {/* Notes */}
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 11, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.4, marginBottom: 6 }}>NOTES</div>
            <div style={{ fontSize: 12, color: sel.notes ? COLORS.textSub : COLORS.textMuted, lineHeight: 1.6, background: COLORS.bg, borderRadius: 8, padding: "8px 12px", minHeight: 40 }}>
              {sel.notes || "—"}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
            <Btn onClick={() => openEdit(sel)} style={{ flex: 1 }}>Modifier</Btn>
            <Btn onClick={() => del(sel.id)} variant="danger">Suppr.</Btn>
          </div>
        </div>
      )}

      {showForm && (
        <Modal title={editContact ? "Modifier le contact" : "Nouveau contact"} onClose={() => setShowForm(false)} wide>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {/* Identité */}
            <Input label="First Name" value={form.firstName} onChange={v => setForm({ ...form, firstName: v })} placeholder="Jean" />
            <Input label="Last Name" value={form.lastName} onChange={v => setForm({ ...form, lastName: v })} placeholder="Dupont" />

            {/* Société — autocomplete */}
            {(() => {
              const selComp = companies.find(co => co.id === Number(form.companyId));
              return (
                <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 6, position: "relative" }}>
                  <label style={{ fontSize: 12, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5 }}>COMPANY</label>
                  <div style={{ position: "relative" }}>
                    <input
                      value={form._companySearch !== undefined ? form._companySearch : (selComp?.name || "")}
                      onChange={e => setForm({ ...form, _companySearch: e.target.value, companyId: "" })}
                      onFocus={e => setForm({ ...form, _companySearch: form._companySearch !== undefined ? form._companySearch : (selComp?.name || ""), _companyOpen: true })}
                      onBlur={() => setTimeout(() => setForm(f => ({ ...f, _companyOpen: false })), 150)}
                      placeholder="Search company..."
                      style={{ width: "100%", background: COLORS.bg, border: `1px solid ${form.companyId ? COLORS.green + "80" : COLORS.border}`, borderRadius: 8, padding: "10px 14px", color: COLORS.text, fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
                    />
                    {form.companyId && <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: COLORS.green }}>✓</span>}
                  </div>
                  {form._companyOpen && (() => {
                    const q = (form._companySearch || "").toLowerCase();
                    const suggestions = companies.filter(co => co.name.toLowerCase().includes(q)).slice(0, 8);
                    if (!suggestions.length) return null;
                    return (
                      <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 200, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 8, boxShadow: "0 8px 24px #00000060", overflow: "hidden", marginTop: 2 }}>
                        {suggestions.map(co => (
                          <div key={co.id} onMouseDown={() => setForm(f => ({ ...f, companyId: co.id, _companySearch: co.name, _companyOpen: false }))}
                            style={{ padding: "10px 14px", cursor: "pointer", fontSize: 13, color: COLORS.text, display: "flex", alignItems: "center", gap: 10, borderBottom: `1px solid ${COLORS.border}` }}
                            onMouseOver={e => e.currentTarget.style.background = COLORS.hover}
                            onMouseOut={e => e.currentTarget.style.background = "transparent"}>
                            <Avatar initials={co.avatar} size={24} color={COLORS.accent} square />
                            <div>
                              <div style={{ fontWeight: 600 }}>{co.name}</div>
                              {co.country && <div style={{ fontSize: 11, color: COLORS.textSub }}>{co.country}</div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              );
            })()}

            {/* Position */}
            <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 12, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5 }}>POSITION</label>
              <select value={form.position} onChange={e => setForm({ ...form, position: e.target.value })}
                style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "10px 14px", color: COLORS.text, fontSize: 14, fontFamily: "inherit", outline: "none" }}>
                <option value="">— Select position —</option>
                {(config.contactPositions || []).map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>

            {/* Contact */}
            <PhoneField label="Phone Number" dialCode={form.phoneDialCode || ""} onDialChange={v => setForm({ ...form, phoneDialCode: v })} phone={form.phone || ""} onPhoneChange={v => setForm({ ...form, phone: v })} />
            <PhoneField label="Additional Phone Number" dialCode={form.phoneAltDialCode || ""} onDialChange={v => setForm({ ...form, phoneAltDialCode: v })} phone={form.phoneAlt || ""} onPhoneChange={v => setForm({ ...form, phoneAlt: v })} />
            <div style={{ gridColumn: "1 / -1" }}>
              <Input label="Email" type="email" value={form.email} onChange={v => setForm({ ...form, email: v })} placeholder="jean.dupont@acme.fr" />
            </div>

            {/* Toggles */}
            <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 8 }}>
              <label style={{ fontSize: 12, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5 }}>STATUS</label>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <ToggleBtn label="MAIN CONTACT" value={form.isMainContact} onChange={v => setForm({ ...form, isMainContact: v })} color={COLORS.green} />
                <ToggleBtn label="AUTHORIZED SIGNATORY" value={form.isAuthorizedSignatory} onChange={v => setForm({ ...form, isAuthorizedSignatory: v })} color={COLORS.gold} />
                <ToggleBtn label="IS VERIFIED" value={form.isVerified} onChange={v => setForm({ ...form, isVerified: v })} color={COLORS.blue} />
              </div>
            </div>

            {/* Notes */}
            <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 12, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5 }}>NOTES</label>
              <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3}
                style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "10px 14px", color: COLORS.text, fontSize: 14, resize: "vertical", fontFamily: "inherit", outline: "none", width: "100%", boxSizing: "border-box" }} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 22, justifyContent: "flex-end" }}>
            <Btn variant="secondary" onClick={() => setShowForm(false)}>Annuler</Btn>
            <Btn onClick={save}>Enregistrer</Btn>
          </div>
        </Modal>
      )}
      {showImport && <ExcelImportModal type="contacts" onClose={() => setShowImport(false)} onImport={(items) => {
  setContacts(prev => {
    const ex = new Set(prev.map(c => c.email?.toLowerCase()).filter(Boolean));
    const next = [...prev, ...items.filter(i => !i.email || !ex.has(i.email?.toLowerCase()))];
    saveLargeTable('contacts', next);
    return next;
  });
}} />}
    </div>
  );
};

// ─── TASKS ────────────────────────────────────────────────────
const Tasks = ({ tasks, setTasks, contacts, companies }) => {
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState("all");
  const [form, setForm] = useState({ title: "", contactId: "", due: "", priority: "moyenne" });

  const filtered = tasks.filter(t => filter === "all" ? true : filter === "done" ? t.done : !t.done).sort((a, b) => new Date(a.due) - new Date(b.due));
  const toggle = (id) => setTasks(tasks.map(t => t.id === id ? { ...t, done: !t.done } : t));
  const del = (id) => setTasks(tasks.filter(t => t.id !== id));
  const save = () => { setTasks([...tasks, { ...form, id: Date.now(), contactId: Number(form.contactId), done: false }]); setShowForm(false); setForm({ title: "", contactId: "", due: "", priority: "moyenne" }); };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, color: COLORS.text, fontFamily: "'Inter', sans-serif" }}>Tâches</h1>
          <p style={{ margin: "4px 0 0", color: COLORS.textSub, fontSize: 13 }}>{tasks.filter(t => !t.done).length} tâches en attente</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {["all", "todo", "done"].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{ background: filter === f ? COLORS.accent : "transparent", border: `1px solid ${filter === f ? COLORS.accent : COLORS.border}`, color: filter === f ? "#fff" : COLORS.textSub, padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontFamily: "inherit" }}>
              {{ all: "Toutes", todo: "À faire", done: "Faites" }[f]}
            </button>
          ))}
          <Btn onClick={() => setShowForm(true)}>+ Nouvelle</Btn>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.map(t => {
          const contact = contacts.find(c => c.id === t.contactId);
          const company = contact ? companies.find(co => co.id === contact.companyId) : null;
          const overdue = !t.done && new Date(t.due) < new Date();
          return (
            <div key={t.id} style={{ background: COLORS.card, border: `1px solid ${overdue ? COLORS.red + "50" : COLORS.border}`, borderRadius: 12, padding: "16px 20px", display: "flex", alignItems: "center", gap: 16, opacity: t.done ? 0.5 : 1 }}>
              <div onClick={() => toggle(t.id)} style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${t.done ? COLORS.green : COLORS.border}`, background: t.done ? COLORS.green : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {t.done && <span style={{ color: "#fff", fontSize: 13 }}>✓</span>}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, color: COLORS.text, fontSize: 15, textDecoration: t.done ? "line-through" : "none" }}>{t.title}</div>
                {contact && <div style={{ fontSize: 12, color: COLORS.textSub, marginTop: 2 }}>{contact.name}{company ? <span style={{ color: COLORS.blue }}> · {company.name}</span> : ""}</div>}
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <Badge label={PRIORITY_CONFIG[t.priority]?.label} color={PRIORITY_CONFIG[t.priority]?.color} />
                <span style={{ fontSize: 12, color: overdue ? COLORS.red : COLORS.textMuted, fontFamily: "'DM Mono', monospace" }}>{overdue ? "⚠ " : ""}{t.due}</span>
                <button onClick={() => del(t.id)} style={{ background: "none", border: "none", color: COLORS.textMuted, cursor: "pointer", fontSize: 16 }}>×</button>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && <div style={{ textAlign: "center", color: COLORS.textMuted, padding: 48 }}>Aucune tâche</div>}
      </div>
      {showForm && (
        <Modal title="Nouvelle tâche" onClose={() => setShowForm(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Input label="Titre" value={form.title} onChange={v => setForm({ ...form, title: v })} placeholder="Ex: Appel de suivi" />
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 12, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5 }}>CONTACT</label>
              <select value={form.contactId} onChange={e => setForm({ ...form, contactId: e.target.value })} style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "10px 14px", color: COLORS.text, fontSize: 14, fontFamily: "inherit", outline: "none" }}>
                <option value="">— Choisir un contact —</option>
                {contacts.map(c => { const co = companies.find(co => co.id === c.companyId); return <option key={c.id} value={c.id}>{c.name}{co ? ` (${co.name})` : ""}</option>; })}
              </select>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <Input label="Échéance" type="date" value={form.due} onChange={v => setForm({ ...form, due: v })} />
              <SelectField label="Priorité" value={form.priority} onChange={v => setForm({ ...form, priority: v })} options={Object.entries(PRIORITY_CONFIG).map(([k, v]) => ({ value: k, label: v.label }))} />
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <Btn variant="secondary" onClick={() => setShowForm(false)}>Annuler</Btn>
              <Btn onClick={save}>Créer</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

// ─── COMPANIES DASHBOARD ──────────────────────────────────────

// ─── DERIVATIVES ─────────────────────────────────────────────────────────────
const MultiToggle = ({ label, options, values, onChange }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 6, gridColumn: "1 / -1" }}>
    <label style={{ fontSize: 11, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5 }}>
      {label}
      {values.length > 0 && <span style={{ marginLeft: 8, fontSize: 10, color: COLORS.accent, fontWeight: 400 }}>{values.length} sélectionné{values.length > 1 ? "s" : ""}</span>}
    </label>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {options.map(o => {
        const active = values.includes(o.value);
        return (
          <div key={o.value} onClick={() => onChange(active ? values.filter(v => v !== o.value) : [...values, o.value])}
            style={{ padding: "5px 12px", borderRadius: 7, cursor: "pointer", fontSize: 12, fontWeight: active ? 700 : 500, transition: "all 0.15s", border: `1.5px solid ${active ? COLORS.accent : COLORS.border}`, background: active ? `${COLORS.accent}18` : COLORS.bg, color: active ? COLORS.accent : COLORS.textSub, userSelect: "none" }}>
            {o.label}
          </div>
        );
      })}
    </div>
  </div>
);

const Derivatives = ({ companies }) => {
  const { config } = useConfig();
  const [products, setProducts] = useState([]);

useEffect(() => {
  async function loadProducts() {
    const { data } = await supabase.from('deriv_products').select('data');
    if (data?.length) setProducts(data.map(r => r.data));
  }
  loadProducts();
}, []);

const [derivAccounts, setDerivAccounts] = useState([]);

useEffect(() => {
  async function loadDerivAccounts() {
    const { data } = await supabase.from('deriv_accounts').select('*');
    if (data?.length) setDerivAccounts(data.map(r => {
      const acc = r.data ?? r;
      if (typeof acc.isActive === "string") {
        acc.isActive = acc.isActive.trim().toLowerCase() !== "false" && acc.isActive.trim() !== "0";
      }
      return acc;
    }));
  }
  loadDerivAccounts();
}, []);

const [lotSizes, setLotSizes] = useState([]);

useEffect(() => {
  async function loadLotSizes() {
    const { data } = await supabase.from('deriv_lot_sizes').select('data');
    if (data?.length) setLotSizes(data.map(r => r.data));
  }
  loadLotSizes();
}, []);
  const [exchangeTarifs, setExchangeTarifs] = useState([]);

useEffect(() => {
  async function loadExchangeTarifs() {
    const { data } = await supabase.from('deriv_exchange_tarifs').select('data');
    if (data?.length) setExchangeTarifs(data.map(r => r.data));
  }
  loadExchangeTarifs();
}, []);

  const CURRENCY_SYMBOLS = { EUR: "€", USD: "$", GBP: "£", MAD: "MAD", UAH: "₴", CHF: "CHF" };

  const computeFees = (op, tarifs) => {
    try {
      if (!tarifs || tarifs.length === 0 || !op) return "";
      const norm = v => (v || "").toString().toLowerCase().trim();
      const opBroker = norm(op.broker);
      // Resolve exchange from product if not set on the operation
      const resolvedExchange = products.find(p => norm(p.label) === norm(op.instrument))?.stoxxExchange || op.exchange || "";
      const opExchange = norm(resolvedExchange);
      const opTrans = norm(op.orderTransmissionType);
      const opOpType = norm(op.opType);

      const matching = tarifs.filter(t => {
        if (!t.isActive) return false;
        const brokers = Array.isArray(t.financialBroker) ? t.financialBroker : [t.financialBroker];
        const transmissions = Array.isArray(t.orderTransmissionType) ? t.orderTransmissionType : [t.orderTransmissionType];
        const opTypes = Array.isArray(t.opType) ? t.opType : (t.opType ? [t.opType] : []);
        const brokerMatch = brokers.some(b => norm(b) === opBroker || norm(b).includes(opBroker) || opBroker.includes(norm(b)));
        const exchangeMatch = norm(t.exchange) === opExchange || norm(t.exchange).includes(opExchange) || opExchange.includes(norm(t.exchange));
        const transMatch = opTrans === "" || transmissions.some(tr => norm(tr) === opTrans);
        // If the tarif has no opType defined, it applies to all operation types
        const opTypeMatch = opTypes.length === 0 || opOpType === "" || opTypes.some(ot => norm(ot) === opOpType);
        return brokerMatch && exchangeMatch && transMatch && opTypeMatch;
      });

      if (matching.length === 0) return "";
      const total = matching.reduce((sum, t) => sum + (parseFloat(t.tarif) || 0), 0);
      const lots = parseFloat(op.quantity) || 1;
      return Math.round(total * lots);
    } catch { return ""; }
  };

  const INSTRUMENT_TYPES = ["Future", "Option"];
  const SIDES = ["BUY", "SELL"];
  const OP_TYPES = ["Hedging", "Rolling", "Trade"];
  const UNDERLYINGS = ["Wheat", "Corn", "Soybean", "Rapeseed", "Sunflower", "Cotton", "Sugar", "Coffee", "Cocoa", "Palm Oil", "Rice", "Barley"];
  const STATUSES = [
    { value: "pending", label: "PENDING", color: COLORS.orange },
    { value: "traded", label: "TRADED",  color: COLORS.green  },
  ];
  const OPTION_TYPES = ["Call", "Put"];
  const CURRENCIES = ["USD", "EUR", "GBP", "CHF", "JPY"];
  const UNITS = ["MT", "Lots", "Bushels", "BBL", "KG"];

  const genRef = () => `DRV-${Date.now().toString(36).toUpperCase().slice(-6)}`;

  const makeEmpty = () => {
    const instrDefault = config.derivInstrumentTypeDefault;
    const instrItem = (config.derivInstrumentTypes || []).find(t => t.value === instrDefault || t.label === instrDefault);
    const instrVal = instrItem?.label || (config.derivInstrumentTypes?.[0]?.label) || "Future";

    const opDefault = config.derivOpTypeDefault;
    const opItem = (config.derivOpTypes || []).find(t => t.value === opDefault || t.label === opDefault);
    const opVal = opItem?.label || (config.derivOpTypes?.[0]?.label) || "Trade";

    const transDefault = config.derivOrderTransmissionDefault;
    const transItem = (config.derivOrderTransmissionTypes || []).find(t => t.value === transDefault || t.label === transDefault);
    const transVal = transItem?.value || transDefault || "";

    return {
      id: null, ref: "", type: instrVal, opType: opVal, instrument: "",
      side: "BUY", quantity: "", price: "",
      strike: "", optionType: "Call",
      tradeDate: new Date().toISOString().slice(0, 10), expiryDate: "",
      businessUnit: config.derivBusinessUnitDefault || "", broker: config.derivDefaultBroker || "", exchange: "", account: "",
      contract: "", trade: "", lotSize: "", orderTransmissionType: transVal, fees: "",
      status: (() => { const def = config.derivOpStatusDefault; const found = (config.derivOpStatuses || []).find(s => s.value === def); return found ? found.label.toUpperCase() : (config.derivOpStatuses?.[0]?.label?.toUpperCase() || "TRADED"); })(), notes: "", internalDeal: false,
    };
  };

  const [ops, setOpsRaw] = useState([]);

useEffect(() => {
  async function loadOps() {
    const PAGE = 1000;
    let all = [];
    let from = 0;
    while (true) {
      const { data, error } = await supabase.from('derivatives').select('data').order('id', { ascending: true }).range(from, from + PAGE - 1);
      if (error || !data || data.length === 0) break;
      all = [...all, ...data.map(r => r.data ?? r)];
      if (data.length < PAGE) break;
      from += PAGE;
    }
    if (all.length) setOpsRaw(all);
  }
  loadOps();
}, []);

// ── Save ALL derivatives (import only) ─────────────────────
const saveAllDerivatives = async (items, setOpsRaw, onComplete) => {
  if (!items || items.length === 0) return;
  // Use same approach as saveLargeTable (proven to work for companies/contacts)
  try {
    await supabase.from('derivatives').delete().neq('id', 0);
    const CHUNK = 50;
    for (let i = 0; i < items.length; i += CHUNK) {
      const chunk = items.slice(i, i + CHUNK).map(item => ({ data: item }));
      const { error } = await supabase.from('derivatives').insert(chunk);
      if (error) console.error(`[saveAllDerivatives] chunk error:`, error);
    }
  } catch (err) {
    console.error('[saveAllDerivatives] error:', err);
  }
  // Wait for Supabase to fully persist, then reload
  if (onComplete) onComplete(items.length);
};

// ── Save a single op (create/update) ───────────────────────
const saveOneDerivative = async (op) => {
  // Targeted save: delete by id then reinsert
  await supabase.from('derivatives').delete().eq('data->>id', String(op.id));
  await supabase.from('derivatives').insert({ data: op });
};

// ── Delete a single op ─────────────────────────────────────
const deleteOneDerivative = async (id) => {
  await supabase.from('derivatives').delete().eq('data->>id', String(id));
};

const reloadOps = async () => {
  setIsReloading(true);
  const PAGE = 1000;
  let all = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase.from('derivatives').select('data').order('id', { ascending: true }).range(from, from + PAGE - 1);
    if (error || !data || data.length === 0) break;
    all = [...all, ...data.map(r => r.data ?? r)];
    if (data.length < PAGE) break;
    from += PAGE;
  }
  if (all.length) setOpsRaw(all);
  setIsReloading(false);
};

const setOps = async (val) => {
  const next = typeof val === "function" ? val(ops) : val;
  setOpsRaw(next);
};
  const [showForm, setShowForm]   = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [isReloading, setIsReloading] = useState(false);
  const [editOp, setEditOp]       = useState(null);
  const [form, setForm]         = useState(makeEmpty());
  const [selected, setSelected] = useState(null);
  const [search, setSearch]     = useState("");
  const [accountSearch, setAccountSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo]     = useState("");
  const [editingFeesId, setEditingFeesId] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filterMode, setFilterMode]   = useState("AND");
  const EMPTY_FILTERS = { type: [], opType: [], side: [], status: [], businessUnit: [], internalDeal: [], exchange: [], underlying: [], financingBank: [] };
  const [activeFilters, setActiveFilters] = useState(EMPTY_FILTERS);
  const [customFilters, setCustomFilters] = useState([]);
  const [filterSearch, setFilterSearch]   = useState("");
  const [filterSuggestions, setFilterSuggestions] = useState([]);

  const DERIV_CUSTOM_FIELDS = [
    { key: "ref",        label: "Reference",    type: "text" },
    { key: "instrument", label: "Instrument",   type: "text" },
    { key: "broker",     label: "Broker",       type: "text" },
    { key: "exchange",   label: "Exchange",     type: "text" },
    { key: "account",    label: "Account",      type: "text" },
    { key: "contract",   label: "Contract",     type: "text" },
    { key: "trade",      label: "Trade",        type: "text" },
    { key: "price",      label: "Price",        type: "number" },
    { key: "quantity",   label: "Lots",         type: "number" },
    { key: "tradeDate",  label: "Trade Date",   type: "date" },
    { key: "expiryDate", label: "Expiry Date",  type: "date" },
    { key: "notes",      label: "Notes",        type: "text" },
  ];

  const [formErrors, setFormErrors] = useState({});

  const openNew  = () => { setForm({ ...makeEmpty(), ref: genRef() }); setEditOp(null); setFormErrors({}); setShowForm(true); };
  const openEdit = (op) => { setForm({ ...op, _isEdit: true }); setEditOp(op); setFormErrors({}); setShowForm(true); };
  const del      = (id) => { setOpsRaw(ops.filter(o => o.id !== id)); deleteOneDerivative(id); setSelected(null); };

  const REQUIRED_FIELDS = [
    { key: "businessUnit", label: "Business Unit" },
    { key: "type",         label: "Instrument Type" },
    { key: "opType",       label: "Operation Type" },
    { key: "quantity",     label: "Number of Lots" },
    { key: "price",        label: "Price" },
    { key: "tradeDate",    label: "Trade Date" },
    { key: "instrument",   label: "Instrument" },
    { key: "account",      label: "Account" },
    { key: "side",         label: "Side" },
    { key: "broker",       label: "Broker" },
  ];

  const save = async () => {
    const errors = {};
    // Validate ref
    if (!form.ref?.trim()) {
      errors.ref = "Référence est obligatoire";
    } else if (ops.some(o => o.ref?.toLowerCase() === form.ref.trim().toLowerCase() && o.id !== (editOp?.id))) {
      errors.ref = "Cette référence est déjà utilisée";
    }
    REQUIRED_FIELDS.forEach(({ key, label }) => {
      const val = form[key];
      const isEmpty = val === null || val === undefined || val === "" || (Array.isArray(val) && val.length === 0);
      if (isEmpty) errors[key] = `${label} est obligatoire`;
    });
    // Validate price against tick size
    if (!errors.price && form.price && form.instrument) {
      const prod = products.find(p => p.label === form.instrument);
      const fmt = prod?.decimals || "decimal";
      const tick = prod?.tickSize || "";
      if (tick && !fmt.includes("/")) {
        const tickVal = parseFloat(tick);
        const priceStr = String(form.price).replace(/,/g, ".");
        const priceVal = parseFloat(priceStr);
        if (!isNaN(tickVal) && tickVal > 0 && !isNaN(priceVal)) {
          const tickDecimals = tick.includes(".") ? tick.split(".")[1].length : 0;
          // Count decimals in price
          const priceDecimals = priceStr.includes(".") ? priceStr.split(".")[1].length : 0;
          // If price has more decimals than tick, it's invalid
          const invalid = priceDecimals > tickDecimals ||
            (tickDecimals > 0 && (() => {
              // Also check that the value at tick precision is a multiple of tick
              const factor = Math.pow(10, tickDecimals);
              const priceInt = Math.round(priceVal * factor);
              const tickInt  = Math.round(tickVal * factor);
              return tickInt > 0 && priceInt % tickInt !== 0;
            })());
          if (invalid) {
            errors.price = `Prix invalide — le tick minimum est ${tick} (ex: ${(Math.floor(priceVal / tickVal) * tickVal).toFixed(tickDecimals)})`;
          }
        }
      } else if (tick && fmt.includes("/") && form.price.includes(" ")) {
        // Fraction tick validation
        const [tickNum, tickDen] = tick.split("/").map(Number);
        const [, fracStr] = form.price.split(" ");
        if (fracStr) {
          const [fracNum] = fracStr.split("/").map(Number);
          if (fracNum % tickNum !== 0) {
            errors.price = `Prix invalide — le tick minimum est ${tick}`;
          }
        }
      }
    }
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setFormErrors({});
    const norm = v => (v || "").toString().toLowerCase().trim();
    const resolvedExchange = products.find(p => norm(p.label) === norm(form.instrument))?.stoxxExchange || form.exchange || "";
    const data = { ...form, price: String(form.price).replace(/,/g, "."), exchange: resolvedExchange, id: editOp ? editOp.id : Date.now() };
    if (editOp) { setOpsRaw(ops.map(o => o.id === editOp.id ? data : o)); await saveOneDerivative(data); }
    else        { setOpsRaw([...ops, data]); await saveOneDerivative(data); }
    setShowForm(false);
    setSelected(data.id);
  };

  const filtered = useMemo(() => {
    const norm = v => (v || "").toString().toLowerCase().trim().replace(/[_\s-]/g, "");
    const resolveProduct = (instrument) => {
      if (!instrument) return null;
      const n = norm(instrument);
      return products.find(p => norm(p.label) === n || norm(p.value) === n)
          || products.find(p => { const pl = norm(p.label); return pl.length >= 4 && n.startsWith(pl) && (n.length === pl.length || !/[a-z0-9]/.test(n[pl.length] || "")); });
    };
    const commodities = config.derivCommodities || [];
    const resolveUnderlying = (raw) => {
      if (!raw) return null;
      const match = commodities.find(c => norm(c.value) === norm(raw) || norm(c.label) === norm(raw));
      return match ? match.value : raw;
    };
    const exchFilter = activeFilters.exchange;
    const typeFilter = activeFilters.type;
    const opTypeFilter = activeFilters.opType;
    const sideFilter = activeFilters.side;
    const statusFilter = activeFilters.status;
    const buFilter = activeFilters.businessUnit;
    const dealFilter = activeFilters.internalDeal;
    const underFilter = activeFilters.underlying;
    const bankFilter = activeFilters.financingBank;
    return ops.filter(o => {
      const q = search.toLowerCase();
      const ms = !q || o.ref?.toLowerCase().includes(q) || o.instrument?.toLowerCase().includes(q) || o.broker?.toLowerCase().includes(q) || o.exchange?.toLowerCase().includes(q) || o.contract?.toLowerCase().includes(q) || o.notes?.toLowerCase().includes(q);
      if (!ms) return false;
      const aq = accountSearch.toLowerCase().trim();
      if (aq && (!o.account || o.account.toLowerCase() !== aq)) return false;
      if (dateFrom && (o.tradeDate || "") < dateFrom) return false;
      if (dateTo   && (o.tradeDate || "") > dateTo)   return false;
      const accRecord = derivAccounts.find(a => a.accountNumber === o.account);
      const opFinancingBank = accRecord?.financingBank || "";
      const product = resolveProduct(o.instrument);
      const opUnderlying = resolveUnderlying(product?.underlying || "");
      // Exchange — always AND
      if (exchFilter.length > 0 && !exchFilter.some(ex => norm(o.exchange) === norm(ex))) return false;
      // Tag filters
      if (typeFilter.length > 0   && !typeFilter.includes(o.type)) return false;
      if (sideFilter.length > 0   && !sideFilter.includes(o.side)) return false;
      if (dealFilter.length > 0   && !dealFilter.includes(String(o.internalDeal))) return false;
      if (buFilter.length > 0     && !buFilter.includes(o.businessUnit)) return false;
      if (opTypeFilter.length > 0 && !opTypeFilter.includes(o.opType)) return false;
      if (statusFilter.length > 0 && !statusFilter.includes(o.status) && !statusFilter.some(s => o.status?.toLowerCase() === s?.toLowerCase())) return false;
      if (underFilter.length > 0  && !underFilter.some(u => norm(opUnderlying) === norm(u))) return false;
      if (bankFilter.length > 0   && !bankFilter.some(fb => norm(opFinancingBank) === norm(fb))) return false;
      // Custom filters
      for (const cf of customFilters) {
        const val = o[cf.key];
        if (cf.op === "empty"    && (val && String(val).trim() !== "")) return false;
        if (cf.op === "notempty" && (!val || String(val).trim() === "")) return false;
        if (cf.value !== undefined && cf.value !== null && cf.value !== "") {
          if (cf.op === "eq"       && String(val || "").toLowerCase() !== String(cf.value || "").toLowerCase()) return false;
          if (cf.op === "gt"       && !(Number(val) > Number(cf.value))) return false;
          if (cf.op === "lt"       && !(Number(val) < Number(cf.value))) return false;
          if (cf.op === "contains" && !String(val || "").toLowerCase().includes(String(cf.value).toLowerCase())) return false;
        }
      }
      return true;
    }).sort((a, b) => {
      const dateDiff = (b.tradeDate || "").localeCompare(a.tradeDate || "");
      if (dateDiff !== 0) return dateDiff;
      return (b.id || 0) - (a.id || 0);
    });
  }, [ops, search, accountSearch, dateFrom, dateTo,
      activeFilters.exchange, activeFilters.type, activeFilters.opType, activeFilters.side,
      activeFilters.status, activeFilters.businessUnit, activeFilters.internalDeal,
      activeFilters.underlying, activeFilters.financingBank,
      customFilters, filterMode, derivAccounts, products, config]);

  const sel = ops.find(o => o.id === selected);

  // ── Format price for display based on instrument decimals config ──
  const formatPrice = (price, instrument) => {
    if (!price && price !== 0) return "—";
    const prod = products.find(p => p.label === instrument);
    const fmt = prod?.decimals || "decimal";
    // Fraction format: e.g. "1/8"
    if (fmt.includes("/")) {
      const den = parseInt(fmt.split("/")[1] || "8");
      // If already stored as fraction string "201 4/8", display as-is
      if (typeof price === "string" && price.includes(" ") && price.includes("/")) {
        return price;
      }
      const num = parseFloat(price);
      if (isNaN(num)) return String(price);
      const intPart = Math.floor(num);
      const fracDecimal = num - intPart;
      const fracNum = Math.round(fracDecimal * den);
      if (fracNum === 0) return String(intPart);
      if (fracNum === den) return String(intPart + 1);
      return `${intPart} ${fracNum}/${den}`;
    }
    // decimal1/2/3 format
    const dpMatch = fmt.match(/^decimal(\d)$/);
    if (dpMatch) {
      const dp = parseInt(dpMatch[1]);
      // Handle fraction string stored as "201 4/8" in non-fraction mode (fallback)
      if (typeof price === "string" && price.includes(" ")) {
        const [intStr, fracStr] = price.split(" ");
        if (fracStr && fracStr.includes("/")) {
          const [fn, fd] = fracStr.split("/").map(Number);
          const num = parseInt(intStr) + fn / fd;
          return parseFloat(num.toFixed(dp)).toString();
        }
      }
      const num = parseFloat(price);
      if (isNaN(num)) return String(price);
      return parseFloat(num.toFixed(dp)).toString();
    }
    // decimal or unknown: show as-is
    return String(price);
  };

  const getStatusCfg = (v) => (config.derivOpStatuses || []).find(s => s.value === v || s.label.toLowerCase() === v?.toLowerCase()) || { label: v || "—", color: COLORS.textSub };

  const pendingCount = ops.filter(o => o.status === "pending").length;
  const tradedCount  = ops.filter(o => o.status === "traded").length;
  const totalNominal = ops.filter(o => o.quantity && o.price).reduce((s, o) => s + Number(o.quantity) * Number(o.price), 0);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") {
        if (showFilters) setShowFilters(false);
        else setSelected(null);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [showFilters]);

  const ToggleGroup = ({ label, options, value, onChange, colorFn, labelFn }) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 11, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5 }}>{label}</label>
      <div style={{ display: "flex", gap: 6 }}>
        {options.map(o => {
          const col = colorFn ? colorFn(o) : COLORS.accent;
          const active = value === o;
          return (
            <div key={o} onClick={() => onChange(o)} style={{ flex: 1, textAlign: "center", padding: "10px 6px", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 12, transition: "all 0.15s", border: `1.5px solid ${active ? col : COLORS.border}`, background: active ? `${col}18` : COLORS.bg, color: active ? col : COLORS.textSub }}>
              {labelFn ? labelFn(o) : o}
            </div>
          );
        })}
      </div>
    </div>
  );

  // Colonnes tableau : REF · TYPE · OP TYPE · SIDE · UNDERLYING · QTY · PRICE · TRADE DATE · EXPIRY · BROKER · EXCHANGE · ACCOUNT · STATUS
  const COLS = "90px 70px 80px 55px 220px 90px 80px 80px 100px 90px 110px 110px 110px 90px 60px 90px 1fr";
  const HEADERS = ["REF", "TYPE", "OP TYPE", "SIDE", "INSTRUMENT", "LOTS", "PRICE", "BU", "TRADE DATE", "EXPIRY DATE", "BROKER", "EXCHANGE", "ACCOUNT", "STATUS", "INT.", "FEES", "NOTES"];

  return (
    <div style={{ display: "flex", gap: 24, height: "calc(100vh - 130px)", width: "100%" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h1 style={{ margin: 0, fontSize: 28, color: COLORS.text, fontFamily: "'Inter', sans-serif", fontWeight: 700 }}>Derivatives</h1>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {ops.length > 0 && (
              <button onClick={async () => {
                if (window.confirm(`⚠️ Supprimer les ${ops.length} opérations ? Cette action est irréversible.`)) {
                  await supabase.from('derivatives').delete().neq('id', 0);
                  setOpsRaw([]);
                  setSelected(null);
                }
              }} style={{ background: `${COLORS.red}15`, color: COLORS.red, border: `1px solid ${COLORS.red}40`, borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "inherit", padding: "10px 14px", letterSpacing: 0.3 }}>
                🗑 Effacer tout ({ops.length})
              </button>
            )}
            {(() => {
              const [xlOpen, setXlOpen] = useState(false);
              const ref = useRef(null);
              useEffect(() => {
                if (!xlOpen) return;
                const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setXlOpen(false); };
                document.addEventListener("mousedown", handler);
                return () => document.removeEventListener("mousedown", handler);
              }, [xlOpen]);
              return (
                <div ref={ref} style={{ position: "relative" }}>
                  <div onClick={() => setXlOpen(o => !o)}
                    style={{ cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: "10px 14px", borderRadius: 8, border: `1px solid ${xlOpen ? COLORS.accent + "80" : COLORS.border}`, background: xlOpen ? `${COLORS.accent}10` : "transparent", transition: "all 0.15s" }}>
                    <img src="/logoxl.png" style={{ width: 28, height: 28, objectFit: "contain" }} />
                  </div>
                  {xlOpen && (
                    <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 200, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10, overflow: "hidden", boxShadow: "0 8px 24px #00000060", minWidth: 150 }}>
                      <div onClick={() => { setXlOpen(false); setShowImport(true); }}
                        style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 16px", cursor: "pointer", color: COLORS.text, fontSize: 13, fontWeight: 600 }}
                        onMouseOver={e => e.currentTarget.style.background = COLORS.hover}
                        onMouseOut={e => e.currentTarget.style.background = "transparent"}>
                        <span style={{ fontSize: 16 }}>⬆</span> IMPORT
                      </div>
                      <div style={{ height: 1, background: COLORS.border }} />
                      <div onClick={() => { setXlOpen(false); setShowExport(true); }}
                        style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 16px", cursor: "pointer", color: COLORS.text, fontSize: 13, fontWeight: 600 }}
                        onMouseOver={e => e.currentTarget.style.background = COLORS.hover}
                        onMouseOut={e => e.currentTarget.style.background = "transparent"}>
                        <span style={{ fontSize: 16 }}>⬇</span> EXPORT
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
            <button onClick={reloadOps} disabled={isReloading} title="Recharger depuis Supabase"
              style={{ background: "transparent", border: `1px solid ${COLORS.border}`, borderRadius: 8, cursor: isReloading ? "wait" : "pointer", fontSize: 18, padding: "10px 14px", color: isReloading ? COLORS.textMuted : COLORS.textSub, transition: "color 0.2s" }}>
              {isReloading ? "⟳" : "↺"}
            </button>
            <button onClick={openNew} style={{ background: COLORS.accent, color: COLORS.textOnAccent, border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "inherit", padding: "10px 20px", letterSpacing: 0.5 }}>+ NEW OPERATION</button>
          </div>
        </div>

        {/* KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 20 }}>
          {[
            ...(config.derivOpStatuses || []).map(s => ({
              label: s.label.toUpperCase(),
              value: ops.filter(o => o.status === s.value || o.status?.toLowerCase() === s.label.toLowerCase()).length,
              color: s.color,
              icon: "◎"
            })),
            { label: "TOTAL NOMINAL", value: totalNominal ? `$${totalNominal.toLocaleString()}` : "—", color: COLORS.accent, icon: "◈" },
          ].map(k => (
            <div key={k.label} style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: "16px 20px" }}>
              <div style={{ fontSize: 11, color: COLORS.textMuted, fontWeight: 600, letterSpacing: 0.8, marginBottom: 8 }}>{k.icon} {k.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.value}</div>
            </div>
          ))}
        </div>

        {/* Barre recherche + filtres */}
        <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center" }}>
          <input placeholder="Search by ref, instrument, broker, notes…" value={search} onChange={e => setSearch(e.target.value)}
            style={{ flex: 1, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "10px 16px", color: COLORS.text, fontSize: 14, outline: "none", fontFamily: "inherit" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: COLORS.card, border: `1px solid ${(dateFrom || dateTo) ? COLORS.accent + "80" : COLORS.border}`, borderRadius: 10, padding: "6px 12px", transition: "border-color 0.2s" }}>
            <span style={{ fontSize: 11, color: COLORS.textMuted, fontWeight: 600, whiteSpace: "nowrap" }}>DATE</span>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              style={{ background: "transparent", border: "none", color: dateFrom ? COLORS.text : COLORS.textMuted, fontSize: 13, outline: "none", fontFamily: "inherit", cursor: "pointer" }} />
            <span style={{ color: COLORS.textMuted, fontSize: 12 }}>→</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              style={{ background: "transparent", border: "none", color: dateTo ? COLORS.text : COLORS.textMuted, fontSize: 13, outline: "none", fontFamily: "inherit", cursor: "pointer" }} />
            {(dateFrom || dateTo) && <span onClick={() => { setDateFrom(""); setDateTo(""); }} style={{ cursor: "pointer", color: COLORS.textMuted, fontSize: 14, lineHeight: 1 }}>✕</span>}
          </div>
          <input placeholder="Account…" value={accountSearch} onChange={e => setAccountSearch(e.target.value)}
            style={{ width: 160, background: COLORS.card, border: `1px solid ${accountSearch ? COLORS.accent + "80" : COLORS.border}`, borderRadius: 10, padding: "10px 16px", color: COLORS.text, fontSize: 14, outline: "none", fontFamily: "inherit", transition: "border-color 0.2s" }} />
          <div style={{ position: "relative" }}>
            <Btn variant="secondary" onClick={() => setShowFilters(v => !v)}>
              ▼ FILTER {(Object.values(activeFilters).flat().length + customFilters.length) > 0 && <span style={{ background: COLORS.accent, color: "#fff", borderRadius: 10, fontSize: 11, padding: "1px 7px", marginLeft: 6 }}>{Object.values(activeFilters).flat().length + customFilters.length}</span>}
            </Btn>
            {showFilters && (
              <div style={{ position: "absolute", top: "110%", right: 0, zIndex: 100, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 16, paddingBottom: 24, minWidth: 320, boxShadow: "0 8px 32px #0006", maxHeight: "70vh", overflowY: "auto" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.text }}>Filtres</span>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <span style={{ fontSize: 11, color: COLORS.textSub }}>Mode :</span>
                    {["AND", "OR"].map(m => (
                      <span key={m} onClick={() => setFilterMode(m)} style={{ cursor: "pointer", fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 8, background: filterMode === m ? COLORS.accent : COLORS.bg, color: filterMode === m ? "#fff" : COLORS.textSub, border: `1px solid ${filterMode === m ? COLORS.accent : COLORS.border}` }}>{m}</span>
                    ))}
                    <span onClick={() => { setActiveFilters(EMPTY_FILTERS); setCustomFilters([]); }} style={{ cursor: "pointer", fontSize: 11, color: COLORS.textMuted, marginLeft: 6 }}>✕ Reset</span>
                  </div>
                </div>
                {[
                  { key: "type",         label: "Instrument Type", items: (config.derivInstrumentTypes || []).map(t => ({ value: t.label, label: t.label, color: COLORS.blue })) },
                  { key: "opType",       label: "Operation Type",  items: (config.derivOpTypes || []).map(t => ({ value: t.label, label: t.label, color: COLORS.accent })) },
                  { key: "side",         label: "Side",            items: [{ value: "BUY", label: "BUY", color: COLORS.green }, { value: "SELL", label: "SELL", color: COLORS.red }] },
                  { key: "status",       label: "Status",          items: (config.derivOpStatuses || []).map(s => ({ value: s.value, label: s.label, color: s.color })) },
                  { key: "businessUnit", label: "Business Unit",   items: (config.derivBusinessUnits || []).map(v => { const bu = (config.businessUnit || []).find(b => b.value === v || b.label === v); return { value: v, label: bu?.label || v, color: COLORS.accent }; }) },
                  { key: "internalDeal", label: "Internal Deal",   items: [{ value: "true", label: "YES — Internal", color: COLORS.blue }, { value: "false", label: "NO — External", color: COLORS.textSub }] },
                ].map(({ key, label, items }) => items.length === 0 ? null : (
                  <div key={key} style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.textSub, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {items.map(item => {
                        const isActive = activeFilters[key].includes(item.value);
                        return (
                          <span key={item.value} onClick={() => setActiveFilters(f => ({ ...f, [key]: isActive ? f[key].filter(v => v !== item.value) : [...f[key], item.value] }))}
                            style={{ cursor: "pointer", fontSize: 11, padding: "3px 10px", borderRadius: 8, fontWeight: 600, transition: "all 0.15s",
                              background: isActive ? item.color : `${item.color}22`,
                              color: isActive ? "#fff" : item.color,
                              border: `1px solid ${item.color}55` }}>
                            {item.label}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {/* Exchange filter */}
                {(() => {
                  const norm = v => (v || "").toString().toLowerCase().trim().replace(/[_\s-]/g, "");
                  const exchanges = [...new Set(ops.map(o => o.exchange).filter(Boolean))].sort();
                  if (exchanges.length === 0) return null;
                  return (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.textSub, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Exchange</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {exchanges.map(ex => {
                          const isActive = activeFilters.exchange.some(f => f.toLowerCase() === ex.toLowerCase());
                          const label = (config.derivExchanges || []).find(e => norm(e.value) === norm(ex))?.label || ex;
                          return (
                            <span key={ex} onClick={() => setActiveFilters(f => ({ ...f, exchange: isActive ? f.exchange.filter(v => v !== ex) : [...f.exchange, ex] }))}
                              style={{ cursor: "pointer", fontSize: 11, padding: "3px 10px", borderRadius: 8, fontWeight: 600, transition: "all 0.15s",
                                background: isActive ? COLORS.blue : `${COLORS.blue}22`,
                                color: isActive ? "#fff" : COLORS.blue,
                                border: `1px solid ${COLORS.blue}55` }}>
                              {label}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* Underlying filter — fuzzy product resolution + canonical dedup */}
                {(() => {
                  const norm = v => (v || "").toString().toLowerCase().trim().replace(/[_\s-]/g, "");
                  const resolveProduct = (instrument) => {
                    if (!instrument) return null;
                    const n = norm(instrument);
                    return products.find(p => norm(p.label) === n || norm(p.value) === n)
                        || products.find(p => { const pl = norm(p.label); return pl.length >= 4 && n.startsWith(pl) && (n.length === pl.length || !/[a-z0-9]/.test(n[pl.length] || "")); });
                  };
                  const commodities = config.derivCommodities || [];
                  const resolveUnderlying = (raw) => {
                    if (!raw) return null;
                    const match = commodities.find(c => norm(c.value) === norm(raw) || norm(c.label) === norm(raw));
                    return match ? match.value : raw;
                  };
                  const seen = new Set();
                  const underlyings = [];
                  ops.forEach(o => {
                    const product = resolveProduct(o.instrument);
                    const canonical = resolveUnderlying(product?.underlying);
                    if (canonical && !seen.has(norm(canonical))) {
                      seen.add(norm(canonical));
                      underlyings.push(canonical);
                    }
                  });
                  underlyings.sort();
                  if (underlyings.length === 0) return null;
                  const UNDERLYING_COLORS = { wheat: "#F2C94C", corn: "#F2994A", soybean: "#6FCF97", soybeanmeal: "#4ECDC4", rapeseed: "#BB6BD9", sunflower: "#FFB347", barley: "#E2B96F", sugar: COLORS.blue, cotton: COLORS.textSub, coffee: "#9B7653", cocoa: "#7B4F2E", palmoil: COLORS.green, rice: COLORS.accent };
                  return (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.textSub, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Underlying</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {underlyings.map(u => {
                          const isActive = activeFilters.underlying.includes(u);
                          const col = UNDERLYING_COLORS[norm(u)] || COLORS.orange;
                          const cfg = commodities.find(c => norm(c.value) === norm(u) || norm(c.label) === norm(u));
                          const label = cfg?.label || u.charAt(0).toUpperCase() + u.slice(1);
                          return (
                            <span key={u} onClick={() => setActiveFilters(f => ({ ...f, underlying: isActive ? f.underlying.filter(v => v !== u) : [...f.underlying, u] }))}
                              style={{ cursor: "pointer", fontSize: 11, padding: "3px 10px", borderRadius: 8, fontWeight: 600, transition: "all 0.15s",
                                background: isActive ? col : `${col}22`,
                                color: isActive ? "#fff" : col,
                                border: `1px solid ${col}55` }}>
                              {label}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* Financing Bank filter */}
                {(() => {
                  const banks = [...new Set(ops.map(o => derivAccounts.find(a => a.accountNumber === o.account)?.financingBank).filter(Boolean))].sort();
                  if (banks.length === 0) return null;
                  return (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.textSub, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Financing Bank</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {banks.map(bank => {
                          const isActive = activeFilters.financingBank.includes(bank);
                          return (
                            <span key={bank} onClick={() => setActiveFilters(f => ({ ...f, financingBank: isActive ? f.financingBank.filter(v => v !== bank) : [...f.financingBank, bank] }))}
                              style={{ cursor: "pointer", fontSize: 11, padding: "3px 10px", borderRadius: 8, fontWeight: 600, transition: "all 0.15s",
                                background: isActive ? COLORS.accent : `${COLORS.accent}22`,
                                color: isActive ? COLORS.textOnAccent : COLORS.accent,
                                border: `1px solid ${COLORS.accent}55` }}>
                              {bank}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* Filtres personnalisés */}
                <div style={{ marginTop: 4, borderTop: `1px solid ${COLORS.border}`, paddingTop: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.textSub, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Filtres personnalisés <span style={{ color: COLORS.textMuted, fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>— actifs en temps réel</span></div>
                  <div style={{ position: "relative" }}>
                    <input value={filterSearch} onChange={e => { setFilterSearch(e.target.value); setFilterSuggestions(e.target.value.trim() ? DERIV_CUSTOM_FIELDS.filter(f => f.label.toLowerCase().includes(e.target.value.toLowerCase()) && !customFilters.find(cf => cf.key === f.key)) : []); }}
                      onKeyDown={e => { if (e.key === "Escape") { setFilterSearch(""); setFilterSuggestions([]); } }}
                      placeholder="Ajouter un filtre..." style={{ width: "100%", background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "7px 12px", color: COLORS.text, fontSize: 12, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
                    {filterSuggestions.length > 0 && (
                      <div style={{ position: "absolute", top: "110%", left: 0, right: 0, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 8, zIndex: 200, overflow: "hidden" }}>
                        {filterSuggestions.map(f => (
                          <div key={f.key} onClick={() => { setCustomFilters(cf => [...cf, { key: f.key, label: f.label, type: f.type, op: f.type === "text" ? "contains" : "eq", value: "" }]); setFilterSearch(""); setFilterSuggestions([]); }}
                            style={{ padding: "8px 12px", cursor: "pointer", fontSize: 12, color: COLORS.text, borderBottom: `1px solid ${COLORS.border}` }}
                            onMouseOver={e => e.currentTarget.style.background = COLORS.bg}
                            onMouseOut={e => e.currentTarget.style.background = "transparent"}>
                            {f.label} <span style={{ fontSize: 10, color: COLORS.textMuted, marginLeft: 4 }}>{f.type}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {customFilters.map((cf, i) => (
                    <div key={cf.key} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
                      <span style={{ fontSize: 11, color: COLORS.textSub, minWidth: 80 }}>{cf.label}</span>
                      <select value={cf.op} onChange={e => setCustomFilters(fs => fs.map((f, j) => j === i ? { ...f, op: e.target.value } : f))}
                        style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "4px 6px", color: COLORS.text, fontSize: 11, outline: "none" }}>
                        {cf.type === "text"   && <option value="contains">Contient</option>}
                        {cf.type === "text"   && <option value="eq">Égal à</option>}
                        {cf.type !== "text"   && <option value="eq">=</option>}
                        {cf.type === "number" && <option value="gt">&gt;</option>}
                        {cf.type === "number" && <option value="lt">&lt;</option>}
                        <option value="empty">Est vide</option>
                        <option value="notempty">N'est pas vide</option>
                      </select>
                      {cf.op !== "empty" && cf.op !== "notempty" && (
                        <input value={cf.value} type={cf.type === "date" ? "date" : cf.type === "number" ? "number" : "text"}
                          onChange={e => setCustomFilters(fs => fs.map((f, j) => j === i ? { ...f, value: e.target.value } : f))}
                          placeholder="Valeur…"
                          style={{ flex: 1, minWidth: 0, background: cf.value ? `${COLORS.accent}10` : COLORS.bg, border: `1px solid ${cf.value ? COLORS.accent + "60" : COLORS.border}`, borderRadius: 6, padding: "4px 8px", color: COLORS.text, fontSize: 11, outline: "none" }} />
                      )}
                      <span onClick={() => setCustomFilters(fs => fs.filter((_, j) => j !== i))} style={{ cursor: "pointer", color: COLORS.textMuted, fontSize: 14 }}>✕</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Tableau */}
        <div ref={el => { if (el) el._scrollRef = el; }} id="deriv-scroll-container" style={{ flex: 1, overflowY: "auto", overflowX: "auto" }}>
          <div key={JSON.stringify(activeFilters) + filterMode} style={{ minWidth: 1100 }}>
            {/* Header */}
            <div style={{ display: "grid", gridTemplateColumns: COLS, gap: 0, background: COLORS.tableHeader, borderRadius: "10px 10px 0 0", padding: "10px 16px" }}>
              {HEADERS.map(h => <div key={h} style={{ fontSize: 10, fontWeight: 700, color: COLORS.textMuted, letterSpacing: 0.8, textAlign: "center" }}>{h}</div>)}
            </div>
            {/* Lignes */}
            {filtered.map((o, i) => {
              const sc = getStatusCfg(o.status);
              const isSelected = selected === o.id;
              return (
                <div key={o.id} onClick={() => setSelected(o.id === selected ? null : o.id)}
                  style={{ display: "grid", gridTemplateColumns: COLS, gap: 0, padding: "11px 16px", cursor: "pointer", transition: "background 0.12s", borderBottom: `1px solid ${COLORS.border}`, background: isSelected ? COLORS.rowSelected : i % 2 === 0 ? COLORS.card : `${COLORS.card}BB`, alignItems: "center" }}
                  onMouseOver={e => { if (!isSelected) e.currentTarget.style.background = COLORS.hover; }}
                  onMouseOut={e => { if (!isSelected) e.currentTarget.style.background = isSelected ? COLORS.rowSelected : i % 2 === 0 ? COLORS.card : `${COLORS.card}BB`; }}>
                  <div style={{ fontSize: 11, color: COLORS.accent, fontWeight: 700, fontFamily: "'DM Mono', monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "center" }}>{o.ref || "—"}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: o.type?.toLowerCase() === "future" ? COLORS.blue : COLORS.purple, textAlign: "center" }}>{o.type}</div>
                  <div style={{ fontSize: 13, color: COLORS.text, textAlign: "center" }}>{o.opType || "—"}</div>
                  <div style={{ textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ fontSize: 11, fontWeight: 700, padding: "2px 6px", borderRadius: 5, background: o.side === "BUY" ? `${COLORS.green}20` : `${COLORS.red}20`, color: o.side === "BUY" ? COLORS.green : COLORS.red }}>{o.side}</span></div>
                  {(() => { const prod = (config.derivProducts || []).find(p => p.value === o.instrument); return <div style={{ fontSize: 13, color: COLORS.text, fontWeight: 600, whiteSpace: "normal", wordBreak: "break-word", textAlign: "center" }}>{prod?.label || o.instrument || "—"}</div>; })()}
                  <div style={{ fontSize: 13, color: COLORS.text, textAlign: "center" }}>{o.quantity ? `${Number(o.quantity).toLocaleString()}` : "—"}</div>
                  <div style={{ fontSize: 13, color: COLORS.text, textAlign: "center", fontFamily: "'DM Mono', monospace" }}>{formatPrice(o.price, o.instrument)}</div>
                  <div style={{ fontSize: 13, color: COLORS.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "center" }}>{o.businessUnit ? o.businessUnit.toUpperCase() : "—"}</div>
                  <div style={{ fontSize: 13, color: COLORS.text, textAlign: "center" }}>{o.tradeDate ? o.tradeDate.split("-").reverse().join("/") : "—"}</div>
                  <div style={{ fontSize: 13, color: COLORS.text, textAlign: "center" }}>{o.type?.toLowerCase() === "option" ? (o.expiryDate || "—") : <span style={{ color: COLORS.textMuted }}>—</span>}</div>
                  <div style={{ fontSize: 13, color: COLORS.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "center" }}>{o.broker || "—"}</div>
                  {(() => { const norm = v => (v || "").toLowerCase().trim(); const exch = (config.derivExchanges || []).find(e => norm(e.value) === norm(o.exchange)); return <div style={{ fontSize: 13, color: COLORS.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "center" }}>{exch?.label || o.exchange || "—"}</div>; })()}
                  <div style={{ fontSize: 13, color: COLORS.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "center" }}>{o.account || "—"}</div>
                  <div style={{ textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 5, background: `${sc.color}20`, color: sc.color }}>{sc.label}</span></div>
                  <div style={{ textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 5, background: o.internalDeal ? `${COLORS.blue}20` : "transparent", color: o.internalDeal ? COLORS.blue : COLORS.textMuted }}>{o.internalDeal ? "YES" : "—"}</span></div>
                  {/* FEES — calculé auto, éditable manuellement */}
                  {(() => {
                    const product = products.find(p => (p.label || "").toLowerCase().trim() === (o.instrument || "").toLowerCase().trim());
                    const currency = (product?.currency || "").toUpperCase();
                    const sym = CURRENCY_SYMBOLS[currency] || currency;
                    const autoFees = computeFees(o, exchangeTarifs);
                    const hasManual = o.fees !== undefined && o.fees !== "";
                    const displayVal = hasManual ? o.fees : autoFees;
                    const editingFees = o.id && editingFeesId === o.id;
                    return (
                      <div onClick={e => e.stopPropagation()} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                        {editingFees ? (
                          <input autoFocus
                            defaultValue={hasManual ? o.fees : autoFees}
                            onBlur={e => {
                              const v = e.target.value.replace(/[^\d.-]/g, "");
                              const updated = ops.map(x => x.id === o.id ? { ...x, fees: v === "" ? "" : v } : x);
                              setOpsRaw(updated);
                              const updatedOp = updated.find(x => x.id === o.id);
                              if (updatedOp) saveOneDerivative(updatedOp);
                              setEditingFeesId(null);
                            }}
                            onKeyDown={e => { if (e.key === "Enter") e.target.blur(); if (e.key === "Escape") setEditingFeesId(null); }}
                            style={{ width: 60, background: COLORS.bg, border: `1px solid ${COLORS.accent}60`, borderRadius: 5, color: COLORS.text, fontSize: 12, fontFamily: "'DM Mono', monospace", outline: "none", padding: "1px 5px" }}
                          />
                        ) : (
                          <span style={{ fontSize: 13, fontWeight: 600, color: hasManual ? COLORS.accent : COLORS.text }}>
                            {displayVal !== "" ? `${displayVal} ${sym}` : "—"}
                          </span>
                        )}
                        <span onClick={() => setEditingFeesId(editingFees ? null : o.id)}
                          style={{ fontSize: 10, color: COLORS.textMuted, cursor: "pointer", flexShrink: 0, opacity: 0.6 }}
                          onMouseOver={e => e.currentTarget.style.color = COLORS.accent}
                          onMouseOut={e => e.currentTarget.style.color = COLORS.textMuted}>✏</span>
                      </div>
                    );
                  })()}
                  <div style={{ fontSize: 13, color: COLORS.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontStyle: o.notes ? "italic" : "normal", textAlign: "center" }}>{o.notes || "—"}</div>
                </div>
              );
            })}
            {filtered.length === 0 && <div style={{ textAlign: "center", color: COLORS.textMuted, padding: 48, background: COLORS.card, borderRadius: "0 0 10px 10px" }}>Aucune opération</div>}
          </div>
        </div>
      </div>

      {/* Panneau détail */}
      {sel && (
        <div style={{ width: 300, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 24, overflowY: "auto", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 11, color: COLORS.textMuted, fontWeight: 600, letterSpacing: 0.5, marginBottom: 2 }}>REFERENCE</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: COLORS.accent, fontFamily: "'DM Mono', monospace" }}>{sel.ref || "—"}</div>
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, padding: "4px 10px", borderRadius: 8, background: `${getStatusCfg(sel.status).color}20`, color: getStatusCfg(sel.status).color }}>{getStatusCfg(sel.status).label}</span>
          </div>

          <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 8, background: sel.type?.toLowerCase() === "future" ? `${COLORS.blue}20` : `${COLORS.purple}20`, color: sel.type?.toLowerCase() === "future" ? COLORS.blue : COLORS.purple }}>{sel.type}</span>
            <span style={{ fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 8, background: `${COLORS.accent}15`, color: COLORS.accent }}>{sel.opType}</span>
            <span style={{ fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 8, background: sel.side === "BUY" ? `${COLORS.green}20` : `${COLORS.red}20`, color: sel.side === "BUY" ? COLORS.green : COLORS.red }}>{sel.side}</span>
            {sel.type?.toLowerCase() === "option" && <span style={{ fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 8, background: `${COLORS.purple}20`, color: COLORS.purple }}>{sel.optionType}</span>}
          </div>

          {[
            { label: "INSTRUMENT",      value: sel.instrument || null },
            { label: "NUMBER OF LOTS",  value: sel.quantity ? `${Number(sel.quantity).toLocaleString()} lots` : null },
            { label: "PRICE",           value: formatPrice(sel.price, sel.instrument) || null },
            sel.type?.toLowerCase() === "option" ? { label: "STRIKE", value: sel.strike || null } : null,

            { label: "BUSINESS UNIT",   value: sel.businessUnit ? sel.businessUnit.toUpperCase() : null },
            { label: "TRADE DATE",      value: sel.tradeDate },
            sel.type?.toLowerCase() === "option" ? { label: "EXPIRY DATE", value: sel.expiryDate } : null,
            { label: "BROKER",          value: sel.broker },
            { label: "EXCHANGE",        value: sel.exchange ? ((config.derivExchanges || []).find(e => e.value === sel.exchange)?.label || sel.exchange).toUpperCase() : null },
            { label: "ACCOUNT",         value: sel.account || null },
            { label: "CONTRACT",        value: sel.contract },
            { label: "TRADE",           value: sel.trade },
          ].filter(Boolean).map(row => (
            <div key={row.label} style={{ borderBottom: `1px solid ${COLORS.border}`, padding: "8px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 11, color: COLORS.textMuted, fontWeight: 600, letterSpacing: 0.4 }}>{row.label}</span>
              <span style={{ fontSize: 13, color: row.value ? COLORS.text : COLORS.textMuted }}>{row.value || "—"}</span>
            </div>
          ))}

          {/* FEES */}
          {(() => {
            const product = products.find(p => (p.label || "").toLowerCase().trim() === (sel.instrument || "").toLowerCase().trim());
            const currency = (product?.currency || "").toUpperCase();
            const sym = CURRENCY_SYMBOLS[currency] || currency;
            const autoFees = computeFees(sel, exchangeTarifs);
            const hasManual = sel.fees !== undefined && sel.fees !== "";
            const displayVal = hasManual ? sel.fees : autoFees;
            return (
              <div style={{ borderBottom: `1px solid ${COLORS.border}`, padding: "8px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 11, color: COLORS.textMuted, fontWeight: 600, letterSpacing: 0.4 }}>OPERATION FEES</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: hasManual ? COLORS.accent : COLORS.text }}>
                  {displayVal !== "" ? `${displayVal} ${sym}` : "—"}
                </span>
              </div>
            );
          })()}

          {/* Internal Deal */}
          <div style={{ borderBottom: `1px solid ${COLORS.border}`, padding: "8px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, color: COLORS.textMuted, fontWeight: 600, letterSpacing: 0.4 }}>INTERNAL DEAL</span>
            <span style={{ fontSize: 12, fontWeight: 700, padding: "2px 10px", borderRadius: 6, background: sel.internalDeal ? `${COLORS.blue}20` : `${COLORS.border}`, color: sel.internalDeal ? COLORS.blue : COLORS.textMuted }}>
              {sel.internalDeal ? "YES" : "NO"}
            </span>
          </div>

          {sel.notes && <div style={{ marginTop: 12, fontSize: 12, color: COLORS.textSub, lineHeight: 1.6, background: COLORS.bg, borderRadius: 8, padding: "8px 12px" }}>{sel.notes}</div>}

          <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
            <Btn onClick={() => openEdit(sel)} style={{ flex: 1 }}>Modifier</Btn>
            <Btn onClick={() => del(sel.id)} variant="danger">Suppr.</Btn>
          </div>
        </div>
      )}

      {/* Modal formulaire */}
      {showForm && (
        <Modal title={editOp ? "MODIFIER L'OPÉRATION" : "NEW OPERATION"} onClose={() => setShowForm(false)} wide>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

            {/* Référence — éditable, avec validation doublon et bouton regénérer */}
            {(() => {
              const isDuplicate = form.ref?.trim() && ops.some(o => o.ref?.toLowerCase() === form.ref.trim().toLowerCase() && o.id !== (editOp?.id));
              const refError = formErrors.ref || (isDuplicate ? "déjà utilisée" : (!form.ref?.trim() ? "obligatoire" : null));
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label style={{ fontSize: 11, color: refError ? COLORS.red : COLORS.textSub, fontWeight: 600, letterSpacing: 0.5 }}>
                    REFERENCE <span style={{ color: COLORS.red }}>*</span>
                    {isDuplicate && <span style={{ marginLeft: 8, fontSize: 10, color: COLORS.red, fontWeight: 700 }}>⚠ déjà utilisée</span>}
                  </label>
                  <div style={{ display: "flex", gap: 6 }}>
                    <input
                      value={form.ref}
                      onChange={e => setForm(f => ({ ...f, ref: e.target.value.toUpperCase() }))}
                      placeholder="DRV-XXXXXX"
                      style={{
                        flex: 1,
                        background: refError ? `${COLORS.red}10` : `${COLORS.accent}10`,
                        border: `1px solid ${refError ? COLORS.red + "80" : COLORS.accent + "40"}`,
                        borderRadius: 8, padding: "10px 14px",
                        color: refError ? COLORS.red : COLORS.accent,
                        fontSize: 13, fontFamily: "'DM Mono', monospace", outline: "none", fontWeight: 700,
                        transition: "all 0.2s",
                      }}
                      onFocus={e => { e.target.style.borderColor = refError ? COLORS.red : COLORS.accent; setFormErrors(e2 => ({ ...e2, ref: undefined })); }}
                      onBlur={e => e.target.style.borderColor = refError ? COLORS.red + "80" : COLORS.accent + "40"}
                    />
                    <button
                      onClick={() => setForm(f => ({ ...f, ref: genRef() }))}
                      title="Regénérer une référence automatique"
                      style={{ background: `${COLORS.accent}15`, border: `1px solid ${COLORS.accent}40`, borderRadius: 8, padding: "0 12px", cursor: "pointer", color: COLORS.accent, fontSize: 16, flexShrink: 0, transition: "all 0.15s" }}
                      onMouseOver={e => e.currentTarget.style.background = `${COLORS.accent}30`}
                      onMouseOut={e => e.currentTarget.style.background = `${COLORS.accent}15`}
                      title="Regénérer automatiquement">
                      ↺
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* Business Unit — filtrée sur les BUs actives dans l'admin panel Derivatives */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4, border: formErrors.businessUnit ? `1.5px solid ${COLORS.red}` : "1.5px solid transparent", borderRadius: 10, padding: formErrors.businessUnit ? "6px 8px" : 0 }}>
              <ToggleGroup label="BUSINESS UNIT *"
                options={(config.businessUnit || []).filter(bu => (config.derivBusinessUnits || []).includes(bu.value)).map(bu => bu.value)}
                value={form.businessUnit}
                onChange={v => { setForm(f => ({ ...f, businessUnit: v })); setFormErrors(e => ({ ...e, businessUnit: undefined })); }}
                colorFn={v => (config.businessUnit || []).find(bu => bu.value === v)?.color || COLORS.accent}
                labelFn={v => (config.businessUnit || []).find(bu => bu.value === v)?.label?.toUpperCase() || v.toUpperCase()}
              />
              {formErrors.businessUnit && <span style={{ fontSize: 11, color: COLORS.red }}>⚠ {formErrors.businessUnit}</span>}
            </div>

            {/* Type instrument */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4, border: formErrors.type ? `1.5px solid ${COLORS.red}` : "1.5px solid transparent", borderRadius: 10, padding: formErrors.type ? "6px 8px" : 0 }}>
              <ToggleGroup label="INSTRUMENT TYPE *" options={(config.derivInstrumentTypes || []).map(o => o.label)} value={form.type} onChange={v => {
                const stillValid = products.some(p => p.label.toUpperCase() === (form.instrument || "").toUpperCase() && (!p.instrumentType || p.instrumentType.toUpperCase() === v.toUpperCase()));
                setForm(f => ({ ...f, type: v, instrument: stillValid ? f.instrument : "", exchange: stillValid ? f.exchange : "" }));
                setFormErrors(e => ({ ...e, type: undefined }));
              }} colorFn={v => v === "Option" ? COLORS.purple : COLORS.blue} />
              {formErrors.type && <span style={{ fontSize: 11, color: COLORS.red }}>⚠ {formErrors.type}</span>}
            </div>

            {/* Operation Type */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4, border: formErrors.opType ? `1.5px solid ${COLORS.red}` : "1.5px solid transparent", borderRadius: 10, padding: formErrors.opType ? "6px 8px" : 0 }}>
              <ToggleGroup label="OPERATION TYPE *" options={(config.derivOpTypes || []).map(o => o.label)} value={form.opType} onChange={v => { setForm(f => ({ ...f, opType: v })); setFormErrors(e => ({ ...e, opType: undefined })); }}
                colorFn={() => COLORS.accent} />
              {formErrors.opType && <span style={{ fontSize: 11, color: COLORS.red }}>⚠ {formErrors.opType}</span>}
            </div>

            {/* Side */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4, border: formErrors.side ? `1.5px solid ${COLORS.red}` : "1.5px solid transparent", borderRadius: 10, padding: formErrors.side ? "6px 8px" : 0 }}>
              <ToggleGroup label="SIDE *" options={SIDES} value={form.side} onChange={v => { setForm(f => ({ ...f, side: v })); setFormErrors(e => ({ ...e, side: undefined })); }}
                colorFn={v => v === "BUY" ? COLORS.green : COLORS.red} />
              {formErrors.side && <span style={{ fontSize: 11, color: COLORS.red }}>⚠ {formErrors.side}</span>}
            </div>

            {/* Option type si Option */}
            {form.type?.toLowerCase() === "option"
              ? <ToggleGroup label="OPTION TYPE" options={OPTION_TYPES} value={form.optionType} onChange={v => setForm(f => ({ ...f, optionType: v }))} colorFn={() => COLORS.purple} />
              : <div />}

            {/* Derivatives — autocomplétion depuis l'admin panel */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <DerivAutocomplete form={form} setForm={(val) => { setForm(val); setFormErrors(e => ({ ...e, instrument: undefined })); }} requiredError={formErrors.instrument} products={products} />
            </div>

            {/* Number of Lots */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 11, color: formErrors.quantity ? COLORS.red : COLORS.textSub, fontWeight: 600, letterSpacing: 0.5 }}>NUMBER OF LOTS <span style={{ color: COLORS.red }}>*</span></label>
              <input value={form.quantity} onChange={e => { setForm(f => ({ ...f, quantity: e.target.value })); setFormErrors(er => ({ ...er, quantity: undefined })); }} placeholder="0"
                style={{ background: COLORS.bg, border: `1px solid ${formErrors.quantity ? COLORS.red : COLORS.border}`, borderRadius: 8, padding: "10px 14px", color: COLORS.text, fontSize: 14, outline: "none", fontFamily: "inherit" }} />
              {formErrors.quantity && <span style={{ fontSize: 11, color: COLORS.red }}>⚠ {formErrors.quantity}</span>}
            </div>

            {/* Price — adapté selon le format décimal de l'instrument */}
            {(() => {
              const derivProds = products;
              const instrument = derivProds.find(p => p.label === form.instrument);
              const decimalsFormat = instrument?.decimals || "decimal";
              const tickSize = instrument?.tickSize || "";
              const decConfig = (config.derivDecimals || []).find(d => d.value === decimalsFormat || d.displayFormat === decimalsFormat);
              const isFraction = decimalsFormat.includes("/") && !decimalsFormat.startsWith("decimal");
              // Compute fraction options from tickSize if available, else from displayFormat
              const fractionOptions = isFraction
                ? (() => {
                    const den = parseInt((decimalsFormat.split("/")[1] || "8"));
                    // tickSize determines step: e.g. tickSize="2/8" → step=2, so options are 2/8, 4/8, 6/8
                    const tickNum = tickSize && tickSize.includes("/") ? parseInt(tickSize.split("/")[0]) : 1;
                    const options = [];
                    for (let n = tickNum; n < den; n += tickNum) options.push(`${n}/${den}`);
                    return options;
                  })()
                : [];
              const [intPart, fracPart] = isFraction
                ? (form.price || "").split(" ")
                : [form.price || "", ""];

              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label style={{ fontSize: 11, color: formErrors.price ? COLORS.red : COLORS.textSub, fontWeight: 600, letterSpacing: 0.5 }}>
                    PRICE <span style={{ color: COLORS.red }}>*</span>
                    {decConfig && <span style={{ marginLeft: 8, fontSize: 10, color: COLORS.blue, fontWeight: 400, fontFamily: "'DM Mono', monospace" }}>format: {decConfig.example}</span>}
                  </label>
                  {!isFraction ? (
                    <input value={form.price} onChange={e => { const v = e.target.value.replace(/,/g, "."); setForm(f => ({ ...f, price: v })); setFormErrors(er => ({ ...er, price: undefined })); }} placeholder="0.00"
                      style={{ background: COLORS.bg, border: `1px solid ${formErrors.price ? COLORS.red : COLORS.border}`, borderRadius: 8, padding: "10px 14px", color: COLORS.text, fontSize: 14, outline: "none", fontFamily: "inherit" }} />
                  ) : (
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input value={intPart} onChange={e => { const v = e.target.value.replace(/[^0-9]/g, ""); setForm(f => ({ ...f, price: v + (fracPart ? ` ${fracPart}` : "") })); setFormErrors(er => ({ ...er, price: undefined })); }}
                        placeholder="200" type="text" inputMode="numeric"
                        style={{ flex: 1, background: COLORS.bg, border: `1px solid ${formErrors.price ? COLORS.red : COLORS.border}`, borderRadius: 8, padding: "10px 14px", color: COLORS.text, fontSize: 14, outline: "none", fontFamily: "'DM Mono', monospace" }} />
                      <select value={fracPart || ""} onChange={e => { setForm(f => ({ ...f, price: (intPart || "0") + (e.target.value ? ` ${e.target.value}` : "") })); setFormErrors(er => ({ ...er, price: undefined })); }}
                        style={{ width: 90, background: COLORS.bg, border: `1px solid ${formErrors.price ? COLORS.red : COLORS.border}`, borderRadius: 8, padding: "10px 10px", color: fracPart ? COLORS.text : COLORS.textMuted, fontSize: 14, outline: "none", fontFamily: "'DM Mono', monospace" }}>
                        <option value="">— frac —</option>
                        {fractionOptions.map(f => <option key={f} value={f}>{f}</option>)}
                      </select>
                    </div>
                  )}
                  {formErrors.price && <span style={{ fontSize: 11, color: COLORS.red }}>⚠ {formErrors.price}</span>}
                </div>
              );
            })()}

            {/* Strike si Option */}
            {form.type?.toLowerCase() === "option" && <Input label="Strike" value={form.strike} onChange={v => setForm(f => ({ ...f, strike: v }))} placeholder="0.00" />}

            {/* Dates */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 12, color: formErrors.tradeDate ? COLORS.red : COLORS.textSub, fontWeight: 600, letterSpacing: 0.5 }}>TRADE DATE *</label>
              <input type="date" value={form.tradeDate} onChange={e => { setForm(f => ({ ...f, tradeDate: e.target.value })); setFormErrors(er => ({ ...er, tradeDate: undefined })); }}
                style={{ background: COLORS.bg, border: `1px solid ${formErrors.tradeDate ? COLORS.red : COLORS.border}`, borderRadius: 8, padding: "10px 14px", color: COLORS.text, fontSize: 14, outline: "none", fontFamily: "inherit" }} />
              {formErrors.tradeDate && <span style={{ fontSize: 11, color: COLORS.red }}>⚠ {formErrors.tradeDate}</span>}
            </div>
            {form.type?.toLowerCase() === "option" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 11, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5 }}>EXPIRY DATE <span style={{ fontSize: 10, color: COLORS.textMuted, fontWeight: 400 }}>(auto)</span></label>
                <input value={form.expiryDate || ""} readOnly
                  style={{ background: form.expiryDate ? `${COLORS.purple}10` : COLORS.bg, border: `1px solid ${form.expiryDate ? COLORS.purple + "50" : COLORS.border}`, borderRadius: 8, padding: "10px 14px", color: form.expiryDate ? COLORS.purple : COLORS.textMuted, fontSize: 14, fontFamily: "'DM Mono', monospace", outline: "none", fontWeight: form.expiryDate ? 700 : 400 }} />
              </div>
            )}
            {form.type?.toLowerCase() === "future" && <div />}

            {/* Broker — alimenté par les sociétés ayant le rôle "Broker" */}
            {(() => {
              const brokerCompanies = (companies || []).filter(c =>
                (c.roles || []).some(r => r.toLowerCase().includes("financial") && r.toLowerCase().includes("broker"))
              );
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label style={{ fontSize: 12, color: formErrors.broker ? COLORS.red : COLORS.textSub, fontWeight: 600, letterSpacing: 0.5 }}>FINANCIAL BROKER *</label>
                  {brokerCompanies.length > 0 ? (
                    <select value={form.broker} onChange={e => { setForm(f => ({ ...f, broker: e.target.value })); setFormErrors(er => ({ ...er, broker: undefined })); }}
                      style={{ background: COLORS.bg, border: `1px solid ${formErrors.broker ? COLORS.red : COLORS.border}`, borderRadius: 8, padding: "10px 14px", color: form.broker ? COLORS.text : COLORS.textMuted, fontSize: 14, fontFamily: "inherit", outline: "none" }}>
                      <option value="">— Sélectionner un broker —</option>
                      {brokerCompanies.map(c => (
                        <option key={c.id} value={c.name}>{c.name}{c.country ? ` (${c.country})` : ""}</option>
                      ))}
                    </select>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <input value={form.broker} onChange={e => { setForm(f => ({ ...f, broker: e.target.value })); setFormErrors(er => ({ ...er, broker: undefined })); }} placeholder="Broker name"
                        style={{ background: COLORS.bg, border: `1px solid ${formErrors.broker ? COLORS.red : COLORS.border}`, borderRadius: 8, padding: "10px 14px", color: COLORS.text, fontSize: 14, outline: "none", fontFamily: "inherit" }} />
                      <span style={{ fontSize: 11, color: COLORS.textMuted }}>💡 Aucune société avec le rôle "Financial Broker" — ajoutez-en dans Companies</span>
                    </div>
                  )}
                  {formErrors.broker && <span style={{ fontSize: 11, color: COLORS.red }}>⚠ {formErrors.broker}</span>}
                </div>
              );
            })()}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 11, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5 }}>EXCHANGE <span style={{ fontSize: 10, color: COLORS.textMuted, fontWeight: 400 }}>(auto)</span></label>
              <input value={form.exchange ? form.exchange.toUpperCase() : ""} readOnly
                style={{ background: form.exchange ? `${COLORS.blue}10` : COLORS.bg, border: `1px solid ${form.exchange ? COLORS.blue + "50" : COLORS.border}`, borderRadius: 8, padding: "10px 14px", color: form.exchange ? COLORS.blue : COLORS.textMuted, fontSize: 14, fontFamily: "'DM Mono', monospace", outline: "none", fontWeight: form.exchange ? 700 : 400 }} />
            </div>

            {/* Account — relié à crm_deriv_accounts (admin panel Derivatives) */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 11, color: formErrors.account ? COLORS.red : COLORS.textSub, fontWeight: 600, letterSpacing: 0.5 }}>ACCOUNT <span style={{ color: COLORS.red }}>*</span></label>
              <select value={form.account} onChange={e => { setForm(f => ({ ...f, account: e.target.value })); setFormErrors(er => ({ ...er, account: undefined })); }}
                style={{ background: COLORS.bg, border: `1px solid ${formErrors.account ? COLORS.red : COLORS.border}`, borderRadius: 8, padding: "10px 14px", color: COLORS.text, fontSize: 14, fontFamily: "inherit", outline: "none" }}>
                <option value="">— Select —</option>
                {derivAccounts
  .filter(a => a.isActive !== false && String(a.isActive).toLowerCase() !== "false")
  .map(a => <option key={a.id} value={a.accountNumber}>{a.accountNumber.toUpperCase()}</option>)}
              </select>
              {formErrors.account && <span style={{ fontSize: 11, color: COLORS.red }}>⚠ {formErrors.account}</span>}
              {/* Warning devise compte vs instrument */}
              {(() => {
                if (!form.account || !form.instrument) return null;
                const product = products.find(p => (p.label || "").toLowerCase().trim() === (form.instrument || "").toLowerCase().trim());
                const instrCurrency = (product?.currency || "").toUpperCase();
                const account = derivAccounts.find(a => a.accountNumber === form.account);
                const accCurrencies = (Array.isArray(account?.currency) ? account.currency : (account?.currency ? [account.currency] : [])).map(v => (v || "").toUpperCase());
                if (!instrCurrency || accCurrencies.length === 0) return null;
                const mismatch = !accCurrencies.includes(instrCurrency);
                if (!mismatch) return null;
                return (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, background: `${COLORS.orange}15`, border: `1px solid ${COLORS.orange}40`, borderRadius: 8, padding: "8px 12px" }}>
                    <span style={{ fontSize: 14, flexShrink: 0 }}>⚠️</span>
                    <span style={{ fontSize: 12, color: COLORS.orange, fontWeight: 600, lineHeight: 1.4 }}>
                      Devise du compte (<strong>{accCurrencies.join(", ")}</strong>) différente de la devise de l'instrument (<strong>{instrCurrency}</strong>). Vérifiez la configuration.
                    </span>
                  </div>
                );
              })()}
            </div>

            {/* Contract + Trade */}
            <Input label="Contract" value={form.contract} onChange={v => setForm(f => ({ ...f, contract: v }))} placeholder="À définir" />
            <Input label="Trade" value={form.trade} onChange={v => setForm(f => ({ ...f, trade: v }))} placeholder="À définir" />

            {/* Order Transmission Type */}
            {(config.derivOrderTransmissionTypes || []).length > 0 && (
              <ToggleGroup label="ORDER TRANSMISSION TYPE"
                options={(config.derivOrderTransmissionTypes || []).map(t => t.value)}
                value={form.orderTransmissionType}
                onChange={v => setForm(f => ({ ...f, orderTransmissionType: v }))}
                colorFn={() => COLORS.blue}
                labelFn={v => (config.derivOrderTransmissionTypes || []).find(t => t.value === v)?.label || v}
              />
            )}

            {/* Fees */}
            {(() => {
              const product = products.find(p => (p.label || "").toLowerCase().trim() === (form.instrument || "").toLowerCase().trim());
              const currency = (product?.currency || "").toUpperCase();
              const sym = CURRENCY_SYMBOLS[currency] || currency;
              const autoFees = computeFees({ ...form }, exchangeTarifs);
              const hasManual = form.fees !== undefined && form.fees !== "";
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label style={{ fontSize: 11, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5 }}>
                    FEES
                    {autoFees !== "" && !hasManual && (
                      <span style={{ marginLeft: 8, fontSize: 10, color: COLORS.textMuted, fontWeight: 400 }}>(auto-calculées)</span>
                    )}
                    {hasManual && (
                      <span style={{ marginLeft: 8, fontSize: 10, color: COLORS.accent, fontWeight: 600 }}>● override manuel</span>
                    )}
                  </label>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      type="number"
                      value={form.fees}
                      onChange={e => setForm(f => ({ ...f, fees: e.target.value }))}
                      placeholder={autoFees !== "" ? `${autoFees}${sym ? " " + sym : ""} (auto)` : "0"}
                      style={{
                        flex: 1,
                        background: hasManual ? `${COLORS.accent}08` : COLORS.bg,
                        border: `1px solid ${hasManual ? COLORS.accent + "60" : COLORS.border}`,
                        borderRadius: 8, padding: "10px 14px",
                        color: hasManual ? COLORS.accent : COLORS.text,
                        fontSize: 14, outline: "none", fontFamily: "'DM Mono', monospace",
                        fontWeight: hasManual ? 700 : 400,
                      }}
                      onFocus={e => e.target.style.borderColor = COLORS.accent}
                      onBlur={e => e.target.style.borderColor = hasManual ? COLORS.accent + "60" : COLORS.border}
                    />
                    {sym && <span style={{ fontSize: 13, color: COLORS.textMuted, flexShrink: 0 }}>{sym}</span>}
                    {hasManual && (
                      <button
                        onClick={() => setForm(f => ({ ...f, fees: "" }))}
                        title="Supprimer l'override — revenir au calcul automatique"
                        style={{ background: `${COLORS.red}15`, border: `1px solid ${COLORS.red}40`, borderRadius: 6, padding: "6px 10px", cursor: "pointer", color: COLORS.red, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", flexShrink: 0 }}>
                        ✕ Reset auto
                      </button>
                    )}
                  </div>
                  {autoFees !== "" && (
                    <div style={{ fontSize: 11, color: hasManual ? COLORS.textMuted : COLORS.green, display: "flex", alignItems: "center", gap: 4 }}>
                      {hasManual ? "⚠" : "✓"} Fees auto : <span style={{ fontFamily: "'DM Mono', monospace", fontWeight: 700 }}>{autoFees}{sym ? " " + sym : ""}</span>
                      {hasManual && <span style={{ color: COLORS.textMuted }}> — remplacées par l'override</span>}
                    </div>
                  )}
                  {autoFees === "" && !hasManual && (
                    <div style={{ fontSize: 11, color: COLORS.textMuted }}>
                      Aucun tarif correspondant — saisissez un montant manuel ou configurez les Exchange Tarifs dans l'Admin Panel.
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Status */}
            <ToggleGroup label="OPERATION STATUS" options={(config.derivOpStatuses || []).map(s => s.label.toUpperCase())} value={form.status?.toUpperCase()} onChange={v => setForm(f => ({ ...f, status: v }))}
              colorFn={v => (config.derivOpStatuses || []).find(s => s.label.toUpperCase() === v)?.color || COLORS.accent} />

            {/* Internal Deal + Notes */}
            <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 14, padding: "10px 14px", background: form.internalDeal ? `${COLORS.blue}10` : COLORS.bg, border: `1px solid ${form.internalDeal ? COLORS.blue + "50" : COLORS.border}`, borderRadius: 10, cursor: "pointer", transition: "all 0.15s", userSelect: "none" }}
              onClick={() => setForm(f => ({ ...f, internalDeal: !f.internalDeal }))}>
              <div style={{ width: 38, height: 22, borderRadius: 11, background: form.internalDeal ? COLORS.blue : COLORS.border, position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
                <div style={{ position: "absolute", top: 3, left: form.internalDeal ? 18 : 3, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }} />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: form.internalDeal ? COLORS.blue : COLORS.textSub, letterSpacing: 0.5 }}>INTERNAL DEAL</div>
                <div style={{ fontSize: 11, color: COLORS.textMuted }}>{form.internalDeal ? "Oui — opération interne" : "Non — opération externe"}</div>
              </div>
            </div>

            <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 11, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5 }}>NOTES</label>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3}
                style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "10px 14px", color: COLORS.text, fontSize: 14, resize: "vertical", fontFamily: "inherit", outline: "none", width: "100%", boxSizing: "border-box" }} />
            </div>
          </div>
          {Object.keys(formErrors).filter(k => formErrors[k]).length > 0 && (
            <div style={{ marginTop: 16, background: `${COLORS.red}15`, border: `1px solid ${COLORS.red}50`, borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "flex-start", gap: 10 }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>⚠</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.red, marginBottom: 6 }}>Champs obligatoires manquants :</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {Object.entries(formErrors).filter(([, v]) => v).map(([k, v]) => (
                    <span key={k} style={{ fontSize: 11, background: `${COLORS.red}25`, color: COLORS.red, borderRadius: 6, padding: "2px 8px", fontWeight: 600 }}>
                      {v.replace(" est obligatoire", "")}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
          <div style={{ display: "flex", gap: 10, marginTop: 14, justifyContent: "flex-end" }}>
            <Btn variant="secondary" onClick={() => setShowForm(false)}>Annuler</Btn>
            <Btn onClick={save}>Enregistrer</Btn>
          </div>
        </Modal>
      )}
      {showExport && (
        <DerivExportModal
          ops={ops}
          filtered={filtered}
          products={products}
          config={config}
          onClose={() => setShowExport(false)}
        />
      )}
      {showImport && (
        <ExcelImportModal type="derivatives" derivAccounts={derivAccounts} derivProducts={products} derivCompanies={companies} onClose={() => setShowImport(false)}
          onImport={async (items) => {
            const PAGE = 1000;
            let currentOps = [];
            let from = 0;
            while (true) {
              const { data, error } = await supabase.from('derivatives').select('data').range(from, from + PAGE - 1);
              if (error || !data || data.length === 0) break;
              currentOps = [...currentOps, ...data.map(r => r.data ?? r)];
              if (data.length < PAGE) break;
              from += PAGE;
            }
            const ex = new Set(currentOps.map(o => o.ref?.toLowerCase()).filter(Boolean));
            const toAdd = items
              .map(i => ({ ...makeEmpty(), ...i, id: Date.now() + Math.random(), internalDeal: String(i.internalDeal).toLowerCase() === "true" }))
              .filter(i => !i.ref || !ex.has(i.ref?.toLowerCase()));
            if (toAdd.length === 0) { reloadOps(); return; }
            const CHUNK = 50;
            for (let i = 0; i < toAdd.length; i += CHUNK) {
              const chunk = toAdd.slice(i, i + CHUNK).map(item => ({ data: item }));
              const { error } = await supabase.from('derivatives').insert(chunk);
              if (error) console.error('[import] insert error:', error);
            }
            reloadOps();
          }} />
      )}
    </div>
  );
};


const CompaniesDashboard = ({ companies, setCompanies }) => {
  const { config } = useConfig();
  const [openKpi, setOpenKpi] = useState(null);
  const [editCompany, setEditCompany] = useState(null);
  const [form, setForm] = useState({});

  const openEdit = (c, e) => {
    e.stopPropagation();
    setForm({ ...c, tags: (c.tags || []).join(", "), roles: c.roles || [] });
    setEditCompany(c);
  };

  const saveEdit = () => {
    const data = { ...form, tags: form.tags.split(",").map(t => t.trim()).filter(Boolean), avatar: form.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase(), revenue: Number(form.revenue) || 0, roles: form.roles || [] };
    setCompanies(companies.map(c => c.id === editCompany.id ? { ...c, ...data } : c));
    setEditCompany(null);
  };

  const toggleRole = (role) => {
    const cur = form.roles || [];
    setForm({ ...form, roles: cur.includes(role) ? cur.filter(r => r !== role) : [...cur, role] });
  };

  const complianceKpis = config.complianceStatus.map(s => ({
    key: `compliance_${s.value}`, field: "complianceStatus", value: s.value,
    label: s.label, color: s.color, group: "Compliance Status",
    companies: companies.filter(c => c.complianceStatus === s.value),
  }));

  const finalAuthKpis = config.finalAuthStatus.map(s => ({
    key: `finalauth_${s.value}`, field: "finalAuthStatus", value: s.value,
    label: s.label, color: s.color, group: "Final Authorization Status",
    companies: companies.filter(c => c.finalAuthStatus === s.value),
  }));

  const allGroups = [
    { title: "Compliance Status", icon: "🛡", kpis: complianceKpis },
    { title: "Final Authorization Status", icon: "✅", kpis: finalAuthKpis },
  ];

  const getRoleCfg = (v) => config.roles.find(r => r.value === v) || { color: COLORS.accent };

  const KpiCard = ({ kpi }) => {
    const isOpen = openKpi === kpi.key;
    const toggle = () => setOpenKpi(isOpen ? null : kpi.key);
    const pct = companies.length > 0 ? Math.round((kpi.companies.length / companies.length) * 100) : 0;

    return (
      <div style={{ background: COLORS.card, border: `1px solid ${isOpen ? kpi.color : COLORS.border}`, borderRadius: 14, overflow: "hidden", transition: "border-color 0.2s" }}>
        <div onClick={toggle} style={{ padding: "18px 20px", cursor: "pointer", display: "flex", alignItems: "center", gap: 14 }}
          onMouseOver={e => e.currentTarget.style.background = `${kpi.color}08`}
          onMouseOut={e => e.currentTarget.style.background = "transparent"}>
          <div style={{ width: 12, height: 12, borderRadius: "50%", background: kpi.color, flexShrink: 0, boxShadow: `0 0 8px ${kpi.color}60` }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{kpi.label}</div>
            <div style={{ marginTop: 6, height: 3, background: COLORS.border, borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pct}%`, background: kpi.color, borderRadius: 2, transition: "width 0.4s ease" }} />
            </div>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: kpi.color, fontFamily: "'DM Mono', monospace", lineHeight: 1 }}>{kpi.companies.length}</div>
            <div style={{ fontSize: 11, color: COLORS.textMuted }}>{pct}%</div>
          </div>
          <div style={{ color: kpi.companies.length > 0 ? kpi.color : COLORS.textMuted, fontSize: 14, transition: "transform 0.2s", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", flexShrink: 0 }}>▾</div>
        </div>

        {isOpen && (
          <div style={{ borderTop: `1px solid ${COLORS.border}` }}>
            {kpi.companies.length === 0 ? (
              <div style={{ padding: "16px 20px", fontSize: 13, color: COLORS.textMuted, textAlign: "center" }}>Aucune société avec ce statut</div>
            ) : (
              <div>
                <div style={{ padding: "10px 20px", background: `${kpi.color}08`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: kpi.color, fontWeight: 700, letterSpacing: 0.5 }}>{kpi.companies.length} SOCIÉTÉ{kpi.companies.length > 1 ? "S" : ""}</span>
                  <button onClick={toggle} style={{ background: "none", border: "none", color: COLORS.textMuted, cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>Masquer ▲</button>
                </div>
                {kpi.companies.map(c => (
                  <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 20px", borderBottom: `1px solid ${COLORS.border}` }}
                    onMouseOver={e => e.currentTarget.style.background = `${COLORS.accent}08`}
                    onMouseOut={e => e.currentTarget.style.background = "transparent"}>
                    <CountryFlag country={c.country} size={32} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</span>
                        <button onClick={(e) => openEdit(c, e)}
                          style={{ background: COLORS.hover, border: `1px solid ${COLORS.accent}40`, color: COLORS.accent, borderRadius: 6, padding: "2px 8px", fontSize: 11, cursor: "pointer", flexShrink: 0, fontFamily: "inherit", fontWeight: 600 }}
                          onMouseOver={e => e.currentTarget.style.background = `${COLORS.accent}40`}
                          onMouseOut={e => e.currentTarget.style.background = COLORS.hover}
                        >✏️ Modifier</button>
                      </div>
                      <div style={{ fontSize: 11, color: COLORS.textSub }}>{[c.city, c.country].filter(Boolean).join(", ") || "—"}</div>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      {(c.roles || []).slice(0, 2).map(r => <Badge key={r} label={getRoleCfg(r).label || r} color={getRoleCfg(r).color} />)}
                      {(c.roles || []).length > 2 && <span style={{ fontSize: 11, color: COLORS.textMuted }}>+{c.roles.length - 2}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ margin: 0, fontSize: 28, color: COLORS.text, fontFamily: "'Inter', sans-serif" }}>Companies — Dashboard</h1>
        <p style={{ margin: "6px 0 0", color: COLORS.textSub, fontSize: 14 }}>{companies.length} société{companies.length > 1 ? "s" : ""} au total</p>
      </div>

      <div style={{ background: COLORS.hover, border: `1px solid ${COLORS.accent}40`, borderRadius: 14, padding: "18px 24px", marginBottom: 32, display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: `${COLORS.accent}25`, border: `1px solid ${COLORS.accent}50`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>◆</div>
        <div>
          <div style={{ fontSize: 36, fontWeight: 800, color: COLORS.accent, fontFamily: "'DM Mono', monospace", lineHeight: 1 }}>{companies.length}</div>
          <div style={{ fontSize: 13, color: COLORS.textSub, marginTop: 4 }}>Sociétés enregistrées</div>
        </div>
      </div>

      {allGroups.map(group => (
        <div key={group.title} style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <span style={{ fontSize: 16 }}>{group.icon}</span>
            <h2 style={{ margin: 0, fontSize: 16, color: COLORS.text, fontWeight: 700 }}>{group.title}</h2>
            <div style={{ flex: 1, height: 1, background: COLORS.border, marginLeft: 8 }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
            {group.kpis.map(kpi => <KpiCard key={kpi.key} kpi={kpi} />)}
          </div>
        </div>
      ))}

      {editCompany && (
        <Modal title={`Modifier — ${editCompany.name}`} onClose={() => setEditCompany(null)} wide>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div style={{ gridColumn: "1 / -1" }}><Input label="Company Name" value={form.name} onChange={v => setForm({ ...form, name: v })} /></div>
            <Input label="Website" value={form.website || ""} onChange={v => setForm({ ...form, website: v })} />
            <SelectField label="Activity Status" value={form.status || ""} onChange={v => setForm({ ...form, status: v })} options={config.activityStatus.map(s => ({ value: s.value, label: s.label }))} />
            <SelectField label="Company Type" value={form.companyType || ""} onChange={v => setForm({ ...form, companyType: v })} options={config.companyType.map(s => ({ value: s.value, label: s.label }))} />
            <SelectField label="Compliance Status" value={form.complianceStatus || ""} onChange={v => setForm({ ...form, complianceStatus: v })} options={config.complianceStatus.map(s => ({ value: s.value, label: s.label }))} />
            <SelectField label="Final Authorization Status" value={form.finalAuthStatus || ""} onChange={v => setForm({ ...form, finalAuthStatus: v })} options={config.finalAuthStatus.map(s => ({ value: s.value, label: s.label }))} />
            <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 8 }}>
              <label style={{ fontSize: 12, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5 }}>RÔLE(S)</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {config.roles.map(r => {
                  const isSelected = (form.roles || []).includes(r.value);
                  return <div key={r.value} onClick={() => toggleRole(r.value)}
                    style={{ padding: "6px 14px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, background: isSelected ? `${r.color}25` : COLORS.bg, border: `1.5px solid ${isSelected ? r.color : COLORS.border}`, color: isSelected ? r.color : COLORS.textSub, transition: "all 0.15s", userSelect: "none" }}>
                    {isSelected && <span style={{ marginRight: 5, fontSize: 11 }}>✓</span>}{r.label}
                  </div>;
                })}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 22, justifyContent: "flex-end" }}>
            <Btn variant="secondary" onClick={() => setEditCompany(null)}>Annuler</Btn>
            <Btn onClick={saveEdit}>Enregistrer</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
};

// ─── PIPELINE ─────────────────────────────────────────────────
const Pipeline = ({ contacts, setContacts, companies, setCompanies }) => {
  const { config } = useConfig();
  const [view, setView] = useState("contacts");
  const [dragging, setDragging] = useState(null);
  const [dragOver, setDragOver] = useState(null);

  const isContacts = view === "contacts";
  const items = isContacts ? contacts : companies;
  const handleDrop = (targetStatus) => {
    if (dragging) {
      if (isContacts) setContacts(contacts.map(i => i.id === dragging ? { ...i, status: targetStatus } : i));
      else setCompanies(companies.map(i => i.id === dragging ? { ...i, status: targetStatus } : i));
    }
    setDragging(null); setDragOver(null);
  };

  const columns = config.activityStatus.map(s => ({ key: s.value, label: s.label, color: s.color, items: items.filter(i => i.status === s.value) }));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 24, color: COLORS.text, fontFamily: "'Inter', sans-serif" }}>Pipeline</h1>
        <div style={{ display: "flex", gap: 8 }}>
          {[["contacts", "Contacts"], ["companies", "Sociétés"]].map(([v, l]) => (
            <button key={v} onClick={() => { setView(v); setDragging(null); }} style={{ background: view === v ? COLORS.accent : "transparent", border: `1px solid ${view === v ? COLORS.accent : COLORS.border}`, color: view === v ? "#fff" : COLORS.textSub, padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontFamily: "inherit" }}>{l}</button>
          ))}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(columns.length, 4)}, 1fr)`, gap: 16 }}>
        {columns.map(col => (
          <div key={col.key} onDragOver={e => { e.preventDefault(); setDragOver(col.key); }} onDrop={() => handleDrop(col.key)} onDragLeave={() => setDragOver(null)}
            style={{ background: dragOver === col.key ? `${col.color}15` : COLORS.card, border: `1px solid ${dragOver === col.key ? col.color : COLORS.border}`, borderRadius: 14, padding: 16, transition: "all 0.2s", minHeight: 280 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: col.color }} />
                <span style={{ fontWeight: 700, color: COLORS.text, fontSize: 14 }}>{col.label}</span>
              </div>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: COLORS.textSub }}>{col.items.length}</span>
            </div>
            {col.items.map(item => {
              const company = isContacts ? companies.find(co => co.id === item.companyId) : null;
              return (
                <div key={item.id} draggable onDragStart={() => setDragging(item.id)}
                  style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "12px 14px", marginBottom: 10, cursor: "grab", opacity: dragging === item.id ? 0.4 : 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Avatar initials={item.avatar} size={32} color={col.color} square={!isContacts} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text }}>{item.name}</div>
                      {isContacts && <div style={{ fontSize: 11, color: COLORS.blue }}>{company?.name || "—"}</div>}
                      {!isContacts && <div style={{ fontSize: 11, color: COLORS.textSub }}>{item.country || "—"}</div>}
                    </div>
                  </div>
                  {item.revenue > 0 && <div style={{ marginTop: 8, fontSize: 12, color: COLORS.green, fontFamily: "'DM Mono', monospace" }}>{item.revenue.toLocaleString("fr")} €</div>}
                  {isContacts && item.priority && <div style={{ marginTop: 8 }}><Badge label={PRIORITY_CONFIG[item.priority]?.label} color={PRIORITY_CONFIG[item.priority]?.color} /></div>}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <p style={{ color: COLORS.textMuted, fontSize: 12, marginTop: 12 }}>💡 Glissez-déposez pour changer l'Activity Status</p>
    </div>
  );
};


// ─── FIFO ENGINE ─────────────────────────────────────────────
const runFIFO = (bucketOps, lotSize = 1) => {
  const parseP = (v) => {
    const s = String(v ?? "").replace(/,/g, ".");
    // Handle fraction string "201 4/8"
    if (s.includes(" ") && s.includes("/")) {
      const [intStr, fracStr] = s.split(" ");
      const [fn, fd] = fracStr.split("/").map(Number);
      const result = parseInt(intStr) + fn / fd;
      return isNaN(result) ? 0 : result;
    }
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  };
  const sorted = [...bucketOps].sort((a, b) => {
    const da = a.tradeDate || "9999", db = b.tradeDate || "9999";
    if (da !== db) return da < db ? -1 : 1;
    // Same date: BUY before SELL
    const sideA = (a.side || "").toUpperCase() === "BUY" ? 0 : 1;
    const sideB = (b.side || "").toUpperCase() === "BUY" ? 0 : 1;
    if (sideA !== sideB) return sideA - sideB;
    return (a.id || 0) < (b.id || 0) ? -1 : 1;
  });
  const buyQueue  = []; // pending BUYs
  const sellQueue = []; // pending SELLs (short positions)
  const matches = [];
  let realizedPnl = 0;

  for (const op of sorted) {
    const side = (op.side || "").toUpperCase();
    const lots  = parseP(op.quantity);
    const price = parseP(op.price);

    if (side === "BUY") {
      let remaining = lots;
      // First: match against pending SELLs (close short positions)
      while (remaining > 0 && sellQueue.length > 0) {
        const head = sellQueue[0];
        const matched = Math.min(remaining, head.remaining);
        const pnl = (head.price - price) * matched * lotSize; // short PnL: sell price - buy price
        realizedPnl += pnl;
        matches.push({
          buyRef: op.ref,    buyDate: op.tradeDate || "—",
          sellRef: head.ref, sellDate: head.date,
          lots: matched, entryPrice: head.price, exitPrice: price, pnl,
          position: "SHORT",
        });
        head.remaining -= matched;
        remaining      -= matched;
        if (head.remaining <= 0) sellQueue.shift();
      }
      // Remaining goes into BUY queue (long position)
      if (remaining > 0) {
        buyQueue.push({ ref: op.ref, date: op.tradeDate || "—", lots, price, remaining });
      }
    } else if (side === "SELL") {
      let remaining = lots;
      // First: match against pending BUYs (close long positions)
      while (remaining > 0 && buyQueue.length > 0) {
        const head = buyQueue[0];
        const matched = Math.min(remaining, head.remaining);
        const pnl = (price - head.price) * matched * lotSize;
        realizedPnl += pnl;
        matches.push({
          buyRef: head.ref,  buyDate: head.date,
          sellRef: op.ref,   sellDate: op.tradeDate || "—",
          lots: matched, entryPrice: head.price, exitPrice: price, pnl,
          position: "LONG",
        });
        head.remaining -= matched;
        remaining      -= matched;
        if (head.remaining <= 0) buyQueue.shift();
      }
      // Remaining goes into SELL queue (short position)
      if (remaining > 0) {
        sellQueue.push({ ref: op.ref, date: op.tradeDate || "—", lots, price, remaining });
      }
    }
  }

  const openLongLots  = buyQueue.reduce((s, e) => s + e.remaining, 0);
  const openShortLots = sellQueue.reduce((s, e) => s + e.remaining, 0);
  const openLots = openLongLots - openShortLots;
  const openAvgPrice = openLongLots > 0
    ? buyQueue.reduce((s, e) => s + e.price * e.remaining, 0) / openLongLots
    : openShortLots > 0
    ? sellQueue.reduce((s, e) => s + e.price * e.remaining, 0) / openShortLots
    : 0;
  return { realizedPnl, matches, openLots, openAvgPrice };
};

// ─── DERIVATIVES DASHBOARD ───────────────────────────────────
// ─── TRADING HOURS INDICATOR ─────────────────────────────────
const _thPad = n => String(n).padStart(2, '0');
const _thToM  = (h, m) => h * 60 + m;

function _thLocalDate(tz) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
}
function _thLocalMins(tz) {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(new Date());
  return parseInt(p.find(x => x.type === 'hour').value) * 60 + parseInt(p.find(x => x.type === 'minute').value);
}
function _thLocalDay(tz) {
  return new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' }).format(new Date());
}

function _thGetStatus(exchange, sessions, holidays) {
  const exSessions = sessions.filter(s => s.exchange_id === exchange.id).sort((a, b) => a.sort_order - b.sort_order);
  const today = _thLocalDate(exchange.timezone);
  const isHoliday = holidays.some(h => h.exchange_id === exchange.id && h.date === today);
  const day = _thLocalDay(exchange.timezone);
  const cur = _thLocalMins(exchange.timezone);

  // Sessions active today (based on trading_days if available, fallback Mon-Fri)
  const todaySessions = exSessions.filter(s => {
    const td = s.trading_days;
    if (!td || !Array.isArray(td) || td.length === 0) return day !== 'Sat' && day !== 'Sun';
    return td.includes(day);
  });

  const nextOpen = (c) => {
    let best = Infinity;
    todaySessions.forEach(s => { let d = _thToM(s.open_hour, s.open_minute) - c; if (d <= 0) d += 1440; if (d < best) best = d; });
    // Also check next trading days if no sessions today
    if (best === Infinity) {
      exSessions.forEach(s => { let d = _thToM(s.open_hour, s.open_minute) - c; if (d <= 0) d += 1440; if (d < best) best = d; });
    }
    return best;
  };

  if (isHoliday) return { kind: 'holiday', diffMins: nextOpen(cur) + 1440 };
  if (todaySessions.length === 0) {
    const daysToNext = day === 'Sat' ? 2 : day === 'Sun' ? 1 : 1;
    const firstOpen = _thToM(exSessions[0]?.open_hour || 8, exSessions[0]?.open_minute || 0);
    return { kind: 'weekend', diffMins: daysToNext * 1440 - cur + firstOpen };
  }

  for (const s of todaySessions) {
    const o = _thToM(s.open_hour, s.open_minute), c = _thToM(s.close_hour, s.close_minute);
    if (s.overnight) { if (cur >= o || cur < c) return { kind: 'open', session: s.name, diffMins: cur >= o ? 1440 - cur + c : c - cur }; }
    else { if (cur >= o && cur < c) return { kind: 'open', session: s.name, diffMins: c - cur }; }
  }
  return { kind: 'closed', diffMins: nextOpen(cur) };
}

function _thFmt(m) {
  const h = Math.floor(m / 60), mn = m % 60;
  return h === 0 ? `${mn}min` : `${h}h ${_thPad(mn)}min`;
}

function _thShortLabel(st) {
  if (st.kind === 'open')    return `Closes in ${_thFmt(st.diffMins)}`;
  if (st.kind === 'holiday') return `Holiday`;
  if (st.kind === 'weekend') return `Opens Mon`;
  return `Opens in ${_thFmt(st.diffMins)}`;
}

function TradingHoursIndicator() {
  const [exchanges, setExchanges] = useState([]);
  const [sessions, setSessions]   = useState([]);
  const [holidays, setHolidays]   = useState([]);
  const [tick, setTick]           = useState(0);

  useEffect(() => {
    async function load() {
      const [{ data: ex }, { data: se }, { data: ho }] = await Promise.all([
        supabase.from('exchanges').select('*').eq('active', true).order('id'),
        supabase.from('exchange_sessions').select('*').order('sort_order'),
        supabase.from('exchange_holidays').select('*'),
      ]);
      if (ex) setExchanges(ex);
      if (se) setSessions(se);
      if (ho) setHolidays(ho);
    }
    load();
  }, []);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  if (!exchanges.length) return null;

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
      <style>{`
        @keyframes th-ripple { 0%{opacity:.8;transform:scale(1);}70%{opacity:0;transform:scale(1.9);}100%{opacity:0;transform:scale(1.9);} }
        .th-pill:hover .th-tip { display: block !important; }
        .th-pill:hover { border-color: #444 !important; }
      `}</style>
      {exchanges.map(ex => {
        const st = _thGetStatus(ex, sessions, holidays);
        const dotColor = st.kind === 'open' ? '#1D9E75' : st.kind === 'holiday' ? '#EF9F27' : '#E24B4A';
        const txtColor = st.kind === 'open' ? '#5DCAA5' : st.kind === 'holiday' ? '#FAC775' : '#F09595';
        const badgeBg  = st.kind === 'open' ? '#0F6E5622' : st.kind === 'holiday' ? '#854F0B22' : '#A32D2D22';
        const badgeBdr = st.kind === 'open' ? '#0F6E5644' : st.kind === 'holiday' ? '#854F0B44' : '#A32D2D44';
        const badgeTxt = st.kind === 'open' ? '#5DCAA5'   : st.kind === 'holiday' ? '#FAC775'   : '#F09595';
        const badgeLbl = st.kind === 'open' ? 'Open' : st.kind === 'holiday' ? 'Holiday' : st.kind === 'weekend' ? 'Weekend' : 'Closed';
        const tipMsg   = st.kind === 'open'    ? `Closes in ${_thFmt(st.diffMins)}`
                       : st.kind === 'holiday' ? `Holiday · opens in ${_thFmt(st.diffMins)}`
                       : st.kind === 'weekend' ? `Opens Monday in ${_thFmt(st.diffMins)}`
                       : `Opens in ${_thFmt(st.diffMins)}`;
        const exSessions = sessions.filter(s => s.exchange_id === ex.id).sort((a, b) => a.sort_order - b.sort_order);
        const showTag = st.kind === 'open' && exSessions.length > 1;
        return (
          <div key={ex.id} className="th-pill" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, position: 'relative', cursor: 'default' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1e1e1e', border: '0.5px solid #2e2e2e', borderRadius: 20, padding: '4px 10px 4px 7px', transition: 'border-color 0.15s' }}>
              <span style={{ position: 'relative', display: 'inline-block', width: 9, height: 9, flexShrink: 0 }}>
                <span style={{ display: 'block', width: 9, height: 9, borderRadius: '50%', background: dotColor }} />
                <span style={{ position: 'absolute', inset: -3, borderRadius: '50%', border: `1.5px solid ${dotColor}`, animation: 'th-ripple 2s infinite' }} />
              </span>
              <span style={{ fontSize: 12, fontWeight: 500, color: '#d0d0d0' }}>{ex.name}</span>
              {showTag && <span style={{ fontSize: 10, color: '#666', background: '#252525', borderRadius: 4, padding: '1px 5px' }}>{st.session}</span>}
            </div>
            <span style={{ fontSize: 10, color: txtColor, whiteSpace: 'nowrap' }}>{_thShortLabel(st)}</span>
            <div className="th-tip" style={{ display: 'none', position: 'absolute', top: 'calc(100% + 8px)', left: '50%', transform: 'translateX(-50%)', background: '#1a1a1a', border: '0.5px solid #333', borderRadius: 8, padding: '10px 14px', minWidth: 210, zIndex: 100, pointerEvents: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: '#e0e0e0' }}>{ex.name} · {ex.city}</span>
                <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, fontWeight: 500, background: badgeBg, color: badgeTxt, border: `0.5px solid ${badgeBdr}` }}>{badgeLbl}</span>
              </div>
              <div style={{ fontSize: 11, color: '#777', marginBottom: 8, lineHeight: 1.5 }}>{tipMsg}</div>
              <div style={{ borderTop: '0.5px solid #2a2a2a', paddingTop: 7 }}>
                {exSessions.map(s => {
                  const active = st.kind === 'open' && s.name === st.session;
                  return (
                    <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                      <span style={{ fontSize: 11, color: '#666', display: 'flex', alignItems: 'center', gap: 4 }}>
                        {active && <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#1D9E75', display: 'inline-block' }} />}
                        {s.name}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 500, color: '#aaa' }}>{_thPad(s.open_hour)}:{_thPad(s.open_minute)} – {_thPad(s.close_hour)}:{_thPad(s.close_minute)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── EXPIRY ROW ───────────────────────────────────────────────
const EURONEXT_EXCHANGES = ["euronext", "matif"];

function ExpiryRow({ instrument, exchange, index, products }) {
  const isEuronext = EURONEXT_EXCHANGES.includes((exchange || "").toLowerCase());
  const norm = v => (v || "").toLowerCase().trim();
  const product = products.find(p => norm(p.label) === norm(instrument));
  const fnd = product?.firstNoticeDay || "";
  const ltd = product?.lastTradingDate || "";

  const fmtDate = (d) => {
    if (!d) return "";
    const date = new Date(d);
    if (isNaN(date)) return d;
    return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
  };

  return (
    <div style={{
      display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
      padding: "12px 20px", borderBottom: `1px solid ${COLORS.border}`,
      background: index % 2 === 0 ? COLORS.card : `${COLORS.card}BB`,
      alignItems: "center",
    }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text, fontFamily: "'DM Mono', monospace" }}>{instrument}</div>
        <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 1 }}>{exchange || "—"}</div>
      </div>
      <div style={{ fontSize: 13, fontFamily: "'DM Mono', monospace", textAlign: "right", color: (fnd && !isEuronext) ? COLORS.orange : COLORS.textMuted, fontStyle: (!fnd || isEuronext) ? "italic" : "normal" }}>
        {isEuronext ? "—" : (fnd ? fmtDate(fnd) : "—")}
      </div>
      <div style={{ fontSize: 13, fontFamily: "'DM Mono', monospace", textAlign: "right", color: ltd ? COLORS.accent : COLORS.textMuted, fontStyle: !ltd ? "italic" : "normal" }}>
        {ltd ? fmtDate(ltd) : "—"}
      </div>
    </div>
  );
}

// ─── DERIV STATISTICS ────────────────────────────────────────
// ─── SHARED HELPERS (used by both Statistics and Dashboard) ──
const _norm = v => (v || "").toLowerCase().trim().replace(/_/g, " ");

const resolveLotSize = (exchange, instrument, products, lotSizes) => {
  const product = products.find(p => _norm(p.label) === _norm(instrument));
  const underlying = product?.underlying || instrument;
  const resolvedExchange = product?.stoxxExchange || exchange;
  const normUnderlying = _norm(underlying);
  const normExchange = _norm(resolvedExchange);
  let match = lotSizes.find(l => _norm(l.exchange) === normExchange && _norm(l.instrument) === normUnderlying);
  if (!match) match = lotSizes.find(l => _norm(l.instrument) === normUnderlying);
  if (!match && normExchange) match = lotSizes.find(l => _norm(l.exchange) === normExchange);
  return match ? (parseFloat(match.quantity) || 1) : 1;
};

const resolvePriceUnit = (exchange, instrument, products, priceUnits) => {
  const product = products.find(p => _norm(p.label) === _norm(instrument));
  const resolvedExchange = product?.stoxxExchange || exchange;
  const resolvedUnderlying = product?.underlying || "";
  const normExchange = _norm(resolvedExchange);
  const normUnderlying = _norm(resolvedUnderlying);
  let match = normUnderlying
    ? priceUnits.find(p => _norm(p.exchange) === normExchange && _norm(p.underlying || "") === normUnderlying)
    : null;
  if (!match) match = priceUnits.find(p => _norm(p.exchange) === normExchange && !p.underlying);
  if (!match) match = priceUnits.find(p => _norm(p.exchange) === normExchange);
  return match ? (parseFloat(match.unit) || 1) : 1;
};

const DerivStatistics = () => {
  const { config } = useConfig();
  const [ops, setOps] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [products, setProducts] = useState([]);
  const [lotSizes, setLotSizes] = useState([]);
  const [priceUnits, setPriceUnits] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAll() {
      setLoading(true);
      // Load ops
      const PAGE = 1000;
      let allOps = [];
      let from = 0;
      while (true) {
        const { data, error } = await supabase.from('derivatives').select('data').range(from, from + PAGE - 1);
        if (error || !data || data.length === 0) break;
        allOps = [...allOps, ...data.map(r => r.data ?? r)];
        if (data.length < PAGE) break;
        from += PAGE;
      }
      setOps(allOps);
      const { data: accData } = await supabase.from('deriv_accounts').select('*');
      if (accData?.length) setAccounts(accData.map(r => r.data ?? r));
      const { data: prodData } = await supabase.from('deriv_products').select('data');
      if (prodData?.length) setProducts(prodData.map(r => r.data ?? r));
      const { data: lsData } = await supabase.from('deriv_lot_sizes').select('data');
      if (lsData?.length) setLotSizes(lsData.map(r => r.data ?? r));
      const { data: puData } = await supabase.from('deriv_price_units').select('data');
      if (puData?.length) setPriceUnits(puData.map(r => r.data ?? r));
      setLoading(false);
    }
    loadAll();
  }, []);

  const currentYear = new Date().getFullYear();
  const years = [currentYear - 2, currentYear - 1, currentYear];

  // Filter only speculative accounts
  const specAccNums = new Set(
    accounts.filter(a => (a.accountType || "").toLowerCase() === "speculative").map(a => a.accountNumber)
  );

  // Filter ops for speculative accounts
  const specOps = ops.filter(o => specAccNums.has(o.account));

  // FIFO per bucket (account × instrument) — returns realizedPnl
  const runFIFOPnl = (bucketOps, lotSize = 1) => {
    const parseP = v => {
      const s = String(v ?? "").replace(/,/g, ".");
      if (s.includes(" ") && s.includes("/")) {
        const [intStr, fracStr] = s.split(" ");
        const [fn, fd] = fracStr.split("/").map(Number);
        const result = parseInt(intStr) + fn / fd;
        return isNaN(result) ? 0 : result;
      }
      const n = parseFloat(s);
      return isNaN(n) ? 0 : n;
    };
    const sorted = [...bucketOps].sort((a, b) => {
      const da = a.tradeDate || "9999", db = b.tradeDate || "9999";
      if (da !== db) return da < db ? -1 : 1;
      const sa = (a.side || "").toUpperCase() === "BUY" ? 0 : 1;
      const sb = (b.side || "").toUpperCase() === "BUY" ? 0 : 1;
      return sa - sb;
    });
    const buyQueue = [], sellQueue = [];
    let realizedPnl = 0;
    for (const op of sorted) {
      const side = (op.side || "").toUpperCase();
      const lots = parseP(op.quantity);
      const price = parseP(op.price);
      if (side === "BUY") {
        let rem = lots;
        while (rem > 0 && sellQueue.length > 0) {
          const h = sellQueue[0];
          const matched = Math.min(rem, h.remaining);
          realizedPnl += (h.price - price) * matched * lotSize;
          h.remaining -= matched; rem -= matched;
          if (h.remaining <= 0) sellQueue.shift();
        }
        if (rem > 0) buyQueue.push({ price, remaining: rem });
      } else if (side === "SELL") {
        let rem = lots;
        while (rem > 0 && buyQueue.length > 0) {
          const h = buyQueue[0];
          const matched = Math.min(rem, h.remaining);
          realizedPnl += (price - h.price) * matched * lotSize;
          h.remaining -= matched; rem -= matched;
          if (h.remaining <= 0) buyQueue.shift();
        }
        if (rem > 0) sellQueue.push({ price, remaining: rem });
      }
    }
    return realizedPnl;
  };

  // ── P&L DETAIL MODAL (Statistics) ──
  const [statDetailRow, setStatDetailRow] = useState(null); // { label, ops }

  // getStatFifoDetail must be defined before getPnlByYear (which calls it)
  const getStatFifoDetail = (rowOps) => {
    const norm = v => (v || "").toLowerCase().trim();
    const buckets = {};
    for (const op of rowOps) {
      const key = `${op.account}||${norm(op.instrument)}`;
      if (!buckets[key]) buckets[key] = { account: op.account, instrument: op.instrument, ops: [] };
      buckets[key].ops.push(op);
    }
    return Object.values(buckets).map(b => {
      const ls = resolveLotSize(b.ops[0]?.exchange || "", b.instrument, products, lotSizes);
      const pu = resolvePriceUnit(b.ops[0]?.exchange || "", b.instrument, products, priceUnits);
      const lotSize = ls * pu;
      const fifo = runFIFO(b.ops, lotSize);
      return {
        account: b.account,
        instrument: b.instrument,
        buyCount: b.ops.filter(o => (o.side||"").toUpperCase() === "BUY").length,
        sellCount: b.ops.filter(o => (o.side||"").toUpperCase() === "SELL").length,
        matches: fifo.matches,
        realizedPnl: fifo.realizedPnl,
        openLots: fifo.openLots,
      };
    }).filter(b => b.matches.length > 0 || b.buyCount > 0);
  };

  // Compute P&L per year — using EXIT date (sellDate) to assign each match to a year
  // Uses exactly the same FIFO logic as getStatFifoDetail / exportYearToExcel to stay in sync
  const getPnlByYear = (opsSubset) => {
    const pnlByYear = {};
    for (const year of years) pnlByYear[year] = 0;
    const buckets = getStatFifoDetail(opsSubset);
    for (const b of buckets) {
      for (const m of b.matches) {
        const exitYear = m.sellDate && m.sellDate !== "—" ? parseInt(m.sellDate.slice(0, 4)) : null;
        if (exitYear && pnlByYear[exitYear] !== undefined) {
          pnlByYear[exitYear] += m.pnl;
        }
      }
    }
    return pnlByYear;
  };

  // ── TABLE 1: by BU × Underlying Category ──
  const table1 = useMemo(() => {
    const norm = v => (v || "").toLowerCase().trim();
    const result = {};
    for (const op of specOps) {
      const acc = accounts.find(a => a.accountNumber === op.account);
      const bu = acc?.businessUnit || op.businessUnit || "—";
      const product = products.find(p => norm(p.label) === norm(op.instrument));
      const underlyingCat = product?.underlyingCategory || "—";
      const key = `${bu}||${underlyingCat}`;
      if (!result[key]) result[key] = { bu, underlyingCat, ops: [] };
      result[key].ops.push(op);
    }
    return Object.values(result).map(r => ({ ...r, pnlByYear: getPnlByYear(r.ops) }))
      .sort((a, b) => a.bu.localeCompare(b.bu) || a.underlyingCat.localeCompare(b.underlyingCat));
  }, [ops, accounts, products, lotSizes, priceUnits]);

  // ── TABLE 2: by BU × Account ──
  const table2 = useMemo(() => {
    // Collect all ops per account (BU must not split FIFO — run on full account history)
    const byAccount = {};
    for (const op of specOps) {
      const account = op.account || "—";
      if (!byAccount[account]) byAccount[account] = { ops: [], bu: null };
      byAccount[account].ops.push(op);
    }
    for (const account of Object.keys(byAccount)) {
      const acc = accounts.find(a => a.accountNumber === account);
      byAccount[account].bu = acc?.businessUnit || byAccount[account].ops[0]?.businessUnit || "—";
    }
    return Object.entries(byAccount).map(([account, { bu, ops: accOps }]) => ({
      bu, account, ops: accOps, pnlByYear: getPnlByYear(accOps),
    })).sort((a, b) => a.bu.localeCompare(b.bu) || a.account.localeCompare(b.account));
  }, [ops, accounts, products, lotSizes, priceUnits]);

  const fmtPnl = (n) => {
    if (n === 0 || n === undefined) return "—";
    const abs = Math.abs(Math.round(n)).toLocaleString("en-US");
    return (n >= 0 ? "+ " : "− ") + abs;
  };
  const pnlColor = (n) => !n || n === 0 ? COLORS.textMuted : n > 0 ? COLORS.green : COLORS.red;

  const exportStatDetailToExcel = async (label, rowOps) => {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    const buckets = getStatFifoDetail(rowOps);
    const fmtNum = n => typeof n === "number" ? Math.round(n * 100) / 100 : n;

    const sheetData = [
      ["ACCOUNT", "INSTRUMENT", "POSITION", "BUY REF", "DATE BUY", "SELL REF", "DATE SELL", "LOTS", "PRIX ENTRÉE", "PRIX SORTIE", "DELTA", "P&L"],
    ];

    for (const b of [...buckets].sort((a, z) => Math.abs(z.realizedPnl) - Math.abs(a.realizedPnl))) {
      for (const m of b.matches) {
        sheetData.push([
          b.account, b.instrument,
          m.position || "LONG",
          m.buyRef || "—", m.buyDate,
          m.sellRef || "—", m.sellDate,
          m.lots, fmtNum(m.entryPrice), fmtNum(m.exitPrice),
          fmtNum(m.exitPrice - m.entryPrice), fmtNum(m.pnl),
        ]);
      }
    }

    const totalPnl = buckets.reduce((s, b) => s + b.realizedPnl, 0);
    const totalLots = buckets.reduce((s, b) => s + b.matches.reduce((ss, m) => ss + m.lots, 0), 0);
    sheetData.push([]);
    sheetData.push(["TOTAL", "", "", "", "", "", "", totalLots, "", "", "", fmtNum(totalPnl)]);

    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    XLSX.utils.book_append_sheet(wb, ws, "P&L Détail");

    const date = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `stats_pnl_${label.replace(/[^a-zA-Z0-9]/g, "_")}_${date}.xlsx`);
  };

  const totalRow1 = years.reduce((acc, y) => ({ ...acc, [y]: table1.reduce((s, r) => s + (r.pnlByYear[y] || 0), 0) }), {});
  const totalRow2 = years.reduce((acc, y) => ({ ...acc, [y]: table2.reduce((s, r) => s + (r.pnlByYear[y] || 0), 0) }), {});

  const exportYearToExcel = async (label, rowOps, year) => {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    // Run full FIFO then filter matches by exit year (sellDate)
    const buckets = getStatFifoDetail(rowOps);
    const fmtNum = n => typeof n === "number" ? Math.round(n * 100) / 100 : n;

    const sheetData = [
      ["ACCOUNT", "INSTRUMENT", "POSITION", "BUY REF", "DATE BUY", "SELL REF", "DATE SELL", "LOTS", "PRIX ENTRÉE", "PRIX SORTIE", "DELTA", "P&L"],
    ];
    let totalPnl = 0, totalLots = 0;
    for (const b of [...buckets].sort((a, z) => Math.abs(z.realizedPnl) - Math.abs(a.realizedPnl))) {
      const yearMatches = b.matches.filter(m => m.sellDate && m.sellDate !== "—" && parseInt(m.sellDate.slice(0, 4)) === year);
      for (const m of yearMatches) {
        sheetData.push([
          b.account, b.instrument,
          m.position || "LONG",
          m.buyRef || "—", m.buyDate,
          m.sellRef || "—", m.sellDate,
          m.lots, fmtNum(m.entryPrice), fmtNum(m.exitPrice),
          fmtNum(m.exitPrice - m.entryPrice), fmtNum(m.pnl),
        ]);
        totalPnl += m.pnl;
        totalLots += m.lots;
      }
    }
    sheetData.push([]);
    sheetData.push(["TOTAL", "", "", "", "", "", "", totalLots, "", "", "", fmtNum(totalPnl)]);

    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    XLSX.utils.book_append_sheet(wb, ws, `P&L ${year}`);
    XLSX.writeFile(wb, `stats_pnl_${label.replace(/[^a-zA-Z0-9]/g, "_")}_${year}.xlsx`);
  };

  const TableHeader = ({ cols }) => (
    <div style={{ display: "grid", gridTemplateColumns: cols, background: COLORS.tableHeader, padding: "10px 20px", borderRadius: "10px 10px 0 0" }}>
      {["BU", "Category / Account", ...years.map(String), ...years.map(y => String(y))].map((h, i) => (
        <div key={i} style={{ fontSize: 10, fontWeight: 700, color: i >= 2 + years.length ? COLORS.green : COLORS.textMuted, letterSpacing: 0.8, textAlign: i < 2 ? "left" : "center" }}>
          {h}
        </div>
      ))}
    </div>
  );

  const COLS = `80px 1fr repeat(3, 120px) repeat(3, 44px)`;

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300, color: COLORS.textMuted, fontSize: 14 }}>
      Chargement des données…
    </div>
  );

  // Group rows by BU for display
  const renderTable = (rows, labelKey, totalRow) => {
    const bus = [...new Set(rows.map(r => r.bu))];
    return (
      <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: 12, overflow: "hidden" }}>
        <TableHeader cols={COLS} />
        {bus.map(bu => {
          const buRows = rows.filter(r => r.bu === bu);
          const buTotal = years.reduce((acc, y) => ({ ...acc, [y]: buRows.reduce((s, r) => s + (r.pnlByYear[y] || 0), 0) }), {});
          return (
            <div key={bu}>
              {/* BU subtotal row */}
              <div style={{ display: "grid", gridTemplateColumns: COLS, padding: "9px 20px", background: `${COLORS.accent}10`, borderBottom: `1px solid ${COLORS.border}`, alignItems: "center" }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: COLORS.accent, fontFamily: "'DM Mono', monospace" }}>{(bu || "—").toUpperCase()}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.textSub }}>{buRows.length} ligne{buRows.length > 1 ? "s" : ""}</div>
                {years.map(y => (
                  <div key={y} style={{ textAlign: "right", fontSize: 13, fontWeight: 800, fontFamily: "'DM Mono', monospace", color: pnlColor(buTotal[y]) }}>{fmtPnl(buTotal[y])}</div>
                ))}
                {years.map(y => <div key={`xl-${y}`} />)}
              </div>
              {/* Detail rows */}
              {buRows.map((row, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: COLS, padding: "9px 20px", borderBottom: `1px solid ${COLORS.border}`, background: i % 2 === 0 ? COLORS.card : `${COLORS.card}BB`, alignItems: "center" }}>
                  <div />
                  <div style={{ fontSize: 13, color: COLORS.text, fontWeight: 500 }}>{row[labelKey] || "—"}</div>
                  {years.map(y => (
                    <div key={y} style={{ textAlign: "right", fontSize: 13, fontFamily: "'DM Mono', monospace", color: pnlColor(row.pnlByYear[y]), fontWeight: 600 }}>{fmtPnl(row.pnlByYear[y])}</div>
                  ))}
                  {years.map(y => (
                    <div key={`xl-${y}`} style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <div
                        onClick={() => exportYearToExcel(row[labelKey] || "—", row.ops, y)}
                        title={`Exporter P&L ${y}`}
                        style={{ cursor: "pointer", transition: "opacity 0.15s" }}
                        onMouseOver={e => e.currentTarget.style.opacity = "0.7"}
                        onMouseOut={e => e.currentTarget.style.opacity = "1"}
                      >
                        <img src="/logoxl.png" style={{ width: 20, height: 20, objectFit: "contain" }} />
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          );
        })}
        {/* Grand total */}
        <div style={{ display: "grid", gridTemplateColumns: COLS, padding: "12px 20px", background: COLORS.tableHeader, borderTop: `2px solid ${COLORS.border}`, alignItems: "center" }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: COLORS.text }}>TOTAL</div>
          <div />
          {years.map(y => (
            <div key={y} style={{ textAlign: "right", fontSize: 14, fontWeight: 800, fontFamily: "'DM Mono', monospace", color: pnlColor(totalRow[y]) }}>{fmtPnl(totalRow[y])}</div>
          ))}
          {years.map(y => <div key={`xl-${y}`} />)}
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      {/* Header */}
      <div>
        <div style={{ fontSize: 26, fontWeight: 800, color: COLORS.text, fontFamily: "'Playfair Display', serif", letterSpacing: 0.5 }}>Statistics</div>
        <div style={{ fontSize: 13, color: COLORS.textMuted, marginTop: 4 }}>Analyse P&L des comptes spéculatifs — {years.join(", ")}</div>
      </div>

      {/* SPEC ACCOUNT block */}
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 4, height: 28, borderRadius: 2, background: COLORS.accent }} />
          <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.text }}>SPEC ACCOUNT</div>
          <span style={{ fontSize: 11, color: COLORS.textMuted, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "2px 10px" }}>
            {specAccNums.size} compte{specAccNums.size > 1 ? "s" : ""} spéculatif{specAccNums.size > 1 ? "s" : ""}
          </span>
        </div>

        {specAccNums.size === 0 ? (
          <div style={{ textAlign: "center", color: COLORS.textMuted, fontSize: 14, padding: "40px 0", background: COLORS.card, borderRadius: 12, border: `1px solid ${COLORS.border}` }}>
            Aucun compte de type "Speculative" trouvé
          </div>
        ) : (
          <>
            {/* Table 1: BU × Underlying Category */}
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.textSub, marginBottom: 12, letterSpacing: 0.5 }}>P&L PAR BU × UNDERLYING CATEGORY</div>
              {table1.length === 0
                ? <div style={{ textAlign: "center", color: COLORS.textMuted, fontSize: 13, padding: 24, background: COLORS.card, borderRadius: 12, border: `1px solid ${COLORS.border}` }}>Aucune opération</div>
                : renderTable(table1, "underlyingCat", totalRow1)
              }
            </div>

            {/* Table 2: BU × Account */}
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.textSub, marginBottom: 12, letterSpacing: 0.5 }}>P&L PAR BU × ACCOUNT</div>
              {table2.length === 0
                ? <div style={{ textAlign: "center", color: COLORS.textMuted, fontSize: 13, padding: 24, background: COLORS.card, borderRadius: 12, border: `1px solid ${COLORS.border}` }}>Aucune opération</div>
                : renderTable(table2, "account", totalRow2)
              }
            </div>
          </>
        )}
      </div>

      {/* ── STAT P&L DETAIL MODAL ── */}
      {statDetailRow && (() => {
        const buckets = getStatFifoDetail(statDetailRow.ops);
        const totalPnl = buckets.reduce((s, b) => s + b.realizedPnl, 0);
        const MATCH_GRID = "1fr 1fr 1fr 1fr 80px 90px 90px 110px";
        return (
          <div style={{ position: "fixed", inset: 0, background: "#00000099", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, padding: 24 }}
               onClick={e => { if (e.target === e.currentTarget) setStatDetailRow(null); }}>
            <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 18, width: "100%", maxWidth: 940, maxHeight: "88vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>

              {/* Header */}
              <div style={{ background: COLORS.tableHeader, padding: "18px 24px", borderBottom: `1px solid ${COLORS.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: COLORS.text, fontFamily: "'DM Mono', monospace" }}>{statDetailRow.label}</div>
                  <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 2 }}>Détail du calcul P&L — méthode FIFO</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <button
                    onClick={() => exportStatDetailToExcel(statDetailRow.label, statDetailRow.ops)}
                    style={{ display: "flex", alignItems: "center", gap: 7, background: "#1D6F42", border: "1px solid #1a5c37", borderRadius: 8, padding: "8px 14px", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
                    onMouseOver={e => e.currentTarget.style.opacity = "0.85"}
                    onMouseOut={e => e.currentTarget.style.opacity = "1"}
                  >
                    <img src="/logoxl.png" style={{ width: 18, height: 18, objectFit: "contain" }} />
                    Exporter Excel
                  </button>
                  <button onClick={() => setStatDetailRow(null)} style={{ background: "none", border: "none", color: COLORS.textSub, cursor: "pointer", fontSize: 24, lineHeight: 1, padding: 0 }}>×</button>
                </div>
              </div>

              {/* Body */}
              <div style={{ overflowY: "auto", flex: 1 }}>
                <div style={{ margin: "16px 24px 0", background: `${COLORS.blue}10`, border: `1px solid ${COLORS.blue}30`, borderRadius: 10, padding: "12px 16px", fontSize: 12, color: COLORS.textSub, lineHeight: 1.7 }}>
                  <strong style={{ color: COLORS.text }}>Formule appliquée :</strong>{" "}
                  P&L réalisé = Σ <span style={{ color: COLORS.accent, fontFamily: "'DM Mono', monospace" }}>(Prix SELL − Prix BUY) × Lots matchés × Lot Size</span>. BUY consommés dans l'ordre chronologique (FIFO).
                </div>

                {buckets.sort((a, z) => Math.abs(z.realizedPnl) - Math.abs(a.realizedPnl)).map((b, j) => (
                  <div key={j} style={{ margin: "16px 24px 0" }}>
                    <div style={{ background: COLORS.tableHeader, borderRadius: "10px 10px 0 0", padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", border: `1px solid ${COLORS.border}`, borderBottom: "none" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 7, height: 7, borderRadius: "50%", background: COLORS.accent }} />
                        <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.text }}>{b.account}</span>
                        <span style={{ fontSize: 11, color: COLORS.textMuted }}>—</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.textSub }}>{b.instrument}</span>
                        <span style={{ fontSize: 11, color: COLORS.textMuted, marginLeft: 4 }}>{b.buyCount} BUY · {b.sellCount} SELL · {b.matches.length} match{b.matches.length !== 1 ? "es" : ""}</span>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 900, fontFamily: "'DM Mono', monospace", color: b.sellCount > 0 ? (b.realizedPnl >= 0 ? COLORS.green : COLORS.red) : COLORS.textMuted }}>
                        {b.sellCount > 0 ? fmtPnl(b.realizedPnl) : "Pas de SELL"}
                      </div>
                    </div>
                    {b.matches.length > 0 ? (
                      <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: "0 0 10px 10px", overflow: "hidden" }}>
                        <div style={{ display: "grid", gridTemplateColumns: MATCH_GRID, padding: "8px 16px", background: `${COLORS.tableHeader}CC`, borderBottom: `1px solid ${COLORS.border}` }}>
                          {["BUY REF", "DATE BUY", "SELL REF", "DATE SELL", "LOTS", "PRIX ENTRÉE", "PRIX SORTIE", "P&L"].map((h, i) => (
                            <div key={i} style={{ fontSize: 9, fontWeight: 700, color: COLORS.textMuted, letterSpacing: 0.5, textAlign: i >= 4 ? "right" : "left" }}>{h}</div>
                          ))}
                        </div>
                        {b.matches.map((m, k) => (
                          <div key={k} style={{ display: "grid", gridTemplateColumns: MATCH_GRID, padding: "9px 16px", borderBottom: k < b.matches.length - 1 ? `1px solid ${COLORS.border}20` : "none", background: k % 2 === 0 ? "transparent" : `${COLORS.card}40`, alignItems: "center" }}>
                            <div style={{ fontSize: 11, color: COLORS.green, fontFamily: "'DM Mono', monospace", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.buyRef || "—"}</div>
                            <div style={{ fontSize: 11, color: COLORS.textSub, fontFamily: "'DM Mono', monospace" }}>{m.buyDate}</div>
                            <div style={{ fontSize: 11, color: COLORS.red, fontFamily: "'DM Mono', monospace", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.sellRef || "—"}</div>
                            <div style={{ fontSize: 11, color: COLORS.textSub, fontFamily: "'DM Mono', monospace" }}>{m.sellDate}</div>
                            <div style={{ textAlign: "right", fontSize: 12, fontFamily: "'DM Mono', monospace", color: COLORS.text, fontWeight: 600 }}>{m.lots}</div>
                            <div style={{ textAlign: "right", fontSize: 12, fontFamily: "'DM Mono', monospace", color: COLORS.textSub }}>{m.entryPrice.toFixed(2)}</div>
                            <div style={{ textAlign: "right" }}>
                              <div style={{ fontSize: 12, fontFamily: "'DM Mono', monospace", color: COLORS.textSub }}>{m.exitPrice.toFixed(2)}</div>
                              <div style={{ fontSize: 9, color: m.exitPrice > m.entryPrice ? COLORS.green : COLORS.red, fontFamily: "'DM Mono', monospace" }}>
                                {m.exitPrice > m.entryPrice ? "▲" : "▼"} {Math.abs(m.exitPrice - m.entryPrice).toFixed(2)}
                              </div>
                            </div>
                            <div style={{ textAlign: "right" }}>
                              <div style={{ fontSize: 13, fontWeight: 800, fontFamily: "'DM Mono', monospace", color: m.pnl >= 0 ? COLORS.green : COLORS.red }}>{fmtPnl(m.pnl)}</div>
                              <div style={{ fontSize: 9, color: COLORS.textMuted, fontFamily: "'DM Mono', monospace" }}>({m.exitPrice > m.entryPrice ? "+" : ""}{(m.exitPrice - m.entryPrice).toFixed(2)}) × {m.lots}</div>
                            </div>
                          </div>
                        ))}
                        <div style={{ display: "grid", gridTemplateColumns: MATCH_GRID, padding: "9px 16px", background: `${COLORS.accent}08`, borderTop: `1px solid ${COLORS.accent}25` }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.accent, gridColumn: "1 / 5" }}>SOUS-TOTAL {b.instrument}</div>
                          <div style={{ textAlign: "right", fontSize: 12, fontFamily: "'DM Mono', monospace", color: COLORS.text, fontWeight: 700 }}>{b.matches.reduce((s,m)=>s+m.lots,0)}</div>
                          <div /><div />
                          <div style={{ textAlign: "right", fontSize: 14, fontWeight: 900, fontFamily: "'DM Mono', monospace", color: b.realizedPnl >= 0 ? COLORS.green : COLORS.red }}>{fmtPnl(b.realizedPnl)}</div>
                        </div>
                      </div>
                    ) : (
                      <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: "0 0 10px 10px", padding: "16px", textAlign: "center", color: COLORS.textMuted, fontSize: 12 }}>
                        Aucun match FIFO — position entièrement ouverte ({b.openLots} lots).
                      </div>
                    )}
                  </div>
                ))}

                {/* Grand total */}
                <div style={{ margin: "16px 24px 24px", background: `${COLORS.accent}10`, border: `2px solid ${COLORS.accent}40`, borderRadius: 10, padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: COLORS.accent }}>TOTAL — {statDetailRow.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 900, fontFamily: "'DM Mono', monospace", color: totalPnl >= 0 ? COLORS.green : COLORS.red }}>{fmtPnl(totalPnl)}</div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

const DerivativesDashboard = () => {
  const { config } = useConfig();
  const [ops, setOps] = useState([]);
  const [derivAccounts, setDerivAccounts] = useState([]);
  const [lotSizes, setLotSizes] = useState([]);
  const [products, setProducts] = useState([]);
  const [priceUnits, setPriceUnits] = useState([]);
  const [quotationUnits, setQuotationUnits] = useState([]);
  const [marketPrices, setMarketPrices] = useState({});
  const [editingMktKey, setEditingMktKey] = useState(null);

  useEffect(() => {
    async function loadAll() {
      const { data: accData } = await supabase.from('deriv_accounts').select('*');
      const { data: lsData }  = await supabase.from('deriv_lot_sizes').select('data');
      const { data: mpData }  = await supabase.from('deriv_market_prices').select('*');
      const { data: prodData } = await supabase.from('deriv_products').select('data');
      const { data: puData }  = await supabase.from('deriv_price_units').select('data');
      const { data: quData }  = await supabase.from('deriv_quotation_units').select('data');
      // Load all derivatives pages
      const PAGE = 1000;
      let allOps = [];
      let from = 0;
      while (true) {
        const { data, error } = await supabase.from('derivatives').select('data').order('id', { ascending: true }).range(from, from + PAGE - 1);
        if (error || !data || data.length === 0) break;
        allOps = [...allOps, ...data.map(r => r.data ?? r)];
        if (data.length < PAGE) break;
        from += PAGE;
      }
      if (allOps.length) setOps(allOps);
      if (accData?.length) setDerivAccounts(accData.map(r => {
        const acc = r.data ?? r;
        if (typeof acc.isActive === "string") {
          acc.isActive = acc.isActive.trim().toLowerCase() !== "false" && acc.isActive.trim() !== "0";
        }
        return acc;
      }));
      if (lsData?.length) setLotSizes(lsData.map(r => r.data ?? r));
      if (prodData?.length) setProducts(prodData.map(r => r.data ?? r));
      if (puData?.length) setPriceUnits(puData.map(r => r.data ?? r));
      if (quData?.length) setQuotationUnits(quData.map(r => r.data ?? r));
      if (mpData?.length) {
        const prices = {};
        mpData.forEach(r => { prices[r.key] = r.value; });
        setMarketPrices(prices);
      }
    }
    loadAll();
  }, []);

  const getAccountLabel = (val) => {
    if (!val) return "No Account";
    const fromTable = derivAccounts.find(a => a.accountNumber === val);
    if (fromTable) return fromTable.accountNumber;
    const fromConfig = (config.derivAccounts || []).find(a => a.value === val);
    return fromConfig?.label || val;
  };

  // Get lot size for a given exchange+instrument combo
  const getLotSize = (exchange, instrument) => resolveLotSize(exchange, instrument, products, lotSizes);
  const getPriceUnit = (exchange, instrument) => resolvePriceUnit(exchange, instrument, products, priceUnits);

  const saveMarketPrice = async (key, value) => {
    if (value === undefined || value === "") {
      await supabase.from('deriv_market_prices').delete().eq('key', key);
    } else {
      await supabase.from('deriv_market_prices').upsert({ key, value: String(value) }, { onConflict: 'key' });
    }
  };

  const formatMktPrice = (price, instrument) => {
    if (price === null || price === undefined || price === "") return "— éditer";
    const prod = products.find(p => p.label === instrument);
    const fmt = prod?.decimals || "decimal";
    if (fmt.includes("/")) {
      const den = parseInt(fmt.split("/")[1] || "8");
      // If already stored as fraction string "201 4/8", display as-is
      if (typeof price === "string" && price.includes(" ") && price.includes("/")) return price;
      const num = parseFloat(price);
      if (isNaN(num)) return String(price);
      const intPart = Math.floor(num);
      const fracNum = Math.round((num - intPart) * den);
      if (fracNum === 0) return String(intPart);
      if (fracNum === den) return String(intPart + 1);
      return `${intPart} ${fracNum}/${den}`;
    }
    const dpMatch = fmt.match(/^decimal(\d)$/);
    if (dpMatch) return parseFloat(price).toFixed(parseInt(dpMatch[1]));
    return String(price);
  };
  const roundToTick = (val, instrument) => {
    const prod = products.find(p => p.label === instrument);
    const tick = prod?.tickSize || "";
    if (!tick) return val;
    if (tick.includes("/")) {
      const [num, den] = tick.split("/").map(Number);
      const tickVal = num / den;
      return Math.round(val / tickVal) * tickVal;
    }
    const tickVal = parseFloat(tick);
    if (!tickVal || isNaN(tickVal)) return val;
    return Math.round(val / tickVal) * tickVal;
  };
  const fmtLots = (n) => Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 });
  const fmt = (n) => {
    const abs = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (n >= 0 ? "+ " : "− ") + abs;
  };
  const pnlColor = (n) => n > 0 ? COLORS.green : n < 0 ? COLORS.red : COLORS.textMuted;

  // Build all FIFO computations — re-runs when ops or lotSizes are loaded
  const { bucketResults, rows, grandPnl, grandOpenLots, totalBuys, totalSells, totalMatches, openPositions, bucketsCount } = useMemo(() => {
    const buckets = {};
    for (const op of ops) {
      const normKey = `${(op.account || "").toLowerCase().trim()}||${(op.instrument || "").toLowerCase().trim()}`;
      if (!buckets[normKey]) buckets[normKey] = { account: op.account || "", instrument: op.instrument || "", ops: [] };
      buckets[normKey].ops.push(op);
    }

    const bucketResults = Object.values(buckets).map(b => {
      const exchange = products.find(p => (p.label || "").toLowerCase().trim() === (b.instrument || "").toLowerCase().trim())?.stoxxExchange || b.ops[0]?.exchange || "";
      const ls = getLotSize(exchange, b.instrument);
      const pu = getPriceUnit(exchange, b.instrument);
      return { ...b, exchange, lotSize: ls, priceUnit: pu, ...runFIFO(b.ops, ls * pu) };
    });

    const accountMap = {};
    for (const b of bucketResults) {
      if (!accountMap[b.account]) accountMap[b.account] = { account: b.account, realizedPnl: 0, openLots: 0, instruments: [] };
      accountMap[b.account].realizedPnl += b.realizedPnl;
      accountMap[b.account].openLots += b.openLots;
      accountMap[b.account].instruments.push({
        instrument: b.instrument,
        realizedPnl: b.realizedPnl,
        openLots: b.openLots,
        openAvgPrice: b.openAvgPrice,
        matches: b.matches,
        buyCount: b.ops.filter(o => (o.side || "").toUpperCase() === "BUY").length,
        sellCount: b.ops.filter(o => (o.side || "").toUpperCase() === "SELL").length,
      });
    }

    const rows = Object.values(accountMap).sort((a, b) => Math.abs(b.realizedPnl) - Math.abs(a.realizedPnl));
    const grandPnl = rows.reduce((s, r) => s + r.realizedPnl, 0);
    const grandOpenLots = rows.reduce((s, r) => s + r.openLots, 0);
    const totalBuys = ops.filter(o => (o.side || "").toUpperCase() === "BUY").length;
    const totalSells = ops.filter(o => (o.side || "").toUpperCase() === "SELL").length;
    const totalMatches = bucketResults.reduce((s, b) => s + b.matches.length, 0);

    // Open positions
    const positions = [];
    for (const b of bucketResults) {
      if (!b.openLots || b.openLots === 0) continue;
      const allBuyLots  = b.ops.filter(o => (o.side||"").toUpperCase() === "BUY").reduce((s,o) => s + (parseFloat(o.quantity)||0), 0);
      const allSellLots = b.ops.filter(o => (o.side||"").toUpperCase() === "SELL").reduce((s,o) => s + (parseFloat(o.quantity)||0), 0);
      const side = allBuyLots >= allSellLots ? "BUY" : "SELL";
      const openPositionSide = side === "BUY" ? "LONG" : "SHORT";
      const accRecord = derivAccounts.find(a => a.accountNumber === b.account);
      const product = products.find(p => (p.label || "").toLowerCase().trim() === (b.instrument || "").toLowerCase().trim());
      positions.push({
        key: `${b.account}||${b.instrument}`,
        account: b.account,
        instrument: b.instrument,
        side,
        openPositionSide,
        openLots: b.openLots,
        avgOpenPrice: b.openAvgPrice || 0,
        trade: accRecord?.trade || "",
        bank: accRecord?.financingBank || "",
        lotSize: b.lotSize,
        priceUnit: b.priceUnit,
        exchange: b.exchange,
        currency: (product?.currency || "").toUpperCase(),
        quotationUnit: quotationUnits.find(q => q.underlying === product?.underlying && q.exchange === product?.stoxxExchange)?.quotationUnit || product?.quotationUnit || "",
      });
    }
    const openPositions = positions.sort((a, b) => a.side === b.side ? 0 : a.side === "BUY" ? -1 : 1);

    return { bucketResults, rows, grandPnl, grandOpenLots, totalBuys, totalSells, totalMatches, openPositions, bucketsCount: Object.keys(buckets).length };
  }, [ops, lotSizes, derivAccounts, products, priceUnits, quotationUnits]);

  const OPEN_GRID = "0.55fr 130px 150px 70px 80px 110px 130px 130px 130px";

  const GRID = "32px 1fr 70px 70px 120px 90px 170px";
  const MATCH_GRID = "1fr 1fr 1fr 1fr 100px 100px 100px 130px";

  const [expandedAccounts, setExpandedAccounts] = useState({});
  const [expandedInstruments, setExpandedInstruments] = useState({});
  const toggle = (key) => setExpandedAccounts(p => ({ ...p, [key]: !p[key] }));
  const toggleInst = (key) => setExpandedInstruments(p => ({ ...p, [key]: !p[key] }));
  const [pnlAccountSearch, setPnlAccountSearch] = useState("");

  // ── P&L DETAIL MODAL ──
  const [pnlDetailAccount, setPnlDetailAccount] = useState(null); // row object

  const exportPnlDetailToExcel = async (row) => {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    const fmtNum = n => typeof n === "number" ? Math.round(n * 100) / 100 : n;

    const sheetData = [
      ["INSTRUMENT", "POSITION", "BUY REF", "DATE BUY", "SELL REF", "DATE SELL", "LOTS", "PRIX ENTRÉE", "PRIX SORTIE", "DELTA", "P&L"],
    ];

    const sorted = [...row.instruments].sort((a, b) => Math.abs(b.realizedPnl) - Math.abs(a.realizedPnl));
    for (const inst of sorted) {
      for (const m of inst.matches) {
        sheetData.push([
          inst.instrument,
          m.position || "LONG",
          m.buyRef || "—", m.buyDate,
          m.sellRef || "—", m.sellDate,
          m.lots, fmtNum(m.entryPrice), fmtNum(m.exitPrice),
          fmtNum(m.exitPrice - m.entryPrice), fmtNum(m.pnl),
        ]);
      }
    }

    // Total row
    const totalPnl = row.instruments.reduce((s, i) => s + i.realizedPnl, 0);
    const totalLots = row.instruments.reduce((s, i) => s + i.matches.reduce((ss, m) => ss + m.lots, 0), 0);
    sheetData.push([]);
    sheetData.push(["TOTAL", "", "", "", "", "", totalLots, "", "", "", fmtNum(totalPnl)]);

    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    XLSX.utils.book_append_sheet(wb, ws, "P&L Détail");

    const date = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `pnl_${(row.account || "compte").replace(/[^a-zA-Z0-9]/g, "_")}_${date}.xlsx`);
  };

  const KpiCard = ({ label, value, sub, color }) => (
    <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: "20px 24px" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.textMuted, letterSpacing: 0.8, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: color || COLORS.text, fontFamily: "'DM Mono', monospace", lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 6 }}>{sub}</div>}
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <h1 style={{ margin: 0, fontSize: 28, color: COLORS.text, fontFamily: "'Inter', sans-serif", fontWeight: 700 }}>Derivatives Dashboard</h1>
            <TradingHoursIndicator />
          </div>
          <div style={{ fontSize: 13, color: COLORS.textMuted }}>Realised P&amp;L — FIFO par compte × instrument</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ background: `${COLORS.green}15`, border: `1px solid ${COLORS.green}30`, borderRadius: 10, padding: "8px 16px", fontSize: 13, color: COLORS.green, fontWeight: 700 }}>▲ {totalBuys} BUY</div>
          <div style={{ background: `${COLORS.red}15`, border: `1px solid ${COLORS.red}30`, borderRadius: 10, padding: "8px 16px", fontSize: 13, color: COLORS.red, fontWeight: 700 }}>▼ {totalSells} SELL</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
        <KpiCard label="REALISED P&L (FIFO)" value={totalSells > 0 ? fmt(grandPnl) : "—"} color={totalSells > 0 ? pnlColor(grandPnl) : COLORS.textMuted} sub={totalSells > 0 ? `${rows.length} compte${rows.length > 1 ? "s" : ""}` : "Aucun SELL enregistré"} />
        <KpiCard label="TOTAL OPÉRATIONS" value={ops.length} sub={`${totalBuys} BUY · ${totalSells} SELL`} />
        <KpiCard label="LOTS OUVERTS" value={fmtLots(grandOpenLots)} color={COLORS.orange} sub="position nette non clôturée" />
        <KpiCard label="MATCHES FIFO" value={totalMatches} sub={`sur ${bucketsCount} bucket${bucketsCount > 1 ? "s" : ""}`} />
      </div>

      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, overflow: "hidden" }}>
        <div style={{ background: COLORS.tableHeader, padding: "14px 20px", borderBottom: `1px solid ${COLORS.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text }}>POSITIONS OUVERTES</div>
            <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 2 }}>Market price éditable — P&amp;L latent calculé automatiquement</div>
          </div>
          <div style={{ fontSize: 12, color: COLORS.orange, fontWeight: 700, background: `${COLORS.orange}15`, border: `1px solid ${COLORS.orange}30`, borderRadius: 8, padding: "4px 12px" }}>
            {openPositions.length} position{openPositions.length > 1 ? "s" : ""}
          </div>
        </div>

        {/* Header */}
        <div style={{ display: "grid", gridTemplateColumns: OPEN_GRID, padding: "10px 20px", background: `${COLORS.tableHeader}99`, borderBottom: `1px solid ${COLORS.border}` }}>
          {["ACCOUNT", "TRADE", "BANQUE", "SIDE", "QUANTITY", "AVG OPEN PRICE", "MARKET PRICE", "P&L / LOT", "P&L"].map((h, i) => (
            <div key={i} style={{ fontSize: 10, fontWeight: 700, color: COLORS.textMuted, letterSpacing: 0.7, textAlign: i >= 3 ? "right" : "left", paddingLeft: i === 2 ? 48 : 0 }}>{h}</div>
          ))}
        </div>

        {openPositions.length === 0 && (
          <div style={{ textAlign: "center", color: COLORS.textMuted, padding: "40px 0", fontSize: 13 }}>
            Aucune position ouverte — toutes les opérations sont équilibrées.
          </div>
        )}

        {openPositions.map((pos, i) => {
          const mktRaw = marketPrices[pos.key];
          const mktPrice = mktRaw !== undefined ? parseFloat(mktRaw) : null;
          const isEditing = editingMktKey === pos.key;
          const pnlPerLot = (mktPrice !== null && pos.avgOpenPrice)
            ? (pos.side === "BUY" ? mktPrice - pos.avgOpenPrice : pos.avgOpenPrice - mktPrice)
            : null;
          const pnl = pnlPerLot !== null ? pnlPerLot * Math.abs(pos.openLots) * pos.lotSize * (pos.priceUnit || 1) : null;
          const sideColor = pos.side === "BUY" ? COLORS.green : COLORS.red;
          const CURRENCY_SYMBOLS = { EUR: "€", USD: "$", GBP: "£", MAD: "MAD", UAH: "₴", CHF: "CHF" };
          const sym = pos.currency ? (CURRENCY_SYMBOLS[pos.currency] || pos.currency) : "";
          const fmtPnl = (n) => {
            const rounded = Math.round(n);
            const abs = Math.abs(rounded).toLocaleString("en-US");
            return (n >= 0 ? "+ " : "− ") + abs + (sym ? " " + sym : "");
          };
          const fmtPnlLot = (n) => {
            const abs = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            const unit = pos.quotationUnit || sym;
            return (n >= 0 ? "+ " : "− ") + abs + (unit ? " " + unit : "");
          };

          return (
            <div key={pos.key} style={{ display: "grid", gridTemplateColumns: OPEN_GRID, padding: "12px 20px", borderBottom: `1px solid ${COLORS.border}`, background: i % 2 === 0 ? COLORS.card : `${COLORS.card}BB`, alignItems: "center" }}>
              {/* Account */}
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text, fontFamily: "'DM Mono', monospace" }}>{pos.account || "—"}</div>
                <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 1 }}>{pos.instrument || "—"}</div>
              </div>
              {/* Trade */}
              <div style={{ fontSize: 12, color: COLORS.textSub, fontFamily: "'DM Mono', monospace" }}>{pos.trade || "—"}</div>
              {/* Banque */}
              <div style={{ fontSize: 12, color: COLORS.textSub, paddingLeft: 48 }}>{pos.bank || "—"}</div>
              {/* Side */}
              <div style={{ textAlign: "right" }}>
                <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 5, background: `${sideColor}20`, color: sideColor }}>{pos.openPositionSide}</span>
              </div>
              {/* Quantity */}
              <div style={{ textAlign: "right", fontSize: 13, fontFamily: "'DM Mono', monospace", color: COLORS.orange, fontWeight: 700 }}>{fmtLots(Math.abs(pos.openLots))}</div>
              {/* Avg open price */}
              <div style={{ textAlign: "right", fontSize: 13, fontFamily: "'DM Mono', monospace", color: COLORS.textSub }}>{pos.avgOpenPrice > 0 ? formatMktPrice(pos.avgOpenPrice, pos.instrument) : "—"}</div>
              {/* Market price — editable, persisted */}
              <div style={{ textAlign: "right" }}>
                {isEditing ? (
                  <input
                    autoFocus
                    defaultValue={mktRaw ?? ""}
                    onBlur={e => {
                      const v = e.target.value.replace(/[^\d.-]/g, "");
                      if (v === "") {
                        setMarketPrices(p => ({ ...p, [pos.key]: undefined }));
                        saveMarketPrice(pos.key, undefined);
                      } else {
                        const rounded = roundToTick(parseFloat(v), pos.instrument);
                        const newVal = String(rounded);
                        setMarketPrices(p => ({ ...p, [pos.key]: newVal }));
                        saveMarketPrice(pos.key, newVal);
                      }
                      setEditingMktKey(null);
                    }}
                    onKeyDown={e => { if (e.key === "Enter") e.target.blur(); if (e.key === "Escape") setEditingMktKey(null); }}
                    style={{ width: 90, background: COLORS.bg, border: `1px solid ${COLORS.accent}`, borderRadius: 6, padding: "4px 8px", color: COLORS.text, fontSize: 13, fontFamily: "'DM Mono', monospace", outline: "none", textAlign: "right" }}
                  />
                ) : (
                  <span
                    onClick={() => setEditingMktKey(pos.key)}
                    title="Cliquez pour éditer"
                    style={{ fontSize: 13, fontFamily: "'DM Mono', monospace", color: mktPrice !== null ? COLORS.accent : COLORS.textMuted, cursor: "pointer", borderBottom: `1px dashed ${COLORS.textMuted}`, paddingBottom: 1 }}>
                    {mktPrice !== null ? formatMktPrice(mktPrice, pos.instrument) : "— éditer"}
                  </span>
                )}
              </div>
              {/* P&L per lot */}
              <div style={{ textAlign: "right", fontSize: 13, fontFamily: "'DM Mono', monospace", color: pnlPerLot !== null ? pnlColor(pnlPerLot) : COLORS.textMuted, fontWeight: 600 }}>
                {pnlPerLot !== null ? fmtPnlLot(pnlPerLot) : "—"}
              </div>
              {/* P&L total (× lots × lotSize) */}
              <div style={{ textAlign: "right", fontSize: 14, fontFamily: "'DM Mono', monospace", color: pnl !== null ? pnlColor(pnl) : COLORS.textMuted, fontWeight: 800 }}>
                {pnl !== null ? fmtPnl(pnl) : "—"}
              </div>
            </div>
          );
        })}

        {openPositions.length > 0 && (() => {
          const totalPnl = openPositions.reduce((s, pos) => {
            const mktPrice = marketPrices[pos.key] !== undefined ? parseFloat(marketPrices[pos.key]) : null;
            if (mktPrice === null || !pos.avgOpenPrice) return s;
            const pnlPerLot = pos.side === "BUY" ? mktPrice - pos.avgOpenPrice : pos.avgOpenPrice - mktPrice;
            return s + pnlPerLot * Math.abs(pos.openLots) * pos.lotSize * (pos.priceUnit || 1);
          }, 0);
          const hasAnyPrice = openPositions.some(pos => marketPrices[pos.key] !== undefined);
          return (
            <div style={{ display: "grid", gridTemplateColumns: OPEN_GRID, padding: "12px 20px", background: `${COLORS.accent}08`, borderTop: `2px solid ${COLORS.accent}30` }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: COLORS.accent, gridColumn: "1 / 6" }}>TOTAL P&amp;L LATENT</div>
              <div /><div /><div />
              <div style={{ textAlign: "right", fontSize: 16, fontWeight: 900, fontFamily: "'DM Mono', monospace", color: hasAnyPrice ? pnlColor(totalPnl) : COLORS.textMuted }}>
                {hasAnyPrice ? fmt(totalPnl) : "—"}
              </div>
            </div>
          );
        })()}
      </div>

      {/* ── EXPIRIES ── */}
      {openPositions.length > 0 && (() => {
        const uniquePositions = [...new Map(
          openPositions.map(p => [`${(p.exchange||"").toLowerCase()}||${p.instrument}`, { instrument: p.instrument, exchange: p.exchange }])
        ).values()].sort((a, b) => a.instrument.localeCompare(b.instrument));
        return (
          <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, overflow: "hidden" }}>
            <div style={{ background: COLORS.tableHeader, padding: "14px 20px", borderBottom: `1px solid ${COLORS.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text }}>EXPIRIES</div>
                <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 2 }}>First Notice Day &amp; Last Trading Day par instrument ouvert</div>
              </div>
              <div style={{ fontSize: 12, color: COLORS.accent, fontWeight: 700, background: `${COLORS.accent}15`, border: `1px solid ${COLORS.accent}30`, borderRadius: 8, padding: "4px 12px" }}>
                {uniquePositions.length} instrument{uniquePositions.length > 1 ? "s" : ""}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", padding: "10px 20px", background: `${COLORS.tableHeader}99`, borderBottom: `1px solid ${COLORS.border}` }}>
              {["INSTRUMENT", "FIRST NOTICE DAY", "LAST TRADING DAY"].map((h, i) => (
                <div key={i} style={{ fontSize: 10, fontWeight: 700, color: COLORS.textMuted, letterSpacing: 0.7, textAlign: i === 0 ? "left" : "right" }}>{h}</div>
              ))}
            </div>
            {uniquePositions.map(({ instrument, exchange }, i) => (
              <ExpiryRow key={`${(exchange||"").toLowerCase()}||${instrument}`} instrument={instrument} exchange={exchange} index={i} products={products} />
            ))}
          </div>
        );
      })()}

      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, overflow: "hidden" }}>
        <div style={{ background: COLORS.tableHeader, padding: "14px 20px", borderBottom: `1px solid ${COLORS.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text }}>P&amp;L PAR COMPTE</div>
            <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 2 }}>Cliquez sur un compte pour voir le détail par instrument</div>
          </div>
          <input
            placeholder="🔍 Rechercher un compte…"
            value={pnlAccountSearch}
            onChange={e => setPnlAccountSearch(e.target.value)}
            style={{ width: 220, background: COLORS.bg, border: `1px solid ${pnlAccountSearch ? COLORS.accent + "80" : COLORS.border}`, borderRadius: 8, padding: "8px 14px", color: COLORS.text, fontSize: 13, outline: "none", fontFamily: "inherit", transition: "border-color 0.2s" }}
            onFocus={e => e.target.style.borderColor = COLORS.accent}
            onBlur={e => e.target.style.borderColor = pnlAccountSearch ? COLORS.accent + "80" : COLORS.border}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: GRID, padding: "10px 20px", background: `${COLORS.tableHeader}99`, borderBottom: `1px solid ${COLORS.border}` }}>
          {["", "COMPTE", "BUY", "SELL", "LOTS OUVERTS", "MATCHES", "REALISED P&L"].map((h, i) => (
            <div key={i} style={{ fontSize: 10, fontWeight: 700, color: COLORS.textMuted, letterSpacing: 0.7, textAlign: i >= 2 ? "right" : "left" }}>{h}</div>
          ))}
        </div>

        {(() => {
          const q = pnlAccountSearch.toLowerCase().trim();
          return q ? rows.filter(r => (r.account || "").toLowerCase().includes(q)) : rows;
        })().length === 0 && (
          <div style={{ textAlign: "center", color: COLORS.textMuted, padding: "48px 0", fontSize: 14 }}>
            Aucune opération. Ajoutez des BUY et des SELL dans Derivatives.
          </div>
        )}

        {(() => {
          const q = pnlAccountSearch.toLowerCase().trim();
          const filteredRows = q ? rows.filter(r => (r.account || "").toLowerCase().includes(q)) : rows;
          return filteredRows.map((row, idx) => {
          const expanded = expandedAccounts[row.account];
          const isLast = idx === rows.length - 1;
          const totalBuyCount = row.instruments.reduce((s, i) => s + i.buyCount, 0);
          const totalSellCount = row.instruments.reduce((s, i) => s + i.sellCount, 0);
          const totalMatchCount = row.instruments.reduce((s, i) => s + i.matches.length, 0);

          return (
            <div key={row.account}>
              <div
                onClick={() => toggle(row.account)}
                style={{ display: "grid", gridTemplateColumns: GRID, padding: "14px 20px", borderBottom: `1px solid ${isLast && !expanded ? "transparent" : COLORS.border}`, cursor: "pointer", background: idx % 2 === 0 ? COLORS.card : `${COLORS.card}BB`, transition: "background 0.12s" }}
                onMouseOver={e => { e.currentTarget.style.background = COLORS.hover; }}
                onMouseOut={e => { e.currentTarget.style.background = idx % 2 === 0 ? COLORS.card : `${COLORS.card}BB`; }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 10, color: COLORS.textMuted, display: "inline-block", transition: "transform 0.2s", transform: expanded ? "rotate(90deg)" : "rotate(0deg)" }}>▶</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: `${COLORS.accent}18`, border: `1px solid ${COLORS.accent}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>🏦</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }}>{getAccountLabel(row.account)}</div>
                    <div style={{ fontSize: 11, color: COLORS.textMuted }}>{row.instruments.length} instrument{row.instruments.length > 1 ? "s" : ""}</div>
                  </div>
                  {/* Excel icon — détail P&L */}
                  <div
                    onClick={e => { e.stopPropagation(); setPnlDetailAccount(row); }}
                    title="Voir le détail du calcul P&L"
                    style={{ marginLeft: 4, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, transition: "opacity 0.15s" }}
                    onMouseOver={e => e.currentTarget.style.opacity = "0.7"}
                    onMouseOut={e => e.currentTarget.style.opacity = "1"}
                  >
                    <img src="/logoxl.png" style={{ width: 28, height: 28, objectFit: "contain" }} />
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.green }}>{totalBuyCount}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.red }}>{totalSellCount}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
                  <span style={{ fontSize: 13, fontFamily: "'DM Mono', monospace", color: row.openLots > 0 ? COLORS.orange : COLORS.textMuted }}>{fmtLots(row.openLots)}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
                  <span style={{ fontSize: 13, color: COLORS.textSub }}>{totalMatchCount}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
                  {totalSellCount > 0
                    ? <span style={{ fontSize: 16, fontWeight: 900, fontFamily: "'DM Mono', monospace", color: pnlColor(row.realizedPnl) }}>{fmt(row.realizedPnl)}</span>
                    : <span style={{ fontSize: 12, color: COLORS.textMuted }}>Pas de SELL</span>}
                </div>
              </div>

              {expanded && (
                <div style={{ background: COLORS.bg, borderBottom: `1px solid ${COLORS.border}` }}>
                  {/* Instrument sub-header */}
                  <div style={{ display: "grid", gridTemplateColumns: GRID, padding: "8px 20px 8px 52px", background: `${COLORS.tableHeader}66`, borderBottom: `1px solid ${COLORS.border}40` }}>
                    {["", "INSTRUMENT", "BUY", "SELL", "LOTS OUVERTS", "MATCHES", "P&L"].map((h, i) => (
                      <div key={i} style={{ fontSize: 9, fontWeight: 700, color: COLORS.textMuted, letterSpacing: 0.6, textAlign: i >= 2 ? "right" : "left" }}>{h}</div>
                    ))}
                  </div>
                  {row.instruments.sort((a, b) => Math.abs(b.realizedPnl) - Math.abs(a.realizedPnl)).map((inst, j) => {
                    const instKey = `${row.account}||${inst.instrument}`;
                    const instExpanded = expandedInstruments[instKey];
                    const hasMatches = inst.matches.length > 0;
                    return (
                      <div key={j}>
                        {/* Instrument row — clickable if has matches */}
                        <div
                          onClick={() => hasMatches && toggleInst(instKey)}
                          style={{ display: "grid", gridTemplateColumns: GRID, padding: "11px 20px 11px 52px", borderBottom: `1px solid ${COLORS.border}20`, cursor: hasMatches ? "pointer" : "default", transition: "background 0.12s" }}
                          onMouseOver={e => { if (hasMatches) e.currentTarget.style.background = `${COLORS.accent}08`; }}
                          onMouseOut={e => { e.currentTarget.style.background = "transparent"; }}
                        >
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                            {hasMatches && (
                              <span style={{ fontSize: 9, color: COLORS.textMuted, display: "inline-block", transition: "transform 0.2s", transform: instExpanded ? "rotate(90deg)" : "rotate(0deg)" }}>▶</span>
                            )}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ width: 6, height: 6, borderRadius: "50%", background: COLORS.accent, flexShrink: 0 }} />
                            <span style={{ fontSize: 13, color: COLORS.text, fontWeight: 600 }}>{inst.instrument || "—"}</span>
                            {hasMatches && <span style={{ fontSize: 10, color: COLORS.textMuted, marginLeft: 4 }}>Cliquez pour détailler</span>}
                          </div>
                          <div style={{ textAlign: "right", fontSize: 12, color: COLORS.green, fontWeight: 600 }}>{inst.buyCount}</div>
                          <div style={{ textAlign: "right", fontSize: 12, color: COLORS.red, fontWeight: 600 }}>{inst.sellCount}</div>
                          <div style={{ textAlign: "right" }}>
                            <span style={{ fontSize: 12, fontFamily: "'DM Mono', monospace", color: inst.openLots > 0 ? COLORS.orange : COLORS.textMuted }}>{fmtLots(inst.openLots)}</span>
                            {inst.openLots > 0 && inst.openAvgPrice > 0 && (
                              <div style={{ fontSize: 10, color: COLORS.textMuted }}>avg @ {inst.openAvgPrice.toFixed(2)}</div>
                            )}
                          </div>
                          <div style={{ textAlign: "right", fontSize: 12, color: COLORS.textSub }}>{inst.matches.length}</div>
                          <div style={{ textAlign: "right", fontSize: 13, fontWeight: 700, fontFamily: "'DM Mono', monospace", color: inst.sellCount > 0 ? pnlColor(inst.realizedPnl) : COLORS.textMuted }}>
                            {inst.sellCount > 0 ? fmt(inst.realizedPnl) : "—"}
                          </div>
                        </div>

                        {/* Matches detail drill-down */}
                        {instExpanded && (
                          <div style={{ background: `${COLORS.surface}`, borderBottom: `1px solid ${COLORS.border}30`, borderLeft: `3px solid ${COLORS.accent}40`, marginLeft: 52 }}>
                            {/* Match table header */}
                            <div style={{ display: "grid", gridTemplateColumns: MATCH_GRID, padding: "8px 16px", background: `${COLORS.tableHeader}AA`, borderBottom: `1px solid ${COLORS.border}40` }}>
                              {["BUY REF", "DATE BUY", "SELL REF", "DATE SELL", "LOTS MATCHÉS", "PRIX ENTRÉE", "PRIX SORTIE", "P&L"].map((h, i) => (
                                <div key={i} style={{ fontSize: 9, fontWeight: 700, color: COLORS.textMuted, letterSpacing: 0.5, textAlign: i >= 4 ? "right" : "left" }}>{h}</div>
                              ))}
                            </div>
                            {/* Match rows */}
                            {inst.matches.map((m, k) => (
                              <div key={k} style={{ display: "grid", gridTemplateColumns: MATCH_GRID, padding: "9px 16px", borderBottom: k < inst.matches.length - 1 ? `1px solid ${COLORS.border}20` : "none", background: k % 2 === 0 ? "transparent" : `${COLORS.card}40` }}>
                                <div style={{ fontSize: 11, color: COLORS.green, fontFamily: "'DM Mono', monospace", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.buyRef || "—"}</div>
                                <div style={{ fontSize: 11, color: COLORS.textSub, fontFamily: "'DM Mono', monospace" }}>{m.buyDate}</div>
                                <div style={{ fontSize: 11, color: COLORS.red, fontFamily: "'DM Mono', monospace", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.sellRef || "—"}</div>
                                <div style={{ fontSize: 11, color: COLORS.textSub, fontFamily: "'DM Mono', monospace" }}>{m.sellDate}</div>
                                <div style={{ textAlign: "right", fontSize: 12, fontFamily: "'DM Mono', monospace", color: COLORS.text, fontWeight: 600 }}>{fmtLots(m.lots)}</div>
                                <div style={{ textAlign: "right", fontSize: 12, fontFamily: "'DM Mono', monospace", color: COLORS.textSub }}>{m.entryPrice.toFixed(2)}</div>
                                <div style={{ textAlign: "right", fontSize: 12, fontFamily: "'DM Mono', monospace", color: COLORS.textSub }}>{m.exitPrice.toFixed(2)}</div>
                                <div style={{ textAlign: "right", fontSize: 13, fontWeight: 800, fontFamily: "'DM Mono', monospace", color: pnlColor(m.pnl) }}>
                                  {fmt(m.pnl)}
                                </div>
                              </div>
                            ))}
                            {/* Match subtotal */}
                            <div style={{ display: "grid", gridTemplateColumns: MATCH_GRID, padding: "8px 16px", background: `${COLORS.accent}08`, borderTop: `1px solid ${COLORS.accent}25` }}>
                              <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.accent, gridColumn: "1 / 5" }}>SOUS-TOTAL {inst.instrument}</div>
                              <div style={{ textAlign: "right", fontSize: 12, fontFamily: "'DM Mono', monospace", color: COLORS.text, fontWeight: 700 }}>{fmtLots(inst.matches.reduce((s, m) => s + m.lots, 0))}</div>
                              <div />
                              <div />
                              <div style={{ textAlign: "right", fontSize: 13, fontWeight: 900, fontFamily: "'DM Mono', monospace", color: pnlColor(inst.realizedPnl) }}>{fmt(inst.realizedPnl)}</div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        }); })()}

        {rows.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: GRID, padding: "14px 20px", background: `${COLORS.accent}08`, borderTop: `2px solid ${COLORS.accent}30` }}>
            <div /><div style={{ fontSize: 13, fontWeight: 800, color: COLORS.accent }}>TOTAL</div>
            <div style={{ textAlign: "right", fontSize: 13, fontWeight: 700, color: COLORS.green }}>{totalBuys}</div>
            <div style={{ textAlign: "right", fontSize: 13, fontWeight: 700, color: COLORS.red }}>{totalSells}</div>
            <div style={{ textAlign: "right", fontSize: 13, fontWeight: 700, fontFamily: "'DM Mono', monospace", color: grandOpenLots > 0 ? COLORS.orange : COLORS.textMuted }}>{fmtLots(grandOpenLots)}</div>
            <div style={{ textAlign: "right", fontSize: 13, fontWeight: 700, color: COLORS.textSub }}>{totalMatches}</div>
            <div style={{ textAlign: "right", fontSize: 17, fontWeight: 900, fontFamily: "'DM Mono', monospace", color: totalSells > 0 ? pnlColor(grandPnl) : COLORS.textMuted }}>
              {totalSells > 0 ? fmt(grandPnl) : "—"}
            </div>
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "flex-start", background: `${COLORS.blue}10`, border: `1px solid ${COLORS.blue}30`, borderRadius: 12, padding: "14px 18px" }}>
        <span style={{ fontSize: 16, flexShrink: 0 }}>💡</span>
        <div style={{ fontSize: 12, color: COLORS.textSub, lineHeight: 1.7 }}>
          <strong style={{ color: COLORS.text }}>Méthode FIFO :</strong> pour chaque groupe <em>(compte × instrument)</em>, les BUY sont triés par date croissante et consommés dans l'ordre par les SELL.{" "}
          P&amp;L réalisé = Σ (prix SELL − prix BUY) × lots matchés. Les lots sans SELL correspondant sont comptabilisés comme <span style={{ color: COLORS.orange }}>ouverts</span>.
        </div>
      </div>

      {/* ── P&L DETAIL MODAL ── */}
      {pnlDetailAccount && (() => {
        const row = pnlDetailAccount;
        const totalBuyCount = row.instruments.reduce((s, i) => s + i.buyCount, 0);
        const totalSellCount = row.instruments.reduce((s, i) => s + i.sellCount, 0);
        const totalMatchCount = row.instruments.reduce((s, i) => s + i.matches.length, 0);
        const DETAIL_GRID = "1fr 60px 60px 90px 60px 130px";
        const MATCH_DETAIL_GRID = "1fr 1fr 1fr 1fr 90px 90px 90px 120px";
        return (
          <div style={{ position: "fixed", inset: 0, background: "#00000099", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, padding: 24 }}
               onClick={e => { if (e.target === e.currentTarget) setPnlDetailAccount(null); }}>
            <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 18, width: "100%", maxWidth: 920, maxHeight: "88vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>

              {/* Header */}
              <div style={{ background: COLORS.tableHeader, padding: "18px 24px", borderBottom: `1px solid ${COLORS.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 9, background: `${COLORS.accent}20`, border: `1px solid ${COLORS.accent}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🏦</div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: COLORS.text, fontFamily: "'DM Mono', monospace" }}>{getAccountLabel(row.account)}</div>
                    <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 2 }}>Détail du calcul P&amp;L — méthode FIFO</div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {/* Export Excel button */}
                  <button
                    onClick={() => exportPnlDetailToExcel(row)}
                    style={{ display: "flex", alignItems: "center", gap: 7, background: "#1D6F42", border: "1px solid #1a5c37", borderRadius: 8, padding: "8px 14px", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
                    onMouseOver={e => e.currentTarget.style.opacity = "0.85"}
                    onMouseOut={e => e.currentTarget.style.opacity = "1"}
                  >
                    <img src="/logoxl.png" style={{ width: 18, height: 18, objectFit: "contain" }} />
                    Exporter Excel
                  </button>
                  <button onClick={() => setPnlDetailAccount(null)} style={{ background: "none", border: "none", color: COLORS.textSub, cursor: "pointer", fontSize: 24, lineHeight: 1, padding: 0 }}>×</button>
                </div>
              </div>

              {/* KPIs */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, padding: "16px 24px", borderBottom: `1px solid ${COLORS.border}`, flexShrink: 0, background: COLORS.surface }}>
                {[
                  { label: "INSTRUMENTS", value: row.instruments.length, color: COLORS.accent },
                  { label: "BUY", value: totalBuyCount, color: COLORS.green },
                  { label: "SELL", value: totalSellCount, color: COLORS.red },
                  { label: "MATCHES FIFO", value: totalMatchCount, color: COLORS.blue },
                  { label: "REALISED P&L", value: totalSellCount > 0 ? fmt(row.realizedPnl) : "—", color: totalSellCount > 0 ? pnlColor(row.realizedPnl) : COLORS.textMuted },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "12px 16px" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.textMuted, letterSpacing: 0.7, marginBottom: 6 }}>{label}</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color, fontFamily: "'DM Mono', monospace" }}>{value}</div>
                  </div>
                ))}
              </div>

              {/* Body — scrollable */}
              <div style={{ overflowY: "auto", flex: 1 }}>

                {/* Formule FIFO */}
                <div style={{ margin: "16px 24px 0", background: `${COLORS.blue}10`, border: `1px solid ${COLORS.blue}30`, borderRadius: 10, padding: "12px 16px", fontSize: 12, color: COLORS.textSub, lineHeight: 1.7 }}>
                  <strong style={{ color: COLORS.text }}>Formule appliquée :</strong>{" "}
                  P&amp;L réalisé = Σ <span style={{ color: COLORS.accent, fontFamily: "'DM Mono', monospace" }}>(Prix SELL − Prix BUY) × Lots matchés × Lot Size × Price Unit</span>.
                  {" "}Les BUY sont consommés dans l'ordre chronologique (FIFO).
                </div>

                {/* Par instrument */}
                {row.instruments.sort((a, b) => Math.abs(b.realizedPnl) - Math.abs(a.realizedPnl)).map((inst, j) => {
                  const hasMatches = inst.matches.length > 0;
                  return (
                    <div key={j} style={{ margin: "16px 24px 0" }}>
                      {/* Instrument header */}
                      <div style={{ background: COLORS.tableHeader, borderRadius: "10px 10px 0 0", padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", border: `1px solid ${COLORS.border}`, borderBottom: "none" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 7, height: 7, borderRadius: "50%", background: COLORS.accent }} />
                          <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.text }}>{inst.instrument || "—"}</span>
                          <span style={{ fontSize: 11, color: COLORS.textMuted, marginLeft: 4 }}>{inst.buyCount} BUY · {inst.sellCount} SELL · {inst.matches.length} match{inst.matches.length !== 1 ? "es" : ""}</span>
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 900, fontFamily: "'DM Mono', monospace", color: inst.sellCount > 0 ? pnlColor(inst.realizedPnl) : COLORS.textMuted }}>
                          {inst.sellCount > 0 ? fmt(inst.realizedPnl) : "Pas de SELL"}
                        </div>
                      </div>

                      {/* Matches table */}
                      {hasMatches ? (
                        <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: "0 0 10px 10px", overflow: "hidden" }}>
                          {/* Table header */}
                          <div style={{ display: "grid", gridTemplateColumns: MATCH_DETAIL_GRID, padding: "8px 16px", background: `${COLORS.tableHeader}CC`, borderBottom: `1px solid ${COLORS.border}` }}>
                            {["BUY REF", "DATE BUY", "SELL REF", "DATE SELL", "LOTS", "PRIX ENTRÉE", "PRIX SORTIE", "P&L"].map((h, i) => (
                              <div key={i} style={{ fontSize: 9, fontWeight: 700, color: COLORS.textMuted, letterSpacing: 0.5, textAlign: i >= 4 ? "right" : "left" }}>{h}</div>
                            ))}
                          </div>
                          {/* Match rows */}
                          {inst.matches.map((m, k) => (
                            <div key={k} style={{ display: "grid", gridTemplateColumns: MATCH_DETAIL_GRID, padding: "9px 16px", borderBottom: k < inst.matches.length - 1 ? `1px solid ${COLORS.border}20` : "none", background: k % 2 === 0 ? "transparent" : `${COLORS.card}40`, alignItems: "center" }}>
                              <div style={{ fontSize: 11, color: COLORS.green, fontFamily: "'DM Mono', monospace", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.buyRef || "—"}</div>
                              <div style={{ fontSize: 11, color: COLORS.textSub, fontFamily: "'DM Mono', monospace" }}>{m.buyDate}</div>
                              <div style={{ fontSize: 11, color: COLORS.red, fontFamily: "'DM Mono', monospace", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.sellRef || "—"}</div>
                              <div style={{ fontSize: 11, color: COLORS.textSub, fontFamily: "'DM Mono', monospace" }}>{m.sellDate}</div>
                              <div style={{ textAlign: "right", fontSize: 12, fontFamily: "'DM Mono', monospace", color: COLORS.text, fontWeight: 600 }}>{fmtLots(m.lots)}</div>
                              <div style={{ textAlign: "right" }}>
                                <div style={{ fontSize: 12, fontFamily: "'DM Mono', monospace", color: COLORS.textSub }}>{m.entryPrice.toFixed(2)}</div>
                              </div>
                              <div style={{ textAlign: "right" }}>
                                <div style={{ fontSize: 12, fontFamily: "'DM Mono', monospace", color: COLORS.textSub }}>{m.exitPrice.toFixed(2)}</div>
                                <div style={{ fontSize: 9, color: m.exitPrice > m.entryPrice ? COLORS.green : COLORS.red, fontFamily: "'DM Mono', monospace" }}>
                                  {m.exitPrice > m.entryPrice ? "▲" : "▼"} {Math.abs(m.exitPrice - m.entryPrice).toFixed(2)}
                                </div>
                              </div>
                              <div style={{ textAlign: "right" }}>
                                <div style={{ fontSize: 13, fontWeight: 800, fontFamily: "'DM Mono', monospace", color: pnlColor(m.pnl) }}>{fmt(m.pnl)}</div>
                                <div style={{ fontSize: 9, color: COLORS.textMuted, fontFamily: "'DM Mono', monospace" }}>
                                  ({m.exitPrice > m.entryPrice ? "+" : ""}{(m.exitPrice - m.entryPrice).toFixed(2)}) × {fmtLots(m.lots)}
                                </div>
                              </div>
                            </div>
                          ))}
                          {/* Subtotal */}
                          <div style={{ display: "grid", gridTemplateColumns: MATCH_DETAIL_GRID, padding: "9px 16px", background: `${COLORS.accent}08`, borderTop: `1px solid ${COLORS.accent}25` }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.accent, gridColumn: "1 / 5" }}>SOUS-TOTAL {inst.instrument}</div>
                            <div style={{ textAlign: "right", fontSize: 12, fontFamily: "'DM Mono', monospace", color: COLORS.text, fontWeight: 700 }}>{fmtLots(inst.matches.reduce((s, m) => s + m.lots, 0))}</div>
                            <div /><div />
                            <div style={{ textAlign: "right", fontSize: 14, fontWeight: 900, fontFamily: "'DM Mono', monospace", color: pnlColor(inst.realizedPnl) }}>{fmt(inst.realizedPnl)}</div>
                          </div>
                        </div>
                      ) : (
                        <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: "0 0 10px 10px", padding: "16px", textAlign: "center", color: COLORS.textMuted, fontSize: 12 }}>
                          Aucun match FIFO — position entièrement ouverte ({fmtLots(inst.openLots)} lots).
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Grand total */}
                <div style={{ margin: "16px 24px 24px", background: `${COLORS.accent}10`, border: `2px solid ${COLORS.accent}40`, borderRadius: 10, padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: COLORS.accent }}>TOTAL COMPTE — {getAccountLabel(row.account)}</div>
                  <div style={{ fontSize: 20, fontWeight: 900, fontFamily: "'DM Mono', monospace", color: totalSellCount > 0 ? pnlColor(row.realizedPnl) : COLORS.textMuted }}>
                    {totalSellCount > 0 ? fmt(row.realizedPnl) : "—"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
};

// ─── APP ──────────────────────────────────────────────────────
const initialContacts = [
  { id: 1, firstName: "Sophie", lastName: "Martin", companyId: 101, email: "s.martin@innovatech.fr", phone: "06 12 34 56 78", phoneAlt: "", position: "director", status: "client", priority: "haute", isMainContact: false, isAuthorizedSignatory: false, isVerified: true, tags: ["SaaS", "Enterprise"], notes: "Cliente fidèle depuis 2022.", avatar: "SM", revenue: 42000, lastContact: "2024-01-15", name: "Sophie Martin" },
  { id: 2, firstName: "Lucas", lastName: "Dupont", companyId: 102, email: "l.dupont@startupflow.io", phone: "07 23 45 67 89", phoneAlt: "", position: "ceo", status: "prospect", priority: "moyenne", isMainContact: true, isAuthorizedSignatory: false, isVerified: false, tags: ["Startup", "B2B"], notes: "Intéressé par le plan Pro.", avatar: "LD", revenue: 0, lastContact: "2024-01-10", name: "Lucas Dupont" },
];
const initialTasks = [
  { id: 1, title: "Appel de suivi", contactId: 1, due: "2024-02-01", done: false, priority: "haute" },
  { id: 2, title: "Envoyer devis", contactId: 2, due: "2024-01-30", done: false, priority: "moyenne" },
];

export default function CRM() {
  const [currentUser, setCurrentUser] = useState(() => { try { return JSON.parse(localStorage.getItem("crm_current_user") || "null"); } catch { return null; } });
  const logoSize = 50;
  const [contacts, setContacts] = useState(initialContacts);
  const [companies, setCompanies] = useState([]);
  const [tasks, setTasks] = useState(initialTasks);
  const [page, setPage] = useState("dashboard");
  const dataLoaded = useRef(false);

  useEffect(() => {
  async function initEmployees() {
    const { data: e } = await supabase.from('employees').select('data');
    if (!e || e.length === 0) {
      const defaultAdmin = { id: 1, firstName: "Admin", name: "", email: "admin@orbit.com", password: "admin123", role: "admin", status: "active" };
      await supabase.from('employees').insert({ data: defaultAdmin });
    }
  }
  initEmployees();
}, []);

  const handleLogin = (emp) => { setCurrentUser(emp); localStorage.setItem("crm_current_user", JSON.stringify(emp)); };
  const handleLogout = () => { setCurrentUser(null); localStorage.removeItem("crm_current_user"); };

  // On mount, refresh currentUser from Supabase to pick up any role changes made since last login
  useEffect(() => {
    if (!currentUser?.email) return;
    (async () => {
      const { data } = await supabase.from('employees').select('data');
      const employees = data ? data.map(r => r.data) : [];
      const fresh = employees.find(e => e.email === currentUser.email && e.status === "active");
      if (fresh) {
        setCurrentUser(fresh);
        localStorage.setItem("crm_current_user", JSON.stringify(fresh));
      } else {
        // Employee deactivated or deleted — force logout
        handleLogout();
      }
    })();
  }, []);

  const { showWarning, secondsLeft, resetTimer } = useAutoLogout(currentUser, handleLogout);



  useEffect(() => {
    async function loadAllPages(table) {
      const PAGE = 1000;
      let all = [];
      let from = 0;
      while (true) {
        const { data, error } = await supabase.from(table).select('data').range(from, from + PAGE - 1);
        if (error || !data || data.length === 0) break;
        all = [...all, ...data.map(r => r.data ?? r)];
        if (data.length < PAGE) break;
        from += PAGE;
      }
      return all;
    }

    async function loadData() {
      const [contacts, companies, tasks] = await Promise.all([
        loadAllPages('contacts'),
        loadAllPages('companies'),
        loadAllPages('tasks'),
      ]);
      if (contacts.length) setContacts(contacts);
      if (companies.length) setCompanies(companies);
      if (tasks.length) setTasks(tasks);
      dataLoaded.current = true;
    }
    loadData();
  }, []);

  // Companies and contacts are saved explicitly on each action (no auto-save to avoid overwrite issues with large datasets)

  useEffect(() => {
    async function saveTasks() {
      await supabase.from('tasks').delete().neq('id', 0);
      for (const t of tasks) await supabase.from('tasks').insert({ data: t });
    }
    saveTasks();
  }, [tasks]);

  const NavItem = ({ n, isAdmin = false }) => (
    <div onClick={() => setPage(n.id)} style={{
      display: "flex", alignItems: "center", gap: 12, padding: "11px 24px", cursor: "pointer", transition: "all 0.15s",
      background: page === n.id ? (isAdmin ? `${COLORS.gold}18` : `${COLORS.accent}18`) : "transparent",
      borderRight: page === n.id ? `3px solid ${isAdmin ? COLORS.gold : COLORS.accent}` : "3px solid transparent",
      color: page === n.id ? "#FFFFFF" : "#D4AF37",
    }}>
      <span style={{ fontSize: 14 }}>{n.icon}</span>
      <span style={{ fontSize: 14, fontWeight: page === n.id ? 700 : 500 }}>{n.label.toUpperCase()}</span>
    </div>
  );

    if (!currentUser) return <LoginPage onLogin={handleLogin} />;

  return (
    <ConfigProvider>
      <div style={{ display: "flex", minHeight: "100vh", width: "100vw", overflow: "hidden", background: COLORS.bg, fontFamily: "'Inter', 'Segoe UI', sans-serif", color: COLORS.text }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Inter:wght@400;500;600;700&family=Source+Sans+3:wght@400;600;700&family=DM+Mono:wght@400;600&display=swap');
          * { box-sizing: border-box; }
          ::-webkit-scrollbar { width: 6px; }
          ::-webkit-scrollbar-track { background: transparent; }
          ::-webkit-scrollbar-thumb { background: ${COLORS.border}; border-radius: 3px; }
          option { background: ${COLORS.card}; }
        `}</style>

        {/* Sidebar */}
        <div style={{ width: 220, background: COLORS.surface, borderRight: `1px solid ${COLORS.border}`, display: "flex", flexDirection: "column", padding: "28px 0", flexShrink: 0 }}>
          <div style={{ padding: "0 24px 28px" }}>
            <div style={{ fontSize: 22, fontFamily: "'Inter', sans-serif", color: COLORS.text, lineHeight: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <img src="/xagrilogo.png" style={{ width: logoSize, height: logoSize, objectFit: "contain" }} />
                <span style={{ color: "#D4AF37", fontSize: 22 }}>X-AGRI</span>
              </div>

            </div>
            
          </div>
          <nav style={{ flex: 1 }}>
            
            <NavItem n={{ id: "companies", label: "Companies", icon: "◆" }} />
            <div onClick={() => setPage("companies-dashboard")} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "7px 24px 7px 46px", cursor: "pointer", transition: "all 0.15s",
              background: page === "companies-dashboard" ? `${COLORS.accent}18` : "transparent",
              borderRight: page === "companies-dashboard" ? `3px solid ${COLORS.accent}` : "3px solid transparent",
              color: page === "companies-dashboard" ? "#FFFFFF" : "#D4AF37",
            }}>
              <span style={{ fontSize: 10 }}>◇</span>
              <span style={{ fontSize: 12, fontWeight: page === "companies-dashboard" ? 700 : 400 }}>Dashboard</span>
            </div>
            <NavItem n={{ id: "contacts", label: "Contacts", icon: "◉" }} />
            <NavItem n={{ id: "derivatives", label: "Derivatives", icon: "◬" }} />
            <div onClick={() => setPage("derivatives-dashboard")} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "7px 24px 7px 46px", cursor: "pointer", transition: "all 0.15s",
              background: page === "derivatives-dashboard" ? `${COLORS.accent}18` : "transparent",
              borderRight: page === "derivatives-dashboard" ? `3px solid ${COLORS.accent}` : "3px solid transparent",
              color: page === "derivatives-dashboard" ? "#FFFFFF" : "#D4AF37",
            }}>
              <span style={{ fontSize: 10 }}>◇</span>
              <span style={{ fontSize: 12, fontWeight: page === "derivatives-dashboard" ? 700 : 400 }}>Dashboard</span>
            </div>
            <div onClick={() => setPage("derivatives-statistics")} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "7px 24px 7px 46px", cursor: "pointer", transition: "all 0.15s",
              background: page === "derivatives-statistics" ? `${COLORS.accent}18` : "transparent",
              borderRight: page === "derivatives-statistics" ? `3px solid ${COLORS.accent}` : "3px solid transparent",
              color: page === "derivatives-statistics" ? "#FFFFFF" : "#D4AF37",
            }}>
              <span style={{ fontSize: 10 }}>◇</span>
              <span style={{ fontSize: 12, fontWeight: page === "derivatives-statistics" ? 700 : 400 }}>Statistics</span>
            </div>
            <div style={{ height: 1, background: COLORS.border, margin: "16px 24px" }} />
            <div style={{ padding: "0 24px 10px", fontSize: 14, color: "#D4AF37", fontWeight: 700, letterSpacing: 1 }}>ACTIVITÉ</div>
            {[{ id: "dashboard", label: "Dashboard", icon: "◇" }, { id: "tasks", label: "Tâches", icon: "◎" }, { id: "pipeline", label: "Pipeline", icon: "◈" }].map(n => <NavItem key={n.id} n={n} />)}
            <div style={{ height: 1, background: COLORS.border, margin: "16px 24px" }} />
            <div style={{ padding: "0 24px 10px", fontSize: 14, color: "#D4AF37", fontWeight: 700, letterSpacing: 1 }}>ADMINISTRATION</div>
           {currentUser?.role === "admin" && <NavItem n={{ id: "admin", label: "Admin Panel", icon: "⚙" }} isAdmin />}
          </nav>
          <div style={{ padding: "16px 24px", borderTop: `1px solid ${COLORS.border}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Avatar initials={(currentUser?.firstName?.[0] || "") + (currentUser?.name?.[0] || "")} size={32} color={COLORS.gold} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>{currentUser?.firstName} {currentUser?.name}</div>
                
              </div>
              <button onClick={handleLogout} title="Se déconnecter" style={{ background: "none", border: "none", color: "#D4AF37", cursor: "pointer", fontSize: 22 }}>⏻</button>
            </div>
          </div>
        </div>

        {/* Main */}
        <div style={{ flex: 1, padding: "32px 40px", overflowY: "auto", background: COLORS.bg }}>
          {page === "dashboard" && <Dashboard contacts={contacts} companies={companies} tasks={tasks} />}
          {page === "companies" && <Companies companies={companies} setCompanies={setCompanies} contacts={contacts} />}
          {page === "contacts" && <Contacts contacts={contacts} setContacts={setContacts} companies={companies} />}
          {page === "tasks" && <Tasks tasks={tasks} setTasks={setTasks} contacts={contacts} companies={companies} />}
          {page === "pipeline" && <Pipeline contacts={contacts} setContacts={setContacts} companies={companies} setCompanies={setCompanies} />}
          {page === "companies-dashboard" && <CompaniesDashboard companies={companies} setCompanies={setCompanies} />}
          {page === "derivatives" && <Derivatives companies={companies} />}
          {page === "derivatives-dashboard" && <DerivativesDashboard />}
          {page === "derivatives-statistics" && <DerivStatistics />}
          {page === "admin" && <AdminPanel companies={companies} />}
        </div>
      </div>
      {showWarning && (
        <AutoLogoutWarning
          secondsLeft={secondsLeft}
          onStay={resetTimer}
          onLogout={handleLogout}
        />
      )}
    </ConfigProvider>
  );
}