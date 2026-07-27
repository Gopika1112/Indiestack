import http from 'k6/http';
import { check } from 'k6';
import { Trend } from 'k6/metrics';

// Image upload stress test for 40k daily posts with images
const uploadTime = new Trend('image_upload_time');

export const options = {
  stages: [
    // Simulate 40k posts/day with 2 images each = 80k images/day
    // ~55 images/minute average
    // Peak: 100 posts/minute = 200 images/minute
    { duration: '5m', target: 10 },    // Normal: 10 concurrent uploads
    { duration: '10m', target: 20 },   // Peak: 20 concurrent uploads
    { duration: '5m', target: 10 },    // Back to normal
    { duration: '5m', target: 0 },     // Cool down
  ],
  thresholds: {
    http_req_duration: ['p(95)<5000'], // 5s max for uploads
    image_upload_time: ['p(95)<3000'], // 3s target
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || '';

// Generate dummy image data
function generateImageData(size) {
  const buffer = new ArrayBuffer(size);
  const view = new Uint8Array(buffer);
  
  // JPEG header
  view[0] = 0xFF;
  view[1] = 0xD8;
  view[2] = 0xFF;
  view[3] = 0xE0;
  
  // Fill with random data
  for (let i = 4; i < size; i++) {
    view[i] = Math.floor(Math.random() * 256);
  }
  
  // JPEG footer
  view[size - 2] = 0xFF;
  view[size - 1] = 0xD9;
  
  return buffer;
}

const IMAGE_SIZES = [
  { name: 'thumbnail.jpg', size: 50 * 1024 },      // 50KB - thumbnails
  { name: 'small.jpg', size: 200 * 1024 },         // 200KB - small images
  { name: 'medium.jpg', size: 1024 * 1024 },       // 1MB - standard images
  { name: 'large.jpg', size: 3 * 1024 * 1024 },    // 3MB - large images
  { name: 'hero.jpg', size: 5 * 1024 * 1024 },     // 5MB - hero images
];

export default function () {
  // Weighted distribution matching real usage
  // 50% small, 30% medium, 15% large, 5% hero
  const rand = Math.random();
  let image;
  if (rand < 0.5) {
    image = IMAGE_SIZES[1]; // small
  } else if (rand < 0.8) {
    image = IMAGE_SIZES[2]; // medium
  } else if (rand < 0.95) {
    image = IMAGE_SIZES[3]; // large
  } else {
    image = IMAGE_SIZES[4]; // hero
  }

  const imageData = generateImageData(image.size);
  
  const uploadStart = Date.now();
  
  const res = http.post(
    `${BASE_URL}/api/v1/upload`,
    {
      file: http.file(imageData, image.name, 'image/jpeg'),
    },
    {
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
      },
      timeout: '30s',
    }
  );
  
  uploadTime.add(Date.now() - uploadStart);

  check(res, {
    'upload successful': (r) => r.status === 200,
    'upload time < 5s': (r) => r.timings.duration < 5000,
    'has url in response': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.data && body.data.url;
      } catch (e) {
        return false;
      }
    },
  });

  // Images are expensive - longer think time
  sleep(Math.random() * 5 + 5); // 5-10 seconds between uploads
}

export function handleSummary(data) {
  const totalBytes = data.metrics.http_reqs.values.count * 
    IMAGE_SIZES.reduce((acc, img) => acc + img.size, 0) / IMAGE_SIZES.length;
  
  return {
    'upload-stress-summary.json': JSON.stringify({
      total_requests: data.metrics.http_reqs.values.count,
      avg_upload_time_ms: data.metrics.image_upload_time.values.avg,
      p95_upload_time_ms: data.metrics.image_upload_time.values['p(95)'],
      estimated_daily_throughput_gb: (totalBytes * 144) / (1024 * 1024 * 1024), // Extrapolate to 24h
    }),
  };
}
