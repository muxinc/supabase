import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  ensureTomlProperty,
  ensureTomlProperties,
  ensureTomlArrayItem,
} from '../commands/toml-modifications';

describe('toml-modifications', () => {
  let tempDir: string;
  let testFilePath: string;

  beforeEach(() => {
    // Create a temporary directory for each test
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'toml-test-'));
    testFilePath = path.join(tempDir, 'test.toml');
  });

  afterEach(() => {
    // Clean up temporary directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('ensureTomlProperty', () => {
    it('should add property to existing section', () => {
      const initialContent = `[api]
enabled = true

[db]
port = 5432
`;
      fs.writeFileSync(testFilePath, initialContent, 'utf-8');

      const result = ensureTomlProperty(testFilePath, 'api', 'max_rows', 1000);

      expect(result.modified).toBe(true);
      expect(result.message).toContain('Set [api].max_rows = 1000');

      const content = fs.readFileSync(testFilePath, 'utf-8');
      expect(content).toContain('[api]');
      expect(content).toContain('max_rows = 1000');
      expect(content).toContain('enabled = true');
    });

    it('should add boolean property to existing section', () => {
      const initialContent = `[api]
enabled = true
`;
      fs.writeFileSync(testFilePath, initialContent, 'utf-8');

      const result = ensureTomlProperty(testFilePath, 'api', 'debug', false);

      expect(result.modified).toBe(true);
      const content = fs.readFileSync(testFilePath, 'utf-8');
      expect(content).toContain('debug = false');
    });

    it('should add string property to existing section', () => {
      const initialContent = `[api]
enabled = true
`;
      fs.writeFileSync(testFilePath, initialContent, 'utf-8');

      const result = ensureTomlProperty(testFilePath, 'api', 'name', 'my-api');

      expect(result.modified).toBe(true);
      const content = fs.readFileSync(testFilePath, 'utf-8');
      expect(content).toContain('name = "my-api"');
    });

    it('should add array property to existing section', () => {
      const initialContent = `[api]
enabled = true
`;
      fs.writeFileSync(testFilePath, initialContent, 'utf-8');

      const result = ensureTomlProperty(testFilePath, 'api', 'schemas', [
        'public',
        'mux',
      ]);

      expect(result.modified).toBe(true);
      const content = fs.readFileSync(testFilePath, 'utf-8');
      expect(content).toContain('schemas = [ "public", "mux" ]');
    });

    it('should create new section if it does not exist', () => {
      const initialContent = `[api]
enabled = true
`;
      fs.writeFileSync(testFilePath, initialContent, 'utf-8');

      const result = ensureTomlProperty(
        testFilePath,
        'db.vault',
        'enabled',
        true
      );

      expect(result.modified).toBe(true);
      const content = fs.readFileSync(testFilePath, 'utf-8');
      expect(content).toContain('[db.vault]');
      expect(content).toContain('enabled = true');
    });

    it('should not modify file if property already has correct value', () => {
      const initialContent = `[api]
enabled = true
max_rows = 1000
`;
      fs.writeFileSync(testFilePath, initialContent, 'utf-8');

      const result = ensureTomlProperty(testFilePath, 'api', 'max_rows', 1000);

      expect(result.modified).toBe(false);
      expect(result.message).toContain('already has correct value');
    });

    it('should not modify file if array property already has correct value', () => {
      const initialContent = `[api]
schemas = [ "public", "mux" ]
`;
      fs.writeFileSync(testFilePath, initialContent, 'utf-8');

      const result = ensureTomlProperty(testFilePath, 'api', 'schemas', [
        'public',
        'mux',
      ]);

      expect(result.modified).toBe(false);
      expect(result.message).toContain('already has correct value');
    });

    it('should update property if value is different', () => {
      const initialContent = `[api]
max_rows = 500
`;
      fs.writeFileSync(testFilePath, initialContent, 'utf-8');

      const result = ensureTomlProperty(testFilePath, 'api', 'max_rows', 1000);

      expect(result.modified).toBe(true);
      const content = fs.readFileSync(testFilePath, 'utf-8');
      expect(content).toContain('max_rows = 1000');
      expect(content).not.toContain('max_rows = 500');
    });

    it('should return error if file does not exist', () => {
      const result = ensureTomlProperty(
        '/nonexistent/file.toml',
        'api',
        'enabled',
        true
      );

      expect(result.modified).toBe(false);
      expect(result.message).toContain('File not found');
    });

    it('should preserve comments and formatting', () => {
      const initialContent = `# This is a comment
[api]
# Another comment
enabled = true

# Section comment
[db]
port = 5432
`;
      fs.writeFileSync(testFilePath, initialContent, 'utf-8');

      ensureTomlProperty(testFilePath, 'api', 'max_rows', 1000);

      const content = fs.readFileSync(testFilePath, 'utf-8');
      expect(content).toContain('# This is a comment');
      expect(content).toContain('# Another comment');
      expect(content).toContain('# Section comment');
      expect(content).toContain('enabled = true');
    });

    it('should handle nested section paths', () => {
      const initialContent = `[functions.mux-webhook]
enabled = true
`;
      fs.writeFileSync(testFilePath, initialContent, 'utf-8');

      const result = ensureTomlProperty(
        testFilePath,
        'functions.mux-webhook',
        'timeout',
        300
      );

      expect(result.modified).toBe(true);
      const content = fs.readFileSync(testFilePath, 'utf-8');
      expect(content).toContain('[functions.mux-webhook]');
      expect(content).toContain('timeout = 300');
    });

    it('should escape special characters in string values', () => {
      const initialContent = `[api]
enabled = true
`;
      fs.writeFileSync(testFilePath, initialContent, 'utf-8');

      const result = ensureTomlProperty(
        testFilePath,
        'api',
        'path',
        'C:\\Users\\test\\path'
      );

      expect(result.modified).toBe(true);
      const content = fs.readFileSync(testFilePath, 'utf-8');
      expect(content).toContain('path = "C:\\\\Users\\\\test\\\\path"');
    });
  });

  describe('ensureTomlProperties', () => {
    it('should add multiple properties to existing section', () => {
      const initialContent = `[api]
enabled = true
`;
      fs.writeFileSync(testFilePath, initialContent, 'utf-8');

      const result = ensureTomlProperties(testFilePath, 'api', {
        max_rows: 1000,
        timeout: 30,
        debug: false,
      });

      expect(result.modified).toBe(true);
      expect(result.message).toContain('Added 3 properties');

      const content = fs.readFileSync(testFilePath, 'utf-8');
      expect(content).toContain('max_rows = 1000');
      expect(content).toContain('timeout = 30');
      expect(content).toContain('debug = false');
    });

    it('should create new section with multiple properties', () => {
      const initialContent = `[api]
enabled = true
`;
      fs.writeFileSync(testFilePath, initialContent, 'utf-8');

      const result = ensureTomlProperties(testFilePath, 'db.vault', {
        enabled: true,
        secret_key: 'vault-key',
      });

      expect(result.modified).toBe(true);
      const content = fs.readFileSync(testFilePath, 'utf-8');
      expect(content).toContain('[db.vault]');
      expect(content).toContain('enabled = true');
      expect(content).toContain('secret_key = "vault-key"');
    });

    it('should not modify file if all properties already have correct values', () => {
      const initialContent = `[api]
enabled = true
max_rows = 1000
timeout = 30
`;
      fs.writeFileSync(testFilePath, initialContent, 'utf-8');

      const result = ensureTomlProperties(testFilePath, 'api', {
        max_rows: 1000,
        timeout: 30,
      });

      expect(result.modified).toBe(false);
      expect(result.message).toContain('already have correct values');
    });

    it('should only add properties that need updating', () => {
      const initialContent = `[api]
enabled = true
max_rows = 1000
`;
      fs.writeFileSync(testFilePath, initialContent, 'utf-8');

      const result = ensureTomlProperties(testFilePath, 'api', {
        max_rows: 1000, // Already correct
        timeout: 30, // New property
      });

      expect(result.modified).toBe(true);
      expect(result.message).toContain('Added 1 properties');
      expect(result.message).toContain('timeout');

      const content = fs.readFileSync(testFilePath, 'utf-8');
      expect(content).toContain('timeout = 30');
    });

    it('should return error if file does not exist', () => {
      const result = ensureTomlProperties('/nonexistent/file.toml', 'api', {
        enabled: true,
      });

      expect(result.modified).toBe(false);
      expect(result.message).toContain('File not found');
    });

    it('should handle array properties', () => {
      const initialContent = `[api]
enabled = true
`;
      fs.writeFileSync(testFilePath, initialContent, 'utf-8');

      const result = ensureTomlProperties(testFilePath, 'api', {
        schemas: ['public', 'mux'],
        ports: [8080, 8081],
      });

      expect(result.modified).toBe(true);
      const content = fs.readFileSync(testFilePath, 'utf-8');
      expect(content).toContain('schemas = [ "public", "mux" ]');
      expect(content).toContain('ports = [ 8080, 8081 ]');
    });
  });

  describe('ensureTomlArrayItem', () => {
    it('should add item to existing array', () => {
      const initialContent = `[api]
schemas = [ "public", "storage" ]
`;
      fs.writeFileSync(testFilePath, initialContent, 'utf-8');

      const result = ensureTomlArrayItem(testFilePath, 'api', 'schemas', 'mux');

      expect(result.modified).toBe(true);
      expect(result.message).toContain('Added "mux"');

      const content = fs.readFileSync(testFilePath, 'utf-8');
      expect(content).toContain('schemas = [ "public", "storage", "mux"]');
    });

    it('should not modify file if item already exists in array', () => {
      const initialContent = `[api]
schemas = [ "public", "mux", "storage" ]
`;
      fs.writeFileSync(testFilePath, initialContent, 'utf-8');

      const result = ensureTomlArrayItem(testFilePath, 'api', 'schemas', 'mux');

      expect(result.modified).toBe(false);
      expect(result.message).toContain('already exists');
    });

    it('should add item to empty array', () => {
      const initialContent = `[api]
schemas = []
`;
      fs.writeFileSync(testFilePath, initialContent, 'utf-8');

      const result = ensureTomlArrayItem(testFilePath, 'api', 'schemas', 'mux');

      expect(result.modified).toBe(true);
      const content = fs.readFileSync(testFilePath, 'utf-8');
      expect(content).toContain('schemas = ["mux"]');
    });

    it('should preserve array formatting with spaces', () => {
      const initialContent = `[api]
schemas = [ "public" ]
`;
      fs.writeFileSync(testFilePath, initialContent, 'utf-8');

      const result = ensureTomlArrayItem(testFilePath, 'api', 'schemas', 'mux');

      expect(result.modified).toBe(true);
      const content = fs.readFileSync(testFilePath, 'utf-8');
      expect(content).toContain('schemas = [ "public", "mux"]');
    });

    it('should return error if property is not an array', () => {
      const initialContent = `[api]
enabled = true
`;
      fs.writeFileSync(testFilePath, initialContent, 'utf-8');

      const result = ensureTomlArrayItem(
        testFilePath,
        'api',
        'enabled',
        'value'
      );

      expect(result.modified).toBe(false);
      expect(result.message).toContain('is not an array');
    });

    it('should return error if property does not exist', () => {
      const initialContent = `[api]
enabled = true
`;
      fs.writeFileSync(testFilePath, initialContent, 'utf-8');

      const result = ensureTomlArrayItem(testFilePath, 'api', 'schemas', 'mux');

      expect(result.modified).toBe(false);
      expect(result.message).toContain("is not an array or doesn't exist");
    });

    it('should return error if section does not exist', () => {
      const initialContent = `[api]
enabled = true
`;
      fs.writeFileSync(testFilePath, initialContent, 'utf-8');

      const result = ensureTomlArrayItem(testFilePath, 'db', 'schemas', 'mux');

      expect(result.modified).toBe(false);
      expect(result.message).toContain("is not an array or doesn't exist");
    });

    it('should return error if file does not exist', () => {
      const result = ensureTomlArrayItem(
        '/nonexistent/file.toml',
        'api',
        'schemas',
        'mux'
      );

      expect(result.modified).toBe(false);
      expect(result.message).toContain('File not found');
    });

    it('should handle nested section paths', () => {
      const initialContent = `[functions.mux-webhook]
allowed_events = [ "video.asset.created" ]
`;
      fs.writeFileSync(testFilePath, initialContent, 'utf-8');

      const result = ensureTomlArrayItem(
        testFilePath,
        'functions.mux-webhook',
        'allowed_events',
        'video.asset.ready'
      );

      expect(result.modified).toBe(true);
      const content = fs.readFileSync(testFilePath, 'utf-8');
      expect(content).toContain(
        'allowed_events = [ "video.asset.created", "video.asset.ready"]'
      );
    });

    it('should preserve comments when adding to array', () => {
      const initialContent = `# API Configuration
[api]
# Allowed database schemas
schemas = [ "public" ]
`;
      fs.writeFileSync(testFilePath, initialContent, 'utf-8');

      ensureTomlArrayItem(testFilePath, 'api', 'schemas', 'mux');

      const content = fs.readFileSync(testFilePath, 'utf-8');
      expect(content).toContain('# API Configuration');
      expect(content).toContain('# Allowed database schemas');
    });
  });

  describe('real-world scenarios', () => {
    it('should handle supabase config.toml structure', () => {
      const initialContent = `# A string used to distinguish different Supabase projects on the same host.
project_id = "test-project"

[api]
enabled = true
port = 54321
schemas = ["public", "storage"]

[db]
port = 54322

[db.pooler]
enabled = false
`;
      fs.writeFileSync(testFilePath, initialContent, 'utf-8');

      // Add mux schema to api.schemas
      const result1 = ensureTomlArrayItem(
        testFilePath,
        'api',
        'schemas',
        'mux'
      );
      expect(result1.modified).toBe(true);

      // Add vault configuration
      const result2 = ensureTomlProperty(
        testFilePath,
        'db.vault',
        'enabled',
        true
      );
      expect(result2.modified).toBe(true);

      const content = fs.readFileSync(testFilePath, 'utf-8');
      expect(content).toContain('schemas = ["public", "storage", "mux"]');
      expect(content).toContain('[db.vault]');
      expect(content).toContain('enabled = true');
      expect(content).toContain('# A string used to distinguish');
    });

    it('should handle multiple modifications in sequence', () => {
      const initialContent = `[api]
enabled = true
`;
      fs.writeFileSync(testFilePath, initialContent, 'utf-8');

      // First modification
      ensureTomlProperty(testFilePath, 'api', 'max_rows', 1000);

      // Second modification
      ensureTomlProperty(testFilePath, 'db', 'port', 5432);

      // Third modification
      ensureTomlProperty(testFilePath, 'api', 'timeout', 30);

      const content = fs.readFileSync(testFilePath, 'utf-8');
      expect(content).toContain('[api]');
      expect(content).toContain('max_rows = 1000');
      expect(content).toContain('timeout = 30');
      expect(content).toContain('[db]');
      expect(content).toContain('port = 5432');
    });
  });
});
