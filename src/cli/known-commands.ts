import { commandHandlers } from "./command-registry.js";

export const knownCommands = new Set(Object.keys(commandHandlers));
