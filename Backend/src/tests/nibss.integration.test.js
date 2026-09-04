const assert = require('node:assert/strict');
const http = require('node:http');
const {
  createNIBSSClient,
  NIBSSIntegrationError,
} = require('../integrations/nibss/nibss.client');
const { onboardFintech, authenticateFintech } = require('../integrations/nibss/nibss.auth');
const { insertBvn, insertNin, validateBvn, validateNin } = require('../integrations/nibss/nibss.onboarding');
const { nameEnquiry } = require('../integrations/nibss/nibss.name-enquiry');
const { transfer } = require('../integrations/nibss/nibss.transfer');
const { transactionStatus } = require('../integrations/nibss/nibss.transaction-status');

function startStub() {
  const requests = [];
  const server = http.createServer((request, response) => {
    let body = '';
    request.on('data', (chunk) => { body += chunk; });
    request.on('end', () => {
      requests.push({ method: request.method, url: request.url, headers: request.headers, body });
      response.setHeader('content-type', 'application/json');

      if (request.url === '/timeout') {
        setTimeout(() => response.end('{}'), 100);
        return;
      }
      if (request.url === '/http-error') {
        response.statusCode = 401;
        response.end(JSON.stringify({ secret: 'must-not-leak' }));
        return;
      }
      if (request.url === '/malformed') {
        response.end(JSON.stringify([]));
        return;
      }
      if (request.url === '/api/fintech/onboard') {
        response.statusCode = 201;
        response.end(JSON.stringify({ apiKey: 'key', apiSecret: 'secret', bankCode: '260', bankName: 'PHC Bank' }));
        return;
      }
      if (request.url === '/api/auth/token') {
        response.end(JSON.stringify({ token: 'jwt-token', fintech: { bankCode: '260' } }));
        return;
      }
      if (['/api/insertBvn', '/api/insertNin', '/api/validateBvn', '/api/validateNin'].includes(request.url)) {
        assert.equal(request.headers.authorization, undefined);
        response.end(JSON.stringify({
          success: true,
          data: {
            bvn: '12345678901',
            firstName: 'Jane',
            lastName: 'Doe',
            dob: '1990-01-01T00:00:00.000Z',
            phone: '08012345678',
          },
        }));
        return;
      }
      if (request.url === '/api/account/name-enquiry/1234567890') {
        assert.equal(request.headers.authorization, 'Bearer jwt-token');
        response.end(JSON.stringify({ accountName: 'Test User', accountNumber: '1234567890', bankCode: '260' }));
        return;
      }
      if (request.url === '/api/transfer') {
        assert.equal(request.headers.authorization, 'Bearer jwt-token');
        response.end(JSON.stringify({ message: 'Transfer successful', transactionId: 'TX1', amount: 10, from: '1234567890', to: '1234567891', status: 'SUCCESS' }));
        return;
      }
      if (request.url === '/api/transaction/TX1') {
        assert.equal(request.headers.authorization, 'Bearer jwt-token');
        response.end(JSON.stringify({ transactionId: 'TX1', status: 'SUCCESS', amount: 10, from: '1234567890', to: '1234567891', timestamp: '2026-08-29T00:00:00Z' }));
        return;
      }
      response.statusCode = 404;
      response.end(JSON.stringify({ message: 'not found' }));
    });
  });
  return new Promise((resolve) => server.listen(0, () => resolve({ server, requests, port: server.address().port })));
}

(async () => {
  const { server, requests, port } = await startStub();
  const client = createNIBSSClient({ baseURL: `http://127.0.0.1:${port}`, timeout: 50 });
  try {
    assert.equal((await onboardFintech({ name: 'Test Bank', email: 'test@example.com' }, client)).bankCode, '260');
    assert.equal((await authenticateFintech({ apiKey: 'key', apiSecret: 'secret' }, client)).token, 'jwt-token');
    assert.equal((await insertBvn({ bvn: '12345678901' }, client)).valid, true);
    assert.equal((await insertNin({ nin: '12345678901' }, client)).valid, true);
    assert.equal((await validateBvn('12345678901', client)).valid, true);
    assert.equal((await validateNin('12345678901', client)).valid, true);
    assert.equal((await nameEnquiry('1234567890', 'jwt-token', client)).bankCode, '260');
    assert.equal((await transfer({ from: '1234567890', to: '1234567891', amount: '10' }, 'jwt-token', client)).transactionId, 'TX1');
    assert.equal((await transactionStatus('TX1', 'jwt-token', client)).status, 'SUCCESS');
    assert.ok(requests.some((request) => request.url === '/api/account/name-enquiry/1234567890'));
    assert.ok(!requests.some((request) => request.url.includes('nameenquiry')));

    await assert.rejects(() => client.request({ method: 'GET', url: '/http-error' }), (error) => error instanceof NIBSSIntegrationError && error.statusCode === 401);
    await assert.rejects(() => nameEnquiry('malformed', 'jwt-token', {
      request: () => client.request({ method: 'GET', url: '/malformed', token: 'jwt-token' }),
    }), (error) => error.statusCode === 502);
    await assert.rejects(() => client.request({ method: 'GET', url: '/timeout' }), (error) => error instanceof NIBSSIntegrationError && error.statusCode === 504);
    await assert.rejects(() => createNIBSSClient({ baseURL: 'http://127.0.0.1:1', timeout: 1000 }).request({ method: 'GET', url: '/unavailable' }), (error) => error instanceof NIBSSIntegrationError && error.statusCode === 503);
    console.log('Phase 4 NIBSS integration validation passed');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
