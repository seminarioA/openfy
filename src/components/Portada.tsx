import { Music2 } from "lucide-react";
import type { Item } from "../lib/db";

/** La carátula pequeña de una pista; sin carátula, una nota musical. */
export function Miniatura({ item, tamano = 40 }: { item: Item; tamano?: number }) {
  return item.portada ? (
    <img className="mini" src={item.portada} alt="" loading="lazy" width={tamano} height={tamano} />
  ) : (
    <span className="mini" aria-hidden>
      <Music2 size={18} />
    </span>
  );
}
