# Web Vitals Monitoring Script
# Uses Google PageSpeed Insights API to check LCP, CLS, and FID
# Usage: node scripts/web-vitals.mjs --url <url> --key <api-key>
#        node scripts/web-vitals.mjs --url <url> --key <api-key> --threshold <lcp:2.5,cls:0.1,fid:100>

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const outDir = path.join(rootDir, 'dist');

const args = process.argv.slice(2);
let siteUrl = '';
let apiKey = '';
let thresholds = { lcp: 2.5, cls: 0.1, fid: 100 };

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--url' && args[i + 1]) {
    siteUrl = args[i + 1];
    i++;
  } else if (args[i] === '--key' && args[i + 1]) {
    apiKey = args[i + 1];
    i++;
  } else if (args[i] === '--threshold' && args[i + 1]) {
    const parts = args[i + 1].split(',');
    parts.forEach(part => {
      const [key, value] = part.split(':');
      if (key && value) {
        thresholds[key] = parseFloat(value);
      }
    });
    i++;
  }
}

// Default to GitHub Pages URL if not provided
if (!siteUrl) {
  siteUrl = 'https://alex-shen1121.github.io/personal-blog/';
}

console.log(`🔍 Running Web Vitals check for: ${siteUrl}`);
console.log(`📊 Thresholds: LCP <= ${thresholds.lcp}s, CLS <= ${thresholds.cls}, FID <= ${thresholds.fid}ms\n`);

const checkWebVitals = async () => {
  if (!apiKey) {
    console.log('⚠️  No API key provided. To run Web Vitals checks:');
    console.log('   1. Get a Google PageSpeed Insights API key from:');
    console.log('      https://developers.google.com/speed/docs/insights/v5/get-started');
    console.log('   2. Run: node scripts/web-vitals.mjs --url <url> --key <your-api-key>');
    console.log('   3. Or set PSI_API_KEY in GitHub Secrets');
    return null;
  }

  const PSI_API = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';
  const url = `${PSI_API}?url=${encodeURIComponent(siteUrl)}&key=${apiKey}&strategy=mobile&category=PERFORMANCE`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Extract metrics
    const lighthouseResult = data.lighthouseResult;
    const audits = lighthouseResult.audits;
    
    const metrics = {
      lcp: {
        value: audits['largest-contentful-paint']?.numericValue / 1000 || 0,
        displayValue: audits['largest-contentful-paint']?.displayValue || 'N/A',
        score: audits['largest-contentful-paint']?.score || 0
      },
      cls: {
        value: audits['cumulative-layout-shift']?.numericValue || 0,
        displayValue: audits['cumulative-layout-shift']?.displayValue || 'N/A',
        score: audits['cumulative-layout-shift']?.score || 0
      },
      fid: {
        value: audits['max-potential-fid']?.numericValue || 0,
        displayValue: audits['max-potential-fid']?.displayValue || 'N/A',
        score: audits['max-potential-fid']?.score || 0
      },
      fcp: {
        value: audits['first-contentful-paint']?.numericValue / 1000 || 0,
        displayValue: audits['first-contentful-paint']?.displayValue || 'N/A',
        score: audits['first-contentful-paint']?.score || 0
      },
      tti: {
        value: audits['interactive']?.numericValue / 1000 || 0,
        displayValue: audits['interactive']?.displayValue || 'N/A',
        score: audits['interactive']?.score || 0
      },
      performanceScore: lighthouseResult.categories?.performance?.score * 100 || 0
    };
    
    return metrics;
  } catch (error) {
    console.error('✗ Error running Web Vitals check:', error.message);
    return null;
  }
};

const formatMetric = (metric, threshold, unit = 's') => {
  const passed = metric.value <= threshold;
  const symbol = passed ? '✓' : '✗';
  return `${symbol} ${metric.displayValue} (threshold: ${threshold}${unit})`;
};

const runWebVitalsCheck = async () => {
  const metrics = await checkWebVitals();
  
  if (!metrics) {
    // Write placeholder results
    writeFileSync(
      path.join(outDir, 'web-vitals.json'),
      JSON.stringify({ status: 'skipped', reason: 'No API key provided' }, null, 2)
    );
    return;
  }
  
  // Check thresholds
  const results = {
    status: 'passed',
    timestamp: new Date().toISOString(),
    url: siteUrl,
    metrics: {
      lcp: { ...metrics.lcp, threshold: thresholds.lcp, passed: metrics.lcp.value <= thresholds.lcp },
      cls: { ...metrics.cls, threshold: thresholds.cls, passed: metrics.cls.value <= thresholds.cls },
      fid: { ...metrics.fid, threshold: thresholds.fid, passed: metrics.fid.value <= thresholds.fid },
      fcp: metrics.fcp,
      tti: metrics.tti,
      performanceScore: metrics.performanceScore
    }
  };
  
  if (!results.metrics.lcp.passed || !results.metrics.cls.passed || !results.metrics.fid.passed) {
    results.status = 'failed';
  }
  
  // Output results
  console.log('📊 Web Vitals Results:\n');
  console.log(`   LCP (Largest Contentful Paint): ${formatMetric(metrics.lcp, thresholds.lcp)}`);
  console.log(`   CLS (Cumulative Layout Shift): ${formatMetric(metrics.cls, thresholds.cls, '')}`);
  console.log(`   FID (First Input Delay):       ${formatMetric(metrics.fid, thresholds.fid, 'ms')}`);
  console.log(`   FCP (First Contentful Paint):  ${metrics.fcp.displayValue}`);
  console.log(`   TTI (Time to Interactive):     ${metrics.tti.displayValue}`);
  console.log(`\n   Overall Performance Score: ${metrics.performanceScore.toFixed(0)}/100`);
  console.log(`\n   Status: ${results.status === 'passed' ? '✓ All metrics passed' : '✗ Some metrics failed'}\n`);
  
  // Write results to file
  writeFileSync(
    path.join(outDir, 'web-vitals.json'),
    JSON.stringify(results, null, 2)
  );
  
  if (results.status === 'failed') {
    console.log('⚠️  Some Web Vitals metrics failed to meet thresholds.');
    console.log('   This may affect user experience and SEO.');
  }
};

runWebVitalsCheck();
