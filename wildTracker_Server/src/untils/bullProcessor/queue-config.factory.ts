/* eslint-disable prettier/prettier */

import { WELCOME_QUEUE } from '../constants/constant';


export interface QueueSettings {
  stalledInterval: number;
  maxStalledCount: number;
}

export interface QueueJobOptions {
  removeOnComplete: number;
  removeOnFail: number;
  attempts: number;
  backoff: {
    type: string;
    delay: number;
  };
  delay: number;
  priority: number;
}

export interface QueueConfig {
  name: string;
  settings: QueueSettings;
  defaultJobOptions: QueueJobOptions;
}


export const BASE_QUEUE_CONFIG: Omit<QueueConfig, 'name'> = {
  settings: {
    stalledInterval: 30 * 1000,
    maxStalledCount: 1,
  },
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    delay: 0,
    priority: 1,
  },
};


export const QUEUE_CONFIGS: Record<string, QueueConfig> = {
  [WELCOME_QUEUE]: createQueueConfig(WELCOME_QUEUE, {
    defaultJobOptions: {
      ...BASE_QUEUE_CONFIG.defaultJobOptions,
      priority: 7, 
      removeOnComplete: 25, 
      attempts: 3, 
    },
  }),
};

/**
 * 
 * 
 * @param queueName 
 * @param overrides 
 * @returns 
 */
export function createQueueConfig(
  queueName: string, 
  overrides: Partial<Omit<QueueConfig, 'name'>> = {}
): QueueConfig {
  return {
    name: queueName,
    settings: {
      ...BASE_QUEUE_CONFIG.settings,
      ...overrides.settings,
    },
    defaultJobOptions: {
      ...BASE_QUEUE_CONFIG.defaultJobOptions,
      ...overrides.defaultJobOptions,
    },
  };
}


export function createHighPriorityQueueConfig(queueName: string) {
  return createQueueConfig(queueName, {
    defaultJobOptions: {
      ...BASE_QUEUE_CONFIG.defaultJobOptions,
      priority: 10,
      removeOnComplete: 50,
      attempts: 5, 
    },
  });
}


export function createLowPriorityQueueConfig(queueName: string) {
  return createQueueConfig(queueName, {
    defaultJobOptions: {
      ...BASE_QUEUE_CONFIG.defaultJobOptions,
      priority: 5,
      removeOnComplete: 100,
      attempts: 2, 
    },
  });
}


export function createBulkProcessingQueueConfig(queueName: string) {
  return createQueueConfig(queueName, {
    defaultJobOptions: {
      ...BASE_QUEUE_CONFIG.defaultJobOptions,
      priority: 1,
      removeOnComplete: 200, 
      attempts: 1, 
      delay: 1000, 
    },
  });
}

export function getAllQueueConfigs(): QueueConfig[] {
  return Object.values(QUEUE_CONFIGS);
}


export function addQueueConfig(
  queueName: string, 
  config: Partial<Omit<QueueConfig, 'name'>> = {}
): QueueConfig {
  const newConfig = createQueueConfig(queueName, config);
  QUEUE_CONFIGS[queueName] = newConfig;
  return newConfig;
}


