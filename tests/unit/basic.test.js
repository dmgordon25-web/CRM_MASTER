import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '../../crm-app');

describe('project sanity', () => {
  it('includes the CRM index file', () => {
    expect(fs.existsSync(path.join(root, 'index.html'))).toBe(true);
  });
});
