// SPDX-License-Identifier: Apache-2.0
/**
 * Load testing script using autocannon
 * Simulates realistic load on staging environment
 */

import autocannon from 'autocannon';
import logger from '@/lib/logger';

const DEFAULT_CONFIG = {
  url: 'http://localhost:3000',
  connections: 10,
  pipelining: 1,
  duration: 60,
  maxConnectionRequests: 50,
  timeout: 10,
  title: 'Narravo Load Test',
  headers: {
    'User-Agent': 'Narravo-LoadTest/1.0'
  },
  requests: [
    {
      method: 'GET' as const,
      path: '/',
      weight: 40
    },
    {
      method: 'GET' as const, 
      path: '/sample-post',
      weight: 30
    },
    {
      method: 'GET' as const,
      path: '/admin/dashboard',
      weight: 20,
      headers: {
        'Cookie': 'authjs.session-token=test-admin-token'
      }
    },
    {
      method: 'GET' as const,
      path: '/api/metrics/view',
      weight: 10
    }
  ]
};

/**
 * Run performance load test
 */
async function runLoadTest(options: Record<string, any> = {}) {
  logger.info('🚀 Starting load test...');
  logger.info(`Target: ${options.url || DEFAULT_CONFIG.url}`);
  logger.info(`Duration: ${options.duration || DEFAULT_CONFIG.duration}s`);
  logger.info(`Rate: ${options.overallRate || 50} req/s`);
  
  const config = { 
    ...DEFAULT_CONFIG, 
    ...options,
    // Set a default overallRate if not provided
    overallRate: options.overallRate || 50
  };
  
  try {
    const result = await autocannon(config);
    
    logger.info('\n📊 Load Test Results:');
    logger.info('====================');
    logger.info(`Requests/sec: ${result.requests.average}`);
    logger.info(`Latency p50: ${(result.latency as any).p50 || result.latency.mean}ms`);
    logger.info(`Latency p95: ${(result.latency as any).p95 || result.latency.max}ms`);
    logger.info(`Latency p99: ${(result.latency as any).p99 || result.latency.max}ms`);
    logger.info(`Throughput: ${(result.throughput.average / 1024 / 1024).toFixed(2)} MB/sec`);
    logger.info(`Errors: ${result.errors}`);
    logger.info(`Timeouts: ${result.timeouts}`);
    
    // Check against SLO targets
    const p95Target = 400; // 400ms p95 target for TTFB
    const errorRateTarget = 0.01; // 1% error rate max
    const errorRate = result.errors / result.requests.total;
    
    logger.info('\n🎯 SLO Validation:');
    logger.info('==================');
    const p95Latency = (result.latency as any).p95 || result.latency.max;
    logger.info(`P95 Latency: ${p95Latency}ms (target: <${p95Target}ms) ${p95Latency <= p95Target ? '✅' : '❌'}`);
    logger.info(`Error Rate: ${(errorRate * 100).toFixed(2)}% (target: <${(errorRateTarget * 100).toFixed(1)}%) ${errorRate <= errorRateTarget ? '✅' : '❌'}`);
    
    const passed = p95Latency <= p95Target && errorRate <= errorRateTarget;
    
    if (passed) {
      logger.info('\n✅ Load test PASSED - All SLOs met');
      return { success: true, result };
    } else {
      logger.warn('\n❌ Load test FAILED - SLO violations detected');
      return { success: false, result };
    }
    
  } catch (error) {
    logger.error('❌ Load test failed:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * CLI interface
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const options: Record<string, any> = {};
  
  // Parse simple CLI args
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]?.replace('--', '');
    const value = args[i + 1];
    if (key && value) {
      if (['duration', 'connections', 'overallRate', 'timeout'].includes(key)) {
        options[key] = parseInt(value, 10);
      } else {
        options[key] = value;
      }
    }
  }
  
  // Run the test
  runLoadTest(options).then(({ success }) => {
    process.exit(success ? 0 : 1);
  });
}

export { runLoadTest };