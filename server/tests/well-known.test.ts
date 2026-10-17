// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { wellKnownHandler } from '../functions/well-known';

describe('/.well-known/*', () => {
  it('answers 404 so Claude treats the MCP server as having no sign-in', () => {
    const response = wellKnownHandler();
    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toContain('text/plain');
  });
});
