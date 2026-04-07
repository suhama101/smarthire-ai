# Next.js Configuration Guide

This document explains the technical purpose and functionality of the Next.js config in this project.

Source file: frontend/next.config.mjs

## Current Config

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
};

export default nextConfig;
```

## What Each Setting Does

### reactStrictMode: true

Purpose:
- Enables React Strict Mode in development.

Functionality:
- Helps detect unsafe React patterns.
- Highlights side-effect issues by intentionally re-running some lifecycle logic in development.
- Encourages code that is resilient for concurrent rendering.

Technical impact:
- Development only behavior checks are stricter.
- Production output is not directly slowed by Strict Mode.

Why this is good for this project:
- Helps catch UI state bugs early in the SmartHire frontend.

---

### poweredByHeader: false

Purpose:
- Removes the X-Powered-By: Next.js HTTP response header.

Functionality:
- Slight security hardening by avoiding framework fingerprint exposure.

Technical impact:
- No functional feature change for users.
- Reduces unnecessary response metadata.

Why this is good for this project:
- Cleaner and safer production responses.

---

### compress: true

Purpose:
- Enables gzip compression for responses served by Next.js.

Functionality:
- Shrinks payload size for HTML, JS, CSS, and some text responses.
- Improves bandwidth usage and often improves load performance.

Technical impact:
- Better transfer efficiency.
- Small CPU overhead for compression on server side.

Why this is good for this project:
- Faster delivery of dashboard pages and frontend assets.

## How This Fits SmartHire Architecture

- Frontend framework: Next.js (App Router).
- Backend API: Express service in a separate backend folder.
- Frontend calls API using NEXT_PUBLIC_API_URL from environment variables.

This config file controls frontend runtime behavior, not backend API routing logic.

## Common Extensions You May Add Later

### 1) API rewrites (if you want frontend and backend under one domain path)

```js
async rewrites() {
  return [
    {
      source: '/api/:path*',
      destination: `${process.env.NEXT_PUBLIC_API_URL}/api/:path*`,
    },
  ];
}
```

Use this when:
- You want to call relative /api URLs from the browser.

### 2) Remote image domains

```js
images: {
  remotePatterns: [
    { protocol: 'https', hostname: 'images.unsplash.com' },
  ],
},
```

Use this when:
- You load external images with Next Image component.

### 3) Security headers

```js
async headers() {
  return [
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      ],
    },
  ];
}
```

Use this when:
- You want stronger frontend HTTP security policy.

## Developer Notes

- File format is ESM (.mjs), so use export default.
- Keep config minimal unless a real requirement appears.
- After changes, restart dev server to ensure config is reloaded.

## Quick Verification Checklist

After changing next.config.mjs:

1. Run frontend dev server.
2. Open browser and verify app loads.
3. Check network headers for X-Powered-By (should be absent).
4. Confirm no unexpected build warnings.
