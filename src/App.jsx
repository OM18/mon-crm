import { useState, useEffect, useRef, createContext, useContext } from "react";
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
  { key: "complianceStatus", label: "Compliance Status", icon: "🛡", description: "Statuts de conformité", hasColor: true, hasValue: true },
  { key: "finalAuthStatus", label: "Final Authorization Status", icon: "✅", description: "Statuts d'autorisation finale", hasColor: true, hasValue: true },
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
  const items = config.derivDecimals || [];
  const [localItems, setLocalItems] = useState(items);
  const [dirty, setDirty] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newExample, setNewExample] = useState("");

  useEffect(() => { setLocalItems(items); setDirty(false); }, [config.derivDecimals]);

  const mark = (next) => { setLocalItems(next); setDirty(true); };

  const add = () => {
    if (!newLabel.trim()) return;
    mark([...localItems, { value: newLabel.trim().replace(/\s/g, ""), label: newLabel.trim(), example: newExample.trim() || newLabel.trim() }]);
    setNewLabel(""); setNewExample("");
  };

  return (
    <div style={{ background: COLORS.bg, border: `1px solid ${dirty ? COLORS.accent + "60" : COLORS.border}`, borderRadius: 14, overflow: "hidden", transition: "border-color 0.2s" }}>
      <div onClick={() => setExpanded(e => !e)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", cursor: "pointer", userSelect: "none" }}
        onMouseOver={e => e.currentTarget.style.background = `${COLORS.accent}08`}
        onMouseOut={e => e.currentTarget.style.background = "transparent"}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 18, width: 24, textAlign: "center" }}>⅛</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }}>Decimals</div>
            <div style={{ fontSize: 11, color: COLORS.textMuted }}>Formats de cotation : décimal standard ou fractions (1/8, 1/32…)</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", gap: 6 }}>
            {localItems.map(d => (
              <span key={d.value} style={{ fontSize: 10, fontFamily: "'DM Mono', monospace", background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 4, padding: "1px 6px", color: COLORS.textSub }}>{d.label}</span>
            ))}
          </div>
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
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
            {localItems.map((d, idx) => (
              <div key={idx} style={{ display: "flex", alignItems: "center", gap: 10, background: COLORS.card, borderRadius: 10, padding: "10px 14px", border: `1px solid ${COLORS.border}` }}>
                <div style={{ width: 70, fontFamily: "'DM Mono', monospace", fontWeight: 700, fontSize: 13, color: COLORS.blue }}>{d.label}</div>
                <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 11, color: COLORS.textMuted }}>ex:</span>
                  <input value={d.example} onChange={e => { const v = e.target.value; mark(localItems.map((x, i) => i === idx ? { ...x, example: v } : x)); }}
                    placeholder="ex: 200 1/8"
                    style={{ flex: 1, background: "transparent", border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "4px 8px", color: COLORS.text, fontSize: 13, fontFamily: "'DM Mono', monospace", outline: "none" }} />
                </div>
                <button onClick={() => mark(localItems.filter((_, i) => i !== idx))}
                  style={{ background: "none", border: "none", color: COLORS.textMuted, cursor: "pointer", fontSize: 18, lineHeight: 1 }}
                  onMouseOver={e => e.currentTarget.style.color = COLORS.red}
                  onMouseOut={e => e.currentTarget.style.color = COLORS.textMuted}>×</button>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "flex-end", background: `${COLORS.accent}08`, border: `1px dashed ${COLORS.accent}40`, borderRadius: 10, padding: "12px 14px" }}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 10, color: COLORS.textSub, fontWeight: 600 }}>FORMAT *</label>
              <input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="ex: 1/8" onKeyDown={e => e.key === "Enter" && add()}
                style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "8px 12px", color: COLORS.text, fontSize: 13, outline: "none", fontFamily: "'DM Mono', monospace" }} />
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 10, color: COLORS.textSub, fontWeight: 600 }}>EXEMPLE</label>
              <input value={newExample} onChange={e => setNewExample(e.target.value)} placeholder="ex: 200 1/8" onKeyDown={e => e.key === "Enter" && add()}
                style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "8px 12px", color: COLORS.text, fontSize: 13, outline: "none", fontFamily: "'DM Mono', monospace" }} />
            </div>
            <Btn onClick={add} disabled={!newLabel.trim()} style={{ padding: "8px 14px", fontSize: 13, flexShrink: 0 }}>+ Ajouter</Btn>
          </div>
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
  const isValid = derivProds.some(p => p.label.toUpperCase() === query.toUpperCase());

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
                <option value="commodity">COMMODITY</option>
                <option value="fx">FX</option>
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
              <option value="commodity">COMMODITY</option>
              <option value="fx">FX</option>
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

