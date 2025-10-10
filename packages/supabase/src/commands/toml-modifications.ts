/**
 * Utilities for modifying TOML files while preserving comments and formatting.
 *
 * These functions use TOML parsing for validation but perform targeted string
 * replacements to preserve the original file's comments and structure.
 */

import fs from 'node:fs';
import TOML from '@iarna/toml';

interface TomlModificationResult {
  modified: boolean;
  message: string;
}

/**
 * Ensures a property exists in a TOML section with the specified value.
 * If the section doesn't exist, it will be created.
 * Preserves all comments and formatting in the original file.
 *
 * @param filePath - Path to the TOML file
 * @param sectionPath - Dot-separated path to the section (e.g., 'functions.mux-webhook' or 'db.vault')
 * @param property - Property name to add/modify
 * @param value - Value to set (will be TOML-formatted appropriately)
 * @returns Object indicating if file was modified and a message
 */
export function ensureTomlProperty(
  filePath: string,
  sectionPath: string,
  property: string,
  value: string | boolean | number | string[]
): TomlModificationResult {
  if (!fs.existsSync(filePath)) {
    return {
      modified: false,
      message: `File not found: ${filePath}`,
    };
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const parsed = TOML.parse(content) as any;

  // Navigate to the section in the parsed object (don't create missing sections)
  const pathParts = sectionPath.split('.');
  let current = parsed;
  for (const part of pathParts) {
    if (!current[part]) {
      // Section doesn't exist in file
      current = undefined;
      break;
    }
    current = current[part];
  }

  // Check if property already has the correct value
  if (current && current[property] !== undefined) {
    // Check if values match
    if (Array.isArray(value)) {
      const currentArray = current[property];
      if (
        Array.isArray(currentArray) &&
        currentArray.length === value.length &&
        currentArray.every((v, i) => v === value[i])
      ) {
        return {
          modified: false,
          message: `Property [${sectionPath}].${property} already has correct value`,
        };
      }
    } else if (current[property] === value) {
      return {
        modified: false,
        message: `Property [${sectionPath}].${property} already has correct value`,
      };
    }
  }

  // Format the value as TOML
  const formattedValue = formatTomlValue(value);

  // Build the section header regex (e.g., [functions.mux-webhook])
  const sectionHeader = `[${sectionPath}]`;
  const sectionRegex = new RegExp(
    `^\\[${sectionPath.replace(/\./g, '\\.')}\\]\\s*$`,
    'm'
  );

  let newContent: string;
  const propertyLine = `${property} = ${formattedValue}`;

  if (sectionRegex.test(content)) {
    // Section exists - check if property exists in it
    const propertyRegex = new RegExp(`^\\s*${property}\\s*=.*$`, 'm');

    if (propertyRegex.test(content)) {
      // Property exists - replace it
      newContent = content.replace(propertyRegex, propertyLine);
    } else {
      // Property doesn't exist - add it after the section header
      newContent = content.replace(
        sectionRegex,
        `${sectionHeader}\n${propertyLine}`
      );
    }
  } else {
    // Section doesn't exist - append it at the end
    newContent = content.trimEnd() + `\n\n${sectionHeader}\n${propertyLine}\n`;
  }

  fs.writeFileSync(filePath, newContent, 'utf-8');

  return {
    modified: true,
    message: `Set [${sectionPath}].${property} = ${formattedValue}`,
  };
}

/**
 * Ensures multiple properties exist in a TOML section.
 * More efficient than calling ensureTomlProperty multiple times as it only
 * parses and writes the file once.
 *
 * @param filePath - Path to the TOML file
 * @param sectionPath - Dot-separated path to the section
 * @param properties - Object mapping property names to values
 * @returns Object indicating if file was modified and messages for each property
 */
export function ensureTomlProperties(
  filePath: string,
  sectionPath: string,
  properties: Record<string, string | boolean | number | string[]>
): TomlModificationResult {
  if (!fs.existsSync(filePath)) {
    return {
      modified: false,
      message: `File not found: ${filePath}`,
    };
  }

  let content = fs.readFileSync(filePath, 'utf-8');
  const parsed = TOML.parse(content) as any;

  // Navigate to the section in the parsed object (don't create missing sections)
  const pathParts = sectionPath.split('.');
  let current = parsed;
  for (const part of pathParts) {
    if (!current[part]) {
      // Section doesn't exist in file
      current = undefined;
      break;
    }
    current = current[part];
  }

  // Determine which properties need to be added/modified
  const propertiesToAdd: string[] = [];
  for (const [property, value] of Object.entries(properties)) {
    const needsUpdate = shouldUpdateProperty(
      current ? current[property] : undefined,
      value
    );
    if (needsUpdate) {
      propertiesToAdd.push(property);
    }
  }

  if (propertiesToAdd.length === 0) {
    return {
      modified: false,
      message: `All properties in [${sectionPath}] already have correct values`,
    };
  }

  // Build the section header regex
  const sectionHeader = `[${sectionPath}]`;
  const sectionRegex = new RegExp(
    `^\\[${sectionPath.replace(/\./g, '\\.')}\\]\\s*$`,
    'm'
  );

  const sectionExists = sectionRegex.test(content);

  // Generate property lines
  const propertyLines = propertiesToAdd
    .map((prop) => `${prop} = ${formatTomlValue(properties[prop])}`)
    .join('\n');

  if (sectionExists) {
    // Add properties after the section header
    content = content.replace(
      sectionRegex,
      `${sectionHeader}\n${propertyLines}`
    );
  } else {
    // Append new section at the end
    content = content.trimEnd() + `\n\n${sectionHeader}\n${propertyLines}\n`;
  }

  fs.writeFileSync(filePath, content, 'utf-8');

  return {
    modified: true,
    message: `Added ${propertiesToAdd.length} properties to [${sectionPath}]: ${propertiesToAdd.join(', ')}`,
  };
}

/**
 * Helper function to determine if a property value needs updating
 */
function shouldUpdateProperty(
  currentValue: any,
  newValue: string | boolean | number | string[]
): boolean {
  if (currentValue === undefined) {
    return true;
  }

  if (Array.isArray(newValue)) {
    return !(
      Array.isArray(currentValue) &&
      currentValue.length === newValue.length &&
      currentValue.every((v, i) => v === newValue[i])
    );
  }

  return currentValue !== newValue;
}

/**
 * Ensures an item exists in a TOML array property.
 * If the item already exists, does nothing.
 * Preserves all comments and formatting in the original file.
 *
 * @param filePath - Path to the TOML file
 * @param sectionPath - Dot-separated path to the section (e.g., 'api')
 * @param property - Array property name (e.g., 'schemas')
 * @param item - Item to add to the array
 * @returns Object indicating if file was modified and a message
 */
export function ensureTomlArrayItem(
  filePath: string,
  sectionPath: string,
  property: string,
  item: string
): TomlModificationResult {
  if (!fs.existsSync(filePath)) {
    return {
      modified: false,
      message: `File not found: ${filePath}`,
    };
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const parsed = TOML.parse(content) as any;

  // Navigate to the section in the parsed object
  const pathParts = sectionPath.split('.');
  let current = parsed;
  for (const part of pathParts) {
    if (!current[part]) {
      current = undefined;
      break;
    }
    current = current[part];
  }

  // Check if property exists and is an array
  if (!current || !Array.isArray(current[property])) {
    return {
      modified: false,
      message: `Property [${sectionPath}].${property} is not an array or doesn't exist`,
    };
  }

  // Check if item already exists in array
  if (current[property].includes(item)) {
    return {
      modified: false,
      message: `Item "${item}" already exists in [${sectionPath}].${property}`,
    };
  }

  // Find the property line in the file
  const propertyRegex = new RegExp(
    `^(\\s*${property}\\s*=\\s*\\[)([^\\]]*)(\\].*)$`,
    'm'
  );
  const match = content.match(propertyRegex);

  if (!match) {
    return {
      modified: false,
      message: `Could not find property [${sectionPath}].${property} in file`,
    };
  }

  const [_fullMatch, prefix, arrayContent, suffix] = match;

  // Format the new item
  const formattedItem = formatTomlValue(item);

  // Add the item to the array
  let newArrayContent: string;
  if (arrayContent.trim() === '') {
    // Empty array
    newArrayContent = formattedItem;
  } else {
    // Add to end of array with proper spacing
    newArrayContent = `${arrayContent.trimEnd()}, ${formattedItem}`;
  }

  const newLine = `${prefix}${newArrayContent}${suffix}`;
  const newContent = content.replace(propertyRegex, newLine);

  fs.writeFileSync(filePath, newContent, 'utf-8');

  return {
    modified: true,
    message: `Added "${item}" to [${sectionPath}].${property}`,
  };
}

/**
 * Formats a JavaScript value as a TOML value string
 */
function formatTomlValue(value: string | boolean | number | string[]): string {
  if (typeof value === 'boolean') {
    return value.toString();
  }

  if (typeof value === 'number') {
    return value.toString();
  }

  if (typeof value === 'string') {
    // Use double quotes and escape special characters
    return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }

  if (Array.isArray(value)) {
    // Format array elements
    const elements = value.map((v) => formatTomlValue(v)).join(', ');
    return `[ ${elements} ]`;
  }

  throw new Error(`Unsupported value type: ${typeof value}`);
}
