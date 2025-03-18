/**
 * Formatter exports.ts
 * Exports the formatter modules
 * 
 * This file serves as the public API for the formatter module,
 * exposing all the necessary classes and interfaces for external use.
 */
import { SlackMessage, MessageParser } from "./message-parser";
import { SimpleFormatter } from "./simple-formatter";
import { TextProcessor } from "./text-processor";
import { SlackFormatterSettings, FormatMode } from "../types";
import { SlackFormatter } from "./formatter";
import { EmojiProcessor } from "./emoji-processor";
import { DateTimeProcessor } from "./datetime-processor";
import {
  type MessageFormatHandler,
  BaseFormatHandler,
  MessageFormatFactory
} from "./message-format-strategy";
import { StandardFormatHandler } from "./standard-format-handler";
import { BracketFormatHandler } from "./bracket-format-handler";

// Export all formatter components
export {
  // Core classes
  SlackMessage,
  MessageParser,
  SimpleFormatter,
  TextProcessor,
  SlackFormatter,
  
  // Specialized processors
  EmojiProcessor,
  DateTimeProcessor,
  
  // Strategy pattern components
  BaseFormatHandler,
  MessageFormatFactory,
  StandardFormatHandler,
  BracketFormatHandler,
};

// Export types
export type {
  MessageFormatHandler,
  FormatMode
};