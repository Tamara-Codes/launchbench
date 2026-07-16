import { createId } from "@paralleldrive/cuid2";

/** Collision-resistant identifier used for all primary keys. */
export function newId(): string {
  return createId();
}
