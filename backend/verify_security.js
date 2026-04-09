// セキュリティ検証スクリプト。サーバーのバリデーションが正しく機能しているかをテストします。

const fetch = require('node-fetch');
const { spawn } = require('child_process');
const path = require('path');

const BASE_URL = 'http://localhost:3000/api/posts';

async function testValidation() {
  console.log('Testing Validation...');

  try {
    // Case 1: Empty name
    const res1 = await fetch(BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '', content: 'Test content', device_id: 'test-device' })
    });

    if (res1.status === 400) {
      console.log('✅ Empty name rejected (400)');
    } else {
      console.error(`❌ Empty name failed: ${res1.status}`);
      const json = await res1.json();
      console.log(json);
    }

    // Case 2: Long name
    const longName = 'a'.repeat(21);
    const res2 = await fetch(BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: longName, content: 'Test content', device_id: 'test-device' })
    });

    if (res2.status === 400) {
      console.log('✅ Long name rejected (400)');
    } else {
      console.error(`❌ Long name failed: ${res2.status}`);
    }
  } catch (err) {
    console.error('Test execution failed:', err);
  }
}

async function run() {
  console.log('Starting server...');
  const serverProcess = spawn('node', ['app.js'], {
    cwd: path.join(__dirname),
    stdio: 'inherit' // Pipe output to parent
  });

  // Wait for server to start
  await new Promise(resolve => setTimeout(resolve, 3000));

  try {
    await testValidation();
  } catch (e) {
    console.error(e);
  } finally {
    console.log('Stopping server...');
    serverProcess.kill();
  }
}

run();