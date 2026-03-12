import { useState, useEffect, useRef, createContext, useContext } from "react";

// ─── COLORS ───────────────────────────────────────────────────
const COLORS = {
  bg: "#0F0F13",
  surface: "#16161D",
  card: "#1C1C26",
  border: "#2A2A3A",
  accent: "#6C63FF",
  gold: "#F5C842",
  green: "#3ECFA0",
  red: "#FF5C7A",
  blue: "#4BA3F5",
  orange: "#FF8C42",
  purple: "#B06CF5",
  text: "#E8E8F0",
  textSub: "#8888A8",
  textMuted: "#55556A",
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
    { value: "morocco", label: "Morocco", color: "#C0913A" },
    { value: "ukraine", label: "Ukraine", color: "#4B8AE8" },
  ],
  country: [
    { value: "France", label: "France" },
    { value: "Morocco", label: "Morocco" },
    { value: "Ukraine", label: "Ukraine" },
    { value: "United Kingdom", label: "United Kingdom" },
    { value: "Germany", label: "Germany" },
    { value: "United States", label: "United States" },
    { value: "UAE", label: "UAE" },
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
    { value: "Customs broker", label: "Customs broker", color: COLORS.gold },
    { value: "Surveyor", label: "Surveyor", color: COLORS.purple },
    { value: "Insurer", label: "Insurer", color: COLORS.red },
    { value: "Farm", label: "Farm", color: "#7EC86A" },
    { value: "Elevator", label: "Elevator", color: "#4ECDC4" },
    { value: "Bank", label: "Bank", color: COLORS.accent },
  ],
};

// ─── CONFIG CONTEXT ───────────────────────────────────────────
const ConfigContext = createContext(null);
const useConfig = () => useContext(ConfigContext);

const ConfigProvider = ({ children }) => {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("crm-admin-config");
      if (saved) setConfig(JSON.parse(saved));
    } catch {}
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) {
      try { localStorage.setItem("crm-admin-config", JSON.stringify(config)); } catch {}
    }
  }, [config, loaded]);

  const updateField = (fieldKey, newValues) => {
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

const SIZE_CONFIG = {
  "1-10": { label: "1–10 emp.", color: COLORS.textSub },
  "11-50": { label: "11–50 emp.", color: COLORS.blue },
  "51-200": { label: "51–200 emp.", color: COLORS.orange },
  "201-1000": { label: "201–1000 emp.", color: COLORS.green },
  "1000+": { label: "1000+ emp.", color: COLORS.purple },
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
  "philippines": "PH", "singapore": "SG", "south korea": "KR", "north korea": "KP",
  "taiwan": "TW", "hong kong": "HK", "myanmar": "MM", "cambodia": "KH",
  "kazakhstan": "KZ", "uzbekistan": "UZ", "azerbaijan": "AZ", "georgia": "GE",
  "armenia": "AM", "afghanistan": "AF",
  "new zealand": "NZ",
};

const getCountryCode = (country) => {
  if (!country) return null;
  const trimmed = country.trim();
  if (trimmed.length === 2) return trimmed.toUpperCase();
  const threeLetter = { "UAE": "AE", "USA": "US", "UK": "GB" };
  if (threeLetter[trimmed.toUpperCase()]) return threeLetter[trimmed.toUpperCase()];
  return COUNTRY_TO_CODE[trimmed.toLowerCase()] || null;
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

const Modal = ({ title, onClose, children, wide = false }) => (
  <div style={{ position: "fixed", inset: 0, background: "#00000088", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }} onClick={onClose}>
    <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 28, width: "100%", maxWidth: wide ? 680 : 560, maxHeight: "90vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 20, color: COLORS.text, fontFamily: "'Playfair Display', serif" }}>{title}</h2>
        <button onClick={onClose} style={{ background: "none", border: "none", color: COLORS.textSub, cursor: "pointer", fontSize: 22 }}>×</button>
      </div>
      {children}
    </div>
  </div>
);

const Btn = ({ children, onClick, variant = "primary", style = {}, disabled = false }) => {
  const styles = {
    primary: { background: COLORS.accent, color: "#fff", border: "none" },
    secondary: { background: "transparent", color: COLORS.text, border: `1px solid ${COLORS.border}` },
    danger: { background: `${COLORS.red}20`, color: COLORS.red, border: `1px solid ${COLORS.red}40` },
    success: { background: `${COLORS.green}20`, color: COLORS.green, border: `1px solid ${COLORS.green}40` },
  };
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ ...styles[variant], padding: "10px 18px", borderRadius: 8, cursor: disabled ? "not-allowed" : "pointer", fontSize: 14, fontWeight: 600, fontFamily: "inherit", transition: "opacity 0.2s", opacity: disabled ? 0.4 : 1, ...style }}
      onMouseOver={e => { if (!disabled) e.currentTarget.style.opacity = "0.85"; }}
      onMouseOut={e => { if (!disabled) e.currentTarget.style.opacity = "1"; }}
    >{children}</button>
  );
};

