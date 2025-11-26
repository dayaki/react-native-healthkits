import { NativeEventEmitter, Platform } from 'react-native';
import NativeHealthKits from './NativeHealthKits';
import { toISOString } from './utils/mappers';
import type {
  HealthDataType,
  HealthPermission,
  PermissionStatus,
  ReadOptions,
  WriteData,
  HealthData,
  HealthDataCallback,
  Subscription,
} from './types';
import { HealthKitError, HealthKitErrorCode } from './types';

// Re-export types
export * from './types';
export { getDefaultUnit } from './utils/units';
export {
  healthDataTypeToiOS,
  healthDataTypeToAndroid,
  workoutTypeToiOS,
  workoutTypeToAndroid,
} from './utils/mappers';

const eventEmitter = new NativeEventEmitter(NativeHealthKits);

/**
 * Map to store active subscriptions
 */
const activeSubscriptions = new Map<string, HealthDataCallback>();

/**
 * HealthKits - Unified health data access for React Native
 *
 * Provides a single API for accessing health data from both
 * iOS HealthKit and Android Health Connect.
 */
const HealthKits = {
  /**
   * Check if health data services are available on this device.
   *
   * On iOS, checks if HealthKit is available.
   * On Android, checks if Health Connect is installed and available.
   *
   * @returns Promise resolving to true if health services are available
   *
   * @example
   * ```typescript
   * const available = await HealthKits.isAvailable();
   * if (!available) {
   *   console.log('Health data not available on this device');
   * }
   * ```
   */
  async isAvailable(): Promise<boolean> {
    try {
      return await NativeHealthKits.isAvailable();
    } catch (error) {
      return false;
    }
  },

  /**
   * Request permissions for specified health data types.
   *
   * This will prompt the user to grant access to the requested data types.
   * On iOS, this opens the HealthKit permission sheet.
   * On Android, this opens the Health Connect permission dialog.
   *
   * @param permissions - Array of permission objects specifying type and access level
   * @returns Promise resolving to true if all permissions were granted
   *
   * @example
   * ```typescript
   * const granted = await HealthKits.requestPermissions([
   *   { type: 'steps', access: 'read' },
   *   { type: 'heartRate', access: 'read' },
   *   { type: 'weight', access: 'write' },
   * ]);
   * ```
   */
  async requestPermissions(permissions: HealthPermission[]): Promise<boolean> {
    try {
      const permissionsJson = JSON.stringify(permissions);
      return await NativeHealthKits.requestPermissions(permissionsJson);
    } catch (error) {
      throw wrapError(error);
    }
  },

  /**
   * Get the current authorization status for a specific data type.
   *
   * Note: On iOS, HealthKit does not reveal if permission was denied for privacy.
   * It will return 'notDetermined' even if the user denied access.
   *
   * @param dataType - The health data type to check
   * @param access - Whether to check 'read' or 'write' permission
   * @returns Promise resolving to the permission status
   *
   * @example
   * ```typescript
   * const status = await HealthKits.getPermissionStatus('steps', 'read');
   * if (status === 'authorized') {
   *   // Can read steps data
   * }
   * ```
   */
  async getPermissionStatus(
    dataType: HealthDataType,
    access: 'read' | 'write' = 'read'
  ): Promise<PermissionStatus> {
    try {
      const status = await NativeHealthKits.getPermissionStatus(dataType, access);
      return status as PermissionStatus;
    } catch (error) {
      throw wrapError(error);
    }
  },

  /**
   * Read health data based on provided options.
   *
   * @param options - Query options including type, date range, and optional aggregation
   * @returns Promise resolving to array of health records
   *
   * @example
   * ```typescript
   * // Read steps for the last 7 days
   * const steps = await HealthKits.readData({
   *   type: 'steps',
   *   startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
   *   endDate: new Date(),
   * });
   *
   * // Read aggregated daily steps
   * const dailySteps = await HealthKits.readData({
   *   type: 'steps',
   *   startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
   *   endDate: new Date(),
   *   aggregate: true,
   *   aggregateInterval: 'day',
   * });
   * ```
   */
  async readData(options: ReadOptions): Promise<HealthData[]> {
    try {
      const normalizedOptions = {
        ...options,
        startDate: toISOString(options.startDate),
        endDate: toISOString(options.endDate),
      };
      const optionsJson = JSON.stringify(normalizedOptions);
      const resultJson = await NativeHealthKits.readData(optionsJson);
      return JSON.parse(resultJson) as HealthData[];
    } catch (error) {
      throw wrapError(error);
    }
  },

  /**
   * Write health data.
   *
   * @param data - Health data to write
   * @returns Promise resolving to true if write was successful
   *
   * @example
   * ```typescript
   * // Write weight data
   * await HealthKits.writeData({
   *   type: 'weight',
   *   value: 70.5,
   *   unit: 'kg',
   *   date: new Date(),
   * });
   *
   * // Write a workout
   * await HealthKits.writeData({
   *   type: 'workout',
   *   workoutType: 'running',
   *   date: new Date(Date.now() - 60 * 60 * 1000),
   *   endDate: new Date(),
   *   totalEnergyBurned: 500,
   *   totalDistance: 5000,
   * });
   * ```
   */
  async writeData(data: WriteData): Promise<boolean> {
    try {
      const normalizedData = {
        ...data,
        date: toISOString(data.date),
        ...(('endDate' in data && data.endDate) ? { endDate: toISOString(data.endDate) } : {}),
      };
      const dataJson = JSON.stringify(normalizedData);
      return await NativeHealthKits.writeData(dataJson);
    } catch (error) {
      throw wrapError(error);
    }
  },

  /**
   * Subscribe to real-time updates for a specific health data type.
   *
   * On iOS, this uses HKObserverQuery to receive background updates.
   * On Android, this uses Health Connect's change notifications.
   *
   * @param dataType - The health data type to subscribe to
   * @param callback - Function called when new data is available
   * @returns Subscription object with remove() method to unsubscribe
   *
   * @example
   * ```typescript
   * const subscription = HealthKits.subscribeToUpdates('steps', (data) => {
   *   console.log('New steps data:', data);
   * });
   *
   * // Later, to unsubscribe:
   * subscription.remove();
   * ```
   */
  subscribeToUpdates(
    dataType: HealthDataType,
    callback: HealthDataCallback
  ): Subscription {
    const eventName = `HealthKits_${dataType}_update`;

    // Store callback for this data type
    activeSubscriptions.set(dataType, callback);

    // Set up event listener
    const subscription = eventEmitter.addListener(eventName, (event: { data: string }) => {
      try {
        const data = JSON.parse(event.data) as HealthData[];
        callback(data);
      } catch (error) {
        console.error('Failed to parse health data update:', error);
      }
    });

    // Start native subscription
    NativeHealthKits.subscribeToUpdates(dataType).catch((error) => {
      console.error('Failed to subscribe to updates:', error);
    });

    return {
      remove: () => {
        subscription.remove();
        activeSubscriptions.delete(dataType);
        NativeHealthKits.unsubscribeFromUpdates(dataType).catch((error) => {
          console.error('Failed to unsubscribe from updates:', error);
        });
      },
    };
  },

  /**
   * Open Health Connect settings on Android.
   * On iOS, this is a no-op as HealthKit permissions are managed in Settings app.
   *
   * @example
   * ```typescript
   * if (Platform.OS === 'android') {
   *   await HealthKits.openHealthConnectSettings();
   * }
   * ```
   */
  async openHealthConnectSettings(): Promise<void> {
    if (Platform.OS === 'android') {
      await NativeHealthKits.openHealthConnectSettings();
    }
  },
};

