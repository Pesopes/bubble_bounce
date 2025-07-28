export class LocalStorageManager {
    /**
     * Saves a value to localStorage under a specific key.
     * The value will be JSON stringified.
     * @param key The key to save the value under.
     * @param value The value to save. Must be JSON serializable.
     * @returns True if successful, false otherwise.
     */
    public static set<T>(key: string, value: T): boolean {
        try {
            const serializedValue = JSON.stringify(value);
            localStorage.setItem(key, serializedValue);
            return true;
        } catch (error) {
            console.error(`Error saving to localStorage for key "${key}":`, error);
            return false;
        }
    }

    /**
     * Retrieves a value from localStorage.
     * @param key The key of the value to retrieve.
     * @param defaultValue The value to return if the key is not found or if parsing fails.
     * @returns The parsed value from localStorage, or the defaultValue.
     */
    public static get<T>(key: string, defaultValue?: T): T | null {
        try {
            const serializedValue = localStorage.getItem(key);
            if (serializedValue === null) {
                if (defaultValue === undefined) {
                    return null;
                }
                return defaultValue;
            }
            return JSON.parse(serializedValue) as T;
        } catch (error) {
            console.error(`Error reading from localStorage for key "${key}":`, error);
            if (defaultValue === undefined) {
                return null;
            }
            return defaultValue;
        }
    }

    /**
     * Removes an item from localStorage.
     * @param key The key of the item to remove.
     */
    public static remove(key: string): void {
        try {
            localStorage.removeItem(key);
        } catch (error) {
            console.error(`Error removing item from localStorage for key "${key}":`, error);
        }
    }
}
