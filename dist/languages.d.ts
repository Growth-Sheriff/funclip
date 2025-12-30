/**
 * Language Configurations
 */
import { Language, LanguageConfig } from './types';
export declare const LANGUAGE_CONFIGS: Record<Language, LanguageConfig>;
export declare function getLanguageByExtension(ext: string): Language;
export declare function getLanguageConfig(lang: Language): LanguageConfig;
export declare function getSupportedExtensions(): string[];
export declare const DEFAULT_EXCLUDE_DIRS: string[];