/**
 * Wrap native errors in HealthKitError
 */
function wrapError(error: unknown): HealthKitError {
  if (error instanceof HealthKitError) {
    return error;
  }

  if (error instanceof Error) {
    // Try to parse error code from native error message
    const message = error.message;

    if (message.includes('NOT_AVAILABLE') || message.includes('not available')) {
      return new HealthKitError(HealthKitErrorCode.NOT_AVAILABLE, message);
    }
    if (message.includes('PERMISSION_DENIED') || message.includes('permission denied')) {
      return new HealthKitError(HealthKitErrorCode.PERMISSION_DENIED, message);
    }
    if (message.includes('HEALTH_CONNECT_NOT_INSTALLED')) {
      return new HealthKitError(HealthKitErrorCode.HEALTH_CONNECT_NOT_INSTALLED, message);
    }
    if (message.includes('UNSUPPORTED')) {
      return new HealthKitError(HealthKitErrorCode.UNSUPPORTED_DATA_TYPE, message);
    }
    if (message.includes('INVALID')) {
      return new HealthKitError(HealthKitErrorCode.INVALID_PARAMETERS, message);
    }

    return new HealthKitError(HealthKitErrorCode.UNKNOWN, message);
  }

  return new HealthKitError(HealthKitErrorCode.UNKNOWN, String(error));
}

export default HealthKits;
