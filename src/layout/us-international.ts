/**
 * Windows "United States-International" (KBDUSX.DLL), transcribed from the
 * DLL that ships with Windows 11. The tests compare the built layouts
 * against the real DLL, so any drift from this table is caught.
 */
import type { KeyId } from "../keys";
import { type Accent, type DeadKey, type KeyLevels, dead, key } from "../model";

export const US_INTERNATIONAL_KEYS: Record<KeyId, KeyLevels> = {
  Backquote: key(dead("grave"), dead("tilde")),
  Digit1: key("1", "!", "¡", "¹"),
  Digit2: key("2", "@", "²"),
  Digit3: key("3", "#", "³"),
  Digit4: key("4", "$", "¤", "£"),
  Digit5: key("5", "%", "€"),
  Digit6: key("6", dead("circumflex"), "¼"),
  Digit7: key("7", "&", "½"),
  Digit8: key("8", "*", "¾"),
  Digit9: key("9", "(", "‘"),
  Digit0: key("0", ")", "’"),
  Minus: key("-", "_", "¥"),
  Equal: key("=", "+", "×", "÷"),

  KeyQ: key("q", "Q", "ä", "Ä"),
  KeyW: key("w", "W", "å", "Å"),
  KeyE: key("e", "E", "é", "É"),
  KeyR: key("r", "R", "®"),
  KeyT: key("t", "T", "þ", "Þ"),
  KeyY: key("y", "Y", "ü", "Ü"),
  KeyU: key("u", "U", "ú", "Ú"),
  KeyI: key("i", "I", "í", "Í"),
  KeyO: key("o", "O", "ó", "Ó"),
  KeyP: key("p", "P", "ö", "Ö"),
  BracketLeft: key("[", "{", "«"),
  BracketRight: key("]", "}", "»"),
  Backslash: key("\\", "|", "¬", "¦"),

  KeyA: key("a", "A", "á", "Á"),
  KeyS: key("s", "S", "ß", "§"),
  KeyD: key("d", "D", "ð", "Ð"),
  KeyF: key("f", "F"),
  KeyG: key("g", "G"),
  KeyH: key("h", "H"),
  KeyJ: key("j", "J"),
  KeyK: key("k", "K"),
  KeyL: key("l", "L", "ø", "Ø"),
  Semicolon: key(";", ":", "¶", "°"),
  Quote: key(dead("acute"), dead("diaeresis"), "´", "¨"),

  IntlBackslash: key("\\", "|"),
  KeyZ: key("z", "Z", "æ", "Æ"),
  KeyX: key("x", "X"),
  KeyC: key("c", "C", "©", "¢"),
  KeyV: key("v", "V"),
  KeyB: key("b", "B"),
  KeyN: key("n", "N", "ñ", "Ñ"),
  KeyM: key("m", "M", "µ"),
  Comma: key(",", "<", "ç", "Ç"),
  Period: key(".", ">"),
  Slash: key("/", "?", "¿"),

  Space: key(" ", " "),
};

/** Base letter → accented letter, for each lowercase/uppercase pair. */
function pairs(spec: string): Record<string, string> {
  const compose: Record<string, string> = {};
  for (const [base, composed] of spec.split(" ").map((p) => [...p])) {
    compose[base!] = composed!;
    compose[base!.toUpperCase()] = composed!.toUpperCase();
  }
  return compose;
}

/** Dead-key compositions of US-International, exactly as in KBDUSX.DLL. */
export const US_INTERNATIONAL_COMPOSE: Record<Accent, Record<string, string>> = {
  acute: pairs("aá eé ií oó uú yý cç"),
  // KBDUSX has no " + Y → Ÿ.
  diaeresis: { ...pairs("aä eë iï oö uü"), y: "ÿ" },
  grave: pairs("aà eè iì oò uù"),
  tilde: pairs("aã oõ nñ"),
  circumflex: pairs("aâ eê iî oô uû"),
};

/** US-International's dead keys: each types its own ASCII symbol when followed by Space. */
export const US_INTERNATIONAL_DEAD_KEYS: Record<Accent, DeadKey> = {
  acute: { char: "'", name: "ACUTE/CEDILLA", compose: US_INTERNATIONAL_COMPOSE.acute },
  diaeresis: { char: '"', name: "UMLAUT", compose: US_INTERNATIONAL_COMPOSE.diaeresis },
  grave: { char: "`", name: "GRAVE", compose: US_INTERNATIONAL_COMPOSE.grave },
  tilde: { char: "~", name: "TILDE", compose: US_INTERNATIONAL_COMPOSE.tilde },
  circumflex: { char: "^", name: "CIRCUMFLEX", compose: US_INTERNATIONAL_COMPOSE.circumflex },
};