const CountryFlag = ({ country, size = 36 }) => {
  const code = getCountryCode(country);
  return (
    <div style={{ width: size * 1.5, height: size, borderRadius: 8, overflow: "hidden", flexShrink: 0, border: `1px solid ${COLORS.border}`, background: COLORS.border, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {code
        ? <img
            src={`https://flagcdn.com/${code.toLowerCase()}.svg`}
            alt={country}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            onError={e => { e.target.onerror = null; e.target.src = `https://flagcdn.com/w80/${code.toLowerCase()}.png`; }}
          />
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
  { key: "country", label: "Country", icon: "🌍", description: "Pays disponibles dans les formulaires", hasColor: false, hasValue: false },
  { key: "complianceStatus", label: "Compliance Status", icon: "🛡", description: "Statuts de conformité", hasColor: true, hasValue: true },
  { key: "finalAuthStatus", label: "Final Authorization Status", icon: "✅", description: "Statuts d'autorisation finale", hasColor: true, hasValue: true },
  { key: "roles", label: "Roles", icon: "◎", description: "Rôles assignables aux sociétés", hasColor: true, hasValue: true },
];

const FieldEditor = ({ fieldDef, values, onUpdate }) => {
  const [items, setItems] = useState(values);
  const [newLabel, setNewLabel] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newColor, setNewColor] = useState(COLORS.accent);
  const [dirty, setDirty] = useState(false);
  const [colorPickerIdx, setColorPickerIdx] = useState(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => { setItems(values); setDirty(false); }, [values]);

  const markDirty = (updated) => { setItems(updated); setDirty(true); };

  const addItem = () => {
    if (!newLabel.trim()) return;
    const val = fieldDef.hasValue ? (newValue.trim() || newLabel.toLowerCase().replace(/\s+/g, "_")) : newLabel;
    const item = { value: val, label: newLabel.trim() };
    if (fieldDef.hasColor) item.color = newColor;
    markDirty([...items, item]);
    setNewLabel(""); setNewValue(""); setNewColor(COLORS.accent);
  };

  const removeItem = (idx) => markDirty(items.filter((_, i) => i !== idx));
  const moveUp = (idx) => { if (idx === 0) return; const a = [...items]; [a[idx - 1], a[idx]] = [a[idx], a[idx - 1]]; markDirty(a); };
  const moveDown = (idx) => { if (idx === items.length - 1) return; const a = [...items]; [a[idx], a[idx + 1]] = [a[idx + 1], a[idx]]; markDirty(a); };
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
            {items.map((item, idx) => (
              <div key={idx} style={{ display: "flex", alignItems: "center", gap: 8, background: COLORS.card, borderRadius: 10, padding: "8px 12px", border: `1px solid ${COLORS.border}` }}>
                {fieldDef.hasColor && (
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    <div title="Changer la couleur" onClick={() => setColorPickerIdx(colorPickerIdx === idx ? null : idx)}
                      style={{ width: 22, height: 22, borderRadius: 6, background: item.color || COLORS.textSub, cursor: "pointer", border: `2px solid ${COLORS.border}` }} />
                    {colorPickerIdx === idx && (
                      <div style={{ position: "absolute", top: 28, left: 0, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 10, zIndex: 50, display: "flex", flexWrap: "wrap", gap: 6, width: 190, boxShadow: "0 8px 24px #00000060" }}>
                        {COLOR_PALETTE.map(c => (
                          <div key={c} onClick={() => { updateItem(idx, "color", c); setColorPickerIdx(null); }}
                            style={{ width: 24, height: 24, borderRadius: 6, background: c, cursor: "pointer", border: item.color === c ? `2px solid ${COLORS.text}` : `2px solid transparent`, transition: "transform 0.1s" }}
                            onMouseOver={e => e.currentTarget.style.transform = "scale(1.2)"}
                            onMouseOut={e => e.currentTarget.style.transform = "scale(1)"}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <input value={item.label} onChange={e => updateItem(idx, "label", e.target.value)}
                  style={{ flex: 1, background: "transparent", border: "none", color: COLORS.text, fontSize: 13, fontFamily: "inherit", outline: "none" }} />
                {fieldDef.hasValue && (
                  <span style={{ fontSize: 10, color: COLORS.textMuted, fontFamily: "'DM Mono', monospace", whiteSpace: "nowrap", background: COLORS.bg, padding: "2px 6px", borderRadius: 4 }}>
                    {item.value}
                  </span>
                )}
                {fieldDef.hasColor && (
                  <Badge label={item.label} color={item.color || COLORS.textSub} />
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <button onClick={() => moveUp(idx)} style={{ background: "none", border: "none", color: COLORS.textMuted, cursor: "pointer", fontSize: 9, padding: "1px 3px", lineHeight: 1 }}>▲</button>
                  <button onClick={() => moveDown(idx)} style={{ background: "none", border: "none", color: COLORS.textMuted, cursor: "pointer", fontSize: 9, padding: "1px 3px", lineHeight: 1 }}>▼</button>
                </div>
                <button onClick={() => removeItem(idx)} style={{ background: "none", border: "none", color: COLORS.textMuted, cursor: "pointer", fontSize: 18, flexShrink: 0, lineHeight: 1 }}
                  onMouseOver={e => e.currentTarget.style.color = COLORS.red}
                  onMouseOut={e => e.currentTarget.style.color = COLORS.textMuted}
                >×</button>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "flex-end", background: `${COLORS.accent}08`, border: `1px dashed ${COLORS.accent}40`, borderRadius: 10, padding: "12px 14px" }}>
            {fieldDef.hasColor && (
              <div style={{ flexShrink: 0 }}>
                <div style={{ fontSize: 10, color: COLORS.textSub, marginBottom: 5, fontWeight: 600 }}>COULEUR</div>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", width: 110 }}>
                  {COLOR_PALETTE.slice(0, 6).map(c => (
                    <div key={c} onClick={() => setNewColor(c)}
                      style={{ width: 20, height: 20, borderRadius: 5, background: c, cursor: "pointer", border: newColor === c ? `2px solid ${COLORS.text}` : `2px solid transparent`, transition: "transform 0.1s" }}
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

const AdminPanel = () => {
  const { config, updateField } = useConfig();
  const [showResetConfirm, setShowResetConfirm] = useState(false);

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
            <h1 style={{ margin: 0, fontSize: 28, color: COLORS.text, fontFamily: "'Playfair Display', serif" }}>Admin Panel</h1>
          </div>
          <p style={{ margin: 0, color: COLORS.textSub, fontSize: 14 }}>Gérez les valeurs prédéfinies de vos champs CRM sans toucher au code</p>
        </div>
        <Btn variant="danger" style={{ padding: "8px 14px", fontSize: 12 }} onClick={() => setShowResetConfirm(true)}>
          ↺ Réinitialiser les défauts
        </Btn>
      </div>

      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, overflow: "hidden" }}>
        <div style={{ padding: "18px 24px", borderBottom: `1px solid ${COLORS.border}`, display: "flex", alignItems: "center", gap: 14, background: `${COLORS.accent}06` }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: `${COLORS.accent}20`, border: `1px solid ${COLORS.accent}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>📋</div>
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
            💡 Cliquez sur un champ pour le déplier et modifier ses valeurs. Les modifications sont instantanément disponibles dans tous les formulaires.
            N'oubliez pas de cliquer sur <strong>✓ Sauvegarder</strong> après chaque modification.
          </div>
          {FIELD_DEFINITIONS.map(fieldDef => (
            <FieldEditor
              key={fieldDef.key}
              fieldDef={fieldDef}
              values={config[fieldDef.key] || []}
              onUpdate={updateField}
            />
          ))}
        </div>
      </div>

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
        <h1 style={{ margin: 0, fontSize: 28, color: COLORS.text, fontFamily: "'Playfair Display', serif" }}>Vue d'ensemble</h1>
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
  "name": ["name"], "website": ["website"], "city": ["city"], "country": ["country"],
  "broker": ["broker"], "roles": ["role"], "businessUnit": ["business unit"],
  "complianceStatus": ["compliance status"], "finalAuthStatus": ["authorisation status"],
  "taxInfo": ["tax info", "tax", "tva", "siret", "tax number"],
  "legalName": ["legal name", "raison sociale", "denomination"],
  "additionalInfos": ["additional infos", "additional info", "infos", "informations"],
  "complianceAdditionalInfos": ["compliance additional infos", "compliance additional info", "compliance infos", "compliance notes"],
};
const CONTACT_FIELD_MAP = {
  "name": ["name", "nom", "full name", "contact"],
  "email": ["email", "mail", "e-mail"],
  "phone": ["phone", "tel", "telephone"],
  "role": ["role", "rôle", "poste", "title", "job title"],
  "notes": ["notes", "note", "comments"],
  "revenue": ["revenue", "revenus", "ca"],
};
const normalizeHeader = (h) => h?.toString().toLowerCase().trim().replace(/[^a-z0-9 ]/g, "");
const guessField = (header, fieldMap) => {
  const norm = normalizeHeader(header);
  for (const [field, aliases] of Object.entries(fieldMap)) {
    if (aliases.some(a => norm === a || norm.includes(a))) return field;
  }
  return null;
};

const ExcelImportModal = ({ onClose, onImport, type }) => {
  const { config } = useConfig();
  const [step, setStep] = useState("upload");
  const [rawRows, setRawRows] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [mapping, setMapping] = useState({});
  const [preview, setPreview] = useState([]);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef();
  const fieldMap = type === "companies" ? COMPANY_FIELD_MAP : CONTACT_FIELD_MAP;

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
      hdrs.forEach((h, i) => { const g = guessField(h, fieldMap); if (g && !Object.values(autoMap).includes(g)) autoMap[i] = g; });
      setMapping(autoMap); setStep("mapping");
    } catch { setError("Erreur de lecture du fichier."); }
  };

  const buildPreview = () => {
    setPreview(rawRows.slice(0, 5).map(row => { const obj = {}; Object.entries(mapping).forEach(([ci, f]) => { if (f) obj[f] = row[ci]?.toString() || ""; }); return obj; }));
    setStep("preview");
  };

  const [warnings, setWarnings] = useState([]);
  const [showWarnings, setShowWarnings] = useState(false);

  const doImport = () => {
    setImporting(true);
    const unknowns = {};

    const mapToConfigValue = (fieldKey, val) => {
      if (!val) return null;
      const match = config[fieldKey]?.find(
        s => s.value.toLowerCase() === val.toLowerCase() ||
             s.label.toLowerCase() === val.toLowerCase()
      );
      return match ? match.value : null;
    };

    const checkUnknown = (fieldKey, fieldLabel, val) => {
      if (!val) return;
      const mapped = mapToConfigValue(fieldKey, val);
      if (!mapped) {
        if (!unknowns[fieldLabel]) unknowns[fieldLabel] = new Set();
        unknowns[fieldLabel].add(val);
      }
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

    const items = rawRows.map((row, i) => {
      const obj = { id: Date.now() + i };
      Object.entries(mapping).forEach(([ci, f]) => { if (f) obj[f] = row[ci]?.toString() || ""; });
      if (type === "companies") {
        obj.avatar = (obj.name || "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
        obj.tags = []; obj.revenue = Number(obj.revenue) || 0;
        if (obj.status) checkUnknown("activityStatus", "Activity Status", obj.status);
        if (obj.companyType) checkUnknown("companyType", "Company Type", obj.companyType);
        if (obj.businessUnit) checkUnknown("businessUnit", "Business Unit", obj.businessUnit);
        if (obj.country) checkUnknown("country", "Country", obj.country);
        if (obj.city) checkUnknown("city", "City", obj.city);
        obj.status = mapToConfigValue("activityStatus", obj.status) || config.activityStatus[0]?.value || "";
        obj.size = obj.size || "1-10";
        obj.companyType = mapToConfigValue("companyType", obj.companyType) || config.companyType[0]?.value || "";
        obj.businessUnit = mapToConfigValue("businessUnit", obj.businessUnit) || "";
        obj.country = mapToConfigValue("country", obj.country) || obj.country || "";
        obj.city = mapToConfigValue("city", obj.city) || obj.city || "";
        obj.complianceStatus = mapAuth(obj.complianceStatus, config.complianceStatus);
        obj.finalAuthStatus = mapAuth(obj.finalAuthStatus, config.finalAuthStatus);
        if (obj.roles && typeof obj.roles === "string") {
          obj.roles = obj.roles.split(/[,;\/]/).map(r => r.trim()).filter(Boolean).map(r => {
            const matched = config.roles?.find(
              cr => cr.value.toLowerCase() === r.toLowerCase() || cr.label.toLowerCase() === r.toLowerCase()
            );
            return matched ? matched.value : r;
          });
        } else {
          obj.roles = [];
        }
      } else {
        obj.avatar = (obj.name || "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
        obj.tags = []; obj.revenue = Number(obj.revenue) || 0;
        if (obj.status) checkUnknown("activityStatus", "Activity Status", obj.status);
        obj.status = mapToConfigValue("activityStatus", obj.status) || config.activityStatus[0]?.value || "";
        obj.priority = obj.priority || "moyenne";
        obj.lastContact = new Date().toISOString().split("T")[0];
      }
      return obj;
    }).filter(o => o.name);

    const warnList = Object.entries(unknowns).map(([field, vals]) => ({
      field,
      values: [...vals],
    }));

    onImport(items);
    setImporting(false);

    if (warnList.length > 0) {
      setWarnings(warnList);
      setShowWarnings(true);
    } else {
      onClose();
    }
  };

  const allFields = Object.keys(fieldMap);
  return (
    <div style={{ position: "fixed", inset: 0, background: "#00000090", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }} onClick={onClose}>
      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 18, padding: 30, width: "100%", maxWidth: 700, maxHeight: "90vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, color: COLORS.text, fontFamily: "'Playfair Display', serif" }}>Import Excel — {type === "companies" ? "Companies" : "Contacts"}</h2>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: COLORS.textSub }}>Formats acceptés : .xlsx, .xls, .csv</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: COLORS.textSub, cursor: "pointer", fontSize: 22 }}>×</button>
        </div>
        <div style={{ display: "flex", gap: 6, marginBottom: 28 }}>
          {[["upload", "1. Fichier"], ["mapping", "2. Colonnes"], ["preview", "3. Aperçu"]].map(([s, l]) => (
            <div key={s} style={{ padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: step === s ? COLORS.accent : COLORS.bg, color: step === s ? "#fff" : COLORS.textMuted, border: `1px solid ${step === s ? COLORS.accent : COLORS.border}` }}>{l}</div>
          ))}
        </div>
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
        {step === "mapping" && (
          <div>
            <p style={{ color: COLORS.textSub, fontSize: 13, margin: "0 0 20px" }}>{rawRows.length} lignes détectées.</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, maxHeight: 380, overflowY: "auto" }}>
              {headers.map((h, i) => (
                <div key={i} style={{ background: COLORS.bg, borderRadius: 10, padding: "10px 14px", border: `1px solid ${COLORS.border}` }}>
                  <div style={{ fontSize: 12, color: COLORS.accent, fontWeight: 600, marginBottom: 6 }}>{h || `Colonne ${i + 1}`}</div>
                  <select value={mapping[i] || ""} onChange={e => { const m = { ...mapping }; if (e.target.value) { Object.keys(m).forEach(k => { if (m[k] === e.target.value) delete m[k]; }); m[i] = e.target.value; } else delete m[i]; setMapping(m); }}
                    style={{ width: "100%", background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "6px 10px", color: COLORS.text, fontSize: 13, fontFamily: "inherit", outline: "none" }}>
                    <option value="">— Ignorer —</option>
                    {allFields.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                  <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 4 }}>Ex: {rawRows[0]?.[i]?.toString().slice(0, 30) || "—"}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 22, justifyContent: "flex-end" }}>
              <Btn variant="secondary" onClick={() => setStep("upload")}>← Retour</Btn>
              <Btn onClick={buildPreview}>Aperçu →</Btn>
            </div>
          </div>
        )}
        {step === "preview" && !showWarnings && (
          <div>
            <p style={{ color: COLORS.textSub, fontSize: 13, margin: "0 0 16px" }}>Aperçu des 5 premières lignes sur {rawRows.length}.</p>
            <div style={{ overflowX: "auto", borderRadius: 10, border: `1px solid ${COLORS.border}` }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead><tr style={{ background: COLORS.bg }}>{Object.values(mapping).filter(Boolean).map(f => <th key={f} style={{ padding: "10px 14px", color: COLORS.textSub, fontWeight: 700, textAlign: "left", borderBottom: `1px solid ${COLORS.border}` }}>{f.toUpperCase()}</th>)}</tr></thead>
                <tbody>{preview.map((row, i) => <tr key={i} style={{ borderBottom: `1px solid ${COLORS.border}` }}>{Object.values(mapping).filter(Boolean).map(f => <td key={f} style={{ padding: "9px 14px", color: COLORS.text, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row[f] || <span style={{ color: COLORS.textMuted }}>—</span>}</td>)}</tr>)}</tbody>
              </table>
            </div>
            <div style={{ marginTop: 16, padding: "10px 14px", background: `${COLORS.green}12`, border: `1px solid ${COLORS.green}30`, borderRadius: 8, fontSize: 13, color: COLORS.green }}>
              ✓ {rawRows.filter(r => r[Object.keys(mapping).find(k => mapping[k] === "name")]?.toString()).length} entrées valides
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 22, justifyContent: "flex-end" }}>
              <Btn variant="secondary" onClick={() => setStep("mapping")}>← Modifier</Btn>
              <Btn onClick={doImport} style={{ background: COLORS.green }}>{importing ? "Import..." : `✓ Importer ${rawRows.length} lignes`}</Btn>
            </div>
          </div>
        )}

        {showWarnings && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, padding: "14px 18px", background: `${COLORS.gold}12`, border: `1px solid ${COLORS.gold}40`, borderRadius: 12 }}>
              <span style={{ fontSize: 24, flexShrink: 0 }}>⚠️</span>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.gold }}>Import réussi avec des avertissements</div>
                <div style={{ fontSize: 13, color: COLORS.textSub, marginTop: 3 }}>
                  {rawRows.length} entrées importées. Certaines valeurs ne sont pas reconnues dans l'Admin Panel.
                </div>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
              {warnings.map(w => (
                <div key={w.field} style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "12px 16px" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.textSub, letterSpacing: 0.5, marginBottom: 8 }}>
                    {w.field.toUpperCase()}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {w.values.map(v => (
                      <span key={v} style={{ background: `${COLORS.gold}15`, color: COLORS.gold, border: `1px solid ${COLORS.gold}40`, borderRadius: 6, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>
                        {v}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ padding: "12px 16px", background: `${COLORS.accent}10`, border: `1px solid ${COLORS.accent}30`, borderRadius: 10, fontSize: 13, color: COLORS.textSub, lineHeight: 1.7 }}>
              💡 Ces valeurs ont quand même été importées mais s'afficheront sans couleur ni badge.
              Rendez-vous dans <strong style={{ color: COLORS.accent }}>Admin Panel → Bloc CRM</strong> pour les ajouter aux listes prédéfinies.
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
  const [activeTab, setActiveTab] = useState("info");
  const TABS = [
    { id: "info", label: "INFO", icon: "ℹ" },
    { id: "finance", label: "FINANCE", icon: "💰" },
    { id: "activity", label: "ACTIVITY", icon: "📊" },
    { id: "risk", label: "RISK", icon: "⚠" },
    { id: "compliance", label: "COMPLIANCE", icon: "🛡" },
    { id: "documents", label: "DOCUMENTS", icon: "📄" },
    { id: "contacts", label: "CONTACTS", icon: "◉" },
  ];

  return (
    <div style={{ width: 360, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, display: "flex", flexDirection: "column", flexShrink: 0, overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "20px 20px 0", borderBottom: `1px solid ${COLORS.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <CountryFlag country={sel.country} size={44} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.text, fontFamily: "'Playfair Display', serif", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sel.name}</div>
            <div style={{ fontSize: 12, color: COLORS.textSub, marginTop: 2 }}>{sel.website || "—"}</div>
          </div>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            <button onClick={onEdit} title="Modifier" style={{ background: `${COLORS.accent}20`, border: `1px solid ${COLORS.accent}40`, color: COLORS.accent, borderRadius: 7, padding: "5px 10px", cursor: "pointer", fontSize: 13 }}>✏️</button>
            <button onClick={onDelete} title="Supprimer" style={{ background: `${COLORS.red}15`, border: `1px solid ${COLORS.red}30`, color: COLORS.red, borderRadius: 7, padding: "5px 10px", cursor: "pointer", fontSize: 13 }}>🗑</button>
          </div>
        </div>
        {/* Tabs */}
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
            {sel.ref && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, background: `${COLORS.accent}10`, border: `1px solid ${COLORS.accent}25`, borderRadius: 8, padding: "7px 12px", marginBottom: 14 }}>
                <span style={{ fontSize: 11, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5 }}>ID</span>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 700, color: COLORS.accent, letterSpacing: 1 }}>{sel.ref}</span>
              </div>
            )}
            {[
              { label: "Company Name", value: sel.name },
              { label: "Legal Name", value: sel.legalName },
              { label: "Group", value: sel.group },
              { label: "Tax Info", value: sel.taxInfo },
              { label: "Address", value: sel.address },
              { label: "City", value: sel.city },
              { label: "Country", value: sel.country },
            ].filter(r => r.value).map(row => (
              <div key={row.label} style={{ borderBottom: `1px solid ${COLORS.border}`, padding: "9px 0", display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontSize: 12, color: COLORS.textSub, flexShrink: 0 }}>{row.label}</span>
                <span style={{ fontSize: 12, color: COLORS.text, textAlign: "right" }}>{row.value}</span>
              </div>
            ))}
            {/* Activity Status */}
            <div style={{ borderBottom: `1px solid ${COLORS.border}`, padding: "9px 0", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, color: COLORS.textSub, flexShrink: 0 }}>Activity Status</span>
              <Badge label={getStatusCfg(sel.status).label} color={getStatusCfg(sel.status).color} />
            </div>
            {/* Broker */}
            {sel.broker && (
              <div style={{ borderBottom: `1px solid ${COLORS.border}`, padding: "9px 0", display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontSize: 12, color: COLORS.textSub, flexShrink: 0 }}>Broker</span>
                <span style={{ fontSize: 12, color: COLORS.text, textAlign: "right" }}>{sel.broker}</span>
              </div>
            )}
            {/* Business Unit */}
            {sel.businessUnit && (
              <div style={{ borderBottom: `1px solid ${COLORS.border}`, padding: "9px 0", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, color: COLORS.textSub, flexShrink: 0 }}>Business Unit</span>
                <Badge label={getBUCfg(sel.businessUnit).label} color={getBUCfg(sel.businessUnit).color} />
              </div>
            )}
            {sel.tags && sel.tags.length > 0 && (
              <div style={{ marginTop: 14, display: "flex", gap: 6, flexWrap: "wrap" }}>{sel.tags.map(t => <Tag key={t} label={t} />)}</div>
            )}
            {sel.additionalInfos && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 11, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5, marginBottom: 6 }}>ADDITIONAL INFOS</div>
                <div style={{ padding: 12, background: COLORS.bg, borderRadius: 8, fontSize: 13, color: COLORS.textSub, lineHeight: 1.6 }}>{sel.additionalInfos}</div>
              </div>
            )}
            {sel.notes && (
              <div style={{ marginTop: 14, padding: 12, background: COLORS.bg, borderRadius: 8, fontSize: 13, color: COLORS.textSub, lineHeight: 1.6 }}>{sel.notes}</div>
            )}
          </div>
        )}

        {/* ── FINANCE ── */}
        {activeTab === "finance" && (
          <div style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <span style={{ fontSize: 15 }}>💰</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.text, letterSpacing: 0.5 }}>FINANCE</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
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
                  <span style={{ fontSize: 13, color: row.value ? COLORS.text : COLORS.textMuted, fontFamily: row.label !== "Incorporation Date" && row.value ? "'DM Mono', monospace" : "inherit" }}>{row.value || "—"}</span>
                </div>
              ))}
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
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
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
                  <span style={{ fontSize: 13, color: row.value ? COLORS.text : COLORS.textMuted, fontFamily: "'DM Mono', monospace" }}>{row.value || "—"}</span>
                </div>
              ))}
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
              {sel.watchList
                ? <Badge label="⚠ Yes" color={COLORS.red} />
                : <Badge label="No" color={COLORS.textSub} />
              }
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
                  {sel.complianceStatus
                    ? <Badge label={getComplianceCfg(sel.complianceStatus).label} color={getComplianceCfg(sel.complianceStatus).color} />
                    : <span style={{ fontSize: 12, color: COLORS.textMuted }}>—</span>}
                </div>
                <div>
                  <div style={{ fontSize: 10, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5, marginBottom: 6 }}>FINAL AUTHORIZATION STATUS</div>
                  {sel.finalAuthStatus
                    ? <Badge label={getFinalAuthCfg(sel.finalAuthStatus).label} color={getFinalAuthCfg(sel.finalAuthStatus).color} />
                    : <span style={{ fontSize: 12, color: COLORS.textMuted }}>—</span>}
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                {[
                  { label: "Creation Date", value: sel.complianceCreationDate },
                  { label: "Last Update Date", value: sel.complianceLastUpdateDate },
                  { label: "Request Date", value: sel.complianceRequestDate },
                  { label: "Last Reception Date", value: sel.complianceLastReceptionDate },
                  { label: "Final Confirmation Date", value: sel.complianceFinalConfirmationDate },
                ].map(row => (
                  <div key={row.label} style={{ display: "flex", justifyContent: "space-between", borderBottom: `1px solid ${COLORS.border}`, paddingBottom: 7 }}>
                    <span style={{ fontSize: 11, color: COLORS.textSub }}>{row.label}</span>
                    <span style={{ fontSize: 11, color: row.value ? COLORS.text : COLORS.textMuted, fontFamily: "'DM Mono', monospace" }}>{row.value || "—"}</span>
                  </div>
                ))}
              </div>

              {sel.complianceAdditionalInfos && (
                <div>
                  <div style={{ fontSize: 10, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5, marginBottom: 6 }}>ADDITIONAL INFOS (COMPLIANCE)</div>
                  <div style={{ padding: 10, background: COLORS.card, borderRadius: 8, fontSize: 12, color: COLORS.textSub, lineHeight: 1.6 }}>{sel.complianceAdditionalInfos}</div>
                </div>
              )}
            </div>

            {/* Key People block */}
            <div style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <span style={{ fontSize: 15 }}>👤</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.text, letterSpacing: 0.5 }}>KEY PEOPLE</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {[
                  { label: "President", ids: sel.president ? [sel.president] : [] },
                  { label: "CEO", ids: sel.ceo ? [sel.ceo] : [] },
                  { label: "CFO", ids: sel.cfo ? [sel.cfo] : [] },
                  { label: "Shareholders", ids: sel.shareholders || [] },
                  { label: "UBO", ids: sel.ubo || [] },
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
                                  <div style={{ display: "flex", gap: 4, marginTop: 3, flexWrap: "wrap" }}>
                                    {(p.mentions || []).includes("main_contact") && <Badge label="Main Contact" color={COLORS.green} />}
                                    {(p.mentions || []).includes("authorized_signatory") && <Badge label="Authorized Signatory" color={COLORS.gold} />}
                                  </div>
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

            {!sel.complianceStatus && !sel.finalAuthStatus && !sel.complianceAdditionalInfos && !sel.complianceRequestDate && !sel.complianceLastReceptionDate && !sel.complianceFinalConfirmationDate && !sel.president && !sel.ceo && !sel.cfo && !(sel.shareholders?.length) && !(sel.ubo?.length) && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 120, gap: 12 }}>
                <div style={{ fontSize: 40 }}>🛡</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.text }}>No compliance information</div>
                <div style={{ fontSize: 13, color: COLORS.textMuted, textAlign: "center", lineHeight: 1.6 }}>Fill in the compliance fields from the edit form.</div>
              </div>
            )}
          </div>
        )}

        {/* ── DOCUMENTS ── */}
        {activeTab === "documents" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 200, gap: 12 }}>
            <div style={{ fontSize: 40 }}>📄</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.text }}>Bloc DOCUMENTS</div>
            <div style={{ fontSize: 13, color: COLORS.textMuted, textAlign: "center", lineHeight: 1.6 }}>
              Les documents liés à cette société<br />seront disponibles prochainement.
            </div>
          </div>
        )}

        {/* ── CONTACTS ── */}
        {activeTab === "contacts" && (
          <div>
            <div style={{ fontSize: 11, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5, marginBottom: 14 }}>
              {selContacts.length} CONTACT{selContacts.length > 1 ? "S" : ""} LIÉ{selContacts.length > 1 ? "S" : ""}
            </div>
            {selContacts.length === 0 && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "30px 0", color: COLORS.textMuted, fontSize: 13 }}>
                <span style={{ fontSize: 32 }}>◉</span>
                Aucun contact associé à cette société
              </div>
            )}
            {selContacts.map(c => (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: `1px solid ${COLORS.border}` }}>
                <Avatar initials={c.avatar} size={34} color={getStatusCfg(c.status).color} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: COLORS.text, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</div>
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
const Companies = ({ companies, setCompanies, contacts }) => {
  const { config } = useConfig();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editCompany, setEditCompany] = useState(null);

  const makeEmptyForm = () => ({
    name: "", size: "11-50", status: config.activityStatus[0]?.value || "",
    website: "", phone: "", address: "", country: "", city: "", revenue: 0,
    tags: "", notes: "", group: "",
    companyType: config.companyType[0]?.value || "",
    roles: [],
    complianceStatus: config.complianceStatus[0]?.value || "",
    finalAuthStatus: config.finalAuthStatus[0]?.value || "",
    businessUnit: "", broker: "",
    taxInfo: "", legalName: "", additionalInfos: "", complianceAdditionalInfos: "",
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
    return ms && (filterStatus === "all" || c.status === filterStatus);
  });

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
    if (editCompany) setCompanies(companies.map(c => c.id === editCompany.id ? { ...c, ...data } : c));
    else setCompanies([...companies, { ...data, id: Date.now(), ref: generateCompanyRef() }]);
    setShowForm(false); setSelected(null);
  };

  const del = (id) => { setCompanies(companies.filter(c => c.id !== id)); setSelected(null); };
  const sel = selected ? companies.find(c => c.id === selected) : null;
  const selContacts = sel ? contacts.filter(c => c.companyId === sel.id) : [];

  const getStatusCfg = (v) => config.activityStatus.find(s => s.value === v) || { label: v || "—", color: COLORS.textSub };
  const getComplianceCfg = (v) => config.complianceStatus.find(s => s.value === v) || { label: v || "—", color: COLORS.textSub };
  const getFinalAuthCfg = (v) => config.finalAuthStatus.find(s => s.value === v) || { label: v || "—", color: COLORS.textSub };
  const getBUCfg = (v) => config.businessUnit.find(s => s.value === v) || { label: v || "—", color: COLORS.accent };
  const getRoleCfg = (v) => config.roles.find(r => r.value === v) || { color: COLORS.accent };
  const getTypeCfg = (v) => config.companyType.find(s => s.value === v) || { label: v || "—", color: COLORS.blue };

  return (
    <div style={{ display: "flex", gap: 20, height: "calc(100vh - 200px)" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
          <input placeholder="Rechercher une société..." value={search} onChange={e => setSearch(e.target.value)}
            style={{ flex: 1, minWidth: 160, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "10px 16px", color: COLORS.text, fontSize: 14, outline: "none", fontFamily: "inherit" }} />
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "10px 12px", color: COLORS.text, fontSize: 13, fontFamily: "inherit", outline: "none" }}>
            <option value="all">All Activity Status</option>
            {config.activityStatus.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <Btn onClick={() => setShowImport(true)} variant="secondary">⬆ Import Excel</Btn>
          <Btn onClick={openNew}>+ Nouvelle société</Btn>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 1.2fr 1.5fr 1.5fr 1.2fr 1fr", gap: 10, padding: "8px 18px", marginBottom: 6 }}>
          {["Company", "Broker", "Role", "Compliance Status", "Final Auth. Status", "Website", "Business Unit"].map(h => (
            <div key={h} style={{ fontSize: 10, color: COLORS.textMuted, fontWeight: 600, letterSpacing: 0.5 }}>{h.toUpperCase()}</div>
          ))}
        </div>

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
                    {[c.city, c.country].filter(Boolean).join(", ") || "—"}
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 12, color: c.broker ? COLORS.text : COLORS.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.broker || "—"}</div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {(c.roles || []).slice(0, 2).map(r => <Badge key={r} label={r} color={getRoleCfg(r).color} />)}
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
              <div>{c.businessUnit ? <Badge label={getBUCfg(c.businessUnit).label} color={getBUCfg(c.businessUnit).color} /> : <span style={{ fontSize: 12, color: COLORS.textMuted }}>—</span>}</div>
            </div>
          ))}
          {filtered.length === 0 && <div style={{ textAlign: "center", color: COLORS.textMuted, padding: 48 }}>Aucune société trouvée</div>}
        </div>
      </div>

      {sel && <CompanyDetailPanel
        sel={sel}
        selContacts={selContacts}
        onEdit={() => openEdit(sel)}
        onDelete={() => del(sel.id)}
        getStatusCfg={getStatusCfg}
        getComplianceCfg={getComplianceCfg}
        getFinalAuthCfg={getFinalAuthCfg}
        getBUCfg={getBUCfg}
        getRoleCfg={getRoleCfg}
        getTypeCfg={getTypeCfg}
      />}

      {showForm && (
        <Modal title={editCompany ? "Modifier la société" : "Nouvelle société"} onClose={() => setShowForm(false)} wide>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div style={{ gridColumn: "1 / -1" }}><Input label="Company Name" value={form.name} onChange={v => setForm({ ...form, name: v })} placeholder="ACME Corp" /></div>
            <Input label="Legal Name" value={form.legalName || ""} onChange={v => setForm({ ...form, legalName: v })} placeholder="Raison sociale officielle" />
            <Input label="Tax Info" value={form.taxInfo || ""} onChange={v => setForm({ ...form, taxInfo: v })} placeholder="N° TVA, SIRET…" />
            <Input label="Website" value={form.website} onChange={v => setForm({ ...form, website: v })} placeholder="acme.fr" />
            <SelectField label="Activity Status" value={form.status} onChange={v => setForm({ ...form, status: v })} options={config.activityStatus.map(s => ({ value: s.value, label: s.label }))} />
            <SelectField label="Company Size" value={form.companySize || ""} onChange={v => setForm({ ...form, companySize: v })} options={[{ value: "", label: "— Select —" }, { value: "Big", label: "Big" }, { value: "Medium", label: "Medium" }, { value: "Small", label: "Small" }]} />
            <SelectField label="Company Type" value={form.companyType} onChange={v => setForm({ ...form, companyType: v })} options={config.companyType.map(s => ({ value: s.value, label: s.label }))} />
            <Input label="Group" value={form.group} onChange={v => setForm({ ...form, group: v })} placeholder="Ex: ACME Holding" />
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 12, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5 }}>COUNTRY</label>
              <select value={form.country} onChange={e => setForm({ ...form, country: e.target.value })}
                style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "10px 14px", color: COLORS.text, fontSize: 14, outline: "none", fontFamily: "inherit" }}>
                <option value="">— Sélectionner —</option>
                {config.country.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <Input label="Address" value={form.address || ""} onChange={v => setForm({ ...form, address: v })} placeholder="Ex: 12 rue de la Paix" />
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 12, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5 }}>CITY</label>
              <select value={form.city} onChange={e => setForm({ ...form, city: e.target.value })}
                style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "10px 14px", color: COLORS.text, fontSize: 14, outline: "none", fontFamily: "inherit" }}>
                <option value="">— Sélectionner —</option>
                {config.city.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <Input label="Broker" value={form.broker} onChange={v => setForm({ ...form, broker: v })} placeholder="Ex: BNP Paribas" />
            <SelectField label="Business Unit" value={form.businessUnit} onChange={v => setForm({ ...form, businessUnit: v })} options={[{ value: "", label: "— None —" }, ...config.businessUnit.map(s => ({ value: s.value, label: s.label }))]} />
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
              <textarea value={form.complianceAdditionalInfos || ""} onChange={e => setForm({ ...form, complianceAdditionalInfos: e.target.value })} rows={2} style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "10px 14px", color: COLORS.text, fontSize: 14, resize: "vertical", fontFamily: "inherit", outline: "none", width: "100%", boxSizing: "border-box" }} />
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
            {[
              { label: "President", key: "president" },
              { label: "CEO", key: "ceo" },
              { label: "CFO", key: "cfo" },
            ].map(({ label, key }) => (
              <div key={key} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 12, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5 }}>{label}</label>
                <select value={form[key] || ""} onChange={e => setForm({ ...form, [key]: e.target.value })}
                  style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "10px 14px", color: COLORS.text, fontSize: 14, outline: "none", fontFamily: "inherit" }}>
                  <option value="">— None —</option>
                  {(editCompany ? contacts.filter(c => c.companyId === editCompany.id) : []).map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            ))}
            {[
              { label: "Shareholders", key: "shareholders" },
              { label: "UBO", key: "ubo" },
            ].map(({ label, key }) => (
              <div key={key} style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 8 }}>
                <label style={{ fontSize: 12, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5 }}>{label.toUpperCase()} — multiple selection</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {(editCompany ? contacts.filter(c => c.companyId === editCompany.id) : []).length === 0
                    ? <span style={{ fontSize: 12, color: COLORS.textMuted }}>No contacts linked to this company yet.</span>
                    : (editCompany ? contacts.filter(c => c.companyId === editCompany.id) : []).map(c => {
                        const selected = (form[key] || []).includes(c.id);
                        return (
                          <div key={c.id} onClick={() => {
                            const cur = form[key] || [];
                            setForm({ ...form, [key]: selected ? cur.filter(id => id !== c.id) : [...cur, c.id] });
                          }} style={{ padding: "6px 14px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, background: selected ? `${COLORS.blue}25` : COLORS.bg, border: `1.5px solid ${selected ? COLORS.blue : COLORS.border}`, color: selected ? COLORS.blue : COLORS.textSub, transition: "all 0.15s", userSelect: "none" }}>
                            {selected && <span style={{ marginRight: 5, fontSize: 11 }}>✓</span>}
                            {c.name}
                          </div>
                        );
                      })
                  }
                </div>
              </div>
            ))}
            <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 8 }}>
              <label style={{ fontSize: 12, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5 }}>RÔLE(S) — sélection multiple</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {config.roles.map(r => {
                  const isSelected = (form.roles || []).includes(r.value);
                  return (
                    <div key={r.value} onClick={() => toggleRole(r.value)} style={{ padding: "6px 14px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, background: isSelected ? `${r.color}25` : COLORS.bg, border: `1.5px solid ${isSelected ? r.color : COLORS.border}`, color: isSelected ? r.color : COLORS.textSub, transition: "all 0.15s", userSelect: "none" }}>
                      {isSelected && <span style={{ marginRight: 5, fontSize: 11 }}>✓</span>}
                      {r.label}
                    </div>
                  );
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
              <label style={{ fontSize: 12, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5 }}>CONTRACTS CURRENCY — multiple selection</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {["USD", "EUR", "GBP", "MAD", "UAH", "AED", "CHF", "JPY", "CAD"].map(cur => {
                  const isSelected = (form.contractsCurrency || []).includes(cur);
                  return (
                    <div key={cur} onClick={() => {
                      const curr = form.contractsCurrency || [];
                      setForm({ ...form, contractsCurrency: isSelected ? curr.filter(c => c !== cur) : [...curr, cur] });
                    }} style={{ padding: "6px 14px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, background: isSelected ? `${COLORS.accent}25` : COLORS.bg, border: `1.5px solid ${isSelected ? COLORS.accent : COLORS.border}`, color: isSelected ? COLORS.accent : COLORS.textSub, transition: "all 0.15s", userSelect: "none" }}>
                      {isSelected && <span style={{ marginRight: 5, fontSize: 11 }}>✓</span>}
                      {cur}
                    </div>
                  );
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
      {showImport && <ExcelImportModal type="companies" onClose={() => setShowImport(false)} onImport={(items) => setCompanies(prev => { const ex = new Set(prev.map(c => c.name?.toLowerCase())); return [...prev, ...items.filter(i => !ex.has(i.name?.toLowerCase()))]; })} />}
    </div>
  );
};

// ─── CONTACTS ─────────────────────────────────────────────────
const Contacts = ({ contacts, setContacts, companies }) => {
  const { config } = useConfig();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editContact, setEditContact] = useState(null);

  const makeEmptyForm = () => ({ name: "", companyId: "", email: "", phone: "", status: config.activityStatus[0]?.value || "", priority: "moyenne", role: "", tags: "", notes: "", revenue: 0, mentions: [] });
  const [form, setForm] = useState(makeEmptyForm());

  const filtered = contacts.filter(c => {
    const company = companies.find(co => co.id === c.companyId);
    const ms = c.name?.toLowerCase().includes(search.toLowerCase()) || company?.name?.toLowerCase().includes(search.toLowerCase()) || c.email?.toLowerCase().includes(search.toLowerCase());
    return ms && (filter === "all" || c.status === filter);
  });

  const openEdit = (c) => { setForm({ ...c, tags: (c.tags || []).join(", ") }); setEditContact(c); setShowForm(true); };
  const openNew = () => { setForm(makeEmptyForm()); setEditContact(null); setShowForm(true); };

  const save = () => {
    const data = { ...form, companyId: form.companyId ? Number(form.companyId) : null, tags: form.tags.split(",").map(t => t.trim()).filter(Boolean), avatar: form.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase(), revenue: Number(form.revenue) || 0, lastContact: editContact?.lastContact || new Date().toISOString().split("T")[0] };
    if (editContact) setContacts(contacts.map(c => c.id === editContact.id ? { ...c, ...data } : c));
    else setContacts([...contacts, { ...data, id: Date.now() }]);
    setShowForm(false); setSelected(null);
  };

  const del = (id) => { setContacts(contacts.filter(c => c.id !== id)); setSelected(null); };
  const sel = selected ? contacts.find(c => c.id === selected) : null;
  const selCompany = sel ? companies.find(co => co.id === sel.companyId) : null;
  const getStatusCfg = (v) => config.activityStatus.find(s => s.value === v) || { label: v || "—", color: COLORS.textSub };

  return (
    <div style={{ display: "flex", gap: 20, height: "calc(100vh - 200px)" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
          <input placeholder="Rechercher un contact..." value={search} onChange={e => setSearch(e.target.value)}
            style={{ flex: 1, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "10px 16px", color: COLORS.text, fontSize: 14, outline: "none", fontFamily: "inherit" }} />
          <select value={filter} onChange={e => setFilter(e.target.value)}
            style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "10px 14px", color: COLORS.text, fontSize: 13, fontFamily: "inherit", outline: "none" }}>
            <option value="all">All Activity Status</option>
            {config.activityStatus.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <Btn onClick={() => setShowImport(true)} variant="secondary">⬆ Import Excel</Btn>
          <Btn onClick={openNew}>+ Nouveau contact</Btn>
        </div>
        <div style={{ overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map(c => {
            const company = companies.find(co => co.id === c.companyId);
            const sc = getStatusCfg(c.status);
            return (
              <div key={c.id} onClick={() => setSelected(c.id === selected ? null : c.id)} style={{ background: selected === c.id ? `${COLORS.accent}15` : COLORS.card, border: `1px solid ${selected === c.id ? COLORS.accent : COLORS.border}`, borderRadius: 12, padding: "14px 18px", cursor: "pointer", display: "flex", alignItems: "center", gap: 14, transition: "all 0.15s" }}>
                <Avatar initials={c.avatar} size={40} color={sc.color} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: COLORS.text, fontSize: 15 }}>{c.name}</div>
                  <div style={{ color: COLORS.textSub, fontSize: 13 }}>{c.role && <span>{c.role} · </span>}{company ? <span style={{ color: COLORS.blue }}>{company.name}</span> : <span>{c.email}</span>}</div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                  <Badge label={sc.label} color={sc.color} />
                  <Badge label={PRIORITY_CONFIG[c.priority]?.label} color={PRIORITY_CONFIG[c.priority]?.color} />
                  {(c.mentions || []).includes("main_contact") && <Badge label="Main Contact" color={COLORS.green} />}
                  {(c.mentions || []).includes("authorized_signatory") && <Badge label="Authorized Signatory" color={COLORS.gold} />}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && <div style={{ textAlign: "center", color: COLORS.textMuted, padding: 48 }}>Aucun contact trouvé</div>}
        </div>
      </div>

      {sel && (
        <div style={{ width: 320, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 24, overflowY: "auto", flexShrink: 0 }}>
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <Avatar initials={sel.avatar} size={64} color={getStatusCfg(sel.status).color} />
            <h2 style={{ margin: "12px 0 4px", color: COLORS.text, fontSize: 18, fontFamily: "'Playfair Display', serif" }}>{sel.name}</h2>
            <p style={{ margin: 0, color: COLORS.textSub, fontSize: 13 }}>{sel.role || "—"}</p>
          </div>
          {selCompany && (
            <div style={{ background: `${COLORS.purple}15`, border: `1px solid ${COLORS.purple}30`, borderRadius: 10, padding: "10px 14px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
              <Avatar initials={selCompany.avatar} size={28} color={COLORS.accent} square />
              <div><div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text }}>{selCompany.name}</div><div style={{ fontSize: 11, color: COLORS.textSub }}>{selCompany.website || "—"}</div></div>
            </div>
          )}
          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 20, flexWrap: "wrap" }}>
            <Badge label={getStatusCfg(sel.status).label} color={getStatusCfg(sel.status).color} />
            <Badge label={PRIORITY_CONFIG[sel.priority]?.label} color={PRIORITY_CONFIG[sel.priority]?.color} />
            {(sel.mentions || []).includes("main_contact") && <Badge label="Main Contact" color={COLORS.green} />}
            {(sel.mentions || []).includes("authorized_signatory") && <Badge label="Authorized Signatory" color={COLORS.gold} />}
          </div>
          {[{ label: "Email", value: sel.email }, { label: "Phone Number", value: sel.phone }, { label: "Dernier contact", value: sel.lastContact }, { label: "Revenus", value: sel.revenue ? `${sel.revenue.toLocaleString("fr")} €` : "—" }].map(row => (
            <div key={row.label} style={{ borderBottom: `1px solid ${COLORS.border}`, padding: "10px 0", display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, color: COLORS.textSub }}>{row.label}</span>
              <span style={{ fontSize: 13, color: COLORS.text }}>{row.value || "—"}</span>
            </div>
          ))}
          <div style={{ marginTop: 14 }}><div style={{ fontSize: 11, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5, marginBottom: 6 }}>ACTIVITY STATUS</div><Badge label={getStatusCfg(sel.status).label} color={getStatusCfg(sel.status).color} /></div>
          {sel.tags && sel.tags.length > 0 && <div style={{ marginTop: 14, display: "flex", gap: 6, flexWrap: "wrap" }}>{sel.tags.map(t => <Tag key={t} label={t} />)}</div>}
          {sel.notes && <div style={{ marginTop: 14, padding: 12, background: COLORS.bg, borderRadius: 8, fontSize: 13, color: COLORS.textSub, lineHeight: 1.6 }}>{sel.notes}</div>}
          <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
            <Btn onClick={() => openEdit(sel)} style={{ flex: 1 }}>Modifier</Btn>
            <Btn onClick={() => del(sel.id)} variant="danger">Suppr.</Btn>
          </div>
        </div>
      )}

      {showForm && (
        <Modal title={editContact ? "Modifier le contact" : "Nouveau contact"} onClose={() => setShowForm(false)}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Input label="Nom complet" value={form.name} onChange={v => setForm({ ...form, name: v })} placeholder="Jean Dupont" />
            <Input label="Poste / Rôle" value={form.role} onChange={v => setForm({ ...form, role: v })} placeholder="Directeur Commercial" />
            <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 12, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5 }}>SOCIÉTÉ</label>
              <select value={form.companyId} onChange={e => setForm({ ...form, companyId: e.target.value })} style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "10px 14px", color: COLORS.text, fontSize: 14, fontFamily: "inherit", outline: "none" }}>
                <option value="">— Aucune société —</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <Input label="Email" type="email" value={form.email} onChange={v => setForm({ ...form, email: v })} placeholder="jean@acme.fr" />
            <Input label="Phone Number" value={form.phone} onChange={v => setForm({ ...form, phone: v })} placeholder="06 12 34 56 78" />
            <SelectField label="Activity Status" value={form.status} onChange={v => setForm({ ...form, status: v })} options={config.activityStatus.map(s => ({ value: s.value, label: s.label }))} />
            <SelectField label="Priorité" value={form.priority} onChange={v => setForm({ ...form, priority: v })} options={Object.entries(PRIORITY_CONFIG).map(([k, v]) => ({ value: k, label: v.label }))} />
            <Input label="Revenus (€)" type="number" value={form.revenue} onChange={v => setForm({ ...form, revenue: v })} placeholder="0" />
            <Input label="Tags (séparés par virgule)" value={form.tags} onChange={v => setForm({ ...form, tags: v })} placeholder="SaaS, B2B" />
            <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 8 }}>
              <label style={{ fontSize: 12, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5 }}>MENTIONS</label>
              <div style={{ display: "flex", gap: 10 }}>
                {[
                  { value: "main_contact", label: "Main Contact", color: COLORS.green },
                  { value: "authorized_signatory", label: "Authorized Signatory", color: COLORS.gold },
                ].map(m => {
                  const isSelected = (form.mentions || []).includes(m.value);
                  return (
                    <div key={m.value} onClick={() => {
                      const cur = form.mentions || [];
                      setForm({ ...form, mentions: isSelected ? cur.filter(v => v !== m.value) : [...cur, m.value] });
                    }} style={{ padding: "7px 16px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, background: isSelected ? `${m.color}25` : COLORS.bg, border: `1.5px solid ${isSelected ? m.color : COLORS.border}`, color: isSelected ? m.color : COLORS.textSub, transition: "all 0.15s", userSelect: "none" }}>
                      {isSelected && <span style={{ marginRight: 5, fontSize: 11 }}>✓</span>}
                      {m.label}
                    </div>
                  );
                })}
              </div>
            </div>
            <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 12, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5 }}>NOTES</label>
              <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3} style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "10px 14px", color: COLORS.text, fontSize: 14, resize: "vertical", fontFamily: "inherit", outline: "none", width: "100%", boxSizing: "border-box" }} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 22, justifyContent: "flex-end" }}>
            <Btn variant="secondary" onClick={() => setShowForm(false)}>Annuler</Btn>
            <Btn onClick={save}>Enregistrer</Btn>
          </div>
        </Modal>
      )}
      {showImport && <ExcelImportModal type="contacts" onClose={() => setShowImport(false)} onImport={(items) => setContacts(prev => { const ex = new Set(prev.map(c => c.email?.toLowerCase()).filter(Boolean)); return [...prev, ...items.filter(i => !i.email || !ex.has(i.email?.toLowerCase()))]; })} />}
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
          <h1 style={{ margin: 0, fontSize: 24, color: COLORS.text, fontFamily: "'Playfair Display', serif" }}>Tâches</h1>
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
    const data = {
      ...form,
      tags: form.tags.split(",").map(t => t.trim()).filter(Boolean),
      avatar: form.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase(),
      revenue: Number(form.revenue) || 0,
      roles: form.roles || [],
    };
    setCompanies(companies.map(c => c.id === editCompany.id ? { ...c, ...data } : c));
    setEditCompany(null);
  };

  const toggleRole = (role) => {
    const cur = form.roles || [];
    setForm({ ...form, roles: cur.includes(role) ? cur.filter(r => r !== role) : [...cur, role] });
  };

  const complianceKpis = config.complianceStatus.map(s => ({
    key: `compliance_${s.value}`,
    field: "complianceStatus",
    value: s.value,
    label: s.label,
    color: s.color,
    group: "Compliance Status",
    companies: companies.filter(c => c.complianceStatus === s.value),
  }));

  const finalAuthKpis = config.finalAuthStatus.map(s => ({
    key: `finalauth_${s.value}`,
    field: "finalAuthStatus",
    value: s.value,
    label: s.label,
    color: s.color,
    group: "Final Authorization Status",
    companies: companies.filter(c => c.finalAuthStatus === s.value),
  }));

  const allGroups = [
    { title: "Compliance Status", icon: "🛡", kpis: complianceKpis },
    { title: "Final Authorization Status", icon: "✅", kpis: finalAuthKpis },
  ];

  const getComplianceCfg = (v) => config.complianceStatus.find(s => s.value === v) || { label: v || "—", color: COLORS.textSub };
  const getFinalAuthCfg = (v) => config.finalAuthStatus.find(s => s.value === v) || { label: v || "—", color: COLORS.textSub };
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
            <div style={{ fontSize: 12, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {kpi.label}
            </div>
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
              <div style={{ padding: "16px 20px", fontSize: 13, color: COLORS.textMuted, textAlign: "center" }}>
                Aucune société avec ce statut
              </div>
            ) : (
              <div>
                <div style={{ padding: "10px 20px", background: `${kpi.color}08`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: kpi.color, fontWeight: 700, letterSpacing: 0.5 }}>
                    {kpi.companies.length} SOCIÉTÉ{kpi.companies.length > 1 ? "S" : ""}
                  </span>
                  <button onClick={toggle} style={{ background: "none", border: "none", color: COLORS.textMuted, cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>
                    Masquer ▲
                  </button>
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
                          title="Modifier la société"
                          style={{ background: `${COLORS.accent}20`, border: `1px solid ${COLORS.accent}40`, color: COLORS.accent, borderRadius: 6, padding: "2px 8px", fontSize: 11, cursor: "pointer", flexShrink: 0, fontFamily: "inherit", fontWeight: 600 }}
                          onMouseOver={e => e.currentTarget.style.background = `${COLORS.accent}40`}
                          onMouseOut={e => e.currentTarget.style.background = `${COLORS.accent}20`}
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
        <h1 style={{ margin: 0, fontSize: 28, color: COLORS.text, fontFamily: "'Playfair Display', serif" }}>
          Companies — Dashboard
        </h1>
        <p style={{ margin: "6px 0 0", color: COLORS.textSub, fontSize: 14 }}>
          {companies.length} société{companies.length > 1 ? "s" : ""} au total — cliquez sur un KPI pour afficher la liste
        </p>
      </div>

      <div style={{ background: `${COLORS.accent}15`, border: `1px solid ${COLORS.accent}40`, borderRadius: 14, padding: "18px 24px", marginBottom: 32, display: "flex", alignItems: "center", gap: 16 }}>
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
            <Input label="Website" value={form.website || ""} onChange={v => setForm({ ...form, website: v })} placeholder="acme.fr" />
            <Input label="Phone Number" value={form.phone || ""} onChange={v => setForm({ ...form, phone: v })} />
            <SelectField label="Activity Status" value={form.status || ""} onChange={v => setForm({ ...form, status: v })} options={config.activityStatus.map(s => ({ value: s.value, label: s.label }))} />
            <SelectField label="Company Type" value={form.companyType || ""} onChange={v => setForm({ ...form, companyType: v })} options={config.companyType.map(s => ({ value: s.value, label: s.label }))} />
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 12, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5 }}>COUNTRY</label>
              <select value={form.country || ""} onChange={e => setForm({ ...form, country: e.target.value })}
                style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "10px 14px", color: COLORS.text, fontSize: 14, outline: "none", fontFamily: "inherit" }}>
                <option value="">— Sélectionner —</option>
                {config.country.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 12, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5 }}>CITY</label>
              <select value={form.city || ""} onChange={e => setForm({ ...form, city: e.target.value })}
                style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "10px 14px", color: COLORS.text, fontSize: 14, outline: "none", fontFamily: "inherit" }}>
                <option value="">— Sélectionner —</option>
                {config.city.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <Input label="Broker" value={form.broker || ""} onChange={v => setForm({ ...form, broker: v })} />
            <SelectField label="Business Unit" value={form.businessUnit || ""} onChange={v => setForm({ ...form, businessUnit: v })} options={[{ value: "", label: "— None —" }, ...config.businessUnit.map(s => ({ value: s.value, label: s.label }))]} />
            <SelectField label="Compliance Status" value={form.complianceStatus || ""} onChange={v => setForm({ ...form, complianceStatus: v })} options={config.complianceStatus.map(s => ({ value: s.value, label: s.label }))} />
            <SelectField label="Final Authorization Status" value={form.finalAuthStatus || ""} onChange={v => setForm({ ...form, finalAuthStatus: v })} options={config.finalAuthStatus.map(s => ({ value: s.value, label: s.label }))} />
            <Input label="Revenus (€)" type="number" value={form.revenue || 0} onChange={v => setForm({ ...form, revenue: v })} />
            <Input label="Group" value={form.group || ""} onChange={v => setForm({ ...form, group: v })} />
            <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 8 }}>
              <label style={{ fontSize: 12, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5 }}>RÔLE(S)</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {config.roles.map(r => {
                  const isSelected = (form.roles || []).includes(r.value);
                  return (
                    <div key={r.value} onClick={() => toggleRole(r.value)} style={{ padding: "6px 14px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, background: isSelected ? `${r.color}25` : COLORS.bg, border: `1.5px solid ${isSelected ? r.color : COLORS.border}`, color: isSelected ? r.color : COLORS.textSub, transition: "all 0.15s", userSelect: "none" }}>
                      {isSelected && <span style={{ marginRight: 5, fontSize: 11 }}>✓</span>}
                      {r.label}
                    </div>
                  );
                })}
              </div>
            </div>
            <div style={{ gridColumn: "1 / -1" }}><Input label="Tags (séparés par virgule)" value={form.tags || ""} onChange={v => setForm({ ...form, tags: v })} /></div>
            <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 12, color: COLORS.textSub, fontWeight: 600, letterSpacing: 0.5 }}>NOTES</label>
              <textarea value={form.notes || ""} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3}
                style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "10px 14px", color: COLORS.text, fontSize: 14, resize: "vertical", fontFamily: "inherit", outline: "none", width: "100%", boxSizing: "border-box" }} />
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
        <h1 style={{ margin: 0, fontSize: 24, color: COLORS.text, fontFamily: "'Playfair Display', serif" }}>Pipeline</h1>
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

