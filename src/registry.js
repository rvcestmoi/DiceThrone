import spiderman from "./characters/spiderman.js";
import thor from "./characters/thor.js";
import loki from "./characters/loki.js";

export const CHARACTERS = [spiderman, thor, loki];

// util
export function byId(id){
  const c = CHARACTERS.find(x => x.id === id);
  if(!c) throw new Error(`Unknown character id: ${id}`);
  return c;
}
