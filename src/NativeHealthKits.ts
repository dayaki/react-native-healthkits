import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

/**
 * Native module specification for Turbo Modules
 * This interface defines the contract between JS and native code
 */
export interface Spec extends TurboModule {
  /**
   * Check if health data services are available on this device
   */
  isAvailable(): Promise<boolean>;

  /**
   * Request permissions for specified health data types
   * @param permissions - Array of permission objects as JSON string
   * @returns Promise resolving to true if all permissions granted
   */
  requestPermissions(permissions: string): Promise<boolean>;

  /**
   * Get the current authorization status for a specific data type
   * @param dataType - The health data type to check
   * @param accessType - 'read' or 'write'
   * @returns Promise resolving to permission status string
   */
  getPermissionStatus(dataType: string, accessType: string): Promise<string>;

  /**
   * Read health data based on provided options
   * @param options - Query options as JSON string
   * @returns Promise resolving to array of health records as JSON string
   */
  readData(options: string): Promise<string>;

  /**
   * Write health data
   * @param data - Health data to write as JSON string
   * @returns Promise resolving to true if write successful
   */
  writeData(data: string): Promise<boolean>;

  /**
   * Subscribe to real-time updates for a data type
   * @param dataType - The health data type to subscribe to
   * @returns Promise resolving to subscription ID
   */
  subscribeToUpdates(dataType: string): Promise<string>;

  /**
   * Unsubscribe from real-time updates
   * @param subscriptionId - The subscription ID to remove
   */
  unsubscribeFromUpdates(subscriptionId: string): Promise<void>;

  /**
   * Open Health Connect settings (Android only)
   * On iOS, this is a no-op
   */
  openHealthConnectSettings(): Promise<void>;

  /**
   * Add event listener for native events
   */
  addListener(eventName: string): void;

  /**
   * Remove event listeners
   */
  removeListeners(count: number): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('HealthKits');
