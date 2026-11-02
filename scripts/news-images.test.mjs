import test from 'node:test';
import assert from 'node:assert/strict';
import { enrichStoryImage, parseFeedImage, parseStoryImage } from '../src/news-images.mjs';
import { parseRSS } from '../src/daily.mjs';
import { renderNewsVisual, newsFallback } from '../src/client/news-visual.js';

const url = 'https://techcrunch.com/2026/11/02/story/';
test('publisher metadata handles different attribute orders, relative images, and escaped query strings', () => {
  const result = parseStoryImage(
    `<meta content='/photos/a.jpg?size=900&AMP;fit=crop' PROPERTY='og:image'><meta property="og:image:alt" content="A scientist &amp; a telescope">`,
    url,
  );
  assert.equal(result.image, 'https://techcrunch.com/photos/a.jpg?size=900&fit=crop');
  assert.equal(result.imageAlt, 'A scientist & a telescope');
  assert.equal(
    parseStoryImage('<meta name="twitter:image" content="https://cdn.example.org/photo.jpg">', url)
      .image,
    'https://cdn.example.org/photo.jpg',
  );
});
test('unsafe image schemes and publisher logos fall back to another usable image', () => {
  assert.equal(
    parseStoryImage('<meta property="og:image" content="javascript:alert(1)">', url).image,
    '',
  );
  assert.equal(
    parseStoryImage('<meta property="og:image" content="http://example.org/a.jpg">', url).image,
    '',
  );
  assert.equal(
    parseStoryImage(
      '<meta property="og:image" content="/default-social.jpg"><meta name="twitter:image" content="/actual.jpg">',
      url,
    ).image,
    'https://techcrunch.com/actual.jpg',
  );
});
test('RSS thumbnails are extracted without mistaking video enclosures for images', () => {
  assert.equal(
    parseFeedImage('<media:thumbnail url="https://cdn.example.org/story.jpg"/>', url),
    'https://cdn.example.org/story.jpg',
  );
  assert.equal(
    parseFeedImage('<enclosure url="https://cdn.example.org/video.mp4" type="video/mp4"/>', url),
    '',
  );
  assert.equal(
    parseFeedImage(
      '<media:content url="https://cdn.example.org/video.mp4" type="video/mp4"/>',
      url,
    ),
    '',
  );
  const stories = parseRSS(
    '<rss><item><title>Discovery</title><link>' +
      url +
      '</link><description><![CDATA[<img src="https://cdn.example.org/photo.jpg">A discovery.]]></description></item></rss>',
  );
  assert.equal(stories[0].image, 'https://cdn.example.org/photo.jpg');
  assert.equal(stories[0].description, 'A discovery.');
});
test('a missing or inaccessible thumbnail never removes a valid news story', async () => {
  const previous = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    throw Error('Unavailable');
  };
  try {
    const story = { url, title: 'A discovery', source: 'TechCrunch' };
    const result = await enrichStoryImage(story);
    assert.equal(result.title, story.title);
    assert.equal(result.image, '');
    assert.equal(calls, 1);
    const withImage = await enrichStoryImage({
      ...story,
      image: 'https://cdn.example.org/from-feed.jpg',
    });
    assert.equal(calls, 1);
    assert.equal(withImage.imageAttribution, 'Image via TechCrunch');
  } finally {
    globalThis.fetch = previous;
  }
});
test('card imagery follows the article image and uses a clearly labeled neutral fallback', () => {
  const first = renderNewsVisual('science', {
    url: 'https://example.org/one',
    title: 'First',
    image: 'https://cdn.example.org/one.jpg',
  });
  const second = renderNewsVisual('science', {
    url: 'https://example.org/two',
    title: 'Second',
    image: 'https://cdn.example.org/two.jpg',
  });
  assert.ok(first.includes('one.jpg') && !first.includes('two.jpg'));
  assert.ok(second.includes('two.jpg') && !second.includes('one.jpg'));
  const fallback = renderNewsVisual('tech', { url, title: 'A story' });
  assert.ok(fallback.includes('publisher image unavailable'));
  assert.ok(!fallback.includes('/assets/earth.jpg'));
  assert.notEqual(newsFallback('tech', 'one'), newsFallback('tech', 'two'));
});
