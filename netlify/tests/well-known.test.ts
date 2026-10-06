// @vitest-environment node
import { describe, expect, it } from 'vitest';

import wellKnown, { config } from '../functions/well-known';

describe('/.well-known/*', () => {
  it('answers 404 so Claude treats the MCP server as having no sign-in', async () => {
    const response = await wellKnown();
    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toContain('text/plain');
    expect(config.path).toBe('/.well-known/*');
  });
});
