import { version } from "../../package.json";

/**
 * Version shown in the UI. package.json is the single source of truth, so the
 * badge can never drift away from the shipped build again.
 */
export const APP_VERSION = version;