const EMPTY_PROD = { label: "", stoxxExchange: "", instrumentType: "", underlyingCategory: "", underlying: "", underlyingOrigin: "", volumeSizePerLot: "", volumeUnit: "", currency: "EUR", decimals: "decimal", expiryDate: "", firstNoticeDay: "", lastTradingDate: "" };

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
    const updated = editId ? products.map(p => p.id === editId ? { ...form, id: editId } : p) : [...products, { ...form, id: Date.now() }];
    setProducts(updated);
    await safeSave('deriv_products', updated, setProducts, products);
    setForm(EMPTY_PROD); setInstrumentType(""); setEditId(null); setShowForm(false);
  };

  const remove = async (id) => { const u = products.filter(p => p.id !== id); setProducts(u); await safeSave('deriv_products', u, setProducts, products); };

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
              <DerivSelectField label="Underlying Category" field="underlyingCategory" options={[{ value: "commodity", label: "Commodity" }, { value: "fx", label: "FX" }]} form={form} setForm={setForm} />
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
              <DerivSelectField label="Currency" field="currency" options={(config.derivCurrencies || []).map(c => ({ value: c.value, label: c.label }))} form={form} setForm={setForm} />
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <label style={{ fontSize: 11, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5 }}>DECIMALS <span style={{ color: COLORS.red }}>*</span></label>
                <select value={form.decimals} onChange={e => setForm(f => ({ ...f, decimals: e.target.value }))}
                  style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "9px 12px", color: COLORS.text, fontSize: 13, outline: "none", fontFamily: "inherit" }}>
                  {(config.derivDecimals || []).map(d => (
                    <option key={d.value} value={d.value}>{d.label} — ex: {d.example}</option>
                  ))}
                </select>
              </div>
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
            await safeSave('deriv_products', updated, setProducts, products);
          };

          const renderRow = (p) => {
            const isInactive = p.active === false;
            return (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, background: isInactive ? "transparent" : COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "12px 16px", opacity: isInactive ? 0.55 : 1 }}>
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
                    {p.firstNoticeDay && <span>📅 FND: {p.firstNoticeDay}</span>}
                    {p.lastTradingDate && <span>🔚 LTD: {p.lastTradingDate}</span>}
                    {p.instrumentType?.toLowerCase() === "option" && p.expiryDate && <span style={{ color: COLORS.purple }}>⏱ EXP: {p.expiryDate}</span>}
                  </div>
                </div>
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
            await safeSave('deriv_products', updated, setProducts, products);
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
        obj.currency = match ? match.value : obj.currency.toUpperCase();
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
                    <span style={{ fontSize: 11, color: COLORS.gold }}>{a.currency}</span>
                    <span style={{ fontSize: 11, color: COLORS.green, fontFamily: "'DM Mono', monospace" }}>{Number(a.initialAmount).toLocaleString("fr")} {a.currency}</span>
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
  const [expanded, setExpanded] = useState(false);

  const bankCompanies = companies.filter(c =>
    Array.isArray(c.roles) ? c.roles.includes("Bank") : c.roles === "Bank"
  );

  const selected = Array.isArray(config.derivFinancingBanks) ? config.derivFinancingBanks : [];

  // Auto-clean: remove any stored name that no longer matches a Bank company
  const validNames = bankCompanies.map(c => c.name);
  const cleanSelected = selected.filter(name => validNames.includes(name));
  useEffect(() => {
    if (cleanSelected.length !== selected.length) {
      updateField("derivFinancingBanks", cleanSelected);
    }
  }, [bankCompanies.map(c => c.name).join(",")]);

  const toggle = (companyName) => {
    const next = cleanSelected.includes(companyName)
      ? cleanSelected.filter(v => v !== companyName)
      : [...cleanSelected, companyName];
    updateField("derivFinancingBanks", next);
  };

  return (
    <div style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 14, marginBottom: 0, overflow: "hidden" }}>
      <div onClick={() => setExpanded(!expanded)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", cursor: "pointer", userSelect: "none" }}
        onMouseOver={e => e.currentTarget.style.background = `${COLORS.accent}08`}
        onMouseOut={e => e.currentTarget.style.background = "transparent"}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 18, width: 24, textAlign: "center" }}>🏦</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }}>Financing Banks</div>
            <div style={{ fontSize: 11, color: COLORS.textMuted }}>Banques de financement — sélectionner parmi les companies avec le rôle Bank</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end", maxWidth: 420 }}>
          {cleanSelected.length === 0
            ? <span style={{ fontSize: 12, color: COLORS.textMuted, fontStyle: "italic" }}>Aucune sélectionnée</span>
            : cleanSelected.map(name => (
              <span key={name} style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 5, background: `${COLORS.accent}20`, color: COLORS.accent, border: `1px solid ${COLORS.accent}40` }}>
                {name}
              </span>
            ))
          }
          <span style={{ color: COLORS.textMuted, fontSize: 14, transition: "transform 0.2s", display: "inline-block", transform: expanded ? "rotate(180deg)" : "rotate(0deg)", marginLeft: 4 }}>▾</span>
        </div>
      </div>

      {expanded && (
        <div style={{ padding: "14px 18px", borderTop: `1px solid ${COLORS.border}` }}>
          {bankCompanies.length === 0 ? (
            <div style={{ textAlign: "center", color: COLORS.textMuted, fontSize: 13, padding: "16px 0" }}>
              Aucune company avec le rôle <strong style={{ color: COLORS.text }}>Bank</strong> trouvée.
              <div style={{ fontSize: 11, marginTop: 4 }}>Assignez ce rôle dans le module Companies.</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {bankCompanies.map(c => {
                const isSelected = cleanSelected.includes(c.name);
                return (
                  <div key={c.id} onClick={() => toggle(c.name)}
                    style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 10, cursor: "pointer", border: `1px solid ${isSelected ? COLORS.accent + "60" : COLORS.border}`, background: isSelected ? `${COLORS.accent}10` : COLORS.card, transition: "all 0.15s" }}
                    onMouseOver={e => { if (!isSelected) e.currentTarget.style.background = COLORS.hover; }}
                    onMouseOut={e => { e.currentTarget.style.background = isSelected ? `${COLORS.accent}10` : COLORS.card; }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: isSelected ? `${COLORS.accent}25` : COLORS.bg, border: `1px solid ${isSelected ? COLORS.accent + "50" : COLORS.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: isSelected ? COLORS.accent : COLORS.textMuted, flexShrink: 0 }}>
                      {(c.name || "?")[0].toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>{c.name}</div>
                      {c.country && <div style={{ fontSize: 11, color: COLORS.textMuted }}>{c.country}</div>}
                    </div>
                    <div style={{ width: 18, height: 18, borderRadius: 5, border: `2px solid ${isSelected ? COLORS.accent : COLORS.textMuted}`, background: isSelected ? COLORS.accent : COLORS.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" }}>
                      {isSelected && <span style={{ color: COLORS.textOnAccent, fontSize: 11, fontWeight: 700, lineHeight: 1 }}>✓</span>}
                    </div>
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
  const EMPTY_ACC = () => ({ accountNumber: "", businessUnit: "", currency: "EUR", initialAmount: "", isActive: true, accountType: config.derivDefaultAccountType || "", financingBank: "", contracts: "", trade: "" });
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
    accForm.currency !== "" &&
    String(accForm.initialAmount).trim() !== "";

  const saveAccount = async () => {
    if (!isAccFormValid()) return;
    const updated = editAccId
      ? derivAccounts.map(a => a.id === editAccId ? { ...accForm, id: editAccId } : a)
      : [...derivAccounts, { ...accForm, id: Date.now() }];
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
    setEmpForm({ firstName: "", name: "", phone: "", email: "", status: "active" });
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
                      <select value={accForm.currency} onChange={e => { const v = e.target.value; setAccForm(p => ({ ...p, currency: v })); }}
                        style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "10px 14px", color: COLORS.text, fontSize: 14, outline: "none", fontFamily: "inherit" }}>
                        {config.contractsCurrency.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </select>
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

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 14 }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <label style={{ fontSize: 12, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5 }}>CONTRACTS</label>
                      <input value={accForm.contracts || ""} onChange={e => setAccForm(f => ({ ...f, contracts: e.target.value }))} placeholder="ex: CME-001"
                        style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "10px 14px", color: COLORS.text, fontSize: 14, outline: "none", fontFamily: "inherit" }} />
                    </div>
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
                              <span>💱 {a.currency}</span>
                              {a.initialAmount && <span style={{ color: COLORS.green, fontFamily: "'DM Mono', monospace" }}>{Number(a.initialAmount).toLocaleString("fr")} {a.currency}</span>}
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
                          <button onClick={() => { setAccForm({ ...a }); setEditAccId(a.id); setShowAccForm(true); }} style={{ background: "none", border: "none", color: COLORS.accent, cursor: "pointer", fontSize: 14 }}>✏️</button>
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
          <FinancingBanksEditor companies={companies} config={config} updateField={updateField} />

          {/* ── Account Type ── */}
          <AccountTypePillsEditor config={config} updateField={updateField} defaultKey="derivDefaultAccountType" onSetDefault={v => updateField("derivDefaultAccountType", v)} />

          <DerivOpStatusEditor config={config} updateField={updateField} />

          <DerivPillsEditor configKey="derivInstrumentTypes" label="Instrument Types" icon="📐" description="Types d'instruments disponibles dans la modale (Future, Option…)" config={config} updateField={updateField} defaultKey="derivInstrumentTypeDefault" onSetDefault={v => updateField("derivInstrumentTypeDefault", v)} />

          <DerivPillsEditor configKey="derivOpTypes" label="Operation Types" icon="🔁" description="Types d'opérations disponibles dans la modale (Hedging, Rolling…)" config={config} updateField={updateField} defaultKey="derivOpTypeDefault" onSetDefault={v => updateField("derivOpTypeDefault", v)} />

          <DerivPillsEditor configKey="derivExchanges" label="Exchanges" icon="🏛" description="Bourses disponibles pour les opérations (CME, Euronext…)" config={config} updateField={updateField} defaultKey="derivDefaultExchange" onSetDefault={v => updateField("derivDefaultExchange", v)} />

          <DerivProductEditor config={config} />

          <DerivPillsEditor configKey="derivVolumeUnits" label="Volume Units" icon="📦" description="Unités de volume utilisées dans les opérations sur dérivés" config={config} updateField={updateField} />

          <DerivPillsEditor configKey="derivCurrencies" label="Currencies" icon="💱" description="Devises disponibles dans le module Derivatives" config={config} updateField={updateField} />

          <DerivPillsEditor configKey="derivDecimals" label="Decimals" icon="⅛" description="Formats de cotation : décimal standard ou fractions (1/8, 1/32…)" config={config} updateField={updateField} />

          <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: "20px 24px" }}>
            <DerivBUEditor config={config} updateField={updateField} />
          </div>

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
                      return (
                        <div key={l.id} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 80px 80px 60px", gap: 8, alignItems: "center", background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "10px 12px" }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.blue }}>{exchCfg?.label || l.exchange}</span>
                          <span style={{ fontSize: 13, color: COLORS.text }}>{l.instrument}</span>
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
                    {[...exchangeTarifs].sort((a, b) => {
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

        </div>
      )}

      {adminTab === "company" && (
        <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, overflow: "hidden" }}>
          <div style={{ padding: "18px 24px", borderBottom: `1px solid ${COLORS.border}`, background: `${COLORS.accent}06` }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.text }}>🏢 Company</div>
            <div style={{ fontSize: 12, color: COLORS.textSub, marginTop: 4 }}>Paramètres spécifiques aux sociétés</div>
          </div>
          <div style={{ padding: "20px 24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text, textTransform: "uppercase", letterSpacing: 0.5 }}>👥 EMPLOYEES</div>
              <Btn onClick={() => { setEmpForm({ firstName: "", name: "", phone: "", email: "", status: "active" }); setEditEmpId(null); setShowEmpForm(true); }}>+ Ajouter</Btn>
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

  const mapAuth = (val, cfgList) => {
    if (!val) return cfgList[0]?.value || "";
    const v = val.toString().toUpperCase().trim();
    if (v.includes("AWAITING")) return "not_auth_awaiting";
    if (v.includes("REQUESTED")) return "not_auth_requested";
    if (v === "AUTHORISED" || v === "AUTHORIZED") return "authorized";
    if (v.includes("BLACK")) return "blacklisted";
    return cfgList[0]?.value || "";
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
  if (!config.complianceStatus.find(s => s.value === mapped)) {
    const key = `complianceStatus:${obj.complianceStatus}`;
    if (!unknowns[key]) unknowns[key] = { fieldKey: "complianceStatus", configKey: "complianceStatus", fieldLabel: "Compliance Status", value: obj.complianceStatus };
  }
  obj.complianceStatus = mapped;
}
if (obj.finalAuthStatus) {
  const mapped = mapAuth(obj.finalAuthStatus, config.finalAuthStatus);
  if (!config.finalAuthStatus.find(s => s.value === mapped)) {
    const key = `finalAuthStatus:${obj.finalAuthStatus}`;
    if (!unknowns[key]) unknowns[key] = { fieldKey: "finalAuthStatus", configKey: "finalAuthStatus", fieldLabel: "Final Authorization Status", value: obj.finalAuthStatus };
  }
  obj.finalAuthStatus = mapped;
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
  roleValues.forEach(r => {
    const matched = config.roles?.find(cr => cr.value.toLowerCase() === r.toLowerCase() || cr.label.toLowerCase() === r.toLowerCase());
    if (!matched) {
      const key = `roles:${r}`;
      if (!unknowns[key]) unknowns[key] = { fieldKey: "roles", configKey: "roles", fieldLabel: "Roles", value: r };
    }
  });
  obj.roles = roleValues.map(r => {
    const matched = config.roles?.find(cr => cr.value.toLowerCase() === r.toLowerCase() || cr.label.toLowerCase() === r.toLowerCase());
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
      } else if (type === "contacts") {
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
        // Validate account against derivAccounts table
        if (obj.account) {
          const norm = v => v?.toString().toLowerCase().trim() || "";
          const accountExists = derivAccounts.some(a => norm(a.accountNumber) === norm(obj.account));
          if (!accountExists) {
            const key = `derivAccount:${obj.account}`;
            if (!unknowns[key]) unknowns[key] = { fieldKey: "account", configKey: "derivAccount", fieldLabel: "Account Number", value: obj.account, infoOnly: true };
          }
        }
        // Validate instrument against deriv_products table (case-insensitive, trimmed)
        if (obj.instrument) {
          const norm = v => v?.toString().toLowerCase().trim() || "";
          const found = derivProducts.find(p => norm(p.label) === norm(obj.instrument) || norm(p.value) === norm(obj.instrument));
          if (!found) {
            const key = `derivProducts:${obj.instrument}`;
            if (!unknowns[key]) unknowns[key] = { fieldKey: "instrument", configKey: "derivProducts", fieldLabel: "Instrument", value: obj.instrument };
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
      if (type === "derivatives") return !!(o.ref || o.side || o.instrument || o.price || o.quantity);
      return !!o.name;
    });

    setParsedItems(items);
    const allUnknowns = Object.values(unknowns);
    // infoOnly = valeurs déjà vérifiées (compte, broker) — acceptées automatiquement
    const autoDecisions = {};
    allUnknowns.filter(u => u.infoOnly).forEach(u => {
      autoDecisions[`${u.configKey}:${u.value}`] = "add";
    });
    const queue = allUnknowns.filter(u => !u.infoOnly);
    if (queue.length > 0) {
      setUnknownQueue(queue); setCurrentQueueIdx(0); setDecisions(autoDecisions); setStep("validate");
    } else {
      const resolved = resolveItems(items, autoDecisions);
      onImport(resolved); setImporting(false); onClose();
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
  resolved.roles = resolved.roles.map(r => {
    const matched = config.roles?.find(cr => cr.value.toLowerCase() === r.toLowerCase() || cr.label.toLowerCase() === r.toLowerCase());
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
      onImport(resolved); setStep("summary");
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
              {currentItem.infoOnly ? (
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

// ─── COMPANY DETAIL PANEL ────────────────────────────────────
const CompanyDetailPanel = ({ sel, selContacts, onEdit, onDelete, getStatusCfg, getComplianceCfg, getFinalAuthCfg, getBUCfg, getRoleCfg, getTypeCfg }) => {
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
              <Badge label={getStatusCfg(sel.status).label} color={getStatusCfg(sel.status).color} />
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
                    {sel.roles.map(r => <Badge key={r} label={r} color={getRoleCfg(r).color} />)}
                  </div>
                : <span style={{ fontSize: 12, color: COLORS.textMuted }}>—</span>}
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
                    {sel.roles.map(r => <Badge key={r} label={r} color={getRoleCfg(r).color} />)}
                  </div>
                : <span style={{ fontSize: 13, color: COLORS.textMuted }}>—</span>}
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
                <div>
                  <div style={{ fontSize: 10, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5, marginBottom: 6 }}>COMPLIANCE STATUS</div>
                  {sel.complianceStatus ? <Badge label={getComplianceCfg(sel.complianceStatus).label} color={getComplianceCfg(sel.complianceStatus).color} /> : <span style={{ fontSize: 12, color: COLORS.textMuted }}>—</span>}
                </div>
                <div>
                  <div style={{ fontSize: 10, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5, marginBottom: 6 }}>FINAL AUTHORIZATION STATUS</div>
                  {sel.finalAuthStatus ? <Badge label={getFinalAuthCfg(sel.finalAuthStatus).label} color={getFinalAuthCfg(sel.finalAuthStatus).color} /> : <span style={{ fontSize: 12, color: COLORS.textMuted }}>—</span>}
                </div>
              </div>
              {[
                { label: "Legal Name", value: sel.legalName },
{ label: "Creation Date", value: sel.complianceCreationDate },
                { label: "Last Update Date", value: sel.complianceLastUpdateDate },
                { label: "Request Date", value: sel.complianceRequestDate },
                { label: "Last Reception Date", value: sel.complianceLastReceptionDate },
                { label: "Final Confirmation Date", value: sel.complianceFinalConfirmationDate },
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
const LoginPage = ({ onLogin }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async () => {
    const { data, error } = await supabase.from('employees').select('data');
    
    const employees = data ? data.map(r => r.data) : [];
    
    const emp = employees.find(e => e.email === email && e.password === password && e.status === "active");
    
    if (emp) { onLogin(emp); }
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

const Companies = ({ companies, setCompanies, contacts }) => {
  const { config } = useConfig();
  const [search, setSearch] = useState("");
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
  });
  const [form, setForm] = useState(makeEmptyForm());

  const filtered = companies.filter(c => {
    const ms = c.name?.toLowerCase().includes(search.toLowerCase()) || c.website?.toLowerCase().includes(search.toLowerCase());
const filterKeys = activeFilters ? Object.keys(activeFilters) : [];
const passFilters = filterKeys.every(key => {
  const val = c[key];
  const valArr = Array.isArray(val) ? val : (val !== undefined && val !== null && val !== "" ? [val] : []);
  if (activeFilters[key].length > 0) {
    const inc = filterMode === "AND" ? activeFilters[key].every(f => valArr.includes(f)) : activeFilters[key].some(f => valArr.includes(f));
    if (!inc) return false;
    // "only" check: if any active filter value for this key has "only" mode, the field must contain exactly that value and nothing else
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
});
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
    if (cf.op === "eq") return val === cf.value;
    if (cf.op === "gt") return val > cf.value;
    if (cf.op === "lt") return val < cf.value;
  }
  return true;
  });
  return ms && passFilters && passCustom;
});

const sel = selected ? filtered.find(c => c.id === selected) : null;
  const openEdit = (c) => { setForm({ ...c, tags: (c.tags || []).join(", "), roles: c.roles || [] }); setEditCompany(c); setShowForm(true); };
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
    const data = { ...form, tags: form.tags.split(",").map(t => t.trim()).filter(Boolean), avatar: form.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase(), revenue: Number(form.revenue) || 0, roles: form.roles || [] };
    const updated = editCompany ? companies.map(c => c.id === editCompany.id ? { ...c, ...data } : c) : [...companies, { ...data, id: Date.now(), ref: generateCompanyRef() }];
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
  const getComplianceCfg = (v) => config.complianceStatus.find(s => s.value === v) || { label: v || "—", color: COLORS.textSub };
  const getFinalAuthCfg = (v) => config.finalAuthStatus.find(s => s.value === v) || { label: v || "—", color: COLORS.textSub };
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
              ▼ FILTER {Object.values(activeFilters).flat().length > 0 && <span style={{ background: COLORS.accent, color: "#fff", borderRadius: 10, fontSize: 11, padding: "1px 7px", marginLeft: 6 }}>{Object.values(activeFilters).flat().length}</span>}
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
                <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.textSub, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Filtres personnalisés</div>
                <div style={{ position: "relative" }}>
                  <input value={filterSearch} onChange={e => { setFilterSearch(e.target.value); setFilterSuggestions(e.target.value.trim() ? CUSTOM_FILTER_FIELDS.filter(f => f.label.toLowerCase().includes(e.target.value.toLowerCase()) && !customFilters.find(cf => cf.key === f.key)) : []); }}
                    placeholder="Ajouter un filtre..." style={{ width: "100%", background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "7px 12px", color: COLORS.text, fontSize: 12, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
                  {filterSuggestions.length > 0 && (
                    <div style={{ position: "absolute", top: "110%", left: 0, right: 0, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 8, zIndex: 200, overflow: "hidden" }}>
                      {filterSuggestions.map(f => (
                        <div key={f.key} onClick={() => { setCustomFilters(cf => [...cf, { key: f.key, label: f.label, type: f.type, op: f.type === "text" || f.type === "contact" ? "notempty" : "eq", value: "" }]); setFilterSearch(""); setFilterSuggestions([]); }}
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
                    <span style={{ fontSize: 11, color: COLORS.textSub, minWidth: 100 }}>{cf.label}</span>
                    <select value={cf.op} onChange={e => setCustomFilters(fs => fs.map((f, j) => j === i ? { ...f, op: e.target.value } : f))}
  style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "4px 6px", color: COLORS.text, fontSize: 11, outline: "none" }}>
  {cf.type !== "text" && cf.type !== "contact" && <option value="eq">=</option>}
  {cf.type !== "text" && cf.type !== "contact" && <option value="gt">&gt;</option>}
  {cf.type !== "text" && cf.type !== "contact" && <option value="lt">&lt;</option>}
  {cf.type === "contact" && <option value="contains">Contient</option>}
  <option value="empty">Est vide</option>
  <option value="notempty">N'est pas vide</option>
</select>
                    {cf.op !== "empty" && cf.op !== "notempty" && <input value={cf.value} type={cf.type === "date" ? "date" : cf.type === "number" ? "number" : "text"} placeholder={cf.type === "contact" ? "Nom du contact..." : ""}
                      onChange={e => setCustomFilters(fs => fs.map((f, j) => j === i ? { ...f, value: e.target.value } : f))}
                      style={{ flex: 1, minWidth: 0, maxWidth: 120, background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "4px 8px", color: COLORS.text, fontSize: 11, outline: "none" }} />}
                    <span onClick={() => setCustomFilters(fs => fs.filter((_, j) => j !== i))} style={{ cursor: "pointer", color: COLORS.textMuted, fontSize: 14 }}>✕</span>
                  </div>
                ))}
</div>
              </div>
            )}
          </div>
          <div onClick={() => setShowImport(true)} style={{ cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: "10px 14px", borderRadius: 8, border: `1px solid ${COLORS.border}`, background: "transparent" }}><img src="/logoxl.png" style={{ width: 32, height: 32, objectFit: "contain" }} /></div>
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
          <button onClick={openNew} style={{ background: COLORS.accent, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit", padding: "6px 14px", lineHeight: "1", height: "46px", marginTop: 3 }}>+ NEW COMPANY</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 1.2fr 1.5fr 1.5fr 1.2fr 1fr", gap: 10, padding: "8px 18px", marginBottom: 2 }}>
          {["Company", "Broker", "Role", "Compliance Status", "Final Auth. Status", "Website", "Business Unit"].map(h => (
            <div key={h} style={{ fontSize: 14, color: "#D4AF37", fontWeight: 600, letterSpacing: 0.5 }}>{h.toUpperCase()}</div>
          ))}
        </div>

       {Object.values(activeFilters).flat().length > 0 && (
  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
    <span style={{ fontSize: 11, color: COLORS.textSub, fontWeight: 600, alignSelf: "center" }}>Filtres actifs :</span>
    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, background: filterMode === "AND" ? `${COLORS.accent}22` : `${COLORS.purple}22`, color: filterMode === "AND" ? COLORS.accent : COLORS.purple, fontWeight: 700, alignSelf: "center" }}>{filterMode}</span>
    {customFilters.filter(cf => cf.value).map((cf, i) => (
      <span key={`custom:${cf.key}`} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, padding: "2px 8px", borderRadius: 6, background: `${COLORS.accent}22`, color: COLORS.accent, border: `1px solid ${COLORS.accent}55`, fontWeight: 600 }}>
        {cf.label} {cf.type !== "text" ? cf.op === "eq" ? "=" : cf.op === "gt" ? ">" : "<" : "="} {cf.value}
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
        <div style={{ overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
          {filtered.map(c => (
            <div key={c.id} onClick={() => setSelected(c.id === selected ? null : c.id)} style={{
              background: selected === c.id ? `${COLORS.purple}12` : COLORS.card,
              border: `1px solid ${selected === c.id ? COLORS.purple : COLORS.border}`,
              borderRadius: 12, padding: "12px 18px", cursor: "pointer",
              display: "grid", gridTemplateColumns: "2fr 1.2fr 1.2fr 1.5fr 1.5fr 1.2fr 1fr", gap: 10, alignItems: "center", transition: "all 0.15s",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <CountryFlag country={c.country} size={36} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: COLORS.text, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</div>
                  <div style={{ color: COLORS.textSub, fontSize: 11, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {c.ref && <span style={{ fontFamily: "'DM Mono', monospace", color: COLORS.accent, marginRight: 6 }}>{c.ref}</span>}
                    {[c.city, c.country ? getCountryLabel(c.country, config.country).toUpperCase() : null].filter(Boolean).join(", ") || "—"}
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 12, color: c.broker ? COLORS.text : COLORS.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.broker || "—"}</div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {(c.roles || []).slice(0, 2).map(r => <Badge key={r} label={r.toUpperCase()} color={getRoleCfg(r).color} />)}
                {(c.roles || []).length > 2 && <span style={{ fontSize: 11, color: COLORS.textMuted }}>+{c.roles.length - 2}</span>}
                {(c.roles || []).length === 0 && <span style={{ fontSize: 12, color: COLORS.textMuted }}>—</span>}
              </div>
              <div>
                {c.complianceStatus ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: getComplianceCfg(c.complianceStatus).color, flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: getComplianceCfg(c.complianceStatus).color, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {getComplianceCfg(c.complianceStatus).label.split("–").pop()?.trim() || getComplianceCfg(c.complianceStatus).label}
                    </span>
                  </div>
                ) : <span style={{ fontSize: 12, color: COLORS.textMuted }}>—</span>}
              </div>
              <div>
                {c.finalAuthStatus ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: getFinalAuthCfg(c.finalAuthStatus).color, flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: getFinalAuthCfg(c.finalAuthStatus).color, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {getFinalAuthCfg(c.finalAuthStatus).label.split("–").pop()?.trim() || getFinalAuthCfg(c.finalAuthStatus).label}
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
          ))}
          {filtered.length === 0 && <div style={{ textAlign: "center", color: COLORS.textMuted, padding: 48 }}>Aucune société trouvée</div>}
        </div>
      </div>

      {sel && <div style={{ marginLeft: 20 }}><CompanyDetailPanel sel={sel} selContacts={selContacts} onEdit={() => openEdit(sel)} onDelete={() => del(sel.id)}
        getStatusCfg={getStatusCfg} getComplianceCfg={getComplianceCfg} getFinalAuthCfg={getFinalAuthCfg}
        getBUCfg={getBUCfg} getRoleCfg={getRoleCfg} getTypeCfg={getTypeCfg} /></div>}


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
            <Input label="Creation Date" type="date" value={form.complianceCreationDate || ""} onChange={v => setForm({ ...form, complianceCreationDate: v })} />
            <Input label="Last Update Date" type="date" value={form.complianceLastUpdateDate || ""} onChange={v => setForm({ ...form, complianceLastUpdateDate: v })} />
            <Input label="Request Date" type="date" value={form.complianceRequestDate || ""} onChange={v => setForm({ ...form, complianceRequestDate: v })} />
            <Input label="Last Reception Date" type="date" value={form.complianceLastReceptionDate || ""} onChange={v => setForm({ ...form, complianceLastReceptionDate: v })} />
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
      {showImport && <ExcelImportModal type="companies" onClose={() => setShowImport(false)} onImport={(items) => {
  setCompanies(prev => {
    const ex = new Set(prev.map(c => c.name?.toLowerCase()));
    const next = [...prev, ...items.filter(i => !ex.has(i.name?.toLowerCase()))];
    saveLargeTable('companies', next);
    return next;
  });
}} />}
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
      const opExchange = norm(op.exchange);
      const opTrans = norm(op.orderTransmissionType);

      const matching = tarifs.filter(t => {
        if (!t.isActive) return false;
        const brokers = Array.isArray(t.financialBroker) ? t.financialBroker : [t.financialBroker];
        const transmissions = Array.isArray(t.orderTransmissionType) ? t.orderTransmissionType : [t.orderTransmissionType];
        const brokerMatch = brokers.some(b => norm(b) === opBroker || norm(b).includes(opBroker) || opBroker.includes(norm(b)));
        const exchangeMatch = norm(t.exchange) === opExchange || norm(t.exchange).includes(opExchange) || opExchange.includes(norm(t.exchange));
        const transMatch = opTrans === "" || transmissions.some(tr => norm(tr) === opTrans);
        return brokerMatch && exchangeMatch && transMatch;
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
      const { data, error } = await supabase.from('derivatives').select('data').range(from, from + PAGE - 1);
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
const saveAllDerivatives = async (items) => {
  if (!items || items.length === 0) return;
  const CHUNK = 20;
  const DELAY = 100;
  const MAX_RETRY = 3;
  const insertChunkWithRetry = async (chunk, attempt = 0) => {
    const { error } = await supabase.from('derivatives').insert(chunk);
    if (error) {
      if (attempt < MAX_RETRY) {
        await new Promise(r => setTimeout(r, 200 * (attempt + 1)));
        return insertChunkWithRetry(chunk, attempt + 1);
      }
      console.error(`[saveAllDerivatives] chunk failed after ${MAX_RETRY} retries:`, error);
      return false;
    }
    return true;
  };
  await supabase.from('derivatives').delete().neq('id', 0);
  for (let i = 0; i < items.length; i += CHUNK) {
    const chunk = items.slice(i, i + CHUNK).map(item => ({ data: item }));
    await insertChunkWithRetry(chunk);
    if (i + CHUNK < items.length) await new Promise(r => setTimeout(r, DELAY));
  }
};

// ── Save a single op (create/update) ───────────────────────
const saveOneDerivative = async (op) => {
  // Use data->>'id' filter to upsert by logical id
  await supabase.from('derivatives').delete().filter('data->>'id'', 'eq', String(op.id));
  await supabase.from('derivatives').insert({ data: op });
};

// ── Delete a single op ─────────────────────────────────────
const deleteOneDerivative = async (id) => {
  await supabase.from('derivatives').delete().filter('data->>'id'', 'eq', String(id));
};

const setOps = async (val) => {
  const next = typeof val === "function" ? val(ops) : val;
  setOpsRaw(next);
};
  const [showForm, setShowForm]   = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editOp, setEditOp]       = useState(null);
  const [form, setForm]         = useState(makeEmpty());
  const [selected, setSelected] = useState(null);
  const [search, setSearch]     = useState("");
  const [editingFeesId, setEditingFeesId] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filterMode, setFilterMode]   = useState("AND");
  const EMPTY_FILTERS = { type: [], opType: [], side: [], status: [], businessUnit: [], internalDeal: [] };
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
  const openEdit = (op) => { setForm({ ...op }); setEditOp(op); setFormErrors({}); setShowForm(true); };
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

  const save = () => {
    const errors = {};
    REQUIRED_FIELDS.forEach(({ key, label }) => {
      const val = form[key];
      const isEmpty = val === null || val === undefined || val === "" || (Array.isArray(val) && val.length === 0);
      if (isEmpty) errors[key] = `${label} est obligatoire`;
    });
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setFormErrors({});
    const data = { ...form, id: editOp ? editOp.id : Date.now() };
    if (editOp) { setOpsRaw(ops.map(o => o.id === editOp.id ? data : o)); await saveOneDerivative(data); }
    else        { setOpsRaw([...ops, data]); await saveOneDerivative(data); }
    setShowForm(false);
    setSelected(data.id);
  };

  const filtered = ops.filter(o => {
    const q = search.toLowerCase();
    const ms = !q || o.ref?.toLowerCase().includes(q) || o.instrument?.toLowerCase().includes(q) || o.broker?.toLowerCase().includes(q) || o.exchange?.toLowerCase().includes(q) || o.contract?.toLowerCase().includes(q) || o.notes?.toLowerCase().includes(q);
    if (!ms) return false;
    const tagChecks = [
      !activeFilters.type.length         || activeFilters.type.includes(o.type),
      !activeFilters.opType.length       || activeFilters.opType.includes(o.opType),
      !activeFilters.side.length         || activeFilters.side.includes(o.side),
      !activeFilters.status.length       || activeFilters.status.includes(o.status) || activeFilters.status.some(s => o.status?.toLowerCase() === s?.toLowerCase()),
      !activeFilters.businessUnit.length || activeFilters.businessUnit.includes(o.businessUnit),
      !activeFilters.internalDeal.length || activeFilters.internalDeal.includes(String(o.internalDeal)),
    ].filter((_, i) => {
      const keys = ["type","opType","side","status","businessUnit","internalDeal"];
      return activeFilters[keys[i]].length > 0;
    });
    const customChecks = customFilters.map(cf => {
      const val = o[cf.key];
      if (cf.op === "empty")    return !val || String(val).trim() === "";
      if (cf.op === "notempty") return !!val && String(val).trim() !== "";
      if (cf.op === "eq")       return String(val) === String(cf.value);
      if (cf.op === "gt")       return Number(val) > Number(cf.value);
      if (cf.op === "lt")       return Number(val) < Number(cf.value);
      if (cf.op === "contains") return String(val || "").toLowerCase().includes(cf.value.toLowerCase());
      return true;
    });
    const allChecks = [...tagChecks, ...customChecks];
    return filterMode === "OR" ? (allChecks.length === 0 || allChecks.some(Boolean)) : allChecks.every(Boolean);
  });

  const sel = ops.find(o => o.id === selected);
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
  const COLS = "90px 70px 80px 55px 180px 90px 80px 80px 100px 90px 110px 110px 110px 90px 60px 90px 1fr";
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
            <div onClick={() => setShowImport(true)} style={{ cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: "10px 14px", borderRadius: 8, border: `1px solid ${COLORS.border}`, background: "transparent" }}>
              <img src="/logoxl.png" style={{ width: 32, height: 32, objectFit: "contain" }} />
            </div>
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
        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          <input placeholder="Search by ref, instrument, broker, notes…" value={search} onChange={e => setSearch(e.target.value)}
            style={{ flex: 1, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "10px 16px", color: COLORS.text, fontSize: 14, outline: "none", fontFamily: "inherit" }} />
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
        <div style={{ flex: 1, overflowY: "auto", overflowX: "auto" }}>
          <div style={{ minWidth: 1100 }}>
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
                  {(() => { const prod = (config.derivProducts || []).find(p => p.value === o.instrument); return <div style={{ fontSize: 13, color: COLORS.text, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "center" }}>{prod?.label || o.instrument || "—"}</div>; })()}
                  <div style={{ fontSize: 13, color: COLORS.text, textAlign: "center" }}>{o.quantity ? `${Number(o.quantity).toLocaleString()}` : "—"}</div>
                  <div style={{ fontSize: 13, color: COLORS.text, textAlign: "center" }}>{o.price || "—"}</div>
                  <div style={{ fontSize: 13, color: COLORS.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "center" }}>{o.businessUnit ? o.businessUnit.toUpperCase() : "—"}</div>
                  <div style={{ fontSize: 13, color: COLORS.text, textAlign: "center" }}>{o.tradeDate ? o.tradeDate.split("-").reverse().join("/") : "—"}</div>
                  <div style={{ fontSize: 13, color: COLORS.text, textAlign: "center" }}>{o.type?.toLowerCase() === "option" ? (o.expiryDate || "—") : <span style={{ color: COLORS.textMuted }}>—</span>}</div>
                  <div style={{ fontSize: 13, color: COLORS.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "center" }}>{o.broker || "—"}</div>
                  {(() => { const exch = (config.derivExchanges || []).find(e => e.value === o.exchange); return <div style={{ fontSize: 13, color: COLORS.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "center" }}>{exch?.label || o.exchange || "—"}</div>; })()}
                  {(() => { const acc = (config.derivAccounts || []).find(a => a.value === o.account); return <div style={{ fontSize: 13, color: COLORS.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "center" }}>{acc?.label || o.account || "—"}</div>; })()}
                  <div style={{ textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 5, background: `${sc.color}20`, color: sc.color }}>{sc.label}</span></div>
                  <div style={{ textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 5, background: o.internalDeal ? `${COLORS.blue}20` : "transparent", color: o.internalDeal ? COLORS.blue : COLORS.textMuted }}>{o.internalDeal ? "YES" : "—"}</span></div>
                  {/* FEES — calculé auto, éditable manuellement */}
                  {(() => {
                    const account = derivAccounts.find(a => a.accountNumber === o.account);
                    const currency = (account?.currency || "").toUpperCase();
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
            { label: "PRICE",           value: sel.price || null },
            sel.type?.toLowerCase() === "option" ? { label: "STRIKE", value: sel.strike || null } : null,

            { label: "BUSINESS UNIT",   value: sel.businessUnit ? sel.businessUnit.toUpperCase() : null },
            { label: "TRADE DATE",      value: sel.tradeDate },
            sel.type?.toLowerCase() === "option" ? { label: "EXPIRY DATE", value: sel.expiryDate } : null,
            { label: "BROKER",          value: sel.broker },
            { label: "EXCHANGE",        value: sel.exchange ? sel.exchange.toUpperCase() : null },
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
            const account = derivAccounts.find(a => a.accountNumber === sel.account);
            const currency = (account?.currency || "").toUpperCase();
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

            {/* Référence (lecture seule à la création) */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 11, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5 }}>REFERENCE</label>
              <input value={form.ref} readOnly
                style={{ background: `${COLORS.accent}10`, border: `1px solid ${COLORS.accent}40`, borderRadius: 8, padding: "10px 14px", color: COLORS.accent, fontSize: 13, fontFamily: "'DM Mono', monospace", outline: "none", fontWeight: 700 }} />
            </div>

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
              const decConfig = (config.derivDecimals || []).find(d => d.value === decimalsFormat);
              const isFraction = decimalsFormat !== "decimal";
              const fractionOptions = isFraction
                ? (() => {
                    const [num, den] = decimalsFormat.split("/").map(Number);
                    return Array.from({ length: den / num }, (_, i) => `${(i + 1) * num}/${den}`).filter((_, i, a) => {
                      const [n, d] = a[i].split("/").map(Number); return n < d;
                    });
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
                    <input value={form.price} onChange={e => { setForm(f => ({ ...f, price: e.target.value })); setFormErrors(er => ({ ...er, price: undefined })); }} placeholder="0.00"
                      style={{ background: COLORS.bg, border: `1px solid ${formErrors.price ? COLORS.red : COLORS.border}`, borderRadius: 8, padding: "10px 14px", color: COLORS.text, fontSize: 14, outline: "none", fontFamily: "inherit" }} />
                  ) : (
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input value={intPart} onChange={e => { setForm(f => ({ ...f, price: e.target.value + (fracPart ? ` ${fracPart}` : "") })); setFormErrors(er => ({ ...er, price: undefined })); }}
                        placeholder="200" type="number"
                        style={{ flex: 1, background: COLORS.bg, border: `1px solid ${formErrors.price ? COLORS.red : COLORS.border}`, borderRadius: 8, padding: "10px 14px", color: COLORS.text, fontSize: 14, outline: "none", fontFamily: "'DM Mono', monospace" }} />
                      <select value={fracPart || ""} onChange={e => { setForm(f => ({ ...f, price: (intPart || "0") + (e.target.value ? ` ${e.target.value}` : "") })); setFormErrors(er => ({ ...er, price: undefined })); }}
                        style={{ width: 90, background: COLORS.bg, border: `1px solid ${formErrors.price ? COLORS.red : COLORS.border}`, borderRadius: 8, padding: "10px 10px", color: fracPart ? COLORS.text : COLORS.textMuted, fontSize: 14, outline: "none", fontFamily: "'DM Mono', monospace" }}>
                        <option value="">— frac —</option>
                        {(() => {
                          const den = parseInt(decimalsFormat.split("/")[1]);
                          return Array.from({ length: den - 1 }, (_, i) => {
                            const num = i + 1;
                            return <option key={num} value={`${num}/${den}`}>{num}/{den}</option>;
                          });
                        })()}
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
      {showImport && (
        <ExcelImportModal type="derivatives" derivAccounts={derivAccounts} derivProducts={products} derivCompanies={companies} onClose={() => setShowImport(false)}
          onImport={async (items) => {
            const ex = new Set(ops.map(o => o.ref?.toLowerCase()).filter(Boolean));
            const toAdd = items.map(i => ({ ...makeEmpty(), ...i, id: Date.now() + Math.random(), internalDeal: String(i.internalDeal).toLowerCase() === "true" }))
              .filter(i => !i.ref || !ex.has(i.ref?.toLowerCase()));
            const next = [...ops, ...toAdd];
            setOpsRaw(next);
            await saveAllDerivatives(next);
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
                      {(c.roles || []).slice(0, 2).map(r => <Badge key={r} label={r} color={getRoleCfg(r).color} />)}
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
const runFIFO = (bucketOps) => {
  const parseP = (v) => { const n = parseFloat(String(v ?? "").replace(/,/g, ".")); return isNaN(n) ? 0 : n; };
  const sorted = [...bucketOps].sort((a, b) => {
    const da = a.tradeDate || "9999", db = b.tradeDate || "9999";
    if (da !== db) return da < db ? -1 : 1;
    return (a.id || 0) < (b.id || 0) ? -1 : 1;
  });
  const queue = [];
  const matches = [];
  let realizedPnl = 0;
  for (const op of sorted) {
    const side = (op.side || "").toUpperCase();
    const lots = parseP(op.quantity);
    const price = parseP(op.price);
    if (side === "BUY") {
      queue.push({ ref: op.ref, date: op.tradeDate || "—", lots, price, remaining: lots });
    } else if (side === "SELL") {
      let toClose = lots;
      while (toClose > 0 && queue.length > 0) {
        const head = queue[0];
        const matched = Math.min(toClose, head.remaining);
        const pnl = (price - head.price) * matched;
        realizedPnl += pnl;
        matches.push({
          buyRef: head.ref,  buyDate: head.date,
          sellRef: op.ref,   sellDate: op.tradeDate || "—",
          lots: matched, entryPrice: head.price, exitPrice: price, pnl,
        });
        head.remaining -= matched;
        toClose -= matched;
        if (head.remaining <= 0) queue.shift();
      }
    }
  }
  const openLots = queue.reduce((s, e) => s + e.remaining, 0);
  const openAvgPrice = openLots > 0 ? queue.reduce((s, e) => s + e.price * e.remaining, 0) / openLots : 0;
  return { realizedPnl, matches, openLots, openAvgPrice };
};

// ─── DERIVATIVES DASHBOARD ───────────────────────────────────
const DerivativesDashboard = () => {
  const { config } = useConfig();
  const [ops, setOps] = useState([]);
  const [derivAccounts, setDerivAccounts] = useState([]);

  useEffect(() => {
    async function loadAll() {
      const { data: accData } = await supabase.from('deriv_accounts').select('*');
      // Load all derivatives pages
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
      if (allOps.length) setOps(allOps);
      if (accData?.length) setDerivAccounts(accData.map(r => {
        const acc = r.data ?? r;
        if (typeof acc.isActive === "string") {
          acc.isActive = acc.isActive.trim().toLowerCase() !== "false" && acc.isActive.trim() !== "0";
        }
        return acc;
      }));
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

  const fmtLots = (n) => Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 });
  const fmt = (n) => {
    const abs = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (n >= 0 ? "+ " : "− ") + abs;
  };
  const pnlColor = (n) => n > 0 ? COLORS.green : n < 0 ? COLORS.red : COLORS.textMuted;

  // Build buckets keyed by "account||instrument" — normalized to avoid case/space mismatches
  const buckets = {};
  for (const op of ops) {
    const normKey = `${(op.account || "").toLowerCase().trim()}||${(op.instrument || "").toLowerCase().trim()}`;
    if (!buckets[normKey]) buckets[normKey] = { account: op.account || "", instrument: op.instrument || "", ops: [] };
    buckets[normKey].ops.push(op);
  }

  const bucketResults = Object.values(buckets).map(b => ({ ...b, ...runFIFO(b.ops) }));

  // Aggregate by account
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

  const [expandedAccounts, setExpandedAccounts] = useState({});
  const [expandedInstruments, setExpandedInstruments] = useState({});
  const toggle = (key) => setExpandedAccounts(p => ({ ...p, [key]: !p[key] }));
  const toggleInst = (key) => setExpandedInstruments(p => ({ ...p, [key]: !p[key] }));

  const GRID = "32px 1fr 70px 70px 120px 90px 170px";
  const MATCH_GRID = "1fr 1fr 1fr 1fr 100px 100px 100px 130px";

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
        <div>
          <h1 style={{ margin: 0, fontSize: 28, color: COLORS.text, fontFamily: "'Inter', sans-serif", fontWeight: 700 }}>Derivatives Dashboard</h1>
          <div style={{ fontSize: 13, color: COLORS.textMuted, marginTop: 4 }}>Realised P&amp;L — FIFO par compte × instrument</div>
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
        <KpiCard label="MATCHES FIFO" value={totalMatches} sub={`sur ${Object.keys(buckets).length} bucket${Object.keys(buckets).length > 1 ? "s" : ""}`} />
      </div>

      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, overflow: "hidden" }}>
        <div style={{ background: COLORS.tableHeader, padding: "14px 20px", borderBottom: `1px solid ${COLORS.border}` }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text }}>P&amp;L PAR COMPTE</div>
          <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 2 }}>Cliquez sur un compte pour voir le détail par instrument</div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: GRID, padding: "10px 20px", background: `${COLORS.tableHeader}99`, borderBottom: `1px solid ${COLORS.border}` }}>
          {["", "COMPTE", "BUY", "SELL", "LOTS OUVERTS", "MATCHES", "REALISED P&L"].map((h, i) => (
            <div key={i} style={{ fontSize: 10, fontWeight: 700, color: COLORS.textMuted, letterSpacing: 0.7, textAlign: i >= 2 ? "right" : "left" }}>{h}</div>
          ))}
        </div>

        {rows.length === 0 && (
          <div style={{ textAlign: "center", color: COLORS.textMuted, padding: "48px 0", fontSize: 14 }}>
            Aucune opération. Ajoutez des BUY et des SELL dans Derivatives.
          </div>
        )}

        {rows.map((row, idx) => {
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
        })}

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
          {page === "admin" && <AdminPanel companies={companies} />}
        </div>
      </div>
    </ConfigProvider>
  );
}