// ─── APP ──────────────────────────────────────────────────────
const initialContacts = [
  { id: 1, name: "Sophie Martin", companyId: 101, email: "s.martin@innovatech.fr", phone: "06 12 34 56 78", status: "client", priority: "haute", role: "Directrice Commerciale", tags: ["SaaS", "Enterprise"], notes: "Cliente fidèle depuis 2022.", avatar: "SM", revenue: 42000, lastContact: "2024-01-15" },
  { id: 2, name: "Lucas Dupont", companyId: 102, email: "l.dupont@startupflow.io", phone: "07 23 45 67 89", status: "prospect", priority: "moyenne", role: "CEO", tags: ["Startup", "B2B"], notes: "Intéressé par le plan Pro.", avatar: "LD", revenue: 0, lastContact: "2024-01-10" },
];
const initialTasks = [
  { id: 1, title: "Appel de suivi", contactId: 1, due: "2024-02-01", done: false, priority: "haute" },
  { id: 2, title: "Envoyer devis", contactId: 2, due: "2024-01-30", done: false, priority: "moyenne" },
];

export default function CRM() {
  const [contacts, setContacts] = useState(initialContacts);
  const [companies, setCompanies] = useState([]);
  const [tasks, setTasks] = useState(initialTasks);
  const [page, setPage] = useState("dashboard");

  useEffect(() => {
    try { const r = localStorage.getItem("crm-contacts"); if (r) setContacts(JSON.parse(r)); } catch {}
    try { const r = localStorage.getItem("crm-tasks"); if (r) setTasks(JSON.parse(r)); } catch {}
    try { const r = localStorage.getItem("crm-companies"); if (r) setCompanies(JSON.parse(r)); } catch {}
  }, []);

  useEffect(() => { try { localStorage.setItem("crm-contacts", JSON.stringify(contacts)); } catch {} }, [contacts]);
  useEffect(() => { try { localStorage.setItem("crm-tasks", JSON.stringify(tasks)); } catch {} }, [tasks]);
  useEffect(() => { try { localStorage.setItem("crm-companies", JSON.stringify(companies)); } catch {} }, [companies]);

  const NavItem = ({ n, isAdmin = false }) => (
    <div onClick={() => setPage(n.id)} style={{
      display: "flex", alignItems: "center", gap: 12, padding: "11px 24px", cursor: "pointer", transition: "all 0.15s",
      background: page === n.id ? (isAdmin ? `${COLORS.gold}18` : `${COLORS.accent}18`) : "transparent",
      borderRight: page === n.id ? `3px solid ${isAdmin ? COLORS.gold : COLORS.accent}` : "3px solid transparent",
      color: page === n.id ? (isAdmin ? COLORS.gold : COLORS.accent) : COLORS.textSub,
    }}>
      <span style={{ fontSize: 14 }}>{n.icon}</span>
      <span style={{ fontSize: 14, fontWeight: page === n.id ? 700 : 500 }}>{n.label}</span>
    </div>
  );

  return (
    <ConfigProvider>
      <div style={{ display: "flex", minHeight: "100vh", background: COLORS.bg, fontFamily: "'DM Sans', 'Segoe UI', sans-serif", color: COLORS.text }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=DM+Sans:wght@400;600;700&family=DM+Mono:wght@400;600&display=swap');
          * { box-sizing: border-box; }
          ::-webkit-scrollbar { width: 6px; }
          ::-webkit-scrollbar-track { background: transparent; }
          ::-webkit-scrollbar-thumb { background: ${COLORS.border}; border-radius: 3px; }
          option { background: ${COLORS.card}; }
        `}</style>

        {/* Sidebar */}
        <div style={{ width: 220, background: COLORS.surface, borderRight: `1px solid ${COLORS.border}`, display: "flex", flexDirection: "column", padding: "28px 0", flexShrink: 0 }}>
          <div style={{ padding: "0 24px 28px" }}>
            <div style={{ fontSize: 22, fontFamily: "'Playfair Display', serif", color: COLORS.text, lineHeight: 1 }}>Orbit <span style={{ color: COLORS.accent }}>CRM</span></div>
            <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 4 }}>Gestion des relations clients</div>
          </div>
          <nav style={{ flex: 1 }}>
            <div style={{ padding: "0 24px 10px", fontSize: 10, color: COLORS.textMuted, fontWeight: 700, letterSpacing: 1 }}>BASE DE DONNÉES</div>
            <NavItem n={{ id: "companies", label: "Companies", icon: "◆" }} />
            <div onClick={() => setPage("companies-dashboard")} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "7px 24px 7px 46px",
              cursor: "pointer", transition: "all 0.15s",
              background: page === "companies-dashboard" ? `${COLORS.accent}18` : "transparent",
              borderRight: page === "companies-dashboard" ? `3px solid ${COLORS.accent}` : "3px solid transparent",
              color: page === "companies-dashboard" ? COLORS.accent : COLORS.textMuted,
            }}
              onMouseOver={e => { if (page !== "companies-dashboard") e.currentTarget.style.color = COLORS.textSub; }}
              onMouseOut={e => { if (page !== "companies-dashboard") e.currentTarget.style.color = COLORS.textMuted; }}
            >
              <span style={{ fontSize: 10 }}>◇</span>
              <span style={{ fontSize: 12, fontWeight: page === "companies-dashboard" ? 700 : 400 }}>Dashboard</span>
            </div>
            <NavItem n={{ id: "contacts", label: "Contacts", icon: "◉" }} />
            <div style={{ height: 1, background: COLORS.border, margin: "16px 24px" }} />
            <div style={{ padding: "0 24px 10px", fontSize: 10, color: COLORS.textMuted, fontWeight: 700, letterSpacing: 1 }}>ACTIVITÉ</div>
            {[{ id: "dashboard", label: "Dashboard", icon: "◇" }, { id: "tasks", label: "Tâches", icon: "◎" }, { id: "pipeline", label: "Pipeline", icon: "◈" }].map(n => <NavItem key={n.id} n={n} />)}
            <div style={{ height: 1, background: COLORS.border, margin: "16px 24px" }} />
            <div style={{ padding: "0 24px 10px", fontSize: 10, color: COLORS.gold, fontWeight: 700, letterSpacing: 1 }}>ADMINISTRATION</div>
            <NavItem n={{ id: "admin", label: "Admin Panel", icon: "⚙" }} isAdmin />
          </nav>
          <div style={{ padding: "16px 24px", borderTop: `1px solid ${COLORS.border}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Avatar initials="MO" size={32} color={COLORS.gold} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>Mon espace</div>
                <div style={{ fontSize: 11, color: COLORS.textMuted }}>{companies.length} sociétés · {contacts.length} contacts</div>
              </div>
            </div>
          </div>
        </div>

        {/* Main */}
        <div style={{ flex: 1, padding: "32px 40px", overflowY: "auto" }}>
          {page === "dashboard" && <Dashboard contacts={contacts} companies={companies} tasks={tasks} />}
          {page === "companies" && <Companies companies={companies} setCompanies={setCompanies} contacts={contacts} />}
          {page === "contacts" && <Contacts contacts={contacts} setContacts={setContacts} companies={companies} />}
          {page === "tasks" && <Tasks tasks={tasks} setTasks={setTasks} contacts={contacts} companies={companies} />}
          {page === "pipeline" && <Pipeline contacts={contacts} setContacts={setContacts} companies={companies} setCompanies={setCompanies} />}
          {page === "companies-dashboard" && <CompaniesDashboard companies={companies} setCompanies={setCompanies} />}
          {page === "admin" && <AdminPanel />}
        </div>
      </div>
    </ConfigProvider>
  );
}