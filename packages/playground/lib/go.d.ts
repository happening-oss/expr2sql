declare module '*.go' {
    /**
     * Load the go application
     */
    export default function init(): Promise<void>;
}