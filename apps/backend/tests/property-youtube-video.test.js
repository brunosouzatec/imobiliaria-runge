const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const YouTubeVideo = require('../../../packages/shared/youtube-video');
const migration = require('../migrations/021_property_youtube_video');

const projectRoot = path.resolve(__dirname, '../../..');
const server = fs.readFileSync(path.join(projectRoot, 'apps/backend/src/server.js'), 'utf8');
const app = fs.readFileSync(path.join(projectRoot, 'apps/frontend/public/vue-app.js'), 'utf8');
const detailHtml = fs.readFileSync(path.join(projectRoot, 'apps/frontend/public/imovel.html'), 'utf8');
const styles = fs.readFileSync(path.join(projectRoot, 'apps/frontend/public/react-pages.css'), 'utf8');

test('extracts YouTube IDs from supported video link formats', () => {
  const id = 'dQw4w9WgXcQ';
  for (const url of [
    `https://www.youtube.com/watch?v=${id}&t=30`,
    `https://youtu.be/${id}?si=share`,
    `https://youtube.com/shorts/${id}`,
    `https://youtube.com/live/${id}`,
    `https://www.youtube-nocookie.com/embed/${id}`,
    `youtu.be/${id}`
  ]) assert.equal(YouTubeVideo.extractId(url), id, url);
});

test('rejects non-YouTube domains, unsafe protocols and malformed video IDs', () => {
  for (const url of [
    'https://example.com/watch?v=dQw4w9WgXcQ',
    'https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ',
    'https://evil.youtube.com/watch?v=dQw4w9WgXcQ',
    'javascript:alert(1)',
    'https://youtube.com/watch?v=short',
    'not a URL'
  ]) assert.equal(YouTubeVideo.extractId(url), null, url);
  assert.equal(YouTubeVideo.isValidInput(''), true);
  assert.equal(YouTubeVideo.isValidInput('https://example.com/video'), false);
});

test('builds only privacy-enhanced embed links from valid IDs', () => {
  assert.equal(YouTubeVideo.embedUrl('dQw4w9WgXcQ'), 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0');
  assert.equal(YouTubeVideo.embedUrl('invalid'), '');
});

test('YouTube video migration adds a nullable field and is repeat-safe', async () => {
  const statements = [];
  await migration.up({ query: async sql => { statements.push(sql); return [[{ total: 0 }]]; } });
  assert.match(statements[1], /ADD COLUMN youtube_video_id VARCHAR\(11\) NULL/);

  const repeatStatements = [];
  await migration.up({ query: async sql => { repeatStatements.push(sql); return [[{ total: 1 }]]; } });
  assert.equal(repeatStatements.length, 1);
});

test('optional YouTube link is validated, stored, editable and rendered only on property details', () => {
  assert.match(server, /YouTubeVideo\.isValidInput\(data\.video_youtube_url\)/);
  assert.match(server, /youtube_video_id=\?/);
  assert.match(server, /YouTubeVideo\.extractId\(d\.video_youtube_url\)/);
  assert.match(server, /youtube_video_id: YouTubeVideo\.isVideoId\(row\.youtube_video_id\)/);
  assert.match(app, /video_youtube_url/);
  assert.match(app, /YouTubeVideo\.watchUrl\(found\.youtube_video_id\)/);
  assert.match(app, /YouTubeVideo\.embedUrl\(item\.value\?\.youtube_video_id\)/);
  assert.match(app, /property-detail-video-section/);
  assert.match(app, /loading="lazy" referrerpolicy="strict-origin-when-cross-origin"/);
  assert.match(detailHtml, /shared\/youtube-video\.js/);
  assert.match(styles, /\.property-youtube-frame iframe/);
});

test('property creation uses the insert helper return value without destructuring', () => {
  assert.equal((server.match(/const result = await insertPropertyWithOwnerTerms\(/g) || []).length, 2);
  assert.doesNotMatch(server, /const \[result\] = await insertPropertyWithOwnerTerms\(/);
});
