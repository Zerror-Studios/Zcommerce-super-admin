/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import { createContext } from "react";

/**
 * The phone label of the title row's primary (v2 §10: "Add" for "Add product"). The page header provides it around
 * its primary action, so it reaches a primary Button however deeply it is wrapped (a dropdown trigger, a component
 * like "New campaign ▾"). Modal and Drawer reset it, so a dialog opened from that action keeps its own labels.
 */
export const ButtonShortLabelContext = createContext<string | undefined>(undefined);
