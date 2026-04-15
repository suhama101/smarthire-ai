const axios = require('axios');

const baseURL = String(process.env.API_BASE_URL || process.env.BACKEND_API_URL || process.env.BACKEND_URL || '').trim();

if (!baseURL) {
  throw new Error('Set API_BASE_URL or BACKEND_API_URL before running auth-api-test.js');
}
  .trim()
  .replace(/\/$/, '');

const email = String(process.env.TEST_EMAIL || `smarthire.test+${Date.now()}@example.com`).trim();
const password = String(process.env.TEST_PASSWORD || 'TestPass123!');
const fullName = String(process.env.TEST_FULL_NAME || 'SmartHire Test User');
const role = String(process.env.TEST_ROLE || 'candidate');

const client = axios.create({
  baseURL,
  timeout: 30000,
  validateStatus: () => true,
});

function printResponse(label, response) {
  console.log(`\n=== ${label} ===`);
  console.log(`Status: ${response.status}`);
  console.log(JSON.stringify(response.data, null, 2));
}

function printAxiosError(label, error) {
  console.log(`\n=== ${label} ===`);
  if (error.response) {
    console.log(`Status: ${error.response.status}`);
    console.log(JSON.stringify(error.response.data, null, 2));
    return;
  }

  console.log(error.message);
}

async function main() {
  console.log(`Base URL: ${baseURL}`);
  console.log(`Test email: ${email}`);

  let signupResponse;

  try {
    signupResponse = await client.post('/api/auth/signup', {
      email,
      password,
      full_name: fullName,
      role,
    });
    printResponse('Signup response', signupResponse);
  } catch (error) {
    printAxiosError('Signup request failed', error);
    throw error;
  }

  if (signupResponse.status >= 400 && signupResponse.status !== 409) {
    throw new Error('Signup did not succeed. Stopping before login.');
  }

  if (signupResponse.status === 409) {
    console.log('Signup returned 409 because the user already exists. Continuing to login.');
  }

  const loginResponse = await client.post('/api/auth/login', {
    email,
    password,
  });
  printResponse('Login response', loginResponse);

  if (loginResponse.status >= 400) {
    throw new Error('Login failed.');
  }

  const token = loginResponse.data?.token;
  if (!token) {
    throw new Error('Login response did not include a token.');
  }

  const profileResponse = await client.get('/api/auth/profile', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  printResponse('Profile response', profileResponse);
}

main().catch((error) => {
  console.error('\nScript failed:', error.message);
  process.exitCode = 1;
});