/**
 * Czech QWERTY International: US-International plus the Czech háček and
 * ring letters on AltGr + their base letter.
 *
 *   ' then a e i o u y   →  á é í ó ú ý    (dead key, as in US-International)
 *   AltGr + c d e n r s t z  →  č ď ě ň ř š ť ž
 *   AltGr + u            →  ů
 *   add Shift for capitals; Caps Lock works on AltGr letters too
 */
import type { KeyId } from "../keys";
import { type Cell, type KeyLevels, type Layout, dead, key } from "../model";
import { US_INTERNATIONAL_DEAD_KEYS, US_INTERNATIONAL_KEYS } from "./us-international";

type AltGrPair = [altgr: Cell, shiftAltgr: Cell];

/** Czech letters with a háček (č ď ě ň ř š ť ž) or a ring (ů), on AltGr + the base letter. */
export const CZECH_LETTERS = {
  KeyC: ["č", "Č"],
  KeyD: ["ď", "Ď"],
  KeyE: ["ě", "Ě"],
  KeyN: ["ň", "Ň"],
  KeyR: ["ř", "Ř"],
  KeyS: ["š", "Š"],
  KeyT: ["ť", "Ť"],
  KeyZ: ["ž", "Ž"],
  KeyU: ["ů", "Ů"],
} satisfies Partial<Record<KeyId, AltGrPair>>;

/**
 * US-International AltGr characters that the Czech letters displace and that
 * no dead key can produce, moved to keys whose AltGr layer was empty. (é, ú
 * and ñ are not listed: ' + e, ' + u and ~ + n still type them.)
 */
const RELOCATED: Partial<Record<KeyId, AltGrPair>> = {
  KeyF: ["ð", "Ð"], // was AltGr + D, now the key next to it
  KeyG: ["þ", "Þ"], // was AltGr + T
  KeyX: ["æ", "Æ"], // was AltGr + Z, now the key next to it
  KeyV: ["©", "®"], // were AltGr + C and AltGr + R
  KeyB: ["ß", "§"], // were AltGr + S and Shift + AltGr + S
  Digit5: ["€", "¢"], // ¢ was Shift + AltGr + C, now next to €
};

function withAltGr(keys: Record<KeyId, KeyLevels>, ...overlays: Partial<Record<KeyId, AltGrPair>>[]) {
  const result = { ...keys };
  for (const overlay of overlays) {
    for (const [id, [altgr, shiftAltgr]] of Object.entries(overlay) as [KeyId, AltGrPair][]) {
      result[id] = { ...result[id], altgr, shiftAltgr };
    }
  }
  return result;
}

const CZECH_KEYS = withAltGr(US_INTERNATIONAL_KEYS, CZECH_LETTERS, RELOCATED);

export const CZECH_QWERTY_INTERNATIONAL: Layout = {
  id: "czech-qwerty-international",
  name: "Czech QWERTY International",
  variant: "basic",
  dll: "kbdczqi",
  macId: -28_741,
  summary:
    "US-International with Czech letters on AltGr: ' + a → á, AltGr + c → č, AltGr + u → ů.",
  keys: CZECH_KEYS,
  deadKeys: US_INTERNATIONAL_DEAD_KEYS,
};

/**
 * Programmer variant: ' " ` ~ ^ type themselves, as on plain US QWERTY, so
 * code never turns 'a' into á'. The accents move to AltGr + the same key:
 * AltGr + ' then a → á, AltGr + " (Shift) then u → ü, AltGr + ` / ~ / ^.
 */
export const CZECH_QWERTY_INTERNATIONAL_PROGRAMMER: Layout = {
  id: "czech-qwerty-international-programmer",
  name: "Czech QWERTY International (Programmer)",
  variant: "programmer",
  dll: "kbdczqip",
  macId: -28_742,
  summary:
    "Like Czech QWERTY International, but ' and \" are plain keys; accents are on AltGr + ' instead.",
  keys: {
    ...CZECH_KEYS,
    Backquote: key("`", "~", dead("grave"), dead("tilde")),
    // AltGr + 6 keeps US-International's ¼; Shift + AltGr + 6 (where ^ is) becomes the dead circumflex.
    Digit6: key("6", "^", "¼", dead("circumflex")),
    // ´ and ¨ were AltGr + ' and Shift + AltGr + '; the dead keys type them when followed by Space.
    Quote: key("'", '"', dead("acute"), dead("diaeresis")),
  },
  deadKeys: {
    ...US_INTERNATIONAL_DEAD_KEYS,
    acute: { ...US_INTERNATIONAL_DEAD_KEYS.acute, char: "´" },
    diaeresis: { ...US_INTERNATIONAL_DEAD_KEYS.diaeresis, char: "¨" },
  },
};

export const LAYOUTS: readonly Layout[] = [CZECH_QWERTY_INTERNATIONAL, CZECH_QWERTY_INTERNATIONAL_PROGRAMMER];
